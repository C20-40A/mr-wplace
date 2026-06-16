export type CruiseRank = {
  /** この称号に到達する最小スコア */
  minScore: number;
  /** ランク記号 */
  badge: string;
  /** 称号名（短い英語ワード） */
  title: string;
  /** アクセントカラー */
  color: string;
  /** glow 用 rgba */
  glow: string;
};

// スコアが高いものから順に並べる
const CRUISE_RANKS: CruiseRank[] = [
  {
    minScore: 400000,
    badge: "∞",
    title: "MAX",
    color: "#858585",
    glow: "rgba(133, 133, 133, 0.50)",
  },
  {
    minScore: 300000,
    badge: "SSS",
    title: "LEGEND",
    color: "#fde68a",
    glow: "rgba(250, 204, 21, 0.95)",
  },
  {
    minScore: 200000,
    badge: "SS",
    title: "COSMIC ACE",
    color: "#f0abfc",
    glow: "rgba(232, 121, 249, 0.9)",
  },
  {
    minScore: 150000,
    badge: "S",
    title: "STAR CAPTAIN",
    color: "#67e8f9",
    glow: "rgba(34, 211, 238, 0.9)",
  },
  {
    minScore: 100000,
    badge: "A",
    title: "ACE PILOT",
    color: "#86efac",
    glow: "rgba(74, 222, 128, 0.85)",
  },
  {
    minScore: 80000,
    badge: "B",
    title: "NAVIGATOR",
    color: "#a5b4fc",
    glow: "rgba(129, 140, 248, 0.8)",
  },
  {
    minScore: 20000,
    badge: "C",
    title: "CRUISER",
    color: "#fbcfe8",
    glow: "rgba(244, 114, 182, 0.8)",
  },
  {
    minScore: 0,
    badge: "D",
    title: "ROOKIE",
    color: "#e0faff",
    glow: "rgba(148, 163, 184, 0.7)",
  },
];

export const resolveRank = (score: number): CruiseRank => {
  const s = Math.max(0, Math.floor(score));
  return (
    CRUISE_RANKS.find((rank) => s >= rank.minScore) ??
    CRUISE_RANKS[CRUISE_RANKS.length - 1]
  );
};

/** 次のランク情報と不足スコア（最高ランクなら null） */
export const nextRankInfo = (
  score: number,
): { rank: CruiseRank; gap: number } | null => {
  const s = Math.max(0, Math.floor(score));
  const higher = CRUISE_RANKS.filter((rank) => rank.minScore > s);
  if (higher.length === 0) return null;
  const next = higher[higher.length - 1];
  return { rank: next, gap: next.minScore - s };
};
