import { colorpalette } from "../../constants/colors";

export const getEnhancedConfig = ():
  | { enabled: boolean; selectedColors: Set<string> }
  | undefined => {
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  if (!colorFilterManager?.isEnhancedEnabled()) return undefined;

  const selectedColorIds = colorFilterManager.getSelectedColors();
  const selectedColors = new Set<string>();

  for (const id of selectedColorIds) {
    // id: 0 (Transparent)を除外 - 透明色はenhance不要、黒[0,0,0]はid: 1のみ
    if (id === 0) continue;

    const color = colorpalette.find((c) => c.id === id);
    if (color) {
      selectedColors.add(`${color.rgb[0]},${color.rgb[1]},${color.rgb[2]}`);
    }
  }

  return { enabled: true, selectedColors };
};
