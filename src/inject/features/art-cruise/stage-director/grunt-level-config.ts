import type { ArtCruiseEnemyBulletPatternId } from "../enemy/enemy-rules/types";
import type { GruntFormationId } from "./grunt-formations";

export type ArtCruiseGruntFormationConfig = {
  /** grunt-formations の builder id */
  id: GruntFormationId;
  /** 隊形内の grunt へ順番に割り当てる弾幕パターン (敵 index % length) */
  bulletPatterns: ArtCruiseEnemyBulletPatternId[];
};

export type ArtCruiseGruntLevelPool = {
  minLevel: number;
  formations: ArtCruiseGruntFormationConfig[];
  /**
   * formation の敵を全滅させてから次の formation を出すまでの猶予(ms)。
   * 0 や未指定なら全滅待ちゲートを使わず、従来の時間ベース間隔のみで進む。
   */
  clearGapMs?: number;
};

const formation = (
  id: GruntFormationId,
  bulletPatterns: ArtCruiseEnemyBulletPatternId[],
): ArtCruiseGruntFormationConfig => ({ id, bulletPatterns });

// grunt 調整の主入口。minLevel の高いものほど優先される(boss-level-config と同方針)。
// 各 level のフォーメーション配列から1つを単純ランダムで選ぶ(weight なし)。
//
// 難易度設計(ユーザー評価ベース):
//   formation 難度: topLine/sidePeekers = 簡単, vFormation = 簡単だが中以上patternが要る,
//                   opening/straightPass = 中, mirroredDiagonals/sideCrestWave = 中,
//                   rollingWave/staggeredSwarm = むずい, snake = かなりむずい
//   pattern 難度  : aimedFan/ringPulse = 弱, spreadBurst = 弱〜中,
//                   aimedBurst = 単体不可(必ず連結), switchFan = 中(lv3〜),
//                   crossFire = 中〜強(lv4〜), spiralShot = 難(lv5〜、1枠ずつ)
// レベルが上がるほど「むずいformation × 強patten」の比率を増やし、難度の山を作る。
export const ART_CRUISE_GRUNT_LEVEL_POOLS: ArtCruiseGruntLevelPool[] = [
  {
    // 立ち上がり: 簡単formation + 弱pattern のみ。むずいformationは出さない。
    minLevel: 1,
    clearGapMs: 1_500,
    formations: [
      formation("sidePeekers", ["ringPulse"]),
      formation("opening", ["aimedFan"]),
      formation("opening", ["spreadBurst"]),
      // vFormation は隊形が薄いので弱でも spreadBurst で密度を補う
      formation("vFormation", ["spreadBurst"]),
    ],
  },
  {
    // 中formation を解禁。むずいformationはまだ1枠だけ(rollingWave)、弱pattern で抑える。
    minLevel: 2,
    clearGapMs: 1_200,
    formations: [
      formation("topLine", ["spreadBurst"]),
      formation("topLine", ["aimedFan"]),
      formation("sidePeekers", ["aimedFan"]),
      formation("opening", ["aimedFan", "spreadBurst"]),
      formation("straightPass", ["aimedFan"]),
      formation("vFormation", ["aimedFan", "spreadBurst"]),
      formation("mirroredDiagonals", ["aimedFan"]),
      // むずいformationの先出し1枠。aimedBurstは連結で混ぜる。
      formation("rollingWave", ["aimedFan", "aimedBurst"]),
    ],
  },
  {
    // switchFan 解禁。むずいformation(rollingWave/staggeredSwarm)を本格投入。snakeはまだ弱pattern。
    minLevel: 3,
    clearGapMs: 1000,
    formations: [
      formation("topLine", ["ringPulse"]),
      formation("straightPass", ["spreadBurst", "aimedFan"]),
      formation("sideCrestWave", ["aimedFan"]),
      formation("mirroredDiagonals", ["spreadBurst", "aimedFan"]),
      formation("vFormation", ["switchFan", "aimedFan"]),
      formation("rollingWave", ["aimedFan", "spreadBurst"]),
      formation("staggeredSwarm", ["spreadBurst", "aimedFan"]),
      // snake はかなりむずいので導入は弱patternで
      formation("snake", ["aimedFan"]),
    ],
  },
  {
    // crossFire 解禁(連射)。中formationにcrossFireを当て、むずいformationは中patternで山を作る。
    minLevel: 4,
    clearGapMs: 850,
    formations: [
      formation("straightPass", ["crossFire", "aimedFan"]),
      formation("sideCrestWave", ["spreadBurst", "aimedFan"]),
      formation("mirroredDiagonals", ["crossFire", "aimedFan"]),
      formation("vFormation", ["switchFan", "spreadBurst"]),
      formation("rollingWave", ["aimedFan", "switchFan", "spreadBurst"]),
      formation("staggeredSwarm", ["switchFan", "spreadBurst", "aimedFan"]),
      formation("snake", ["spreadBurst"]),
    ],
  },
  {
    // spiralShot 解禁。難patternは1枠ずつだけ混ぜ、むずいformationには寄せない。
    minLevel: 5,
    clearGapMs: 700,
    formations: [
      formation("straightPass", ["crossFire", "switchFan"]),
      formation("sideCrestWave", ["spreadBurst", "switchFan"]),
      formation("mirroredDiagonals", ["switchFan", "spreadBurst"]),
      // spiralShot は避けやすい簡単formationに1枠だけ混ぜて山を作る
      formation("vFormation", ["spiralShot", "aimedFan"]),
      formation("rollingWave", ["spreadBurst", "switchFan", "crossFire"]),
      formation("staggeredSwarm", ["crossFire", "switchFan", "spreadBurst"]),
      formation("snake", ["spreadBurst", "switchFan"]),
    ],
  },
  {
    // 最高難度。強pattern中心。spiralShot はむずいformationにも1枠だけ許可。
    minLevel: 6,
    clearGapMs: 650,
    formations: [
      formation("straightPass", ["crossFire", "spreadBurst"]),
      formation("sideCrestWave", ["spreadBurst", "crossFire"]),
      formation("mirroredDiagonals", ["crossFire", "switchFan"]),
      formation("vFormation", ["spiralShot", "switchFan"]),
      formation("rollingWave", ["aimedFan", "crossFire", "spreadBurst"]),
      formation("staggeredSwarm", ["crossFire", "spreadBurst", "switchFan"]),
      // snake はかなりむずいので spiralShot は1枠のみ、後続は弱patternで緩める
      formation("snake", ["spiralShot", "aimedFan"]),
    ],
  },
];

