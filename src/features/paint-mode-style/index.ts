import { findPaintPixelControls } from "@/constants/selectors";
import { isMobileViewport } from "@/constants/breakpoints";
import { subscribePaintMode } from "@/utils/paint-mode";
import {
  loadPaintModeStyleFromStorage,
  getPaintModeStyle,
} from "@/states/paint-mode-style";

/**
 * ペイントモーダル表示中のスタイル調整機能
 * - モバイル時: findPaintPixelControls()のgapを除去（省スペース化）
 * - ペイント中: マップ上のFABボタンを非表示（操作の邪魔を防止）
 *
 * popupからenable/disableを切り替え可能
 */

/** 非表示にするマップ上のFABボタンID一覧 */
const MAP_FAB_IDS = [
  "gallery-btn",
  "bookmarks-btn",
  "color-filter-fab-btn",
  "timetravel-fab-btn",
  "timetravel-map-pin-btn",
  "timetravel-btn-fallback",
  "data-saver-btn",
  "friends-book-fab",
  "map-pin-button-group",
  "draw-btn-fallback",
  "text-draw-fallback-btn",
  "tile-crop-save-btn",
  "bookmark-map-pin-btn",
  "mr-wplace-focus-mode-btn",
  "mr-wplace-art-cruise-btn",
  "mr-wplace-draft-fab",
] as const;

interface StyleRule {
  /** ルール名（将来のコンフィグキーとして使用） */
  name: string;
  /** ペイントモーダル表示時に適用 */
  apply: (controls: Element) => void;
  /** ペイントモーダル非表示時に復元 */
  restore: () => void;
  /** モバイルのみ適用するか */
  mobileOnly?: boolean;
}

/** findPaintPixelControls() 内の .flex.grow.items-center.gap-1.5 の gap を除去するルール */
const removeGapRule: StyleRule = {
  name: "removeModalGap",
  mobileOnly: true,
  apply: (controls) => {
    controls.classList.remove("gap-1.5");
  },
  restore: () => {
    const controls = findPaintPixelControls();
    controls?.classList.add("gap-1.5");
  },
};

/** マップFABを非表示にするルール */
const hideFabRule: StyleRule = {
  name: "hideMapFabs",
  mobileOnly: false,
  apply: () => {
    for (const id of MAP_FAB_IDS) {
      const el = document.getElementById(id) as HTMLElement | null;
      if (el) el.style.display = "none";
    }
  },
  restore: () => {
    for (const id of MAP_FAB_IDS) {
      const el = document.getElementById(id) as HTMLElement | null;
      if (el) el.style.display = "";
    }
  },
};

const rules: StyleRule[] = [removeGapRule, hideFabRule];

export class PaintModeStyle {
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await loadPaintModeStyleFromStorage();
    if (!getPaintModeStyle()) return;

    this.unsubscribe = subscribePaintMode((active) =>
      active ? this.activate() : this.deactivate(),
    );
  }

  private activate(): void {
    const controls = findPaintPixelControls();
    if (!controls) return;

    console.log("🧑‍🎨 : Paint mode detected, applying styles", controls);
    for (const rule of rules) {
      if (rule.mobileOnly && !isMobileViewport()) continue;
      rule.apply(controls);
    }
  }

  private deactivate(): void {
    for (const rule of rules) {
      if (rule.mobileOnly && !isMobileViewport()) continue;
      rule.restore();
    }
  }

  destroy(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }
}
