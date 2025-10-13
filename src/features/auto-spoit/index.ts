import { setupElementObserver } from "../../components/element-observer";
import { findPaintPixelControls } from "../../constants/selectors";
import { createAutoSpoitButton } from "./ui";
import { AutoSpoitStorage } from "./storage";
import { createKonamiCodeDetector } from "./konami-detector";

export class AutoSpoit {
  private enabled: boolean = true;
  private devMode: boolean = false;
  private button: HTMLButtonElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.enabled = await AutoSpoitStorage.get();
    this.devMode = await AutoSpoitStorage.getDevMode();

    // Update DOM attribute for inject.js
    this.updateDevModeAttribute();

    // Konami code detector setup
    const konamiListener = createKonamiCodeDetector(() =>
      this.handleKonamiCode()
    );
    document.addEventListener("keydown", konamiListener);
    console.log("🧑‍🎨 : Konami code detector initialized");

    this.setupUI();
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
      ? "Developer mode enabled! Auto Spoit feature is now available."
      : "Developer mode disabled! Auto Spoit feature is will be hidden after UI refresh.";

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
      return;
    }

    setupElementObserver([
      {
        id: "auto-spoit-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Toggle auto color picker");

          this.button = createAutoSpoitButton(this.enabled);
          this.button.id = "auto-spoit-btn";
          this.button.addEventListener("click", () => this.toggle());

          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Auto spoit button added");
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
    this.enabled = await AutoSpoitStorage.toggle();
    console.log("🧑‍🎨 : Auto spoit toggled:", this.enabled);

    if (this.button) {
      // ボタンの見た目を更新
      this.button.classList.toggle("text-primary", this.enabled);
      this.button.classList.toggle("text-base-content", !this.enabled);
      this.button.style.opacity = this.enabled ? "1" : "0.5";
    }
  }
}
