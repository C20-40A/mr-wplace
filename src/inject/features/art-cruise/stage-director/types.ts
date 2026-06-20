import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyMovementId,
  ArtCruiseEnemyRank,
} from "../enemy/enemy-rules/types";
import type { ArtCruiseBossPhaseConfig } from "../enemy/boss/boss-pattern-config";

export type ArtCruiseStageSpawn = {
  rank: ArtCruiseEnemyRank;
  delayMs: number;
  xRatio?: number;
  yRatio?: number;
  movement?: ArtCruiseEnemyMovementId;
  speedScale?: number;
  hpBonus?: number;
  bossPhases?: ArtCruiseBossPhaseConfig[];
  squadId?: string;
  bulletPattern?: ArtCruiseEnemyBulletPatternId;
  bulletTuning?: ArtCruiseBulletPatternTuning;
};

export type ArtCruiseStageContext = {
  level: number;
  activeEnemies: number;
  maxEnemies: number;
  sinceBoss: number;
  requiredWavesBeforeBoss: number;
};

export type ArtCruiseDebugWaveOption = {
  index: number;
  label: string;
};
