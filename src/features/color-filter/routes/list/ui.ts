import { ColorPalette } from "../../../../components/color-palette";
import type { SortOrder } from "../../../../components/color-palette/types";
import { ColorPaletteStorage } from "../../../../components/color-palette/storage";
import type { ComputeDevice } from "../../../../components/color-palette/storage";
import { getCurrentTiles } from "../../../../states/currentTile";
import { getAggregatedColorStats } from "@/features/tile-draw";

let colorPalette: ColorPalette | null = null;
let lastSortOrder: SortOrder = "default";
let lastComputeDevice: ComputeDevice = "gpu";

export const renderColorFilters = async (
  container: HTMLElement
): Promise<void> => {
  // 既存インスタンス破棄
  if (colorPalette) colorPalette.destroy();

  // ComputeDevice設定読み込み
  lastComputeDevice = await ColorPaletteStorage.getComputeDevice();

  // ColorFilterManagerの現在状態取得
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  const currentSelectedColors = colorFilterManager?.getSelectedColors() || [];
  const hasExtraColorsBitmap = colorFilterManager?.getOwnedColorIds() !== null;

  // 表示中タイルの統計取得
  const tileOverlay = window.mrWplace?.tileOverlay;
  const currentTiles = getCurrentTiles();

  let colorStats:
    | Record<string, { matched: number; total: number }>
    | undefined;

  if (currentTiles && currentTiles.size > 0) {
    const { GalleryStorage } = await import("../../../gallery/storage");
    const galleryStorage = new GalleryStorage();
    const allImages = await galleryStorage.getAll();

    // currentTiles に含まれる画像フィルタ
    const targetImageKeys = allImages
      .filter(
        (img) =>
          img.drawEnabled &&
          img.drawPosition &&
          currentTiles.has(`${img.drawPosition.TLX},${img.drawPosition.TLY}`)
      )
      .map((img) => img.key);

    console.log(
      `🧑‍🎨 : Color stats - currentTiles: ${currentTiles.size}, targetImages: ${targetImageKeys.length}`
    );

    if (targetImageKeys.length > 0) {
      colorStats = getAggregatedColorStats(targetImageKeys);
      console.log(`🧑‍🎨 : Aggregated color stats:`, colorStats);
    }
  }

  // ColorPaletteコンポーネント表示
  colorPalette = new ColorPalette(container, {
    selectedColorIds: currentSelectedColors,
    onChange: (colorIds) => {
      // 色フィルター適用
      colorFilterManager?.setSelectedColors(colorIds);
    },
    showCurrentlySelected: true,
    showEnhancedSelect: true,
    enhancedMode: colorFilterManager?.getEnhancedMode() ?? "dot",
    onEnhancedModeChange: (mode) => {
      colorFilterManager?.setEnhancedMode(mode);
      console.log(`🧑‍🎨 : Enhanced mode:`, mode);
    },
    hasExtraColorsBitmap,
    showColorStats: !!colorStats,
    colorStats,
    sortOrder: lastSortOrder,
    onSortOrderChange: (sort) => {
      lastSortOrder = sort;
    },
    showComputeDeviceSelect: true,
    computeDevice: lastComputeDevice,
    onComputeDeviceChange: async (device) => {
      lastComputeDevice = device;
      await ColorPaletteStorage.setComputeDevice(device);
      console.log(`🧑‍🎨 : Compute device changed:`, device);
    },
  });
};
