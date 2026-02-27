import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_selected_color_only_mark";

let state = false;

export const loadSelectedColorOnlyMarkFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const stored = result[STORAGE_KEY] as boolean;
  if (typeof stored === "boolean") {
    state = stored;
  }
};

const saveToStorage = async (enabled: boolean): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getSelectedColorOnlyMark = (): boolean => state;

export const setSelectedColorOnlyMark = async (enabled: boolean): Promise<void> => {
  state = enabled;
  await saveToStorage(enabled);
};
