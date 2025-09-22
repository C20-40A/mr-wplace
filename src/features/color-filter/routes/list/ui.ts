import { ColorPalette } from "../../../../components/color-palette";

let colorPalette: ColorPalette | null = null;

export const renderColorFilters = (container: HTMLElement): void => {
  // 既存インスタンス破棄
  if (colorPalette) {
    colorPalette.destroy();
  }

  // ColorPaletteコンポーネント表示
  colorPalette = new ColorPalette(container, {
    onChange: (colorIds) => {
      console.log(`Selected color IDs:`, colorIds);
    }
  });
};
