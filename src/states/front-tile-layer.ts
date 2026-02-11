import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "front-tile-layer-enabled";

let frontTileLayerEnabled = false;
let subscribers: ((enabled: boolean) => void)[] = [];

/**
 * Load front tile layer setting from storage
 */
export const loadFrontTileLayerFromStorage = async (): Promise<void> => {
  try {
    const result = await storage.get(STORAGE_KEY);
    frontTileLayerEnabled = result[STORAGE_KEY] ?? false;
  } catch (error) {
    console.error("🧑‍🎨 : Failed to load front tile layer from storage:", error);
    frontTileLayerEnabled = false;
  }
};

/**
 * Get current front tile layer setting
 */
export const getFrontTileLayer = (): boolean => {
  return frontTileLayerEnabled;
};

/**
 * Set front tile layer setting and persist to storage
 */
export const setFrontTileLayer = async (enabled: boolean): Promise<void> => {
  frontTileLayerEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });

  // Notify subscribers
  subscribers.forEach((callback) => callback(enabled));
};

/**
 * Subscribe to front tile layer changes
 */
export const subscribeFrontTileLayer = (
  callback: (enabled: boolean) => void
): (() => void) => {
  subscribers.push(callback);
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
  };
};
