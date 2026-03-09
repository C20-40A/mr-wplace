import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "overlay-lightweight-mode-enabled";

let overlayLightweightModeState = false;
let subscribers: ((enabled: boolean) => void)[] = [];

export const loadOverlayLightweightModeFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedEnabled = result[STORAGE_KEY] === true;
  overlayLightweightModeState = storedEnabled;
};

const saveOverlayLightweightModeToStorage = async (
  enabled: boolean,
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: enabled });
};

export const getOverlayLightweightMode = (): boolean => {
  return overlayLightweightModeState;
};

export const setOverlayLightweightMode = async (
  enabled: boolean,
): Promise<void> => {
  overlayLightweightModeState = enabled;
  await saveOverlayLightweightModeToStorage(enabled);
  subscribers.forEach((callback) => callback(enabled));
};

export const subscribeOverlayLightweightMode = (
  callback: (enabled: boolean) => void,
): (() => void) => {
  subscribers.push(callback);
  return () => {
    subscribers = subscribers.filter((cb) => cb !== callback);
  };
};
