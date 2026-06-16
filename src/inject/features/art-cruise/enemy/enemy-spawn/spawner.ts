import type { ArtCruiseBossController } from "../boss";
import type { ArtCruisePixiEnemyGraphicPool } from "../enemy-graphics/pixi-enemy-graphic-pool";
import { ArtCruiseSquad } from "../enemy-movement/squad";
import { initializeSquadCommands } from "../enemy-movement/squad-commands";
import {
  vFormationSpawns,
  straightPassSpawns,
  snakeSpawns,
} from "../enemy-movement/squad-formations";
import type { ArtCruiseStageDirector } from "../../stage-director";
import type { ArtCruiseStageSpawn } from "../../stage-director";
import {
  createPixiEnemy,
  ArtCruiseEnemyEntity,
  ArtCruiseEnemyManager,
} from "../index";
import type {
  ArtCruiseDebugBossOptions,
  ArtCruiseDebugSpawnOptions,
} from "../../debug/types";
import {
  ENEMY_MAX_COUNT,
  ENEMY_SPEED,
  GAME_LOGICAL_WIDTH,
  GAME_LOGICAL_HEIGHT,
} from "../../constants";
import { createBossDronePatternConfig } from "../boss/boss-pattern-config";

const FORMATION_SPAWNS: Record<string, (id: string) => ArtCruiseStageSpawn[]> =
  {
    vFormation: vFormationSpawns,
    straightPass: straightPassSpawns,
    snake: snakeSpawns,
  };

type ArtCruiseSpawnerDeps = {
  enemyManager: ArtCruiseEnemyManager;
  bossController: ArtCruiseBossController;
  enemyGraphics: ArtCruisePixiEnemyGraphicPool;
  stageDirector: ArtCruiseStageDirector;
  squads: ArtCruiseSquad[];
  unitScale: () => number;
  onBossSpawn?: (enemy: ArtCruiseEnemyEntity) => void;
};

/**
 * 敵の配置・隊列結成・ボス登録を担うスポーンオーケストレーター。
 * 1体の生成は createPixiEnemy に委譲し、ここでは「どこに/どの隊列で/bossか」を決める。
 */
export class ArtCruiseSpawner {
  constructor(private readonly deps: ArtCruiseSpawnerDeps) {}

  hasActiveBoss = () =>
    this.deps.enemyManager.activeEnemies.some(
      (enemy) => enemy.config.rank === "boss",
    );

  /** stage director の準備済みスポーンを取り出して配置する */
  spawnQueued = (now: number, survivalTimeMs: number) => {
    const { enemyManager, stageDirector } = this.deps;
    if (enemyManager.activeEnemies.length >= ENEMY_MAX_COUNT) return;
    if (this.hasActiveBoss()) return;

    const spawn = stageDirector.takeReadySpawn(
      now,
      enemyManager.activeEnemies.length,
      survivalTimeMs,
    );
    if (!spawn) return;

    this.spawn({ spawn, now });
  };

  /** デバッグ: stage module を即時展開して配置する（キュー/間引きを経由しない） */
  debugSpawnModule = (moduleId: string, now: number) => {
    const { stageDirector, enemyManager } = this.deps;
    const spawns = stageDirector.buildModuleSpawns(
      moduleId,
      enemyManager.activeEnemies.length,
    );
    let offset = 0;
    for (const spawn of spawns) {
      offset += spawn.delayMs;
      // delayMs は累積タイミング。debug では実時間で順次配置する
      window.setTimeout(() => this.spawn({ spawn, now: now + offset }), offset);
    }
  };

  /**
   * デバッグ: 指定弾幕パターンを撃つ静止テスト敵をプレイエリア上部に配置。
   * boss パターンは bounds/origin 依存のため画面内に置いて発火させる。
   */
  debugSpawnBulletPattern = (
    bulletPattern: ArtCruiseDebugSpawnOptions["bulletPattern"],
    now: number,
    level = 1,
  ) => {
    const hpBonus = Math.min(Math.floor(level / 2), 6) + 9999;
    const speedScale = 1 + Math.min(level, 8) * 0.02;
    this.spawn({
      spawn: {
        rank: "grunt",
        delayMs: 0,
        xRatio: 0.5,
        yRatio: 0.16,
        movement: "none",
        hpBonus,
        speedScale,
      },
      now,
      bulletPattern,
      forceStatic: true,
    });
  };

  debugSpawnBossLevel = (
    level: number,
    now: number,
    debugOptions?: ArtCruiseDebugBossOptions,
  ) => {
    this.deps.enemyManager.reset();
    this.deps.bossController.reset();
    this.spawn({
      spawn: {
        rank: "boss",
        delayMs: 0,
        xRatio: 0.5,
        yRatio: -0.14,
        movement: "none",
        speedScale: 0.72,
        bossPhases: createBossDronePatternConfig({
          level,
          sinceBoss: 0,
          debugPatterns: debugOptions?.patterns,
          debugTuning: debugOptions?.tuning,
        }),
      },
      now,
      enemyId: "bossDrone",
      forceStatic: true,
    });
  };

