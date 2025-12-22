import { getMapInstanceReady } from "@/states/map-instance-ready";

class TileBoundaries {
  private button: HTMLButtonElement | null = null;
  private enabled = false;

  async init() {
    // 初期状態は常にOFF
    this.enabled = false;

    // ボタン作成（初期は非表示）
    this.createButton();

    // Map instance readyを監視して表示
    this.setupMapInstanceListener();

    // 既にmap instanceがreadyなら即座に表示
    if (getMapInstanceReady()) {
      this.showButton();
    }
  }

  private createButton() {
    this.button = document.createElement("button");
    this.updateButtonIcon();
    this.button.className = "btn btn-sm btn-circle";
    // NOTE: z-index: 1000;だとmodalの上に表示される
    // high-contrastの下に配置: top: 44px + 32px(button) + 4px(margin) = 80px
    this.button.style.cssText = `
      position: fixed;
      left: 50px;
      top: 80px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
      display: none;
    `;

    this.button.addEventListener("click", () => this.toggle());

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Tile boundaries button created (hidden until map ready)");
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
      // 初期状態（OFF）をinject側に通知
      this.notifyInject();
      console.log("🧑‍🎨 : Tile boundaries button shown (map ready)");
    }
  }

  private updateButtonIcon() {
    if (!this.button) return;
    // 赤いクロス（有効）/ グレーのクロス（無効）
    const color = this.enabled ? "red" : "#888";
    // 横2本+縦2本のクロス、線と線の間を広げる
    this.button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20" style="display: block; margin: auto;">
        <line x1="0" y1="6" x2="20" y2="6" stroke="${color}" stroke-width="2"/>
        <line x1="0" y1="14" x2="20" y2="14" stroke="${color}" stroke-width="2"/>
        <line x1="6" y1="0" x2="6" y2="20" stroke="${color}" stroke-width="2"/>
        <line x1="14" y1="0" x2="14" y2="20" stroke="${color}" stroke-width="2"/>
      </svg>
    `;
  }

  private toggle() {
    this.enabled = !this.enabled;
    this.updateButtonIcon();
    this.notifyInject();
    console.log("🧑‍🎨 : Tile boundaries toggled to:", this.enabled);
  }

  private notifyInject() {
    window.postMessage(
      {
        source: "mr-wplace-tile-boundaries-update",
        visible: this.enabled,
      },
      "*"
    );
  }
}

export const tileBoundariesAPI = {
  initTileBoundaries: async () => {
    const instance = new TileBoundaries();
    await instance.init();
  },
};
