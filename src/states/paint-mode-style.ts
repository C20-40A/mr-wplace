import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_paint_mode_style";

// Default: enabled (true)
let currentEnabled = true;

export const loadPaintModeStyleFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as boolean;
  if (typeof storedEnabled === "boolean") {
    currentEnabled = storedEnabled;
  }
};

export const setPaintModeStyle = async (enabled: boolean): Promise<void> => {
  currentEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getPaintModeStyle = (): boolean => currentEnabled;