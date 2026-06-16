import { ART_CRUISE_BOSS_PHASE_POOLS } from "../enemy/boss/boss-level-config";

const STORAGE_KEY = "mr-wplace-art-cruise-boss-records";

export type ArtCruiseBossRecord = {
  cleared: true;
  bestTimeMs: number;
};

type ArtCruiseBossRecords = Record<number, ArtCruiseBossRecord>;

// 挑戦可能なボス level の一覧（boss-level-config の minLevel から導出）。
export const ART_CRUISE_BOSS_LEVELS = ART_CRUISE_BOSS_PHASE_POOLS.map(
  (pool) => pool.minLevel,
).sort((a, b) => a - b);

export const ART_CRUISE_MAX_BOSS_LEVEL =
  ART_CRUISE_BOSS_LEVELS[ART_CRUISE_BOSS_LEVELS.length - 1];

const readRecords = (): ArtCruiseBossRecords => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const writeRecords = (records: ArtCruiseBossRecords) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage 不可環境では記録を諦める（プレイは継続）。
  }
};

export const getBossRecords = (): ArtCruiseBossRecords => readRecords();

export const getBossRecord = (level: number): ArtCruiseBossRecord | null =>
  readRecords()[level] ?? null;

export const isBossUnlocked = (level: number) => Boolean(readRecords()[level]);

// クリアを記録。解放を確定し、ベストタイムは短い方のみ更新する。
export const recordBossClear = (level: number, timeMs: number) => {
  const records = readRecords();
  const prev = records[level];
  const bestTimeMs =
    prev && prev.bestTimeMs <= timeMs ? prev.bestTimeMs : timeMs;
  records[level] = { cleared: true, bestTimeMs };
  writeRecords(records);
};
