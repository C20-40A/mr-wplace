import { storage } from "@/utils/browser-api";
import { isBlueMarbleDetected } from "@/utils/blue-marble";

const STORAGE_KEY = "front-tile-layer-enabled";
const MIGRATION_KEY = "front-tile-layer-migrated-to-independent-v1";

let frontTileLayerEnabled = false;
let subscribers: ((enabled: boolean) => void)[] = [];

/**
 * Load front tile layer setting from storage.
 * One-time migration: default to composite for BlueMarble users, otherwise independent.
 */
export const loadFrontTileLayerFromStorage = async (): Promise<void> => {
  try {
    const result = await storage.get([STORAGE_KEY, MIGRATION_KEY]);
    const migrated = result[MIGRATION_KEY] ?? false;
    if (!migrated) {
      const defaultEnabled = !isBlueMarbleDetected();
      frontTileLayerEnabled = defaultEnabled;
      await storage.set({
        [STORAGE_KEY]: defaultEnabled,
        [MIGRATION_KEY]: true,
      });
    } else {
      frontTileLayerEnabled = result[STORAGE_KEY] ?? true;
    }
  } catch (error) {
    console.error("🧑‍🎨 : Failed to load front tile layer from storage:", error);
    frontTileLayerEnabled = true;
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
