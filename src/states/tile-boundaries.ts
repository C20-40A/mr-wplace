import { storage } from "@/utils/browser-api";

// Tile boundaries visibility type definition
export type TileBoundariesVisible = boolean;

// Storage key
const STORAGE_KEY = "mr_wplace_tile_boundaries";

// Default: hidden (false)
let currentVisible: TileBoundariesVisible = false;

// Load from storage
export const loadTileBoundariesFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedVisible = result[STORAGE_KEY] as TileBoundariesVisible;
  if (typeof storedVisible === "boolean") {
    currentVisible = storedVisible;
  }
};

// Save to storage
const saveTileBoundariesToStorage = async (
  visible: TileBoundariesVisible
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: visible });
};

// Set tile boundaries visibility (with storage sync)
export const setTileBoundaries = async (
  visible: TileBoundariesVisible
): Promise<void> => {
  currentVisible = visible;
  await saveTileBoundariesToStorage(visible);
};

// Get current tile boundaries visibility
export const getTileBoundaries = (): TileBoundariesVisible => {
  return currentVisible;
};
