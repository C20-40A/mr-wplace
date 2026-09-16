import { storage } from "@/utils/browser-api";

const ENABLED_KEY = "paint-beacon-enabled";
const THRESHOLD_KEY = "paint-beacon-threshold";

export const BEACON_THRESHOLD_MIN = 10;
export const BEACON_THRESHOLD_MAX = 100;
export const BEACON_THRESHOLD_STEP = 10;
const DEFAULT_THRESHOLD = 10;

let enabled = false;
let threshold = DEFAULT_THRESHOLD;

const normalizeThreshold = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return DEFAULT_THRESHOLD;
  const stepped =
    Math.round(num / BEACON_THRESHOLD_STEP) * BEACON_THRESHOLD_STEP;
  return Math.min(
    BEACON_THRESHOLD_MAX,
    Math.max(BEACON_THRESHOLD_MIN, stepped),
  );
};

export const loadPaintBeaconFromStorage = async (): Promise<void> => {
  const result = await storage.get([ENABLED_KEY, THRESHOLD_KEY]);
  enabled = result[ENABLED_KEY] === true;
  threshold = normalizeThreshold(result[THRESHOLD_KEY] ?? DEFAULT_THRESHOLD);
};

export const getPaintBeacon = (): boolean => enabled;
export const getPaintBeaconThreshold = (): number => threshold;

export const setPaintBeacon = async (value: boolean): Promise<void> => {
  enabled = value;
  await storage.set({ [ENABLED_KEY]: value });
};

export const setPaintBeaconThreshold = async (value: number): Promise<void> => {
  threshold = normalizeThreshold(value);
  await storage.set({ [THRESHOLD_KEY]: threshold });
};
