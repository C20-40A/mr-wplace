import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
} from "../enemy-rules/types";

export type ArtCruiseBossPhasePool = {
  minLevel: number;
  phaseCount: number;
  patterns: ArtCruiseBossPatternSet[];
  tuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseBossPatternSet = {
  ids: ArtCruiseEnemyBulletPatternId[];
  hp: number;
};

const patternSet = (
  ids: ArtCruiseEnemyBulletPatternId[],
  hp: number,
): ArtCruiseBossPatternSet => ({ ids, hp });

// ボス調整の主入口。minLevel の高いものほど優先される。
// patterns はフェーズごとの同時発射セット。クリア不能な組み合わせを避けるため手動で管理する。
export const ART_CRUISE_BOSS_PHASE_POOLS: ArtCruiseBossPhasePool[] = [
  {
    minLevel: 1,
    phaseCount: 2,
    patterns: [
      patternSet(["bossBigRing", "spiralShot"], 620),
      patternSet(["bossGigantoRing", "petalRing"], 720),
      patternSet(["bossClusterVolley"], 680),
      patternSet(["bossGalaxyVortex"], 660),
    ],
    tuning: { speedScale: 0.9, intervalScale: 1.18 },
  },
  {
    minLevel: 2,
    phaseCount: 4,
    patterns: [
      patternSet(["aimedBurst", "spiralShot", "bossGalaxyVortex"], 780),
      patternSet(["bossGigantoRing", "spreadBurst", "spiralShot"], 780),
      patternSet(["petalRing", "spiralShot", "switchFan"], 780),
      patternSet(["bossLotusBloom"], 660),
      patternSet(["bossRovingTurret"], 660),
      patternSet(["bossGalaxyVortex", "bossSineWave"], 660),
    ],
    tuning: { speedScale: 0.92, intervalScale: 1.1 },
  },
  {
    minLevel: 3,
    phaseCount: 4,
    patterns: [
      patternSet(["bossWeavingStream"], 780),
      patternSet(["bossReflectLaser"], 780),
      patternSet(["bossDenseRing"], 780),
      patternSet(["bossAbyssalUpdraft"], 780),
      patternSet(["bossWeavingStream"], 780),
      patternSet(["bossRovingTurret", "spiralShot"], 780),
      patternSet(["petalRing", "bossBigRing", "ringPulse"], 780),
    ],
    tuning: { speedScale: 0.96, intervalScale: 1.08 },
  },
  {
    minLevel: 4,
    phaseCount: 4,
    patterns: [
      patternSet(["bossFrozenLattice"], 820), // できる
      patternSet(["bossBigRing", "bossPerimeterGapRing"], 820), // ちょいきつい
      patternSet(["bossGigantoRing", "switchFan", "bossLotusBloom"], 820), // できる
      patternSet(["bossGalaxyVortex", "bossLotusBloom", "switchFan"], 820), // できる
      patternSet(
        ["petalRing", "spiralShot", "switchFan", "ringPulse", "aimedFan"],
        780,
      ), // できる
    ],
    tuning: { speedScale: 1.02, intervalScale: 1 },
  },
  {
    minLevel: 5,
    phaseCount: 4,
    patterns: [
      patternSet(["bossDenseRing", "bossWeavingStream"], 800), // まあまあきつい
      patternSet(["bossAbyssalUpdraft", "aimedFan"], 850), // ややきつい
      patternSet(["bossReflectLaser", "bossRovingTurret"], 900), // ちょいきつい
      patternSet(["aimedFan", "ringPulse", "bossStarfall"], 850), // ややきつい
      patternSet(["bossLotusBloom", "bossPerimeterGapRing"], 900), // ちょいきつい場所による
    ],
    tuning: { speedScale: 1.02, intervalScale: 1 },
  },
  {
    minLevel: 6,
    phaseCount: 5,
    patterns: [
      patternSet(["bossRovingTurret", "bossDenseRing"], 800),
      patternSet(["bossClusterVolley", "bossRovingTurret"], 800), // きつい
      patternSet(
        ["ringPulse", "spreadBurst", "crossFire", "petalRing", "switchFan"],
        800,
      ),
      patternSet(["bossClusterVolley", "bossBigRing"], 800), // ややきつい
      patternSet(["bossReflectLaser", "bossDenseRing"], 800),
      patternSet(["bossGigantoRing", "bossWeavingStream"], 800),
    ],
    tuning: { speedScale: 1.08, intervalScale: 0.94 },
  },
  {
    minLevel: 7,
    phaseCount: 5,
    patterns: [
      patternSet(["bossPerimeterGapRing", "bossWeavingStream"], 700),
      patternSet(["bossAbyssalUpdraft", "bossFrozenLattice"], 700),
      patternSet(["bossBigRing", "bossWeavingStream", "bossRovingTurret"], 700),
      patternSet(
        ["crossFire", "aimedBurst", "spiralShot", "bossClusterVolley"],
        700,
      ),
      patternSet(["bossReflectLaser", "bossAbyssalUpdraft", "spiralShot"], 700),
      patternSet(["bossPerimeterGapRing", "bossStarfall", "crossFire"], 700),
      // patternSet(["", "bossStarfall", "crossFire"], 1460),
      // patternSet(
      //   ["bossPerimeterGapRing", "bossLotusBloom", "bossGigantoRing"],
      //   1440,
      // ),
    ],
    tuning: { speedScale: 1.14, intervalScale: 0.88 },
  },
];

export const pickBossPhasePool = (level: number) => {
  for (let i = ART_CRUISE_BOSS_PHASE_POOLS.length - 1; i >= 0; i--) {
    const pool = ART_CRUISE_BOSS_PHASE_POOLS[i];
    if (level >= pool.minLevel) return pool;
  }
  return ART_CRUISE_BOSS_PHASE_POOLS[0];
};
