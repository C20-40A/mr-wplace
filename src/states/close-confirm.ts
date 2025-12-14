import { storage } from "@/utils/browser-api";

// Storage key
const STORAGE_KEY = "mr_wplace_close_confirm";

// Default: disabled (false)
let currentEnabled = false;

// Load from storage
export const loadCloseConfirmFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as boolean;
  if (typeof storedEnabled === "boolean") {
    currentEnabled = storedEnabled;
  }
};

// Save to storage
const saveCloseConfirmToStorage = async (enabled: boolean): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

// Set close confirm enabled (with storage sync)
export const setCloseConfirm = async (enabled: boolean): Promise<void> => {
  currentEnabled = enabled;
  await saveCloseConfirmToStorage(enabled);
};

// Get current close confirm enabled state
export const getCloseConfirm = (): boolean => {
  return currentEnabled;
};
