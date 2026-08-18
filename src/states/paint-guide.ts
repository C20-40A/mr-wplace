import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "paint-guide-enabled";

let paintGuideEnabled = true;

export const loadPaintGuideFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  paintGuideEnabled = result[STORAGE_KEY] !== false;
};

export const getPaintGuide = (): boolean => {
  return paintGuideEnabled;
};

export const setPaintGuide = async (enabled: boolean): Promise<void> => {
  paintGuideEnabled = enabled;
  await storage.set({ [STORAGE_KEY]: enabled });
};
