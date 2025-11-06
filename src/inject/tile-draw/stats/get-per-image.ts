import { perTileColorStats } from "../states";

/**
 * 画像ごとの集計統計を取得
 * @param imageKeys 統計を取得する画像キーの配列
 * @returns 画像キーごとの matched/total 統計
 */
export const getStatsPerImage = (
  imageKeys: string[]
): Record<string, { matched: Record<string, number>; total: Record<string, number> }> => {
  const result: Record<
    string,
    { matched: Record<string, number>; total: Record<string, number> }
  > = {};

  for (const imageKey of imageKeys) {
    const tileStatsMap = perTileColorStats.get(imageKey);
    if (!tileStatsMap) continue;

    const matched: Record<string, number> = {};
    const total: Record<string, number> = {};

    // タイルごとの統計を集計
    for (const stats of tileStatsMap.values()) {
      // matched集計
      for (const [colorKey, count] of stats.matched.entries()) {
        matched[colorKey] = (matched[colorKey] || 0) + count;
      }

      // total集計
      for (const [colorKey, count] of stats.total.entries()) {
        total[colorKey] = (total[colorKey] || 0) + count;
      }
    }

    result[imageKey] = { matched, total };
  }

  return result;
};
