import type { ArtCruiseStageContext } from "./types";

type BossWaveRequirement = {
  minLevel: number;
  waves: number;
};

export const ART_CRUISE_STAGE_BALANCE = {
  initialLevel: 1,
  openingGraceMs: 1_000,
  waveGap: {
    baseMs: 1_400,
    jitterMs: 800,
    perLevelMs: 110,
    minMs: 450,
  },
  bossDefeatRestMs: 4_000,
  // boss 条件成立後、敵が捌けるまで boss を待つ間の再評価間隔
  bossWaitRetryMs: 500,
  breather: {
    everyModules: 4,
    extraMs: 1_300,
  },
  bossCadence: {
    requiredWaves: [
      { minLevel: 1, waves: 5 },
      { minLevel: 3, waves: 7 },
      { minLevel: 6, waves: 10 },
      { minLevel: 9, waves: 12 },
    ] satisfies BossWaveRequirement[],
    calmWeight: 3,
    pressureExtraWaves: 2,
    pressureWeight: 8,
  },
} as const;

export const getRequiredWavesBeforeBoss = (level: number) => {
  let required = ART_CRUISE_STAGE_BALANCE.bossCadence.requiredWaves[0].waves;
  for (const item of ART_CRUISE_STAGE_BALANCE.bossCadence.requiredWaves) {
    if (level >= item.minLevel) required = item.waves;
  }
  return required;
};

export const canSpawnBossWave = ({
  sinceBoss,
  requiredWavesBeforeBoss,
}: ArtCruiseStageContext) => sinceBoss >= requiredWavesBeforeBoss;
