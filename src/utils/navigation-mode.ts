// Navigation mode type definition
export type NavigationMode = boolean; // true: smart (flyTo/jumpTo), false: URL

// Storage key
const STORAGE_KEY = "mr_wplace_navigation_mode";

// Default: URL mode (false)
let currentMode: NavigationMode = true;

// Load from storage
export async function loadNavigationModeFromStorage(): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const storedMode = result[STORAGE_KEY] as NavigationMode;
    if (typeof storedMode === "boolean") {
      currentMode = storedMode;
    }
  }
}

// Save to storage
export async function saveNavigationModeToStorage(
  mode: NavigationMode
): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    await chrome.storage.local.set({ [STORAGE_KEY]: mode });
  }
}

// Set navigation mode (with storage sync)
export async function setNavigationMode(mode: NavigationMode): Promise<void> {
  currentMode = mode;
  await saveNavigationModeToStorage(mode);
}

// Get current navigation mode
export function getNavigationMode(): NavigationMode {
  return currentMode;
}
