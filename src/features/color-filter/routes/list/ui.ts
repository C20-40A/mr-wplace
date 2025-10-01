import { ColorPalette } from "../../../../components/color-palette";

let colorPalette: ColorPalette | null = null;

export const renderColorFilters = (container: HTMLElement): void => {
  // 既存インスタンス破棄
  if (colorPalette) colorPalette.destroy();

  // ColorFilterManagerの現在状態取得
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  const currentSelectedColors = colorFilterManager?.getSelectedColors() || [];

  // ColorPaletteコンポーネント表示
  colorPalette = new ColorPalette(container, {
    selectedColorIds: currentSelectedColors,
    onChange: (colorIds) => {
      // 色フィルター適用
      colorFilterManager?.setSelectedColors(colorIds);
      console.log(`Selected color IDs:`, colorIds);
    },
    showCurrentlySelected: true,
    showEnhancedSelect: true,
    enhancedMode: colorFilterManager?.getEnhancedMode() ?? "dot",
    onEnhancedModeChange: (mode) => {
      colorFilterManager?.setEnhancedMode(mode);
      console.log(`🧑‍🎨 : Enhanced mode:`, mode);
    },
  });
};
