import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_hide_my_location";

let currentEnabled = true;

export const loadHideMyLocationFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const stored = result[STORAGE_KEY] as boolean;
  if (typeof stored === "boolean") currentEnabled = stored;
};

export const setHideMyLocation = async (enabled: boolean): Promise<void> => {
  currentEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getHideMyLocation = (): boolean => currentEnabled;
