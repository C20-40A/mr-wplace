import { storage } from "@/utils/browser-api";

// Navigation mode type definition
export type NavigationMode = boolean; // true: smart (flyTo/jumpTo), false: URL

// Storage key
const STORAGE_KEY = "mr_wplace_navigation_mode";

// Default: URL mode (false)
let currentMode: NavigationMode = true;

// Load from storage
export const loadNavigationModeFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedMode = result[STORAGE_KEY] as NavigationMode;
  if (typeof storedMode === "boolean") {
    currentMode = storedMode;
  }
};

// Save to storage
const saveNavigationModeToStorage = async (
  mode: NavigationMode
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: mode });
};

// Set navigation mode (with storage sync)
export const setNavigationMode = async (
  mode: NavigationMode
): Promise<void> => {
  currentMode = mode;
  await saveNavigationModeToStorage(mode);
};

// Get current navigation mode
export const getNavigationMode = (): NavigationMode => {
  return currentMode;
};
