import { kyokugenData } from "../../assets/kyokugen-font";
import type { BitmapChar } from "../../assets/kyokugen-font";
import { runtime } from "@/utils/browser-api";

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
  k8x12: {
    type: "ttf",
    path: "assets/fonts/k8x12/k8x12S.ttf",
    size: 12,
  },
  KH_Dot_Akihabara_16: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Akihabara-16.ttf",
    size: 16,
  },
  KH_Dot_Dougenzaka_12: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Dougenzaka-12.ttf",
    size: 12,
  },
  KH_Dot_Hatchoubori_16: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Hatchoubori-16.ttf",
    size: 16,
  },
  KH_Dot_Kabutochou_16: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Kabutochou-16.ttf",
    size: 16,
  },
  KH_Dot_Kagurazaka_12: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Kagurazaka-12.ttf",
    size: 12,
  },
  KH_Dot_Kodenmachou_12: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Kodenmachou-12.ttf",
    size: 12,
  },
  KH_Dot_Ningyouchou_16: {
    type: "ttf",
    path: "assets/fonts/khdotfont-20150527/KH-Dot-Ningyouchou-16.ttf",
    size: 16,
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
      const fontUrl = runtime.getURL(config.path);
      const font = new FontFace(name, `url(${fontUrl})`);
      await font.load();
      document.fonts.add(font);
      console.log("🧑‍🎨 : Font loaded", name);
    }
  }

  fontLoaded = true;
};
