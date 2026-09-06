import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_compact_bottom_sheet";

// Default: disabled (experimental)
let currentEnabled = false;

export const loadCompactBottomSheetFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  currentEnabled = result[STORAGE_KEY] === true;
};

export const getCompactBottomSheet = (): boolean => currentEnabled;

export const setCompactBottomSheet = async (enabled: boolean): Promise<void> => {
  currentEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });
};
