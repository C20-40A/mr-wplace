import { storage } from "@/utils/browser-api";

// Layer sort enabled type definition
export type LayerSortEnabled = boolean;

// Storage key
const STORAGE_KEY = "mr_wplace_layer_sort";

// Default: false
let currentEnabled: LayerSortEnabled = false;

// Load from storage
export const loadLayerSortFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as LayerSortEnabled;
  if (typeof storedEnabled === "boolean") {
    currentEnabled = storedEnabled;
  }
};

// Save to storage
const saveLayerSortToStorage = async (
  enabled: LayerSortEnabled
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

// Set layer sort enabled (with storage sync)
export const setLayerSort = async (
  enabled: LayerSortEnabled
): Promise<void> => {
  currentEnabled = enabled;
  await saveLayerSortToStorage(enabled);
};

// Get current layer sort enabled state
export const getLayerSort = (): LayerSortEnabled => {
  return currentEnabled;
};
