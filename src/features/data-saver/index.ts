import { DataSaverStorage } from "./storage";

class DataSaver {
  private button: HTMLButtonElement | null = null;
  private enabled = false;

  async init() {
    this.enabled = await DataSaverStorage.get();
    this.createButton();
    this.applyState(this.enabled);
  }

  private createButton() {
    this.button = document.createElement("button");
    this.button.textContent = this.enabled ? "💾" : "📶";
    this.button.className = "btn btn-sm btn-circle";
    this.button.style.cssText = `
      position: fixed;
      top: 10px;
      right: 65px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
    `;

    this.button.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Data saver button created");
  }

  private async toggle() {
    this.enabled = !this.enabled;

    await DataSaverStorage.set(this.enabled);

    if (this.button) {
      this.button.textContent = this.enabled ? "💾" : "📶";
    }

    this.applyState(this.enabled);
    console.log("🧑‍🎨 : Data saver toggled:", this.enabled);
  }

  private applyState(enabled: boolean) {
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
