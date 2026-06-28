import { Container, Graphics } from "pixi.js";

// 手前へ流れるグリッドのスクロール速度 (論理px/秒)。
const SCROLL_SPEED = 120;
// 横線の論理上の間隔(画面下端基準)。スクロールはこの値でループする。
const ROW_SPACING = 78;
// 縦線(奥行き方向ライン)の本数(中心から片側)。
const COLUMN_COUNT = 7;
// 床グリッドのネオン色 (シアン)。
const GRID_COLOR = 0x35e6ff;
// 背景のベース色。
const FLOOR_COLOR = 0x0a0a1f;
// ほぼ真上からの見下ろしに付ける僅かな遠近の強さ。
// 0=完全な平行(真上), 値が大きいほど奥(上)が詰まる/狭まる。
const PERSPECTIVE = 0.18;

export class ArtCruiseBackground {
  public readonly view = new Container();
  private readonly floorGraphics = new Graphics();
  private readonly gridGraphics = new Graphics();
  private scrollOffset = 0;
  private lastWidth = 0;
  private lastHeight = 0;

  // 拡張機能内では裏の実マップが背景になるため描画しない。
  // web fallback でのみ擬似トップダウングリッドを描く。
  constructor(private readonly enabled = false) {
    this.view.addChild(this.floorGraphics, this.gridGraphics);
    this.view.renderable = enabled;
  }

  update(deltaSeconds: number, screenWidth: number, screenHeight: number) {
    if (!this.enabled) return;

    // 上から下へ流す: offset を減らし続け、ROW_SPACING で正にループさせる。
    this.scrollOffset =
      (this.scrollOffset - SCROLL_SPEED * deltaSeconds) % ROW_SPACING;
    if (this.scrollOffset < 0) this.scrollOffset += ROW_SPACING;

    if (screenWidth !== this.lastWidth || screenHeight !== this.lastHeight) {
      this.lastWidth = screenWidth;
      this.lastHeight = screenHeight;
      this.drawFloor(screenWidth, screenHeight);
    }

    this.drawGrid(screenWidth, screenHeight);
  }

  /** 床のベース色。サイズ変化時のみ再描画する静的レイヤー。 */
  private drawFloor(width: number, height: number) {
    this.floorGraphics.clear();
    this.floorGraphics.rect(0, 0, width, height).fill({ color: FLOOR_COLOR });
  }

  /**
   * ほぼ真上からの見下ろし床グリッド。地平線も消失点も画面内に無い。
   * 奥(上)へ向けてごく僅かに遠近をかけ、「少しだけ角度のついた3D風」にする。
   *
   * 深度 d: 0=画面下端(手前) .. 1=画面上端(奥)。
   * 縦方向の縮み係数 shrink(d) = 1 - PERSPECTIVE*d で、
   * 奥ほど行間隔が詰まり横幅が狭まる。
   */
  private drawGrid(width: number, height: number) {
    const g = this.gridGraphics;
    g.clear();
    const centerX = width / 2;

    // 深度 d から画面 y を求める。d=0 で下端, d=1 で上端。
    // 行間隔を奥ほど詰めるため、深度を累積距離に対して非線形配置する。
    const depthToY = (d: number) => height - d * height;
    const shrink = (d: number) => 1 - PERSPECTIVE * d;

    // --- 横線(手前方向): スクロールしながら奥へ流れる ---
    // 画面下端からの実距離を ROW_SPACING ごとに置き、遠近で y を圧縮する。
    const rows = Math.ceil(height / ROW_SPACING) + 4;
    for (let i = 0; i < rows; i++) {
      const dist = i * ROW_SPACING + this.scrollOffset;
      // 実距離 -> 深度。奥ほど詰まる log 風圧縮。
      const d = Math.min(1, dist / (height * (1 + PERSPECTIVE)));
      const y = depthToY(d);
      const alpha = 0.42 * (1 - d * 0.55) + 0.05;
      g.moveTo(0, y).lineTo(width, y).stroke({
        color: GRID_COLOR,
        width: 1.2,
        alpha,
      });
    }

    // --- 縦線(奥行き方向): 奥(上)へ向け僅かに内側へ寄る ---
    const halfWidth = width * 0.62;
    for (let i = -COLUMN_COUNT; i <= COLUMN_COUNT; i++) {
      const ratio = i / COLUMN_COUNT;
      const bottomX = centerX + ratio * halfWidth;
      // 上端では shrink(1) 分だけ中心に寄せる。
      const topX = centerX + ratio * halfWidth * shrink(1);
      const alpha = 0.4 - Math.abs(ratio) * 0.16;
      g.moveTo(bottomX, height).lineTo(topX, 0).stroke({
        color: GRID_COLOR,
        width: 1.2,
        alpha,
      });
    }
  }
}
