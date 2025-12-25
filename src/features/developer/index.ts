import { setupElementObserver } from "@/components/element-observer";
import { findPaintPixelControls } from "@/constants/selectors";
import { AutoSpoitStorage } from "./storage";
import { AutoCanvasClickStorage } from "./auto-canvas-click-storage";
import { AutoColorSpoitStorage } from "./auto-color-spoit-storage";
import { createAutoCanvasClickButton } from "./auto-canvas-click-ui";
import { createAutoColorSpoitButton } from "./auto-color-spoit-ui";
import { createKonamiCodeDetector } from "./konami-detector";
import { t } from "@/i18n/manager";
import { ColorFilterManager } from "@/utils/color-filter-manager";
import {
  sendColorFilterToInject,
  sendShowUnplacedOnlyToInject,
} from "@/content";
import type { ColorIsolate } from "@/features/color-isolate";
import { setShowUnplacedOnly } from "@/states/showUnplacedOnly";
import { setupDeveloperMenu } from "./developer-menu";

export class AutoSpoit {
  private devMode: boolean = false;
  private autoCanvasClickEnabled: boolean = false;
  private autoCanvasClickButton: HTMLButtonElement | null = null;
  private autoColorSpoitEnabled: boolean = false;
  private autoColorSpoitButton: HTMLButtonElement | null = null;
  private colorFilterManager: ColorFilterManager;
  private colorIsolate: ColorIsolate;

  constructor(
    colorFilterManager: ColorFilterManager,
    colorIsolate: ColorIsolate
  ) {
    this.colorFilterManager = colorFilterManager;
    this.colorIsolate = colorIsolate;
    this.init();
  }

  private async init(): Promise<void> {
    this.devMode = await AutoSpoitStorage.getDevMode();
    this.autoCanvasClickEnabled = await AutoCanvasClickStorage.get();
    this.autoColorSpoitEnabled = await AutoColorSpoitStorage.get();

    // Update DOM attribute for inject.js
    this.updateDevModeAttribute();

    // Konami code detector setup
    const konamiListener = createKonamiCodeDetector(() =>
      this.handleKonamiCode()
    );
    document.addEventListener("keydown", konamiListener);
    console.log("🧑‍🎨 : Konami code detector initialized");

    this.setupUI();

    // Start auto canvas click if enabled
    if (this.autoCanvasClickEnabled) {
      this.sendAutoCanvasClickStart();
    }

    // Start auto color spoit if enabled
    if (this.autoColorSpoitEnabled) {
      this.sendAutoColorSpoitStart();
    }

    if (this.devMode) {
      setupDeveloperMenu();
    }
  }

  private updateDevModeAttribute(): void {
    let dataElement = document.getElementById("__mr_wplace_data__");
    if (!dataElement) {
      dataElement = document.createElement("div");
      dataElement.id = "__mr_wplace_data__";
      dataElement.style.display = "none";
      (document.head || document.documentElement).prepend(dataElement);
    }
    dataElement.setAttribute(
      "data-auto-spoit-dev-mode",
      this.devMode.toString()
    );
    console.log("🧑‍🎨 : Dev mode attribute updated:", this.devMode);
  }

  private async handleKonamiCode(): Promise<void> {
    this.devMode = await AutoSpoitStorage.toggleDevMode();
    const message = this.devMode
      ? "Developer mode enabled"
      : "Developer mode disabled";

    alert(message);
    console.log("🧑‍🎨 : Dev mode toggled:", this.devMode);

    // Update DOM attribute for inject.js
    this.updateDevModeAttribute();

    // UIを再構築
    this.setupUI();
  }

