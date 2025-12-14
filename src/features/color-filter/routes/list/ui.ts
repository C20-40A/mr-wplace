import { ColorPalette } from "@/components/color-palette";
import type { SortOrder } from "@/components/color-palette/types";
import { ColorPaletteStorage } from "@/components/color-palette/storage";
import type { ComputeDevice } from "@/components/color-palette/storage";
import { getAggregatedColorStats } from "@/utils/inject-bridge";
import { getAllGalleryMetadata } from "@/core/bridge/gallery-storage-bridge";
import { getCurrentPosition } from "@/utils/position";
import { latLngToTilePixel } from "@/utils/coordinate";
import {
  sendColorFilterToInject,
  sendComputeDeviceToInject,
  sendShowUnplacedOnlyToInject,
} from "@/content";
import {
  getShowUnplacedOnly,
  setShowUnplacedOnly,
} from "@/states/showUnplacedOnly";

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

  // ShowUnplacedOnly is now a transient state (not loaded from storage)

  // ColorFilterManagerの現在状態取得
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  const currentSelectedColors = colorFilterManager?.getSelectedColors() || [];
  const hasExtraColorsBitmap = colorFilterManager?.getOwnedColorIds() !== null;

  // 最寄りテンプレートの統計取得
  let colorStats:
    | Record<string, { matched: number; total: number }>
    | undefined;

  const allMetadata = await getAllGalleryMetadata();
  const drawableItems = allMetadata.filter((m) => m.visible && m.coords);

  if (drawableItems.length > 0) {
    const currentPos = getCurrentPosition();

    if (currentPos) {
      const { TLX: cx, TLY: cy } = latLngToTilePixel(
        currentPos.lat,
        currentPos.lng
      );

      // 距離計算 → 最寄り1件を選択
      const nearest = drawableItems.reduce(
        (closest, item) => {
          const dist =
            Math.pow(item.coords!.TLX - cx, 2) +
            Math.pow(item.coords!.TLY - cy, 2);
          return dist < closest.dist ? { item, dist } : closest;
        },
        { item: drawableItems[0], dist: Infinity }
      );

      colorStats = await getAggregatedColorStats([nearest.item.id]);
      console.log(
        `🧑‍🎨 : Nearest template: ${nearest.item.title || nearest.item.id}`
      );
    }
  }

  // ColorPaletteコンポーネント表示
  colorPalette = new ColorPalette(container, {
    selectedColorIds: currentSelectedColors,
    onChange: async (colorIds) => {
      // 色フィルター適用
      await colorFilterManager?.setSelectedColors(colorIds);
      // Send updated filter to inject side
      if (colorFilterManager) {
        sendColorFilterToInject(colorFilterManager);
      }
    },
    showCurrentlySelected: true,
    showEnhancedSelect: true,
    enhancedMode: colorFilterManager?.getEnhancedMode() ?? "dot",
    onEnhancedModeChange: (mode) => {
      colorFilterManager?.setEnhancedMode(mode);
      console.log(`🧑‍🎨 : Enhanced mode:`, mode);
      // Send updated filter to inject side
      if (colorFilterManager) {
        sendColorFilterToInject(colorFilterManager);
      }
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
      // Send updated compute device to inject side
      await sendComputeDeviceToInject();
    },
    showUnplacedOnlyToggle: true,
    showUnplacedOnly: getShowUnplacedOnly(),
    onShowUnplacedOnlyChange: (enabled) => {
      setShowUnplacedOnly(enabled);
      console.log(`🧑‍🎨 : Show unplaced only changed:`, enabled);
      // Send updated setting to inject side (transient state, not persisted)
      sendShowUnplacedOnlyToInject(enabled);
    },
  });
};
