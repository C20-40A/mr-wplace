import { storage } from "@/utils/browser-api";

// Lock button enhancer enabled type definition
export type LockButtonEnhancerEnabled = boolean;

// Storage key
const STORAGE_KEY = "mr_wplace_lock_button_enhancer";

// Default: enabled (true)
let currentEnabled: LockButtonEnhancerEnabled = true;

// Load from storage
export const loadLockButtonEnhancerFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as LockButtonEnhancerEnabled;
  if (typeof storedEnabled === "boolean") {
    currentEnabled = storedEnabled;
  }
};

// Save to storage
const saveLockButtonEnhancerToStorage = async (
  enabled: LockButtonEnhancerEnabled
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

// Set lock button enhancer enabled (with storage sync)
export const setLockButtonEnhancer = async (
  enabled: LockButtonEnhancerEnabled
): Promise<void> => {
  currentEnabled = enabled;
  await saveLockButtonEnhancerToStorage(enabled);
};

// Get current lock button enhancer enabled state
export const getLockButtonEnhancer = (): LockButtonEnhancerEnabled => {
  return currentEnabled;
};
