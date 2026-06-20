import type {
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyBulletPatternId,
} from "../enemy-rules/types";
import { getBulletPatternMeta } from "../enemy-bullet-patterns";
import type {
  ArtCruiseBossPatternSet,
  ArtCruiseBossPhasePool,
} from "./boss-level-config";
import {
  ART_CRUISE_BOSS_PHASE_POOLS,
  pickBossPhasePool,
} from "./boss-level-config";

export type ArtCruiseBossPhaseConfig = {
  /** このフェーズで同時発射する弾幕パターン群 */
  bulletPatterns: ArtCruiseEnemyBulletPatternId[];
  hp: number;
  ultimateName?: string;
  bulletTuning?: ArtCruiseBulletPatternTuning;
  bulletPatternTunings?: Partial<
    Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>
  >;
};

export type ArtCruiseBossPatternContext = {
  level: number;
  sinceBoss: number;
  debugPatterns?: ArtCruiseEnemyBulletPatternId[];
  debugTuning?: ArtCruiseBulletPatternTuning;
  debugPatternTunings?: Partial<
    Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>
  >;
};

const resolvePhase = (
  patternSet: ArtCruiseBossPatternSet,
  tuning?: ArtCruiseBulletPatternTuning,
  patternTunings = patternSet.patternTunings,
): ArtCruiseBossPhaseConfig => {
  const bulletPatterns = patternSet.ids;
  const metas = bulletPatterns.map(getBulletPatternMeta);
  // 複数パターン時は名前を新設せず、選ばれた全パターン名を表示する。
  const ultimateName = metas
    .map((m, i) => m?.ultimateName ?? bulletPatterns[i])
    .join(" / ");
  return {
    bulletPatterns,
    hp: patternSet.hp,
    ultimateName,
    bulletTuning: tuning,
    bulletPatternTunings: patternTunings,
  };
};

const patternKey = (pattern: ArtCruiseBossPatternSet) =>
  [...pattern.ids].sort().join("|");

const mergePatternTunings = (
  patternSet: ArtCruiseBossPatternSet,
  debugTunings:
    | Partial<Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>>
    | undefined,
) => {
  if (!debugTunings) return patternSet.patternTunings;
  const matched = patternSet.ids.flatMap((id) =>
    debugTunings[id] ? [[id, debugTunings[id]] as const] : [],
  );
  if (!matched.length) return patternSet.patternTunings;
  return {
    ...patternSet.patternTunings,
    ...Object.fromEntries(matched),
  };
};

const shuffled = <T>(items: T[]) => {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

const pickUniquePatterns = (
  level: number,
  pool: ArtCruiseBossPhasePool,
) => {
  const selected: ArtCruiseBossPatternSet[] = [];
  const used = new Set<string>();
  const pools = [
    pool,
    ...ART_CRUISE_BOSS_PHASE_POOLS.filter(
      (candidate) => candidate !== pool && candidate.minLevel <= level,
    ).sort((a, b) => b.minLevel - a.minLevel),
  ];

  for (const candidate of pools) {
    for (const pattern of shuffled(candidate.patterns)) {
      const key = patternKey(pattern);
      if (used.has(key)) continue;
      used.add(key);
      selected.push(pattern);
      if (selected.length >= pool.phaseCount) return selected;
    }
  }

  return selected;
};

export const createBossDronePatternConfig = (
  context: ArtCruiseBossPatternContext,
): ArtCruiseBossPhaseConfig[] => {
  const pool = pickBossPhasePool(context.level);
  const tuning = context.debugTuning ?? pool.tuning;
  const debugPatterns = context.debugPatterns;
  const debugHp = pool.patterns[0]?.hp ?? 700;
  if (debugPatterns?.length)
    return Array.from({ length: pool.phaseCount }, () =>
      resolvePhase(
        { ids: debugPatterns, hp: debugHp },
        tuning,
        context.debugPatternTunings,
      ),
    );

  return pickUniquePatterns(context.level, pool).map((pattern) =>
    resolvePhase(
      pattern,
      tuning,
      mergePatternTunings(pattern, context.debugPatternTunings),
    ),
  );
};
