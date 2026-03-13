const BLUE_MARBLE_LOCAL_STORAGE_KEYS = [
  "bmSmartTileCacheVersion",
  "bmSmartTileCacheStats",
] as const;

export const isBlueMarbleDetected = (): boolean => {
  try {
    return BLUE_MARBLE_LOCAL_STORAGE_KEYS.some(
      (key) => window.localStorage.getItem(key) !== null,
    );
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to detect BlueMarble from localStorage:", error);
    return false;
  }
};
