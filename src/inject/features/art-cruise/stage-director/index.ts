import { ENEMY_MAX_COUNT } from "../constants";
import {
  ART_CRUISE_STAGE_BALANCE,
  canSpawnBossWave,
  getRequiredWavesBeforeBoss,
} from "./config";
import {
  ART_CRUISE_AFTER_BOSS_FORMATION,
  getRepresentativeBulletPatterns,
  pickGruntLevelPool,
} from "./grunt-level-config";
import type { ArtCruiseGruntFormationConfig } from "./grunt-level-config";
import {
  ALL_GRUNT_FORMATION_IDS,
  GRUNT_FORMATION_BUILDERS,
} from "./grunt-formations";
import type { GruntFormationId } from "./grunt-formations";
import { buildBossSpawn, buildFormationSpawns } from "./modules";
import type {
  ArtCruiseDebugWaveOption,
  ArtCruiseStageContext,
  ArtCruiseStageSpawn,
} from "./types";

type QueuedSpawn = ArtCruiseStageSpawn & {
  readyAt: number;
};

type StageDirectorOptions = {
  maxEnemies?: number;
};

const BOSS_MODULE_ID = "boss";

const pickRandom = <T>(items: T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export class ArtCruiseStageDirector {
  private readonly maxEnemies: number;
  private readonly queue: QueuedSpawn[] = [];
  private level: number = ART_CRUISE_STAGE_BALANCE.initialLevel;
  private sinceBoss = 0;
  private nextReadyBaseAt = 0;
  private lastModuleId = "";
  private forcedModuleId: string | null = null;
  private modulesSinceBreather = 0;
  // grunt formation 全滅待ちゲート。
  // 直前に積んだ grunt 波の敵が全滅するまで次を出さず、全滅後に clearGapMs だけ猶予を置く。
  private clearGateGapMs = 0;
  private clearGateReleaseAt = 0;

  constructor(options: StageDirectorOptions = {}) {
    this.maxEnemies = options.maxEnemies ?? ENEMY_MAX_COUNT;
  }

  reset = (options: { level?: number } = {}) => {
    this.queue.length = 0;
    this.level = options.level ?? ART_CRUISE_STAGE_BALANCE.initialLevel;
    this.sinceBoss = 0;
    this.nextReadyBaseAt = 0;
    this.lastModuleId = "";
    this.forcedModuleId = null;
    this.modulesSinceBreather = 0;
    this.clearGateGapMs = 0;
    this.clearGateReleaseAt = 0;
  };

  getState = () => ({
    level: this.level,
    sinceBoss: this.sinceBoss,
    requiredWavesBeforeBoss: getRequiredWavesBeforeBoss(this.level),
    lastModuleId: this.lastModuleId,
  });

  forceNextModule = (moduleId: string) => {
    this.forcedModuleId = moduleId;
  };

  runModule = (moduleId: string) => {
    this.queue.length = 0;
    this.forcedModuleId = moduleId;
    this.nextReadyBaseAt = 0;
  };

  pauseAfterBossDefeat = (now: number) => {
    this.queue.length = 0;
    this.nextReadyBaseAt = Math.max(
      this.nextReadyBaseAt,
      now + ART_CRUISE_STAGE_BALANCE.bossDefeatRestMs,
    );
  };

  addBossDefeatLevel = () => {
    this.level += 1;
  };

  pauseForBossPhaseTransition = (now: number, durationMs: number) => {
    this.nextReadyBaseAt = Math.max(this.nextReadyBaseAt, now + durationMs);
  };

  // デバッグ用: 全フォーメーション id 一覧(level 非依存)(+ boss)。
  // 1つずつ個別に試せるよう、プール未登録のものも含めて列挙する。
  getModuleIds = () => [...ALL_GRUNT_FORMATION_IDS, BOSS_MODULE_ID];

  /** デバッグ用: フォーメーションを即時に展開し spawn 列を返す（キューを経由しない） */
  buildModuleSpawns = (
    moduleId: string,
    activeEnemies: number,
  ): ArtCruiseStageSpawn[] => {
    if (moduleId === BOSS_MODULE_ID)
      return [buildBossSpawn(this.createContext(activeEnemies))];
    if (moduleId === ART_CRUISE_AFTER_BOSS_FORMATION.id)
      return buildFormationSpawns(ART_CRUISE_AFTER_BOSS_FORMATION);
    if (!(moduleId in GRUNT_FORMATION_BUILDERS)) return [];
    const id = moduleId as GruntFormationId;
    // level プールに無い formation でも試せるよう代表 bulletPatterns を当てる
    return buildFormationSpawns({
      id,
      bulletPatterns: getRepresentativeBulletPatterns(id),
    });
  };

  getDebugWaveOptions = (level: number): ArtCruiseDebugWaveOption[] =>
    pickGruntLevelPool(level).formations.map((config, index) => ({
      index,
      label: `lv${level} #${index + 1} ${config.id} / ${config.bulletPatterns
        .map((pattern) => pattern.id)
        .join("+")}`,
    }));

  buildDebugWaveSpawns = (
    level: number,
    index: number,
  ): ArtCruiseStageSpawn[] => {
    const config = pickGruntLevelPool(level).formations[index];
    if (!config) return [];
    return buildFormationSpawns(config).map((spawn) =>
      this.applyGruntScaling(spawn, level),
    );
  };

  takeReadySpawn = (
    now: number,
    activeEnemies: number,
    survivalTimeMs: number,
  ): ArtCruiseStageSpawn | null => {
    // 開幕グレースピリオド: 立ち上がりに余裕を持たせる
    if (survivalTimeMs < ART_CRUISE_STAGE_BALANCE.openingGraceMs) return null;
    if (activeEnemies >= this.maxEnemies) return null;
    // grunt formation 全滅待ち: キューが捌け切った後も、敵が残る間/猶予中は次を積まない。
    if (this.queue.length === 0 && this.isClearGateBlocking(now, activeEnemies))
      return null;
    if (this.queue.length === 0) this.enqueueNextModule(now, activeEnemies);

    const next = this.queue[0];
    if (!next || next.readyAt > now) return null;

    this.queue.shift();
    return next;
  };

  // 全滅待ちゲート: 直前 grunt formation の敵が全滅 → clearGapMs 猶予 を満たすまで次波を抑止。
  // 戻り true の間は次の formation を積まない。
  private isClearGateBlocking = (now: number, activeEnemies: number): boolean => {
    if (this.clearGateGapMs <= 0) return false;
    // まだ敵が残っている: 全滅していないのでブロック。猶予タイマーは未開始に戻す。
    if (activeEnemies > 0) {
      this.clearGateReleaseAt = 0;
      return true;
    }
    // 全滅検知: 初回はこの瞬間から猶予を開始。
    if (this.clearGateReleaseAt === 0)
      this.clearGateReleaseAt = now + this.clearGateGapMs;
    if (now < this.clearGateReleaseAt) return true;
    // 猶予満了: ゲートを消費して解除。
    this.clearGateGapMs = 0;
    this.clearGateReleaseAt = 0;
    return false;
  };

  private enqueueNextModule = (now: number, activeEnemies: number) => {
    const context = this.createContext(activeEnemies);
    const { spawns, moduleId, isGruntFormation } = this.resolveNextWave(context);

    // boss 待ちで空波が返った場合は状態を進めず、短い間隔で再評価する。
    // sinceBoss を増やさないことで BOSS カウンタのインフレを防ぐ。
    if (spawns.length === 0) {
      this.nextReadyBaseAt = now + ART_CRUISE_STAGE_BALANCE.bossWaitRetryMs;
      return;
    }

    let readyAt = Math.max(now, this.nextReadyBaseAt);

    for (const spawn of spawns) {
      readyAt += spawn.delayMs;
      this.queue.push({ ...this.applyGruntScaling(spawn, this.level), readyAt });
    }

    this.lastModuleId = moduleId;
    // levelプール由来の通常 grunt formation を積んだら全滅待ちゲートを準備する。
    // boss/afterBoss/forced/空波は対象外(従来の時間ベース進行のまま)。
    this.clearGateGapMs = isGruntFormation
      ? (pickGruntLevelPool(this.level).clearGapMs ?? 0)
      : 0;
    this.clearGateReleaseAt = 0;
    // sinceBoss は「enqueue 時点」で確定させる。
    // boss を含む波を積んだら即 0 にリセットし、
    // boss がキューに居る間に再度 boss 条件が成立する連鎖を防ぐ。
    const isBossWave = spawns.some((spawn) => spawn.rank === "boss");
    if (isBossWave) this.sinceBoss = 0;
    else this.sinceBoss += 1;
    this.nextReadyBaseAt = readyAt + this.waveGapMs(isBossWave);
  };

  // 次に積む波を決める。
  // 1. デバッグ強制 > 2. boss撃破直後の追い込み > 3. boss条件成立 > 4. levelプールから単純ランダム
  private resolveNextWave = (
    context: ArtCruiseStageContext,
  ): {
    spawns: ArtCruiseStageSpawn[];
    moduleId: string;
    isGruntFormation: boolean;
  } => {
    const forced = this.forcedModuleId;
    this.forcedModuleId = null;
    if (forced)
      return {
        spawns: this.buildModuleSpawns(forced, context.activeEnemies),
        moduleId: forced,
        isGruntFormation: false,
      };

    if (this.sinceBoss === 0 && this.lastModuleId === BOSS_MODULE_ID)
      return {
        spawns: buildFormationSpawns(ART_CRUISE_AFTER_BOSS_FORMATION),
        moduleId: ART_CRUISE_AFTER_BOSS_FORMATION.id,
        isGruntFormation: false,
      };

    // boss 条件成立後は新規 grunt 波を積まず、敵が捌けるのを待ってから boss を出す。
    // grunt を積み続けると activeEnemies が下がらず boss が永久に出せなくなる。
    if (canSpawnBossWave(context)) {
      if (context.activeEnemies <= 2)
        return {
          spawns: [buildBossSpawn(context)],
          moduleId: BOSS_MODULE_ID,
          isGruntFormation: false,
        };
      return { spawns: [], moduleId: this.lastModuleId, isGruntFormation: false };
    }

    const config = this.pickFormation(context);
    return {
      spawns: buildFormationSpawns(config),
      moduleId: config.id,
      isGruntFormation: true,
    };
  };

  // grunt を level 連動で強化。HP は +1/2level（上限+6）、弾速は微増。
  // boss は bossPhases 側で別途スケールするため対象外。
  private applyGruntScaling = (
    spawn: ArtCruiseStageSpawn,
    level: number,
  ): ArtCruiseStageSpawn => {
    if (spawn.rank !== "grunt") return spawn;
    const hpBonus = (spawn.hpBonus ?? 0) + Math.min(Math.floor(level / 2), 6);
    const speedScale = (spawn.speedScale ?? 1) * (1 + Math.min(level, 8) * 0.02);
    return { ...spawn, hpBonus, speedScale };
  };

  // 波間の休憩: 序盤は広く、level が上がるほど詰める。
  // 数ザコ波ごとに「息継ぎ」の長い静寂を挟んで緩急を作る。
  private waveGapMs = (isBossWave: boolean) => {
    const { waveGap, breather } = ART_CRUISE_STAGE_BALANCE;
    let gap =
      waveGap.baseMs -
      this.level * waveGap.perLevelMs +
      Math.random() * waveGap.jitterMs;

    if (!isBossWave && ++this.modulesSinceBreather >= breather.everyModules) {
      this.modulesSinceBreather = 0;
      gap += breather.extraMs;
    }

    return Math.max(waveGap.minMs, gap);
  };

  private createContext = (activeEnemies: number): ArtCruiseStageContext => ({
    level: this.level,
    activeEnemies,
    maxEnemies: this.maxEnemies,
    sinceBoss: this.sinceBoss,
    requiredWavesBeforeBoss: getRequiredWavesBeforeBoss(this.level),
  });

  // level プールから単純ランダムで1フォーメーションを選ぶ(weight なし)。
  // 同じフォーメーションの連続を避け、偏りを抑える。
  private pickFormation = (
    context: ArtCruiseStageContext,
  ): ArtCruiseGruntFormationConfig => {
    const { formations } = pickGruntLevelPool(context.level);
    const candidates =
      formations.length > 1
        ? formations.filter((f) => f.id !== this.lastModuleId)
        : formations;
    return pickRandom(candidates.length ? candidates : formations);
  };
}

export type { ArtCruiseDebugWaveOption, ArtCruiseStageSpawn } from "./types";
