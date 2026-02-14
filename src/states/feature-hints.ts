import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_feature_hints_v1";

type DismissedHintMap = Record<string, true>;

let dismissedHintMap: DismissedHintMap = {};
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
      const result = await storage.get([STORAGE_KEY]);
      const storedMap = result[STORAGE_KEY] as DismissedHintMap | undefined;
      dismissedHintMap =
        storedMap && typeof storedMap === "object" ? storedMap : {};
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to load feature hints:", error);
      dismissedHintMap = {};
    } finally {
      isLoaded = true;
      loadingPromise = null;
    }
  })();

  await loadingPromise;
};

export const isFeatureHintDismissed = async (hintId: string): Promise<boolean> => {
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

export const resetFeatureHintsState = async (): Promise<void> => {
  dismissedHintMap = {};
  isLoaded = true;
  loadingPromise = null;

  try {
    await storage.remove(STORAGE_KEY);
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to reset feature hint state:", error);
  }
};
