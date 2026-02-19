import { storage } from "@/utils/browser-api";

/**
 * Show unplaced only state management
 */

const STORAGE_KEY = "mr_wplace_show_unplaced_only";

let showUnplacedOnlyState = false;
const listeners: Set<(enabled: boolean) => void> = new Set();

// Load from storage
export const loadShowUnplacedOnlyFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as boolean;
  if (typeof storedEnabled === "boolean") {
    showUnplacedOnlyState = storedEnabled;
    listeners.forEach((listener) => listener(storedEnabled));
  }
};

// Save to storage
const saveShowUnplacedOnlyToStorage = async (enabled: boolean): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getShowUnplacedOnly = (): boolean => {
  return showUnplacedOnlyState;
};

export const setShowUnplacedOnly = async (enabled: boolean): Promise<void> => {
  showUnplacedOnlyState = enabled;
  await saveShowUnplacedOnlyToStorage(enabled);
  listeners.forEach((listener) => listener(enabled));
};

export const subscribeShowUnplacedOnly = (
  listener: (enabled: boolean) => void
): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
