import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
} from "../enemy/enemy-rules/types";
import { needleBurst } from "../enemy/enemy-bullet-patterns/presets";
import type { GruntFormationId } from "./grunt-formations";

export type ArtCruiseGruntPatternSpec = {
  id: ArtCruiseEnemyBulletPatternId;
  tuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseGruntFormationConfig = {
  /** grunt-formations の builder id */
  id: GruntFormationId;
  /** 隊形内の grunt へ順番に割り当てる弾幕パターン (敵 index % length) */
  bulletPatterns: ArtCruiseGruntPatternSpec[];
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
  bulletPatterns: (ArtCruiseEnemyBulletPatternId | ArtCruiseGruntPatternSpec)[],
): ArtCruiseGruntFormationConfig => ({
  id,
  bulletPatterns: bulletPatterns.map((pattern) =>
    typeof pattern === "string" ? p(pattern) : pattern,
  ),
});

const p = (
  id: ArtCruiseEnemyBulletPatternId,
  tuning?: ArtCruiseBulletPatternTuning,
): ArtCruiseGruntPatternSpec => ({ id, tuning });

// ----

const SHOTGUN: ArtCruiseBulletPatternTuning = {
  sizeScale: 0.5,
  burst: {
    bulletArt: "blue",
    bulletCount: 3,
    baseSpeed: 7,
    accel: -6,
    minSpeed: 2,
    repeatCount: 4,
  },
};

const SHOTGUN_ROUND: ArtCruiseBulletPatternTuning = {
  sizeScale: 0.7,
  burst: {
    aimAtPlayer: true,
    bulletArt: "smallSilver",
    spreadRad: 0.5,
    bulletCount: 8,
    accel: -5,
    minSpeed: 3,
    angleJitterRad: 5,
    repeatCount: 3,
    repeatDelayMs: 0,
  },
};

// ----

// grunt 調整の主入口。minLevel の高いものほど優先される(boss-level-config と同方針)。
// 各 level のフォーメーション配列から1つを単純ランダムで選ぶ(weight なし)。
//
// 難易度設計(ユーザー評価ベース):
//   formation 難度: topLine/sidePeekers = 簡単, vFormation = 簡単だが中以上patternが要る,
//                   opening/straightPass = 中, mirroredDiagonals/sideCrestWave = 中,
//                   rollingWave/staggeredSwarm = むずい, snake = かなりむずい
//   pattern 難度  : aimedFan/ringPulse = 弱, burst = 弱〜中,
//                   needle burst = 単体不可(必ず連結), switchFan = 中(lv3〜),
//                   crossFire = 中〜強(lv4〜), spiralShot = 難(lv5〜、1枠ずつ)
// レベルが上がるほど「むずいformation × 強patten」の比率を増やし、難度の山を作る。
export const ART_CRUISE_GRUNT_LEVEL_POOLS: ArtCruiseGruntLevelPool[] = [
  {
    // 立ち上がり: 簡単formation + 弱pattern のみ。むずいformationは出さない。
    minLevel: 1,
    clearGapMs: 1_500,
    formations: [
      formation("sidePeekers", [
        needleBurst({
          burst: {
            bulletCount: 3,
            spreadRad: 0.1,
            speedStep: 0.5,
            repeatCount: 2,
          },
        }),
      ]),
      formation("topLine", [
        needleBurst({
          burst: {
            bulletCount: 3,
            spreadRad: 0.1,
            speedStep: 0.5,
            repeatCount: 2,
          },
        }),
      ]),
      formation("straightPass", [needleBurst()]),
      formation("opening", [needleBurst()]),
      formation("vFormation", [needleBurst()]),
      formation("rollingWave", [needleBurst()]),
      formation("mirroredDiagonals", [needleBurst()]),
      formation("snake", [needleBurst()]),
    ],
  },
  {
    // 中formation を解禁。むずいformationはまだ1枠だけ(rollingWave)、弱pattern で抑える。
    minLevel: 2,
    clearGapMs: 1_200,
    formations: [
      formation("topLine", [p("burst")]),
      formation("sidePeekers", [needleBurst()]),
      formation("opening", [p("burst")]),
      formation("straightPass", [
        p("aimedFan"),
        p("ringPulse"),
        needleBurst({
          sizeScale: 0.7,
          speedScale: 0.5,
        }),
      ]),
      formation("vFormation", [p("aimedFan"), p("burst"), p("ringPulse")]),
      formation("mirroredDiagonals", [
        needleBurst(),
        p("aimedFan"),
        p("ringPulse"),
      ]),
      formation("rollingWave", [
        p("burst"),
        needleBurst({
          sizeScale: 0.7,
          speedScale: 0.5,
        }),
      ]),
    ],
  },
  {
    // switchFan 解禁。むずいformation(rollingWave/staggeredSwarm)を本格投入。snakeはまだ弱pattern。
    minLevel: 3,
    clearGapMs: 1000,
    formations: [
      formation("topLine", [p("burst", SHOTGUN)]),
      formation("straightPass", [
        p("burst", {
          ...SHOTGUN,
          burst: { ...SHOTGUN.burst, bulletCount: 4, repeatCount: 3 },
        }),
      ]),
      formation("sidePeekers", ["spiralShot"]),
      formation("sidePeekers", [
        {
          id: "ringPulse",
          tuning: {
            sizeScale: 0.7,
          },
        },
      ]),
      formation("opening", ["crossFire", "aimedFan", "spiralShot"]),
      formation("mirroredDiagonals", [p("burst", SHOTGUN)]),
      formation("vFormation", ["ringPulse"]),
      formation("sideCrestWave", [
        { id: "ringPulse", tuning: { sizeScale: 0.7 } },
      ]),
      formation("rollingWave", [needleBurst()]),
      formation("staggeredSwarm", [p("burst", SHOTGUN)]),
      formation("snake", [p("burst", SHOTGUN)]),
    ],
  },
  {
    // crossFire 解禁(連射)。中formationにcrossFireを当て、むずいformationは中patternで山を作る。
    minLevel: 4,
    clearGapMs: 850,
    formations: [
      formation("straightPass", [p("burst", SHOTGUN_ROUND)]),
      formation("topLine", ["spiralShot"]),
      formation("topLine", ["ringPulse"]),
      formation("sideCrestWave", [p("burst", SHOTGUN_ROUND)]),
      formation("mirroredDiagonals", [p("burst", SHOTGUN_ROUND)]),
      formation("vFormation", [p("burst", SHOTGUN_ROUND)]),
      formation("rollingWave", [
        needleBurst({
          burst: {
            bulletCount: 3,
            spreadRad: 0.3,
            speedStep: 0.5,
            repeatCount: 2,
          },
        }),
      ]),
      formation("staggeredSwarm", ["switchFan", "burst", "aimedFan"]),
      formation("snake", ["switchFan"]),
    ],
  },
  {
    // spiralShot 解禁。難patternは1枠ずつだけ混ぜ、むずいformationには寄せない。
    minLevel: 5,
    clearGapMs: 700,
    formations: [
      formation("straightPass", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: { ...SHOTGUN_ROUND.burst, bulletCount: 13 },
        }),
      ]),
      formation("mirroredDiagonals", ["switchFan", "burst"]),
      formation("vFormation", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: { ...SHOTGUN_ROUND.burst, bulletCount: 13 },
        }),
      ]),
      formation("rollingWave", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: { ...SHOTGUN_ROUND.burst, bulletCount: 8 },
        }),
      ]),
      formation("staggeredSwarm", [p("burst", SHOTGUN)]),
      formation("snake", ["burst", "switchFan"]),
    ],
  },
  {
    // 最高難度。強pattern中心。spiralShot はむずいformationにも1枠だけ許可。
    minLevel: 6,
    clearGapMs: 650,
    formations: [
      formation("straightPass", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: {
            ...SHOTGUN_ROUND.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 3.5,
            bulletCount: 20,
          },
        }),
      ]),
      formation("mirroredDiagonals", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: {
            ...SHOTGUN_ROUND.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 2.5,
            bulletCount: 18,
          },
        }),
      ]),
      formation("vFormation", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: {
            ...SHOTGUN_ROUND.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 3.5,
            bulletCount: 22,
          },
        }),
      ]),
      formation("opening", [
        p("burst", {
          ...SHOTGUN_ROUND,
          burst: {
            ...SHOTGUN_ROUND.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 3.5,
            bulletCount: 22,
          },
        }),
      ]),
      formation("rollingWave", [
        p("burst", {
          ...SHOTGUN,
          burst: {
            ...SHOTGUN.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 3.5,
            bulletCount: 13,
            aimAtPlayer: true,
          },
        }),
      ]),
      formation("staggeredSwarm", [
        p("burst", {
          ...SHOTGUN,
          sizeScale: 0.8,
          burst: {
            ...SHOTGUN.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 3.5,
            bulletCount: 13,
            aimAtPlayer: true,
          },
        }),
      ]),
      // snake はかなりむずいので spiralShot は1枠のみ、後続は弱patternで緩める
      formation("snake", [
        p("burst", {
          ...SHOTGUN,
          burst: {
            ...SHOTGUN.burst,
            bulletArt: "kunaiCapsule",
            minSpeed: 2,
            bulletCount: 8,
          },
        }),
      ]),
    ],
  },
];

