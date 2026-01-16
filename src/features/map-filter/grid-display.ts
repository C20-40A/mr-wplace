import { getMapInstanceReady } from "@/states/map-instance-ready";

class GridDisplay {
  private button: HTMLButtonElement | null = null;
  private enabled = false;

  async init() {
    this.enabled = false;
    this.createButton();
    this.setupMapInstanceListener();
    if (getMapInstanceReady()) this.showButton();
  }

  private createButton() {
    this.button = document.createElement("button");
    this.updateButtonIcon();
    this.button.className = "btn btn-sm btn-circle";
    // tile-boundaries(top:80px)の下: 80px + 32px + 4px = 116px
    this.button.style.cssText = `
      position: fixed;
      left: 50px;
      top: 116px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
      display: none;
    `;

    this.button.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Grid display button created (hidden until map ready)");
  }

  private setupMapInstanceListener() {
    window.addEventListener("message", (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-map-instance-captured" &&
        event.data.ready
      ) {
        this.showButton();
      }
    });
  }

  private showButton() {
    if (this.button) {
      this.button.style.display = "block";
      this.notifyInject();
      console.log("🧑‍🎨 : Grid display button shown (map ready)");
    }
  }

  private updateButtonIcon() {
    if (!this.button) return;
    const color = this.enabled ? "#4ade80" : "#888";
    // 細かい格子アイコン（4x4グリッド）
    this.button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" style="display: block; margin: auto;">
        <line x1="5" y1="0" x2="5" y2="20" stroke="${color}" stroke-width="1"/>
        <line x1="10" y1="0" x2="10" y2="20" stroke="${color}" stroke-width="1"/>
        <line x1="15" y1="0" x2="15" y2="20" stroke="${color}" stroke-width="1"/>
        <line x1="0" y1="5" x2="20" y2="5" stroke="${color}" stroke-width="1"/>
        <line x1="0" y1="10" x2="20" y2="10" stroke="${color}" stroke-width="1"/>
        <line x1="0" y1="15" x2="20" y2="15" stroke="${color}" stroke-width="1"/>
      </svg>
    `;
  }

  private toggle() {
    this.enabled = !this.enabled;
    this.updateButtonIcon();
    this.notifyInject();
    console.log("🧑‍🎨 : Grid display toggled to:", this.enabled);
  }

  private notifyInject() {
    window.postMessage(
      {
        source: "mr-wplace-grid-display-update",
        visible: this.enabled,
      },
      "*"
    );
  }
}

export const gridDisplayAPI = {
  initGridDisplay: async () => {
    const instance = new GridDisplay();
    await instance.init();
  },
};
