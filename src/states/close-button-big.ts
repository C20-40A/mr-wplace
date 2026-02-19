import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_close_button_big";

let currentEnabled = true;

export const loadCloseButtonBigFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] as boolean;
  if (typeof storedEnabled === "boolean") {
    currentEnabled = storedEnabled;
  }
};

export const setCloseButtonBig = async (enabled: boolean): Promise<void> => {
  currentEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getCloseButtonBig = (): boolean => currentEnabled;
