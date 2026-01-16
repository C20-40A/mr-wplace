import { setupElementObserver } from "@/components/element-observer";
import { findPaintPixelControls } from "@/constants/selectors";
import { AutoSpoitStorage } from "./storage";
import { AutoCanvasClickStorage } from "./auto-canvas-click-storage";
import { AutoColorSpoitStorage } from "./auto-color-spoit-storage";
import {
  createAutoCanvasClickDialogItem,
  updateAutoCanvasClickDialogItem,
} from "./auto-canvas-click-ui";
import {
  createAutoColorSpoitDialogItem,
  updateAutoColorSpoitDialogItem,
} from "./auto-color-spoit-ui";
import { createDeveloperTriggerButton } from "./developer-trigger-button";
import {
  createDeveloperDialog,
  toggleDeveloperDialog,
} from "./developer-dialog";
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
import { createAreaFillDialogItem } from "./area-fill-ui";
import { AreaFillStorage } from "./area-fill-storage";

export class DevInject {
  private devMode: boolean = false;
  private autoCanvasClickEnabled: boolean = false;
  private autoCanvasClickDialogItem: HTMLDivElement | null = null;
  private autoColorSpoitEnabled: boolean = false;
  private autoColorSpoitDialogItem: HTMLDivElement | null = null;
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
      console.log("🧑‍🎨 : Developer UI hidden (dev mode disabled)");
      // 既存のトリガーボタンを削除
      const existingTrigger = document.getElementById("dev-trigger-btn");
      if (existingTrigger) {
        existingTrigger.parentElement?.remove();
      }
      // ダイアログも削除
      const existingDialog = document.getElementById("mr-wplace-dev-dialog");
      if (existingDialog) {
        existingDialog.remove();
      }
      return;
    }

    // トリガーボタンをPaintPixelControlsに追加
    setupElementObserver([
      {
        id: "dev-trigger-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Developer Tools");

          const triggerButton = createDeveloperTriggerButton();
          triggerButton.id = "dev-trigger-btn";
          triggerButton.addEventListener("click", () => {
            this.ensureDialogContent();
            toggleDeveloperDialog();
          });

          tooltip.appendChild(triggerButton);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Developer trigger button added");
        },
      },
    ]);
  }

  /** ダイアログの中身を構築 */
  private async ensureDialogContent(): Promise<void> {
    const { content } = createDeveloperDialog();

    // 既にアイテムがあればスキップ
    if (content.children.length > 0) return;

    // Auto Canvas Click item
    this.autoCanvasClickDialogItem = createAutoCanvasClickDialogItem(
      this.autoCanvasClickEnabled,
      () => this.toggleAutoCanvasClick()
    );
    content.appendChild(this.autoCanvasClickDialogItem);

    // Auto Color Spoit item
    this.autoColorSpoitDialogItem = createAutoColorSpoitDialogItem(
      this.autoColorSpoitEnabled,
      () => this.toggleAutoColorSpoit()
    );
    content.appendChild(this.autoColorSpoitDialogItem);

    // Area Fill item
    const areaFillCorners = await AreaFillStorage.getCorners();
    let areaFillRunning = false;
    const areaFillUI = createAreaFillDialogItem(areaFillCorners);

    areaFillUI.fillButton.addEventListener("click", async () => {
      if (areaFillRunning) {
        // Stop
        window.postMessage({ source: "mr-wplace-area-fill-stop" }, "*");
        areaFillRunning = false;
        areaFillUI.setRunning(false);
        console.log("🧑‍🎨 : Area fill stop requested");
      } else {
        // Start
        const corners = await AreaFillStorage.getCorners();
        if (!corners.topLeft || !corners.bottomRight) {
          alert("Please set both corners before filling");
          return;
        }
        window.postMessage(
          { source: "mr-wplace-area-fill-start", corners },
          "*"
        );
        areaFillRunning = true;
        areaFillUI.setRunning(true);
        console.log("🧑‍🎨 : Area fill start requested", corners);
      }
    });

    content.appendChild(areaFillUI.container);

    console.log("🧑‍🎨 : Developer dialog content initialized");
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

    if (this.autoCanvasClickDialogItem) {
      updateAutoCanvasClickDialogItem(
        this.autoCanvasClickDialogItem,
        this.autoCanvasClickEnabled
      );
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

    if (this.autoColorSpoitDialogItem) {
      updateAutoColorSpoitDialogItem(
        this.autoColorSpoitDialogItem,
        this.autoColorSpoitEnabled
      );
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
