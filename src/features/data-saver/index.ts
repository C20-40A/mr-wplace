import { DataSaverStorage } from "./storage";

class DataSaver {
  private button: HTMLButtonElement | null = null;
  private badge: HTMLDivElement | null = null;
  private tooltip: HTMLDivElement | null = null;
  private enabled = false;

  async init() {
    this.enabled = await DataSaverStorage.get();
    this.createButton();
    this.createBadge();
    this.createTooltip();
    this.applyState(this.enabled);
  }

  private createButton() {
    this.button = document.createElement("button");
    this.button.innerHTML = this.enabled ? "🪫" : "📡";
    this.button.className = "btn btn-sm btn-circle";
    this.button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 65px;
      font-size: 18px;
      z-index: 800;
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background-color: ${this.enabled ? "#2ecc71" : ""};
      color: white;
      box-shadow: 0 0 8px ${this.enabled ? "#2ecc71" : "rgba(0,0,0,0.5)"};
      cursor: pointer;
      transition: all 0.3s ease;
    `;

    // ホバーアニメーション
    this.button.addEventListener("mouseenter", () => {
      if (this.button) this.button.style.transform = "scale(1.15)";
      if (this.tooltip) this.tooltip.style.opacity = "1";
    });
    this.button.addEventListener("mouseleave", () => {
      if (this.button) this.button.style.transform = "scale(1)";
      if (this.tooltip) this.tooltip.style.opacity = "0";
    });

    this.button.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Data saver button created");
  }

  private createTooltip() {
    this.tooltip = document.createElement("div");
    this.tooltip.textContent = this.enabled
      ? "Data Saver: ON"
      : "Data Saver: OFF";
    this.tooltip.style.cssText = `
      position: fixed;
      top: 50px;
      right: 55px;
      background: rgba(0,0,0,0.75);
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 801;
    `;
    document.body.appendChild(this.tooltip);
  }

  private createBadge() {
    this.badge = document.createElement("div");
    this.badge.textContent = "🪫 Data Saver ON";
    this.badge.style.cssText = `
      position: fixed;
      top: 45px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(46, 204, 113, 0.7);
      color: white;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 9999px;
      box-shadow: 0 0 8px rgba(46, 204, 113, 0.6);
      z-index: 45;
      transition: opacity 0.3s ease;
      opacity: 0;
      pointer-events: none;
    `;
    document.body.appendChild(this.badge);
  }

  private async toggle() {
    this.enabled = !this.enabled;
    await DataSaverStorage.set(this.enabled);
    this.animatePulse();
    this.applyState(this.enabled);
    console.log("🧑‍🎨 : Data saver toggled:", this.enabled);
  }

  private animatePulse() {
    if (!this.button) return;
    this.button.animate(
      [
        { boxShadow: "0 0 8px #2ecc71" },
        { boxShadow: "0 0 16px #2ecc71" },
        { boxShadow: "0 0 8px #2ecc71" },
      ],
      { duration: 600, easing: "ease-in-out" }
    );
  }

  private updateUI() {
    if (!this.button || !this.badge || !this.tooltip) return;

    this.button.innerHTML = this.enabled ? "🪫" : "📡";
    this.button.style.backgroundColor = this.enabled ? "#2ecc71" : "";
    this.button.style.boxShadow = this.enabled
      ? "0 0 8px #2ecc71"
      : "0 0 8px rgba(0,0,0,0.5)";

    this.tooltip.textContent = this.enabled
      ? "Data Saver: ON"
      : "Data Saver: OFF";
    this.badge.textContent = "🪫 Data Saver ON";
    this.badge.style.opacity = this.enabled ? "1" : "0";
  }

  private applyState(enabled: boolean) {
    this.updateUI();
    window.postMessage(
      {
        source: "mr-wplace-data-saver-update",
        enabled,
      },
      "*"
    );
  }
}

export const dataSaverAPI = {
  initDataSaver: async () => {
    const instance = new DataSaver();
    await instance.init();
  },
};
