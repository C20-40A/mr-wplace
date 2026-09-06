import { storage } from "@/utils/browser-api";

const LEGACY_STORAGE_KEY = "palette-toggle-hidden";
const COLOR_SELECTOR = "#color-1";

/** Re-enables palettes hidden by the retired palette toggle. */
export const restoreLegacyPaletteVisibility = async (): Promise<void> => {
  const revealPalette = (): boolean => {
    const colorButton = document.querySelector(COLOR_SELECTOR);
    const palette = colorButton?.parentElement?.parentElement;
    if (!palette) return false;

    palette.removeAttribute("hidden");
    return true;
  };

  if (!revealPalette()) {
    const observer = new MutationObserver(() => {
      if (!revealPalette()) return;
      observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  await storage.remove(LEGACY_STORAGE_KEY);
};