  private setupUI(): void {
    // dev modeがoffの場合はUIを表示しない
    if (!this.devMode) {
      console.log("🧑‍🎨 : Auto spoit UI hidden (dev mode disabled)");
      // 既存のボタンを削除
      const existingAutoCanvasClickButton = document.getElementById(
        "auto-canvas-click-btn"
      );
      if (existingAutoCanvasClickButton) {
        existingAutoCanvasClickButton.parentElement?.remove();
      }
      const existingAutoColorSpoitButton = document.getElementById(
        "auto-color-spoit-btn"
      );
      if (existingAutoColorSpoitButton) {
        existingAutoColorSpoitButton.parentElement?.remove();
      }
      return;
    }

    setupElementObserver([
      {
        id: "auto-canvas-click-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Toggle auto canvas click");
          this.autoCanvasClickButton = createAutoCanvasClickButton(
            this.autoCanvasClickEnabled
          );
          this.autoCanvasClickButton.id = "auto-canvas-click-btn";
          this.autoCanvasClickButton.addEventListener("click", () =>
            this.toggleAutoCanvasClick()
          );
          tooltip.appendChild(this.autoCanvasClickButton);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Auto canvas click button added");
        },
      },
      {
        id: "auto-color-spoit-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Toggle auto color spoit");
          this.autoColorSpoitButton = createAutoColorSpoitButton(
            this.autoColorSpoitEnabled
          );
          this.autoColorSpoitButton.id = "auto-color-spoit-btn";
          this.autoColorSpoitButton.addEventListener("click", () =>
            this.toggleAutoColorSpoit()
          );
          tooltip.appendChild(this.autoColorSpoitButton);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Auto color spoit button added");
        },
      },
    ]);
  }

  isDevModeEnabled(): boolean {
    return this.devMode;
  }

  async toggleAutoCanvasClick(): Promise<void> {
    // 有効化しようとしている場合、初回警告チェック
    if (!this.autoCanvasClickEnabled) {
      const hasShownWarning = await AutoCanvasClickStorage.hasShownWarning();
      if (!hasShownWarning) {
        const warningMessage = t`${"auto_dotter_warning"}`;
        const agreed = confirm(warningMessage);
        if (!agreed) {
          console.log("🧑‍🎨 : Auto canvas click activation cancelled by user");
          return;
        }
        await AutoCanvasClickStorage.setWarningShown();
        console.log("🧑‍🎨 : Auto canvas click warning shown and agreed");
      }
    }

    this.autoCanvasClickEnabled = await AutoCanvasClickStorage.toggle();
    console.log("🧑‍🎨 : Auto canvas click toggled:", this.autoCanvasClickEnabled);

    if (this.autoCanvasClickEnabled) {
      // Set enhanced mode to red-border
      this.colorFilterManager.setEnhancedMode("red-border");
      sendColorFilterToInject(this.colorFilterManager);
      console.log("🧑‍🎨 : Enhanced mode set to red-border");

      // Enable color isolate
      await this.colorIsolate.enable();
      console.log("🧑‍🎨 : Color isolate enabled");

      // Enable show unplaced only
      setShowUnplacedOnly(true);
      sendShowUnplacedOnlyToInject(true);
      console.log("🧑‍🎨 : Show unplaced only enabled");

      this.sendAutoCanvasClickStart();
    } else {
      // Disable color isolate
      await this.colorIsolate.disable();
      console.log("🧑‍🎨 : Color isolate disabled");

      // Disable show unplaced only
      setShowUnplacedOnly(false);
      sendShowUnplacedOnlyToInject(false);
      console.log("🧑‍🎨 : Show unplaced only disabled");

      this.sendAutoCanvasClickStop();
    }

    if (this.autoCanvasClickButton) {
      // ボタンの見た目を更新
      this.autoCanvasClickButton.classList.toggle(
        "text-primary",
        this.autoCanvasClickEnabled
      );
      this.autoCanvasClickButton.classList.toggle(
        "text-base-content",
        !this.autoCanvasClickEnabled
      );
      this.autoCanvasClickButton.style.opacity = this.autoCanvasClickEnabled
        ? "1"
        : "0.5";
    }
  }

  private sendAutoCanvasClickStart(): void {
    window.postMessage({ source: "mr-wplace-auto-canvas-click-start" }, "*");
    console.log("🧑‍🎨 : Sent auto canvas click start message");
  }

  private sendAutoCanvasClickStop(): void {
    window.postMessage({ source: "mr-wplace-auto-canvas-click-stop" }, "*");
    console.log("🧑‍🎨 : Sent auto canvas click stop message");
  }

  async toggleAutoColorSpoit(): Promise<void> {
    if (!this.autoColorSpoitEnabled) {
      const hasShownWarning = await AutoColorSpoitStorage.hasShownWarning();
      if (!hasShownWarning) {
        const warningMessage =
          "Auto Color Spoit will automatically pick colors from your template images as you move your cursor.\n\nThis feature is experimental and requires developer mode.";
        const agreed = confirm(warningMessage);
        if (!agreed) {
          console.log("🧑‍🎨 : Auto color spoit activation cancelled by user");
          return;
        }
        await AutoColorSpoitStorage.setWarningShown();
        console.log("🧑‍🎨 : Auto color spoit warning shown and agreed");
      }
    }

    this.autoColorSpoitEnabled = await AutoColorSpoitStorage.toggle();
    console.log("🧑‍🎨 : Auto color spoit toggled:", this.autoColorSpoitEnabled);

    if (this.autoColorSpoitEnabled) {
      this.sendAutoColorSpoitStart();
    } else {
      this.sendAutoColorSpoitStop();
    }

    if (this.autoColorSpoitButton) {
      this.autoColorSpoitButton.classList.toggle(
        "text-primary",
        this.autoColorSpoitEnabled
      );
      this.autoColorSpoitButton.classList.toggle(
        "text-base-content",
        !this.autoColorSpoitEnabled
      );
      this.autoColorSpoitButton.style.opacity = this.autoColorSpoitEnabled
        ? "1"
        : "0.5";
    }
  }

  private sendAutoColorSpoitStart(): void {
    window.postMessage({ source: "mr-wplace-auto-color-spoit-start" }, "*");
    console.log("🧑‍🎨 : Sent auto color spoit start message");
  }

  private sendAutoColorSpoitStop(): void {
    window.postMessage({ source: "mr-wplace-auto-color-spoit-stop" }, "*");
    console.log("🧑‍🎨 : Sent auto color spoit stop message");
  }
}
