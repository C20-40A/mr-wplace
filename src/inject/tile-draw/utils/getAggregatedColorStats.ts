import { perTileColorStats } from "../states-inject";

export const getAggregatedColorStats = (
  imageKeys: string[]
): Record<string, { matched: number; total: number }> => {
  const aggregated: Record<string, { matched: number; total: number }> = {};

  for (const imageKey of imageKeys) {
    const tileStatsMap = perTileColorStats.get(imageKey);
    if (!tileStatsMap) continue;

    for (const stats of tileStatsMap.values()) {
      // matched集計
      for (const [colorKey, count] of stats.matched.entries()) {
        if (!aggregated[colorKey]) {
          aggregated[colorKey] = { matched: 0, total: 0 };
        }
        aggregated[colorKey].matched += count;
      }

      // total集計
      for (const [colorKey, count] of stats.total.entries()) {
        if (!aggregated[colorKey]) {
          aggregated[colorKey] = { matched: 0, total: 0 };
        }
        aggregated[colorKey].total += count;
      }
    }
  }

  return aggregated;
};