// ボス撃破直後専用の追い込み(level プールとは別枠で常に固定)
export const ART_CRUISE_AFTER_BOSS_FORMATION: ArtCruiseGruntFormationConfig =
  formation("afterBossRush", ["aimedFan", "spreadBurst"]);

// デバッグ用: formation id に対する代表 bulletPatterns を全プールから引く。
// プール未登録(現状どのlevelにも無い)の formation には aimedFan を当てる。
export const getRepresentativeBulletPatterns = (
  formationId: GruntFormationId,
): ArtCruiseEnemyBulletPatternId[] => {
  for (const pool of ART_CRUISE_GRUNT_LEVEL_POOLS) {
    const config = pool.formations.find((f) => f.id === formationId);
    if (config) return config.bulletPatterns;
  }
  if (formationId === ART_CRUISE_AFTER_BOSS_FORMATION.id)
    return ART_CRUISE_AFTER_BOSS_FORMATION.bulletPatterns;
  return ["aimedFan"];
};

export const pickGruntLevelPool = (level: number): ArtCruiseGruntLevelPool => {
  for (let i = ART_CRUISE_GRUNT_LEVEL_POOLS.length - 1; i >= 0; i--) {
    const pool = ART_CRUISE_GRUNT_LEVEL_POOLS[i];
    if (level >= pool.minLevel) return pool;
  }
  return ART_CRUISE_GRUNT_LEVEL_POOLS[0];
};
