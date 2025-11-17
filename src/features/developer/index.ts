import { setupElementObserver } from "../../components/element-observer";
import { findPaintPixelControls } from "../../constants/selectors";
// import { createAutoSpoitButton } from "./ui";
import { AutoSpoitStorage } from "./storage";
import { AutoCanvasClickStorage } from "./auto-canvas-click-storage";
import { createAutoCanvasClickButton } from "./auto-canvas-click-ui";
import { createKonamiCodeDetector } from "./konami-detector";
import { t } from "../../i18n/manager";

export class AutoSpoit {
  private enabled: boolean = true;
  private devMode: boolean = false;
  private button: HTMLButtonElement | null = null;
  private autoCanvasClickEnabled: boolean = false;
  private autoCanvasClickButton: HTMLButtonElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.enabled = await AutoSpoitStorage.get();
    this.devMode = await AutoSpoitStorage.getDevMode();
    this.autoCanvasClickEnabled = await AutoCanvasClickStorage.get();

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
      const existingButton = document.getElementById("auto-spoit-btn");
      if (existingButton) {
        existingButton.parentElement?.remove();
      }
      const existingAutoCanvasClickButton = document.getElementById(
        "auto-canvas-click-btn"
      );
      if (existingAutoCanvasClickButton) {
        existingAutoCanvasClickButton.parentElement?.remove();
      }
      return;
    }

    setupElementObserver([
      // NOTE: auto-spoitは現在利用不可のためコメントアウト
      // {
      //   id: "auto-spoit-btn",
      //   getTargetElement: findPaintPixelControls,
      //   createElement: (container) => {
      //     const tooltip = document.createElement("div");
      //     tooltip.className = "tooltip";
      //     tooltip.setAttribute("data-tip", "Toggle auto color picker");
      //     this.button = createAutoSpoitButton(this.enabled);
      //     this.button.id = "auto-spoit-btn";
      //     this.button.addEventListener("click", () => this.toggle());
      //     tooltip.appendChild(this.button);
      //     container.appendChild(tooltip);
      //     console.log("🧑‍🎨 : Auto spoit button added");
      //   },
      // },
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
    ]);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  isDevModeEnabled(): boolean {
    return this.devMode;
  }

  async toggle(): Promise<void> {
    // 有効化しようとしている場合、初回警告チェック
    if (!this.enabled) {
      const hasShownWarning = await AutoSpoitStorage.hasShownWarning();
      if (!hasShownWarning) {
        const warningMessage = t`${"auto_spoit_warning"}`;

        const agreed = confirm(warningMessage);
        if (!agreed) {
          console.log("🧑‍🎨 : Auto spoit activation cancelled by user");
          return;
        }
        await AutoSpoitStorage.setWarningShown();
        console.log("🧑‍🎨 : Auto spoit warning shown and agreed");
      }
      alert(
        "Sorry! This feature is currently unavailable due to changes in the wplace codebase😇"
      );
    }

    this.enabled = await AutoSpoitStorage.toggle();
    console.log("🧑‍🎨 : Auto spoit toggled:", this.enabled);

    if (this.button) {
      // ボタンの見た目を更新
      this.button.classList.toggle("text-primary", this.enabled);
      this.button.classList.toggle("text-base-content", !this.enabled);
      this.button.style.opacity = this.enabled ? "1" : "0.5";
    }
  }

  async toggleAutoCanvasClick(): Promise<void> {
    this.autoCanvasClickEnabled = await AutoCanvasClickStorage.toggle();
    console.log(
      "🧑‍🎨 : Auto canvas click toggled:",
      this.autoCanvasClickEnabled
    );

    if (this.autoCanvasClickEnabled) {
      this.sendAutoCanvasClickStart();
    } else {
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
}
