import {
  registerPaintToolbarButton,
  setPaintToolbarButtonActive,
} from "@/features/paint-toolbar";
import { COLOR_ISOLATE_ICON_SVG } from "./ui";
import { sendColorFilterToInject } from "../../content";
import { t } from "@/i18n/manager";
import { showFeatureHint } from "@/features/feature-hints";
import { ColorFilter } from "@/features/color-filter";

export class ColorIsolate {
  private enabled: boolean = false;
  private button: HTMLButtonElement | null = null;
  private originalSelectedColors: number[] = [];
  private lastSelectedColorId: number | null = null;
  private storageCheckInterval: number | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupUI();
  }

  private setupUI(): void {
    registerPaintToolbarButton({
      id: "color-isolate-btn",
      tip: t`${"show_selected_color_only"}`,
      icon: COLOR_ISOLATE_ICON_SVG,
      isActive: () => this.enabled,
      onClick: () => void this.toggle(),
      onCreate: (button) => {
        this.button = button;
        showFeatureHint("color-isolate", button);
        console.log("🧑‍🎨 : Color isolate button added");
      },
    });
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async enable(): Promise<void> {
    if (this.enabled) return;
    await this.toggle();
  }

  async disable(): Promise<void> {
    if (!this.enabled) return;
    await this.toggle();
  }

  private startMonitoring(): void {
    // 100msごとにlocalStorageをチェック
    this.storageCheckInterval = window.setInterval(() => {
      const selectedColorStr = window.localStorage.getItem("selected-color");
      const currentColorId = selectedColorStr
        ? parseInt(selectedColorStr)
        : null;

      // 前回と異なる色が選択された場合のみ更新
      if (
        currentColorId !== null &&
        currentColorId !== this.lastSelectedColorId
      ) {
        this.lastSelectedColorId = currentColorId;
        this.updateIsolatedColor(currentColorId);
      }
    }, 100);
  }

  private stopMonitoring(): void {
    if (this.storageCheckInterval !== null) {
      window.clearInterval(this.storageCheckInterval);
      this.storageCheckInterval = null;
      console.log("🧑‍🎨 : Color isolate monitoring stopped");
    }
    this.lastSelectedColorId = null;
  }

  private async updateIsolatedColor(colorId: number): Promise<void> {
    const colorFilterManager = window.mrWplace?.colorFilterManager;
    if (!colorFilterManager) {
      console.warn("🧑‍🎨 : [DEBUG] colorFilterManager not found in updateIsolatedColor");
      return;
    }

    console.log(
      `🧑‍🎨 : [DEBUG] Before update - selected colors:`,
      colorFilterManager.getSelectedColors()
    );

    // 指定した色のみをenableにする
    await colorFilterManager.setSelectedColors([colorId]);

    console.log(
      `🧑‍🎨 : [DEBUG] After update - selected colors:`,
      colorFilterManager.getSelectedColors()
    );

    sendColorFilterToInject(colorFilterManager);
    ColorFilter.getInstance()?.refreshFABBadge();
    console.log("🧑‍🎨 : Color isolate updated to color ID:", colorId);
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    console.log("🧑‍🎨 : Color isolate toggled:", this.enabled);

    if (this.button) setPaintToolbarButtonActive(this.button, this.enabled);

    const colorFilterManager = window.mrWplace?.colorFilterManager;
    if (!colorFilterManager) {
      console.warn("🧑‍🎨 : colorFilterManager not found");
      return;
    }

    if (this.enabled) {
      // ON: 元の選択色を保存し、現在選択中の色のみを表示
      this.originalSelectedColors = colorFilterManager.getSelectedColors();

      const selectedColorStr = window.localStorage.getItem("selected-color");
      const selectedColorId = selectedColorStr
        ? parseInt(selectedColorStr)
        : null;

      if (selectedColorId !== null) {
        this.lastSelectedColorId = selectedColorId;
        await colorFilterManager.setSelectedColors([selectedColorId]);
        sendColorFilterToInject(colorFilterManager);
        ColorFilter.getInstance()?.refreshFABBadge();
        console.log(
          "🧑‍🎨 : Color isolate enabled for color ID:",
          selectedColorId
        );

        // localStorage監視を開始
        this.startMonitoring();
      } else {
        console.warn("🧑‍🎨 : No color selected in localStorage");
        this.enabled = false;
        if (this.button) setPaintToolbarButtonActive(this.button, false);
      }
    } else {
      // OFF: 元の選択色に戻す
      this.stopMonitoring();
      await colorFilterManager.setSelectedColors(this.originalSelectedColors);
      sendColorFilterToInject(colorFilterManager);
      ColorFilter.getInstance()?.refreshFABBadge();
      console.log("🧑‍🎨 : Color isolate disabled, restored original colors");
    }
  }
}
