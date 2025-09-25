import { colorpalette } from "../../constants/colors";

/** Converts a Uint8 array to base64 using the browser's built-in binary to ASCII function */
export function uint8ToBase64(uint8: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

/** Create allowed colors set from color palette */
export function createAllowedColorsSet(): Set<string> {
  const allowed = Array.isArray(colorpalette) ? colorpalette : [];
  const set = new Set(
    allowed
      .filter(
        (color) =>
          (color?.name || "").toLowerCase() !== "transparent" &&
          Array.isArray(color?.rgb)
      )
      .map((color) => `${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`)
  );

  // #deface marker (maps to Transparent color)
  set.add("222,250,206");
  // Special "other" key for non-palette colors
  set.add("other");

  return set;
}
