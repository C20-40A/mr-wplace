import type {
  ArtCruiseBulletPatternContext,
  ArtCruiseBulletPatternMeta,
  ArtCruiseBulletPatternTuning,
  ArtCruiseBulletPatternModule,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyBulletSpawn,
  ArtCruiseEnemyRank,
} from "../enemy-rules/types";
import {
  BUILTIN_BULLET_PATTERNS,
  getPerimeterGapRingOrigins,
  getWeavingStreamOrigins,
} from "./patterns";

export { getPerimeterGapRingOrigins, getWeavingStreamOrigins };

const PATTERN_REGISTRY = new Map<
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseBulletPatternModule
>(BUILTIN_BULLET_PATTERNS.map((m) => [m.id, m]));

/** 登録済み弾幕パターン id の一覧（debug 用） */
export const ART_CRUISE_BULLET_PATTERN_IDS = Array.from(
  PATTERN_REGISTRY.keys(),
);

export const getBulletPatternFireInterval = (
  pattern: ArtCruiseEnemyBulletPatternId,
  tuning?: ArtCruiseBulletPatternTuning,
): number =>
  (PATTERN_REGISTRY.get(pattern)?.fireIntervalMs ?? 1200) *
  (tuning?.intervalScale ?? 1);

export const getBulletPatternShotSeId = (
  pattern: ArtCruiseEnemyBulletPatternId,
) => PATTERN_REGISTRY.get(pattern)?.shotSeId;

/** パターンのメタ情報を取得（rank / ultimateName / launcherOrigins） */
export const getBulletPatternMeta = (
  pattern: ArtCruiseEnemyBulletPatternId,
): ArtCruiseBulletPatternMeta | undefined => PATTERN_REGISTRY.get(pattern);

/** rank で絞り込んだパターン id 一覧（boss 抽選などに利用） */
export const getBulletPatternIdsByRank = (
  rank: ArtCruiseEnemyRank,
): ArtCruiseEnemyBulletPatternId[] =>
  Array.from(PATTERN_REGISTRY.values())
    .filter((m) => (m.rank ?? "grunt") === rank)
    .map((m) => m.id);

/** ランチャー基点を返す。launcherOrigins 未定義のパターンは null。 */
export const getBulletPatternLauncherOrigins = (
  pattern: ArtCruiseEnemyBulletPatternId,
  bounds: { width: number; height: number },
): { x: number; y: number }[] | null =>
  PATTERN_REGISTRY.get(pattern)?.launcherOrigins?.(bounds) ?? null;

export const createEnemyBulletSpawns = (
  pattern: ArtCruiseEnemyBulletPatternId,
  ctx: ArtCruiseBulletPatternContext,
): ArtCruiseEnemyBulletSpawn[] => {
  const spawns = PATTERN_REGISTRY.get(pattern)?.create(ctx) ?? [];
  const tuning = ctx.tuning;
  if (!tuning) return spawns;

  const speedScale = tuning.speedScale ?? 1;
  const accelScale = tuning.accelScale ?? speedScale;
  const accel =
    tuning.accel === undefined ? undefined : tuning.accel * accelScale;
  const minSpeed =
    tuning.minSpeed === undefined ? undefined : tuning.minSpeed * speedScale;
  const sizeScale = tuning.sizeScale ?? 1;
  const delayScale = tuning.delayScale ?? 1;

  return spawns.map((spawn) => ({
    ...spawn,
    speed: spawn.speed * speedScale,
    minSpeed:
      spawn.minSpeed === undefined ? minSpeed : spawn.minSpeed * speedScale,
    accel:
      spawn.accel === undefined
        ? accel
        : spawn.accel * accelScale,
    size: spawn.size === undefined ? undefined : spawn.size * sizeScale,
    delayMs:
      spawn.delayMs === undefined ? undefined : spawn.delayMs * delayScale,
    length: spawn.length === undefined ? undefined : spawn.length * sizeScale,
  }));
};

/** 新パターンモジュールを外部から登録できる拡張ポイント */
export const registerBulletPattern = (module: ArtCruiseBulletPatternModule) =>
  PATTERN_REGISTRY.set(module.id, module);
