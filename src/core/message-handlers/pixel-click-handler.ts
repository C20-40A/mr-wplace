/**
 * Pixel Click Handler - Handle pixel click messages from inject side for AutoSpoit
 */

import { getOverlayPixelColor } from "@/utils/inject-bridge";
import { colorpalette } from "@/constants/colors";

/**
 * Setup pixel click message handler
 */
export const setupPixelClickHandler = () => {
  let lastPixelClickColorId: number | null = null;

  return async (event: MessageEvent) => {
    // Listen for pixel click from inject.js
    if (event.data.source !== "wplace-studio-pixel-click") return;

    // autoSpoit dev modeがoffまたは無効時は処理しない
    if (!window.mrWplace?.autoSpoit?.isDevModeEnabled()) return;
    if (!window.mrWplace?.autoSpoit?.isEnabled()) return;

    const { lat, lng } = event.data;
    const color = await getOverlayPixelColor(lat, lng);

    console.log("🧑‍🎨 : Overlay pixel color (before check):", color, {
      lat,
      lng,
    });
    if (!color || color.a === 0) return;

    console.log("🧑‍🎨 : Overlay pixel color:", color, { lat, lng });

    // find color id
    const targetColor = colorpalette.find(
      (c) =>
        c.rgb[0] === color.r && c.rgb[1] === color.g && c.rgb[2] === color.b
    );
    if (!targetColor) return;

    // selectColor
    const el = document.getElementById(`color-${targetColor.id}`);
    if (el) {
      console.log("🧑‍🎨 : Selecting color ID:", targetColor.id);
      el.click();
      lastPixelClickColorId = targetColor.id;
    }
  };
};
