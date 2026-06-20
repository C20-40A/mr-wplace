import type { ArtCruiseStageContext, ArtCruiseStageSpawn } from "./types";
import { GRUNT_FORMATION_BUILDERS } from "./grunt-formations";
import type { ArtCruiseGruntFormationConfig } from "./grunt-level-config";
import { createBossDronePatternConfig } from "../enemy/boss/boss-pattern-config";

// フォーメーション内の grunt へ bulletPatterns を順番に割り当てる。
// 既に bulletPattern を持つ spawn(squad など)はそのまま残す。
const applyBulletPatterns = (
  spawns: ArtCruiseStageSpawn[],
  config: ArtCruiseGruntFormationConfig,
): ArtCruiseStageSpawn[] => {
  if (!config.bulletPatterns.length) return spawns;
  let gruntIndex = 0;
  return spawns.map((spawn) => {
    if (spawn.rank !== "grunt" || spawn.bulletPattern) return spawn;
    const pattern =
      config.bulletPatterns[gruntIndex % config.bulletPatterns.length];
    gruntIndex += 1;
    return pattern
      ? { ...spawn, bulletPattern: pattern.id, bulletTuning: pattern.tuning }
      : spawn;
  });
};

/** フォーメーション config から spawn 列を生成して bulletPattern を適用 */
export const buildFormationSpawns = (
  config: ArtCruiseGruntFormationConfig,
): ArtCruiseStageSpawn[] =>
  applyBulletPatterns(GRUNT_FORMATION_BUILDERS[config.id](), config);

/** boss spawn を生成 */
export const buildBossSpawn = (
  context: ArtCruiseStageContext,
): ArtCruiseStageSpawn => ({
  rank: "boss",
  delayMs: 1400,
  xRatio: 0.5,
  yRatio: -0.14,
  movement: "none",
  speedScale: 0.72,
  bossPhases: createBossDronePatternConfig(context),
});
