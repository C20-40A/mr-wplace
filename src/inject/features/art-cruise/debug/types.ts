import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyMovementId,
  ArtCruiseEnemyRank,
} from "../enemy/enemy-rules/types";

export type ArtCruiseDebugConfig = {
  showHitboxes?: boolean;
};

export type ArtCruiseDebugEnemyId = "gruntDrone" | "bossDrone";

export type ArtCruiseDebugFormationId =
  | "vFormation"
  | "straightPass"
  | "snake"
  | "sideSlide";

export type ArtCruiseDebugSpawnOptions = {
  enemyId: ArtCruiseDebugEnemyId;
  rank?: ArtCruiseEnemyRank;
  bulletPattern?: ArtCruiseEnemyBulletPatternId;
  bulletTuning?: ArtCruiseBulletPatternTuning;
  movement?: ArtCruiseEnemyMovementId;
  squad?: boolean;
  formation?: ArtCruiseDebugFormationId;
};

export type ArtCruiseDebugBossOptions = {
  patterns?: ArtCruiseEnemyBulletPatternId[];
  tuning?: ArtCruiseBulletPatternTuning;
  patternTunings?: Partial<
    Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>
  >;
};
