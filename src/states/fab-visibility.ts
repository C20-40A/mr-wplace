import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "mr_wplace_fab_visibility";

export const FAB_FEATURES = [
  "gallery",
  "bookmark",
  "time-travel",
  "data-saver",
  "filter",
] as const;

export type FabFeature = (typeof FAB_FEATURES)[number];

// Default: all visible
let currentVisibility: Record<FabFeature, boolean> = {
  gallery: true,
  bookmark: true,
  "time-travel": true,
  "data-saver": true,
  filter: true,
};

export const loadFabVisibilityFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY]);
  const stored = result[STORAGE_KEY] as Record<string, boolean> | undefined;
  if (!stored || typeof stored !== "object") return;

  for (const key of FAB_FEATURES) {
    if (typeof stored[key] === "boolean") currentVisibility[key] = stored[key];
  }

  if (typeof stored.filter !== "boolean") {
    const legacyColorFilter = stored["color-filter"];
    if (typeof legacyColorFilter === "boolean") {
      currentVisibility.filter = legacyColorFilter;
    }
  }
};

export const setFabVisibility = async (
  visibility: Record<FabFeature, boolean>
): Promise<void> => {
  currentVisibility = { ...visibility };
  await storage.set({ [STORAGE_KEY]: currentVisibility });
};

export const getFabVisibility = (): Readonly<Record<FabFeature, boolean>> =>
  currentVisibility;
