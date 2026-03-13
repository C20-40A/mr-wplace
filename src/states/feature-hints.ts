import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_feature_hints_v1";
const SETTINGS_STORAGE_KEY = "mr_wplace_feature_hint_settings_v1";
const DEFAULT_FEATURE_HINT_COOLDOWN_MS = 1000;

type DismissedHintMap = Record<string, true>;
type FeatureHintSettings = {
  cooldownMs?: number;
};

let dismissedHintMap: DismissedHintMap = {};
let featureHintSettings: FeatureHintSettings = {};
let isLoaded = false;
let loadingPromise: Promise<void> | null = null;

const ensureLoaded = async (): Promise<void> => {
  if (isLoaded) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      const result = await storage.get([STORAGE_KEY, SETTINGS_STORAGE_KEY]);
      const storedMap = result[STORAGE_KEY] as DismissedHintMap | undefined;
      const storedSettings = result[SETTINGS_STORAGE_KEY] as
        | FeatureHintSettings
        | undefined;
      dismissedHintMap =
        storedMap && typeof storedMap === "object" ? storedMap : {};
      featureHintSettings =
        storedSettings && typeof storedSettings === "object"
          ? storedSettings
          : {};
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to load feature hints:", error);
      dismissedHintMap = {};
      featureHintSettings = {};
    } finally {
      isLoaded = true;
      loadingPromise = null;
    }
  })();

  await loadingPromise;
};

export const isFeatureHintDismissed = async (
  hintId: string,
): Promise<boolean> => {
  await ensureLoaded();
  return dismissedHintMap[hintId] === true;
};

export const dismissFeatureHint = async (hintId: string): Promise<void> => {
  await ensureLoaded();
  if (dismissedHintMap[hintId]) return;

  dismissedHintMap = {
    ...dismissedHintMap,
    [hintId]: true,
  };

  try {
    await storage.set({ [STORAGE_KEY]: dismissedHintMap });
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to persist feature hint state:", error);
  }
};

export const getFeatureHintCooldownMs = async (): Promise<number> => {
  await ensureLoaded();
  const cooldownMs = featureHintSettings.cooldownMs;
  return typeof cooldownMs === "number" && cooldownMs >= 0
    ? cooldownMs
    : DEFAULT_FEATURE_HINT_COOLDOWN_MS;
};

export const setFeatureHintCooldownMs = async (
  cooldownMs: number,
): Promise<void> => {
  await ensureLoaded();
  const normalizedCooldownMs = Math.max(0, Math.floor(cooldownMs));
  featureHintSettings = {
    ...featureHintSettings,
    cooldownMs: normalizedCooldownMs,
  };

  try {
    await storage.set({ [SETTINGS_STORAGE_KEY]: featureHintSettings });
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to persist feature hint settings:", error);
  }
};

export const resetFeatureHintsState = async (): Promise<void> => {
  dismissedHintMap = {};
  featureHintSettings = {};
  isLoaded = true;
  loadingPromise = null;

  try {
    await storage.remove(STORAGE_KEY);
    await storage.remove(SETTINGS_STORAGE_KEY);
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to reset feature hint state:", error);
  }
};
