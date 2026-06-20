const STORAGE_KEY = "mr-wplace-art-cruise-high-score";

export type ArtCruiseHighScore = {
  score: number;
  survivalMs: number;
  level: number;
  updatedAt: number;
};

export type ArtCruiseHighScoreResult = ArtCruiseHighScore & {
  isNewBest: boolean;
};

const isHighScore = (value: unknown): value is ArtCruiseHighScore => {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<ArtCruiseHighScore>;
  return (
    typeof record.score === "number" &&
    typeof record.survivalMs === "number" &&
    typeof record.level === "number" &&
    typeof record.updatedAt === "number"
  );
};

const readHighScore = (): ArtCruiseHighScore | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isHighScore(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeHighScore = (record: ArtCruiseHighScore) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage 不可環境では記録を諦める（プレイは継続）。
  }
};

const isBetterScore = (
  next: Pick<ArtCruiseHighScore, "score" | "survivalMs">,
  prev: Pick<ArtCruiseHighScore, "score" | "survivalMs">,
) => {
  if (next.score !== prev.score) return next.score > prev.score;
  return next.survivalMs > prev.survivalMs;
};

export const getHighScore = (): ArtCruiseHighScore | null => readHighScore();

export const recordHighScore = (
  score: number,
  survivalMs: number,
  level: number,
): ArtCruiseHighScoreResult => {
  const next = {
    score: Math.max(0, Math.floor(score)),
    survivalMs: Math.max(0, Math.floor(survivalMs)),
    level: Math.max(1, Math.floor(level)),
    updatedAt: Date.now(),
  };
  const prev = readHighScore();
  if (!prev || isBetterScore(next, prev)) {
    writeHighScore(next);
    return { ...next, isNewBest: true };
  }

  return { ...prev, isNewBest: false };
};
