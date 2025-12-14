/** Color palette entry interface */
interface ColorPaletteEntry {
  id: number; // WPlace API color ID (used for localStorage selected-color)
  sort: number; // UI display order
  premium: boolean;
  name: string;
  rgb: [number, number, number];
}

/** The color palette used by wplace.live
 * id: WPlace API color ID (matches localStorage selected-color value)
 * sort: UI display order
 */
export const colorpalette: ColorPaletteEntry[] = [
  { id: 1, sort: 1, premium: false, name: "Black", rgb: [0, 0, 0] },
  { id: 2, sort: 2, premium: false, name: "Dark Gray", rgb: [60, 60, 60] },
  { id: 3, sort: 3, premium: false, name: "Gray", rgb: [120, 120, 120] },
  { id: 32, sort: 4, premium: true, name: "Medium Gray", rgb: [170, 170, 170] },
  { id: 4, sort: 5, premium: false, name: "Light Gray", rgb: [210, 210, 210] },
  { id: 5, sort: 6, premium: false, name: "White", rgb: [255, 255, 255] },
  { id: 6, sort: 7, premium: false, name: "Deep Red", rgb: [96, 0, 24] },
  { id: 33, sort: 8, premium: true, name: "Dark Red", rgb: [165, 14, 30] },
  { id: 7, sort: 9, premium: false, name: "Red", rgb: [237, 28, 36] },
  { id: 34, sort: 10, premium: true, name: "Light Red", rgb: [250, 128, 114] },
  { id: 35, sort: 11, premium: true, name: "Dark Orange", rgb: [228, 92, 26] },
  { id: 8, sort: 12, premium: false, name: "Orange", rgb: [255, 127, 39] },
  { id: 9, sort: 13, premium: false, name: "Gold", rgb: [246, 170, 9] },
  { id: 10, sort: 14, premium: false, name: "Yellow", rgb: [249, 221, 59] },
  { id: 11, sort: 15, premium: false, name: "Light Yellow", rgb: [255, 250, 188] },
  { id: 37, sort: 16, premium: true, name: "Dark Goldenrod", rgb: [156, 132, 49] },
  { id: 38, sort: 17, premium: true, name: "Goldenrod", rgb: [197, 173, 49] },
  { id: 39, sort: 18, premium: true, name: "Light Goldenrod", rgb: [232, 212, 95] },
  { id: 40, sort: 19, premium: true, name: "Dark Olive", rgb: [74, 107, 58] },
  { id: 41, sort: 20, premium: true, name: "Olive", rgb: [90, 148, 74] },
  { id: 42, sort: 21, premium: true, name: "Light Olive", rgb: [132, 197, 115] },
  { id: 12, sort: 22, premium: false, name: "Dark Green", rgb: [14, 185, 104] },
  { id: 13, sort: 23, premium: false, name: "Green", rgb: [19, 230, 123] },
  { id: 14, sort: 24, premium: false, name: "Light Green", rgb: [135, 255, 94] },
  { id: 15, sort: 25, premium: false, name: "Dark Teal", rgb: [12, 129, 110] },
  { id: 16, sort: 26, premium: false, name: "Teal", rgb: [16, 174, 166] },
  { id: 17, sort: 27, premium: false, name: "Light Teal", rgb: [19, 225, 190] },
  { id: 43, sort: 28, premium: true, name: "Dark Cyan", rgb: [15, 121, 159] },
  { id: 20, sort: 29, premium: false, name: "Cyan", rgb: [96, 247, 242] },
  { id: 44, sort: 30, premium: true, name: "Light Cyan", rgb: [187, 250, 242] },
  { id: 18, sort: 31, premium: false, name: "Dark Blue", rgb: [40, 80, 158] },
  { id: 19, sort: 32, premium: false, name: "Blue", rgb: [64, 147, 228] },
  { id: 45, sort: 33, premium: true, name: "Light Blue", rgb: [125, 199, 255] },
  { id: 46, sort: 34, premium: true, name: "Dark Indigo", rgb: [77, 49, 184] },
  { id: 21, sort: 35, premium: false, name: "Indigo", rgb: [107, 80, 246] },
  { id: 22, sort: 36, premium: false, name: "Light Indigo", rgb: [153, 177, 251] },
  { id: 47, sort: 37, premium: true, name: "Dark Slate Blue", rgb: [74, 66, 132] },
  { id: 48, sort: 38, premium: true, name: "Slate Blue", rgb: [122, 113, 196] },
  { id: 49, sort: 39, premium: true, name: "Light Slate Blue", rgb: [181, 174, 241] },
  { id: 23, sort: 40, premium: false, name: "Dark Purple", rgb: [120, 12, 153] },
  { id: 24, sort: 41, premium: false, name: "Purple", rgb: [170, 56, 185] },
  { id: 25, sort: 42, premium: false, name: "Light Purple", rgb: [224, 159, 249] },
  { id: 26, sort: 43, premium: false, name: "Dark Pink", rgb: [203, 0, 122] },
  { id: 27, sort: 44, premium: false, name: "Pink", rgb: [236, 31, 128] },
  { id: 28, sort: 45, premium: false, name: "Light Pink", rgb: [243, 141, 169] },
  { id: 53, sort: 46, premium: true, name: "Dark Peach", rgb: [155, 82, 73] },
  { id: 54, sort: 47, premium: true, name: "Peach", rgb: [209, 128, 120] },
  { id: 55, sort: 48, premium: true, name: "Light Peach", rgb: [250, 182, 164] },
  { id: 29, sort: 49, premium: false, name: "Dark Brown", rgb: [104, 70, 52] },
  { id: 30, sort: 50, premium: false, name: "Brown", rgb: [149, 104, 42] },
  { id: 50, sort: 51, premium: true, name: "Light Brown", rgb: [219, 164, 99] },
  { id: 56, sort: 52, premium: true, name: "Dark Tan", rgb: [123, 99, 82] },
  { id: 57, sort: 53, premium: true, name: "Tan", rgb: [156, 132, 107] },
  { id: 36, sort: 54, premium: true, name: "Light Tan", rgb: [214, 181, 148] },
  { id: 51, sort: 55, premium: true, name: "Dark Beige", rgb: [209, 128, 81] },
  { id: 31, sort: 56, premium: false, name: "Beige", rgb: [248, 178, 119] },
  { id: 52, sort: 57, premium: true, name: "Light Beige", rgb: [255, 197, 165] },
  { id: 61, sort: 58, premium: true, name: "Dark Stone", rgb: [109, 100, 63] },
  { id: 62, sort: 59, premium: true, name: "Stone", rgb: [148, 140, 107] },
  { id: 63, sort: 60, premium: true, name: "Light Stone", rgb: [205, 197, 158] },
  { id: 58, sort: 61, premium: true, name: "Dark Slate", rgb: [51, 57, 65] },
  { id: 59, sort: 62, premium: true, name: "Slate", rgb: [109, 117, 141] },
  { id: 60, sort: 63, premium: true, name: "Light Slate", rgb: [179, 185, 209] },
  // { id: 0, sort: 64, premium: false, name: "Transparent", rgb: [0, 0, 0] },
];