  /** デバッグパネルからの手動スポーン */
  debugSpawn = (options: ArtCruiseDebugSpawnOptions, now: number) => {
    const rank =
      options.rank ?? (options.enemyId === "bossDrone" ? "boss" : "grunt");

    if (options.squad) {
      const enemyId =
        options.enemyId === "bossDrone" ? "gruntDrone" : options.enemyId;
      const formation = options.formation ?? "sideSlide";
      const squadId = `${formation}_debug_${performance.now()}`;
      const spawnsFn = FORMATION_SPAWNS[formation];
      const spawns = spawnsFn
        ? spawnsFn(squadId)
        : [0.3, 0.4, 0.5, 0.6, 0.7].map((yRatio, i) => ({
            rank: "grunt" as const,
            delayMs: 0,
            xRatio: 1.08 + i * 0.02,
            yRatio,
            movement: "none" as const,
            speedScale: 1,
            squadId,
          }));
      for (const spawn of spawns) {
        this.spawn({
          spawn,
          now,
          enemyId,
          bulletPattern: options.bulletPattern,
          forceStatic: true,
        });
      }
      return;
    }

    this.spawn({
      spawn: {
        rank,
        delayMs: 0,
        xRatio: rank === "boss" ? 0.5 : 1.08,
        yRatio: rank === "boss" ? -0.14 : 0.38,
        movement: rank === "boss" ? "none" : options.movement,
      },
      now,
      enemyId: options.enemyId,
      bulletPattern: options.bulletPattern,
      forceStatic: true,
    });
  };

  private spawn = ({
    spawn,
    now,
    enemyId,
    bulletPattern,
    forceStatic = false,
  }: {
    spawn: ArtCruiseStageSpawn;
    now: number;
    enemyId?: ArtCruiseDebugSpawnOptions["enemyId"];
    bulletPattern?: ArtCruiseDebugSpawnOptions["bulletPattern"];
    forceStatic?: boolean;
  }) => {
    const { enemyManager, bossController, enemyGraphics, squads, unitScale } =
      this.deps;
    const isBoss = spawn.rank === "boss";
    const side = isBoss ? "top" : Math.random() < 0.5 ? "right" : "left";

    const enemy = createPixiEnemy({
      now,
      dynamicAsset: forceStatic ? null : enemyGraphics.take(spawn.rank),
      unitScale: unitScale(),
      rank: spawn.rank,
      enemyId,
    });
    enemy.movement = isBoss ? "none" : (spawn.movement ?? enemy.movement);
    if (bulletPattern) enemy.bulletPatterns = [bulletPattern];
    else if (spawn.bulletPattern) enemy.bulletPatterns = [spawn.bulletPattern];
    if (isBoss && spawn.bossPhases?.length) {
      enemy.bossPhases = spawn.bossPhases;
      enemy.bossPhaseIndex = 0;
      enemy.bulletPatterns = spawn.bossPhases[0].bulletPatterns;
      enemy.bulletTuning = spawn.bossPhases[0].bulletTuning;
      enemy.hp = spawn.bossPhases[0].hp;
      enemy.config.hp = spawn.bossPhases.reduce(
        (sum, phase) => sum + phase.hp,
        0,
      );
    }

    const speed =
      ENEMY_SPEED *
      (isBoss ? 0.72 : 0.9 + Math.random() * 0.3) *
      (spawn.speedScale ?? 1);
    enemy.vx = side === "left" ? speed : -speed;
    enemy.hp += spawn.hpBonus ?? 0;

    // sidePeek は「spawn した端から内側へのぞき込み、同じ端へ戻る」動き。
    // 侵入向き(=inward)は moveSidePeek が vx の符号から導くため、spawn 位置と
    // 整合させる必要がある。xRatio 指定の sidePeek で side(left/right) がランダムだと
    // 50% で外側へ飛び出して即 isOutOfBounds 除去される(出てこない)。
    // spawn x が画面右半分なら左向き、左半分なら右向きに矯正する。
    if (enemy.movement === "sidePeek" && spawn.xRatio !== undefined) {
      const speedAbs = Math.abs(enemy.vx);
      enemy.vx = spawn.xRatio > 0.5 ? -speedAbs : speedAbs;
    }

    const margin = isBoss ? 140 : 96;
    let x = 0;
    let y = 0;

    if (isBoss) {
      x = GAME_LOGICAL_WIDTH * (spawn.xRatio ?? 0.5);
      y = GAME_LOGICAL_HEIGHT * (spawn.yRatio ?? -0.12);
    } else {
      x =
        spawn.xRatio !== undefined
          ? GAME_LOGICAL_WIDTH * spawn.xRatio
          : side === "right"
            ? GAME_LOGICAL_WIDTH + margin
            : -margin;
      y =
        spawn.yRatio !== undefined
          ? GAME_LOGICAL_HEIGHT * spawn.yRatio
          : GAME_LOGICAL_HEIGHT * (0.18 + Math.random() * 0.5);
    }

    enemy.view.position.set(x, y);
    enemy.originX = x;
    enemy.originY = y;

    const entity = new ArtCruiseEnemyEntity(enemy);
    enemyManager.addEnemy(entity);

    if (isBoss) {
      bossController.setBoss(entity);
      this.deps.onBossSpawn?.(entity);
      return;
    }

    if (!spawn.squadId) return;

    const squadId = spawn.squadId;
    let squad = squads.find((s) => s.id === squadId);
    if (!squad) {
      squad = new ArtCruiseSquad(squadId);
      initializeSquadCommands(
        squad,
        squadId,
        GAME_LOGICAL_WIDTH,
        GAME_LOGICAL_HEIGHT,
      );
      squads.push(squad);
    }
    squad.addMember(enemy);
  };
}
