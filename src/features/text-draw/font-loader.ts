import { kyokugenData } from "../../assets/kyokugen-font";
import type { BitmapChar } from "../../assets/kyokugen-font";

// ========================================
// Types
// ========================================

export interface TTFFont {
  type: "ttf";
  path: string;
  size: number;
}

export interface BitmapFont {
  type: "bitmap";
  data: BitmapChar[];
}

export type FontConfig = TTFFont | BitmapFont;

// ========================================
// Font definitions
// ========================================

export const fonts: Record<string, FontConfig> = {
  Bytesized: {
    type: "ttf",
    path: "assets/fonts/Bytesized/Bytesized-Regular.ttf",
    size: 8,
  },
  Misaki: {
    type: "ttf",
    path: "assets/fonts/misaki/misaki_gothic.ttf",
    size: 8,
  },
  comic_sans_ms_pixel: {
    type: "ttf",
    path: "assets/fonts/comic_sans_ms_pixel/comic_sans_ms_pixel.ttf",
    size: 16,
  },
  c20_pixel: {
    type: "bitmap",
    data: kyokugenData,
  },
};

// ========================================
// Font loading
// ========================================

let fontLoaded = false;

export const ensureFontLoaded = async (): Promise<void> => {
  if (fontLoaded) return;

  for (const [name, config] of Object.entries(fonts)) {
    if (config.type === "ttf") {
      const fontUrl = chrome.runtime.getURL(config.path);
      const font = new FontFace(name, `url(${fontUrl})`);
      await font.load();
      document.fonts.add(font);
      console.log("🧑‍🎨 : Font loaded", name);
    }
  }

  fontLoaded = true;
};
