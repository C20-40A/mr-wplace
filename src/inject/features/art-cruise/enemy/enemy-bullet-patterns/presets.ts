import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
} from "../enemy-rules/types";

export type ArtCruiseBulletPatternSpec = {
  id: ArtCruiseEnemyBulletPatternId;
  tuning?: ArtCruiseBulletPatternTuning;
};

const NEEDLE_BURST_TUNING: ArtCruiseBulletPatternTuning = {
  intervalScale: 1600 / 1100,
  burst: {
    aimAtPlayer: true,
    bulletArt: "blue",
    bulletCount: 5,
    bulletSize: 6,
    spreadRad: 0,
    angleJitterRad: 0.05,
    baseSpeed: 7,
    accel: -6,
    minSpeed: 3.5,
    speedStep: 0.1,
    delayStepMs: 100,
  },
};

export const needleBurst = (
  tuning?: ArtCruiseBulletPatternTuning,
): ArtCruiseBulletPatternSpec => ({
  id: "burst",
  tuning: {
    ...NEEDLE_BURST_TUNING,
    ...tuning,
    burst: {
      ...NEEDLE_BURST_TUNING.burst,
      ...tuning?.burst,
    },
  },
});