// ボス撃破直後専用の追い込み(level プールとは別枠で常に固定)
export const ART_CRUISE_AFTER_BOSS_FORMATION: ArtCruiseGruntFormationConfig =
  formation("afterBossRush", ["aimedFan", "burst"]);

// デバッグ用: formation id に対する代表 bulletPatterns を全プールから引く。
// プール未登録(現状どのlevelにも無い)の formation には aimedFan を当てる。
export const getRepresentativeBulletPatterns = (
  formationId: GruntFormationId,
): ArtCruiseGruntPatternSpec[] => {
  for (const pool of ART_CRUISE_GRUNT_LEVEL_POOLS) {
    const config = pool.formations.find((f) => f.id === formationId);
    if (config) return config.bulletPatterns;
  }
  if (formationId === ART_CRUISE_AFTER_BOSS_FORMATION.id)
    return ART_CRUISE_AFTER_BOSS_FORMATION.bulletPatterns;
  return [p("aimedFan")];
};

export const pickGruntLevelPool = (level: number): ArtCruiseGruntLevelPool => {
  for (let i = ART_CRUISE_GRUNT_LEVEL_POOLS.length - 1; i >= 0; i--) {
    const pool = ART_CRUISE_GRUNT_LEVEL_POOLS[i];
    if (level >= pool.minLevel) return pool;
  }
  return ART_CRUISE_GRUNT_LEVEL_POOLS[0];
};
