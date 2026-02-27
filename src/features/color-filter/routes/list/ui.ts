import { ColorPalette } from "@/components/color-palette";
import type { SortOrder } from "@/components/color-palette/types";
import { getAggregatedColorStats } from "@/utils/inject-bridge";
import { getAllGalleryMetadata } from "@/core/bridge/gallery-storage-bridge";
import { findNearestGalleryItem } from "@/utils/gallery-helpers";
import {
  sendColorFilterToInject,
  sendShowUnplacedOnlyToInject,
} from "@/content";
import { ColorFilter } from "@/features/color-filter";
import {
  getShowUnplacedOnly,
  setShowUnplacedOnly,
} from "@/states/showUnplacedOnly";
import {
  loadFrontTileLayerFromStorage,
  getFrontTileLayer,
  setFrontTileLayer,
} from "@/states/front-tile-layer";
import { showFeatureHint } from "@/features/feature-hints";

let colorPalette: ColorPalette | null = null;
let lastSortOrder: SortOrder = "default";
const SHOW_UNPLACED_COLOR_SEND_INTERVAL_MS = 100;
let showUnplacedColorSendTimer: ReturnType<typeof setTimeout> | null = null;
let lastShowUnplacedColorSentAt = 0;

const scheduleSendColorFilterForUnplaced = (): void => {
  const colorFilterManager = window.mrWplace?.colorFilterManager;
  if (!colorFilterManager) return;

  const now = Date.now();
  const elapsed = now - lastShowUnplacedColorSentAt;
  if (elapsed >= SHOW_UNPLACED_COLOR_SEND_INTERVAL_MS) {
    sendColorFilterToInject(colorFilterManager);
    lastShowUnplacedColorSentAt = now;
    return;
  }

  if (showUnplacedColorSendTimer) return;
  showUnplacedColorSendTimer = setTimeout(() => {
    showUnplacedColorSendTimer = null;
    const manager = window.mrWplace?.colorFilterManager;
    if (!manager) return;
    sendColorFilterToInject(manager);
    lastShowUnplacedColorSentAt = Date.now();
  }, SHOW_UNPLACED_COLOR_SEND_INTERVAL_MS - elapsed);
};

export const renderColorFilters = async (
  container: HTMLElement
): Promise<void> => {
  // 既存インスタンス破棄
  if (colorPalette) colorPalette.destroy();
  await loadFrontTileLayerFromStorage();
  const overlayModeEnabled = getFrontTileLayer();

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
  // coords が存在するアイテムのみを型安全に抽出
  const drawableItems = allMetadata.filter(
    (m): m is typeof m & { coords: NonNullable<typeof m.coords> } =>
      m.visible && !!m.coords
  );

  if (drawableItems.length > 0) {
    // 最寄り1件を選択
    const nearest = findNearestGalleryItem(drawableItems);

    if (nearest) {
      colorStats = await getAggregatedColorStats([nearest.id]);
      console.log(
        `🧑‍🎨 : Nearest template: ${nearest.title || nearest.id}`
      );
    }
  }

  // ColorPaletteコンポーネント表示
  const isMobile = window.innerWidth < 640;
  colorPalette = new ColorPalette(container, {
    selectedColorIds: currentSelectedColors,
    onChange: async (colorIds) => {
      // 色フィルター適用
      await colorFilterManager?.setSelectedColors(colorIds);
      // Send updated filter to inject side
      if (colorFilterManager) {
        sendColorFilterToInject(colorFilterManager);
      }
      ColorFilter.getInstance()?.refreshFABBadge();
    },
    showCurrentlySelected: true,
    showEnhancedSelect: true,
    enhancedMode: colorFilterManager?.getEnhancedMode() ?? "cross",
    enhancedColor: colorFilterManager?.getEnhancedColor() ?? [255, 0, 0],
    onEnhancedModeChange: (mode) => {
      colorFilterManager?.setEnhancedMode(mode);
      console.log(`🧑‍🎨 : Enhanced mode:`, mode);
      if (colorFilterManager) sendColorFilterToInject(colorFilterManager);
    },
    onEnhancedColorChange: (color) => {
      colorFilterManager?.setEnhancedColor(color);
      console.log(`🧑‍🎨 : Enhanced color:`, color);
      if (colorFilterManager) sendColorFilterToInject(colorFilterManager);
    },
    hasExtraColorsBitmap,
    showColorStats: !!colorStats,
    colorStats,
    sortOrder: lastSortOrder,
    onSortOrderChange: (sort) => {
      lastSortOrder = sort;
    },
    showOverlayModeSelect: true,
    overlayMode: overlayModeEnabled,
    onOverlayModeChange: async (enabled) => {
      await setFrontTileLayer(enabled);
      window.postMessage(
        {
          source: "mr-wplace-front-tile-layer-update",
          enabled,
        },
        "*"
      );
    },
    showUnplacedOnlyToggle: true,
    showUnplacedOnly: getShowUnplacedOnly(),
    showUnplacedColor: colorFilterManager?.getShowUnplacedColor() ?? [160, 160, 160],
    onShowUnplacedOnlyChange: (enabled) => {
      setShowUnplacedOnly(enabled);
      console.log(`🧑‍🎨 : Show unplaced only changed:`, enabled);
      // Send updated setting to inject side (transient state, not persisted)
      sendShowUnplacedOnlyToInject(enabled);
    },
    onShowUnplacedColorChange: (color) => {
      colorFilterManager?.setShowUnplacedColor(color);
      console.log(`🧑‍🎨 : Show unplaced color:`, color);
      scheduleSendColorFilterForUnplaced();
    },
    controlSize: isMobile ? "xs" : "default",
  });

  const overlayModeContainer = container.querySelector(".overlay-mode-container");
  if (overlayModeContainer instanceof HTMLElement) {
    showFeatureHint("overlay-mode-independent", overlayModeContainer);
  }
};
