import {
  loadTileBoundariesFromStorage,
  getTileBoundaries,
  setTileBoundaries,
} from "@/states/tile-boundaries";

class TileBoundaries {
  private button: HTMLButtonElement | null = null;
  private enabled = false;

  async init() {
    // 現在の状態読み込み
    await loadTileBoundariesFromStorage();
    this.enabled = getTileBoundaries();

    // ボタン作成
    this.createButton();

    // 初期状態をinject側に通知
    this.notifyInject();
  }

  private createButton() {
    this.button = document.createElement("button");
    this.button.textContent = this.enabled ? "🔲" : "⬜";
    this.button.className = "btn btn-sm btn-circle";
    // NOTE: z-index: 1000;だとmodalの上に表示される
    this.button.style.cssText = `
      position: fixed;
      left: 90px;
      top: 44px;
      font-size: 18px;
      z-index: 800;
      width: 32px;
      height: 32px;
    `;

    this.button.addEventListener("click", () => this.toggle());

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Tile boundaries button created");
  }

  private async toggle() {
    this.enabled = !this.enabled;

    // Storage保存
    await setTileBoundaries(this.enabled);

    // ボタン更新
    if (this.button) {
      this.button.textContent = this.enabled ? "🔲" : "⬜";
    }

    // inject側に通知
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