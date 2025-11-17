import { setupElementObserver } from "../../components/element-observer";
import { findPaintPixelControls } from "../../constants/selectors";
import { createColorIsolateButton } from "./ui";
import { sendColorFilterToInject } from "../../content";
import { t } from "@/i18n/manager";

export class ColorIsolate {
  private enabled: boolean = false;
  private button: HTMLButtonElement | null = null;
  private originalSelectedColors: number[] = [];
  private lastSelectedColorId: number | null = null;
  private storageCheckInterval: number | null = null;
  private modalObserver: MutationObserver | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupUI();
    this.setupModalObserver();
  }

  private setupModalObserver(): void {
    // paintモーダル（Paint pixel）の表示/非表示を監視
    this.modalObserver = new MutationObserver(() => {
      const paintModal = this.findPaintModal();

      if (!paintModal && this.enabled) {
        // モーダルが閉じた場合、監視を一時停止
        this.pauseMonitoring();
      } else if (paintModal && this.enabled && this.storageCheckInterval === null) {
        // モーダルが開いた場合、監視を再開
        this.resumeMonitoring();
      }
    });

    this.modalObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private findPaintModal(): Element | null {
    // Paint pixelヘッダーを探す
    const headers = Array.from(document.querySelectorAll('h2'));
    const paintHeader = headers.find(h2 => h2.textContent?.includes('Paint pixel'));
    return paintHeader ? paintHeader.closest('.rounded-t-box, .modal-box, [role="dialog"]') : null;
  }

  private pauseMonitoring(): void {
    if (this.storageCheckInterval !== null) {
      window.clearInterval(this.storageCheckInterval);
      this.storageCheckInterval = null;
      console.log("🧑‍🎨 : Color isolate monitoring paused (modal closed)");
    }
  }

  private resumeMonitoring(): void {
    if (this.enabled && this.storageCheckInterval === null) {
      this.startMonitoring();
      console.log("🧑‍🎨 : Color isolate monitoring resumed (modal opened)");
    }
  }

  private setupUI(): void {
    setupElementObserver([
      {
        id: "color-isolate-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", t`show_selected_color_only`);

          this.button = createColorIsolateButton(this.enabled);
          this.button.id = "color-isolate-btn";
          this.button.addEventListener("click", () => this.toggle());

          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Color isolate button added");
        },
      },
    ]);
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
      const currentColorId = selectedColorStr ? parseInt(selectedColorStr) : null;

      // 前回と異なる色が選択された場合のみ更新
      if (currentColorId !== null && currentColorId !== this.lastSelectedColorId) {
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
    if (!colorFilterManager) return;

    // 指定した色のみをenableにする
    await colorFilterManager.setSelectedColors([colorId]);
    sendColorFilterToInject(colorFilterManager);
    console.log("🧑‍🎨 : Color isolate updated to color ID:", colorId);
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    console.log("🧑‍🎨 : Color isolate toggled:", this.enabled);

    if (this.button) {
      // ボタンの見た目を更新
      this.button.classList.toggle("text-primary", this.enabled);
      this.button.classList.toggle("text-base-content", !this.enabled);
      this.button.style.opacity = this.enabled ? "1" : "0.5";
    }

    const colorFilterManager = window.mrWplace?.colorFilterManager;
    if (!colorFilterManager) {
      console.warn("🧑‍🎨 : colorFilterManager not found");
      return;
    }

    if (this.enabled) {
      // ON: 元の選択色を保存し、現在選択中の色のみを表示
      this.originalSelectedColors = colorFilterManager.getSelectedColors();

      const selectedColorStr = window.localStorage.getItem("selected-color");
      const selectedColorId = selectedColorStr ? parseInt(selectedColorStr) : null;

      if (selectedColorId !== null) {
        this.lastSelectedColorId = selectedColorId;
        await colorFilterManager.setSelectedColors([selectedColorId]);
        sendColorFilterToInject(colorFilterManager);
        console.log("🧑‍🎨 : Color isolate enabled for color ID:", selectedColorId);

        // localStorage監視を開始
        this.startMonitoring();
      } else {
        console.warn("🧑‍🎨 : No color selected in localStorage");
        this.enabled = false;
        if (this.button) {
          this.button.classList.remove("text-primary");
          this.button.classList.add("text-base-content");
          this.button.style.opacity = "0.5";
        }
      }
    } else {
      // OFF: 元の選択色に戻す
      this.stopMonitoring();
      await colorFilterManager.setSelectedColors(this.originalSelectedColors);
      sendColorFilterToInject(colorFilterManager);
      console.log("🧑‍🎨 : Color isolate disabled, restored original colors");
    }
  }
}
