import { colorpalette } from "../../constants/colors";

/** Create allowed colors set from color palette */
export const createAllowedColorsSet = (): Set<string> => {
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
};
