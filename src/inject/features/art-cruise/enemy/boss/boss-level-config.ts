import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
} from "../enemy-rules/types";
import { needleBurst } from "../enemy-bullet-patterns/presets";

export type ArtCruiseBossPhasePool = {
  minLevel: number;
  phaseCount: number;
  patterns: ArtCruiseBossPatternSet[];
  tuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseBossPatternSet = {
  ids: ArtCruiseEnemyBulletPatternId[];
  hp: number;
  patternTunings?: Partial<
    Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>
  >;
};

type ArtCruiseBossPatternSpec = {
  id: ArtCruiseEnemyBulletPatternId;
  tuning?: ArtCruiseBulletPatternTuning;
};

const p = (
  id: ArtCruiseEnemyBulletPatternId,
  tuning?: ArtCruiseBulletPatternTuning,
): ArtCruiseBossPatternSpec => ({ id, tuning });

const patternSet = (
  patterns: ArtCruiseBossPatternSpec[],
  hp: number,
): ArtCruiseBossPatternSet => {
  const ids = patterns.map((pattern) => pattern.id);
  const tuningEntries = patterns.flatMap((pattern) =>
    pattern.tuning ? [[pattern.id, pattern.tuning] as const] : [],
  );
  return {
    ids,
    hp,
    ...(tuningEntries.length
      ? { patternTunings: Object.fromEntries(tuningEntries) }
      : {}),
  };
};

// ボス調整の主入口。minLevel の高いものほど優先される。
// patterns はフェーズごとの同時発射セット。クリア不能な組み合わせを避けるため手動で管理する。
export const ART_CRUISE_BOSS_PHASE_POOLS: ArtCruiseBossPhasePool[] = [
  {
    minLevel: 1,
    phaseCount: 3,
    patterns: [
      patternSet(
        [
          p("bossGigantoRing", {
            speedScale: 0.7,
            delayScale: 1.5,
          }),
          p("bossBigRing"),
        ],
        400,
      ),
      patternSet(
        [
          p("aimedFan", {
            speedScale: 2,
            delayScale: 0.5,
            intervalScale: 0.5,
          }),
        ],
        400,
      ),
      patternSet(
        [
          p("bossClusterVolley", {
            speedScale: 1.4,
            accelScale: 2,
            sizeScale: 0.6,
            delayScale: 0.8,
            intervalScale: 1.2,
          }),
        ],
        400,
      ),
      patternSet(
        [
          p("bossTopIceRain", {
            speedScale: 3,
            topIce: {
              fireMode: "sequence",
              bulletsPerWave: 10,
              delayStepMs: 32,
              spreadRad: 0,
            },
          }),
        ],
        720,
      ),
      patternSet(
        [
          p("bossGalaxyVortex", {
            speedScale: 1.2,
            sizeScale: 0.8,
            intervalScale: 0.5,
          }),
        ],
        400,
      ),
      patternSet(
        [
          p("bossEdgeBeam", {
            sizeScale: 2,
            edgeBeam: {
              turretLayout: "top",
              beamCount: 8,
            },
          }),
        ],
        400,
      ),
      patternSet(
        [
          p("bossEdgeBeam", {
            edgeBeam: {
              turretLayout: "perimeter",
              fireMode: "random",
              beamCount: 4,
              angleMode: "center",
            },
          }),
        ],
        700,
      ),
    ],
    tuning: { speedScale: 1.0, intervalScale: 1.0 },
  },
  {
    minLevel: 2,
    phaseCount: 4,
    patterns: [
      patternSet([needleBurst(), p("spiralShot"), p("bossGalaxyVortex")], 680),
      patternSet([p("bossGigantoRing"), p("burst"), p("spiralShot")], 680),
      patternSet([p("petalRing"), p("spiralShot"), p("switchFan")], 680),
      patternSet([p("bossLotusBloom")], 660),
      patternSet(
        [
          p("bossFlappyGate", {
            speedScale: 3,
            intervalScale: 0.4,
            flappyGate: {
              side: "top",
              gateCount: 1,
              gapSize: 100,
              thickness: 0.05,
              gapMoveMinPx: 100,
              gapMoveMaxPx: 150,
            },
          }),
        ],
        460,
      ),
      patternSet(
        [
          p("bossAbyssalUpdraft", {
            speedScale: 0.8,
            delayScale: 2.0,
            intervalScale: 3.0,
          }),
          p("spiralShot", { sizeScale: 0.8 }),
        ],
        600,
      ),
      patternSet(
        [
          p("bossSideKunaiBarrage", {
            intervalScale: 1.15,
            sideKunai: {
              aimAtPlayer: true,
              fireMode: "sequence",
              bulletsPerWave: 12,
              delayStepMs: 28,
              spreadRad: 0.03,
            },
          }),
        ],
        600,
      ),
      patternSet(
        [
          p("bossTopIceRain", {
            topIce: {
              fireMode: "random",
              aimAtPlayer: true,
              baseSpeed: 3,
              accel: 6,
            },
          }),
        ],
        560,
      ),
      patternSet(
        [
          p("burst", {
            sizeScale: 0.7,
            burst: {
              aimAtPlayer: true,
              bulletArt: "smallSilver",
              bulletCount: 10,
              repeatCount: 3,
            },
          }),
        ],
        660,
      ),
      patternSet(
        [
          p("bossRovingTurret", {
            speedScale: 2,
            sizeScale: 0.8,
            delayScale: 1.3,
            intervalScale: 1.3,
          }),
        ],
        660,
      ),
      patternSet([p("bossGalaxyVortex"), p("bossSineWave")], 660),
      patternSet(
        [
          p("bossFrozenLattice", {
            speedScale: 0.6,
            intervalScale: 1.9,
          }),
        ],
        500,
      ),
      patternSet(
        [
          p("bossStarfall", {
            speedScale: 0.7,
          }),
          p("bossAbyssalUpdraft", {
            speedScale: 0.8,
            intervalScale: 1.8,
          }),
        ],
        560,
      ),
      patternSet(
        [
          p("bossTopIceRain", {
            intervalScale: 1.1,
            topIce: {
              fireMode: "sequence",
              bulletsPerWave: 10,
              delayStepMs: 32,
              spreadRad: 0.025,
            },
          }),
        ],
        630,
      ),
    ],
    tuning: { speedScale: 1, intervalScale: 1 },
  },
  {
    minLevel: 3,
    phaseCount: 4,
    patterns: [
      patternSet(
        [
          needleBurst({
            speedScale: 2,
            delayScale: 0.5,
            intervalScale: 0.5,
          }),
          p("ringPulse", {
            speedScale: 2,
            sizeScale: 2,
          }),
        ],
        660,
      ),
      patternSet(
        [
          p("bossFlappyGate", {
            speedScale: 2.5,
            flappyGate: {
              side: "top",
              gateCount: 1,
              gapSize: 100,
              thickness: 0.05,
              gapMoveMinPx: 300,
              gapMoveMaxPx: 400,
            },
          }),
        ],
        560,
      ),
      patternSet(
        [
          p("bossSideKunaiBarrage", {
            sideKunai: {
              fireMode: "random",
            },
          }),
        ],
        700,
      ),
      patternSet(
        [
          p("burst", {
            sizeScale: 7,
            burst: {
              bulletArt: "red",
              baseSpeed: 3,
              accel: -2,
              minSpeed: 2,
              angleJitterRad: 57,
              bulletCount: 15,
            },
          }),
        ],
        680,
      ),
      patternSet(
        [
          p("burst", {
            burst: {
              bulletArt: "yellow",
              spreadRad: 0.5,
              bulletCount: 3,
              bulletSize: 7,
              baseSpeed: 5,
              accel: -2,
              minSpeed: 2.5,
              repeatCount: 2,
              repeatDelayMs: 500,
            },
          }),
          p("bossEdgeBeam", {
            sizeScale: 1.5,
            edgeBeam: {
              turretLayout: "perimeter",
              fireMode: "random",
              beamCount: 5,
              angleMode: "center",
              warningMs: 1000,
              lifeMs: 2000,
              spreadRad: 3,
            },
          }),
        ],
        660,
      ),
      patternSet([p("bossWeavingStream")], 780),
      patternSet(
        [
          p("bossReflectLaser", {
            speedScale: 1.5,
            sizeScale: 0.7,
            delayScale: 4,
          }),
        ],
        780,
      ),
      patternSet([p("bossDenseRing")], 780),
      patternSet([p("bossWeavingStream")], 780),
      patternSet(
        [
          p("bossSideKunaiBarrage", {
            intervalScale: 1.15,
            sideKunai: {
              aimAtPlayer: true,
              fireMode: "sequence",
              bulletsPerWave: 12,
              delayStepMs: 28,
              spreadRad: 0.03,
            },
          }),
        ],
        780,
      ),
      patternSet([p("bossRovingTurret"), p("spiralShot")], 780),
      patternSet([p("petalRing"), p("bossBigRing"), p("ringPulse")], 780),
    ],
    tuning: { speedScale: 0.96, intervalScale: 1.08 },
  },
  {
    minLevel: 4,
    phaseCount: 4,
    patterns: [
      patternSet([p("bossFrozenLattice")], 820), // できる
      patternSet(
        [
          p("bossSideKunaiBarrage", {
            sizeScale: 0.9,
            sideKunai: {
              fireMode: "random",
              turretGapPx: 10,
              bulletsPerWave: 12,
              delayStepMs: 100,
              baseSpeed: 0.1,
              accel: 0.7,
            },
          }),
          p("bossEdgeBeam", {
            edgeBeam: {
              turretLayout: "perimeter",
              fireMode: "all",
              angleMode: "center",
              warningMs: 3000,
              lifeMs: 3000,
            },
          }),
        ],
        520,
      ), // 中央ビームの檻+横クナイ
      patternSet(
        [
          p("burst", {
            intervalScale: 0.5,
            burst: {
              aimAtPlayer: true,
              bulletArt: "purple",
              bulletCount: 35,
              bulletSize: 7.5,
              baseSpeed: 6,
              accel: -7,
              minSpeed: 1,
              angleJitterRad: 57,
              repeatCount: 2,
            },
          }),
        ],
        820,
      ), // 密集円形の紫
      patternSet(
        [
          p("bossPerimeterGapRing", {
            sizeScale: 0.8,
            speedScale: 3,
            accel: -2,
            minSpeed: 0.3,
          }),
        ],
        820,
      ), // 四方八方のタレットからゆっくりの弾
      patternSet(
        [
          p("bossGigantoRing"),
          p("switchFan", { sizeScale: 0.8 }),
          p("bossLotusBloom"),
        ],
        690,
      ), // 地面にいたらできる
      // patternSet(
      //   [p("bossGalaxyVortex"), p("bossLotusBloom"), p("switchFan")],
      //   820,
      // ), // できるけど上のやつと重複
      patternSet(
        [
          p("burst", {
            sizeScale: 0.7,
            burst: {
              bulletArt: "iceCapsule",
              aimAtPlayer: true,
              angleJitterRad: 20,
              bulletCount: 10,
              baseSpeed: 5,
              accel: -4,
              minSpeed: 1,
              repeatCount: 3,
            },
          }),
          p("bossTopIceRain", {
            sizeScale: 0.9,
            topIce: {
              fireMode: "random",
              bulletsPerWave: 10,
              spreadRad: 0.5,
              baseSpeed: 0.8,
            },
          }),
        ],
        880,
      ), // アイスが落ちてくる
      // patternSet(
      //   [
      //     p("bossEdgeBeam", { edgeBeam: { beamCount: 5 } }),
      //     p("burst", {
      //       sizeScale: 0.6,
      //       burst: {
      //         bulletArt: "yellow",
      //         angleJitterRad: 57,
      //         bulletCount: 30,
      //         baseSpeed: 5,
      //         accel: -4,
      //         repeatCount: 2,
      //         minSpeed: 1,
      //       },
      //     }),
      //   ],
      //   780,
      // ), // かんたんすぎる
    ],
    tuning: { speedScale: 1.02, intervalScale: 1 },
  },
  {
    minLevel: 5,
    phaseCount: 4,
    patterns: [
      patternSet(
        [
          p("bossAbyssalUpdraft", {
            speedScale: 5,
            accel: -3,
            sizeScale: 1.5,
            abyssalUpdraft: { spreadRad: 2.5 },
          }),
          p("burst", {
            burst: {
              aimAtPlayer: true,
              bulletArt: "greenCapsule",
              baseSpeed: 5,
              accel: -2,
              repeatCount: 2,
            },
          }),
        ],
        780,
      ),
      patternSet(
        [
          p("bossReflectLaser", {
            sizeScale: 0.5,
            reflectLaser: {
              count: 40,
              weaveRad: 57,
              weaveMs: 100,
              baseSpeed: 0.8,
              altSpeedAdd: 1.3,
              delayStepMs: 30,
            },
          }),
        ],
        800,
      ), // 大量の小レーザー
      patternSet(
        [
          p("bossAbyssalUpdraft", {
            speedScale: 0.3,
            sizeScale: 0.8,
            abyssalUpdraft: { spreadRad: 3 },
          }),
          p("burst", {
            speedScale: 0.5,
            sizeScale: 0.5,
            burst: {
              bulletArt: "greenCapsule",
              bulletCount: 50,
              angleJitterRad: 57,
            },
          }),
        ],
        850,
      ), // 緑圧縮大量
      patternSet(
        [
          p("bossTopIceRain", {
            speedScale: 3,
            sizeScale: 3,
            topIce: {
              fireMode: "random",
            },
          }),
        ],
        850,
      ),
      patternSet(
        [
          p("burst", {
            sizeScale: 0.8,
            burst: {
              bulletArt: "purple",
              bulletCount: 80,
              angleJitterRad: 27,
              spreadRad: 0.3,
              baseSpeed: 0.2,
              accel: 2,
              repeatCount: 2,
            },
          }),
        ],
        850,
      ), // simple大量紫弾幕
      patternSet(
        [
          p("bossFlappyGate", {
            speedScale: 1.5,
            flappyGate: {
              side: "top",
              gateCount: 4,
              gapSize: 30,
              thickness: 0.4,
            },
          }),
        ],
        850,
      ), // starfallの左右で、よけるだけ
      patternSet(
        [
          p("bossLotusBloom", { speedScale: 0.5, sizeScale: 0.5 }),
          p("bossPerimeterGapRing", { speedScale: 0.4, sizeScale: 0.5 }),
        ],
        880,
      ), // 小さな虹弾ゆっく大量
      // patternSet([p("bossDenseRing"), p("bossWeavingStream")], 800), // まあまあきつい
      // patternSet([p("bossReflectLaser"), p("bossRovingTurret")], 900), // ちょいきつい
    ],
    tuning: { speedScale: 1, intervalScale: 1 },
  },
  {
    minLevel: 6,
    phaseCount: 5,
    patterns: [
      patternSet(
        [
          p("bossClusterVolley", {
            speedScale: 0.5,
            sizeScale: 0.6,
            delayScale: 1.3,
          }),
          p("bossRovingTurret", {
            speedScale: 0.5,
            sizeScale: 0.5,
            delayScale: 1.3,
            intervalScale: 1.3,
          }),
          p("bossGigantoRing"),
        ],
        800,
      ), // 虹色のボス
      patternSet(
        [
          p("bossDenseRing", {
            sizeScale: 0.6,
            denseRing: {
              bulletArt: "kunaiCapsule",
              fireSlots: 8,
              count: 80,
              baseSpeed: 3,
              altSpeedAdd: 2,
            },
          }),
        ],
        800,
      ), // 殺意の高いdenseのクナイ円形
      patternSet(
        [
          p("bossTopIceRain", {
            sizeScale: 0.9,
            topIce: {
              fireMode: "random",
              spreadRad: 0,
              baseSpeed: 0.2,
              accel: 3,
            },
          }),
        ],
        800,
      ), // 氷
      patternSet(
        [
          p("bossFrozenLattice", {
            speedScale: 0.7,
            sizeScale: 0.9,
            delayScale: 10,
          }),
          p("bossDenseRing", {
            sizeScale: 0.9,
            denseRing: {
              bulletArt: "green",
              fireSlots: 8,
              count: 20,
              baseSpeed: 0.7,
              altSpeedAdd: 0.6,
            },
          }),
        ],
        880,
      ), // 大量の緑
      patternSet(
        [
          p("burst", {
            sizeScale: 2,
            burst: {
              aimAtPlayer: true,
              bulletArt: "red",
              spreadRad: 0,
              bulletCount: 1,
              baseSpeed: 7,
              accel: -4,
              minSpeed: 1,
            },
          }),
          p("bossReflectLaser", {
            sizeScale: 0.8,
            reflectLaser: { count: 12, baseSpeed: 2, altSpeedAdd: 2 },
          }),
        ],
        800,
      ), // レーザーに赤のゆっくりの弾を向かわせる
      patternSet(
        [
          p("burst", {
            sizeScale: 0.5,
            burst: {
              aimAtPlayer: true,
              bulletArt: "kunaiCapsule",
              bulletCount: 50,
              baseSpeed: 1,
              speedStep: 0.1,
              accel: 3,
              angleJitterRad: 27,
              repeatCount: 3,
            },
          }),
        ],
        800,
      ), // シンプル高速弾幕
      // patternSet(
      //   [
      //     p("ringPulse"),
      //     p("burst"),
      //     p("crossFire"),
      //     p("petalRing"),
      //     p("switchFan"),
      //   ],
      //   800,
      // ),
      // patternSet([p("bossClusterVolley"), p("bossBigRing")], 800), // ややきつい
      // patternSet([p("bossGigantoRing"), p("bossWeavingStream")], 800),
    ],
    tuning: { speedScale: 1, intervalScale: 1 },
  },
  // 無理
  // {
  //   minLevel: 7,
  //   phaseCount: 5,
  //   patterns: [
  //     patternSet([p("bossPerimeterGapRing"), p("bossWeavingStream")], 700),
  //     patternSet([p("bossAbyssalUpdraft"), p("bossFrozenLattice")], 700),
  //     patternSet(
  //       [p("bossBigRing"), p("bossWeavingStream"), p("bossRovingTurret")],
  //       700,
  //     ),
  //     patternSet(
  //       [
  //         p("crossFire"),
  //         needleBurst(),
  //         p("spiralShot"),
  //         p("bossClusterVolley"),
  //       ],
  //       700,
  //     ),
  //     patternSet(
  //       [p("bossReflectLaser"), p("bossAbyssalUpdraft"), p("spiralShot")],
  //       700,
  //     ),
  //     patternSet(
  //       [p("bossPerimeterGapRing"), p("bossStarfall"), p("crossFire")],
  //       700,
  //     ),
  // patternSet([p("bossStarfall"), p("crossFire")], 1460),
  // patternSet(
  //   [p("bossPerimeterGapRing"), p("bossLotusBloom"), p("bossGigantoRing")],
  //   1440,
  // ),
  //   ],
  //   tuning: { speedScale: 1.14, intervalScale: 0.88 },
  // },
];

export const pickBossPhasePool = (level: number) => {
  for (let i = ART_CRUISE_BOSS_PHASE_POOLS.length - 1; i >= 0; i--) {
    const pool = ART_CRUISE_BOSS_PHASE_POOLS[i];
    if (level >= pool.minLevel) return pool;
  }
  return ART_CRUISE_BOSS_PHASE_POOLS[0];
};
