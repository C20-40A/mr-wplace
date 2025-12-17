import { setupElementObserver } from "@/components/element-observer";
import { findPaintPixelControls } from "@/constants/selectors";
import { ColorFilter } from "@/features/color-filter";
import { IMG_ICON_COLOR_FILTER } from "@/assets/iconImages";

// Paint pixel の多言語テキストリスト
const PAINT_PIXEL_TEXTS = [
  "Paint pixel",
  "Pintar pixel",
  "绘制像素",
  "Pixel malen",
  "Pintar píxel",
  "Peindre un pixel",
  "Dipingere pixel",
  "ピクセルを塗る",
  "Pomaluj piksel",
  "Нарисовать пиксель",
  "Намалювати піксель",
  "Tô pixel",
];

/**
 * Paint pixel のテキストをアイコンに変更し、h2全体をボタンのように機能させ、
 * クリックでColorFilterモーダルを開く機能
 */
export class PaintPixelIcon {
  constructor() {
    this.init();
  }

  private init(): void {
    setupElementObserver([
      {
        id: "paint-pixel-icon",
        getTargetElement: () => findPaintPixelControls(),
        createElement: (container) => {
          this.makeH2ButtonAndReplaceTextWithIcon(container);
        },
      },
    ]);
  }

  private makeH2ButtonAndReplaceTextWithIcon(container: Element): void {
    const h2 = container.querySelector("h2");
    if (!h2) return; // 既に置換済みか確認

    if (h2.dataset.mrWplaceIconified) return; // テキストが Paint pixel 系か確認

    const hasText = PAINT_PIXEL_TEXTS.some((text) =>
      h2.textContent?.includes(text)
    );
    if (!hasText) return; // canvas要素を保持

    const canvas = h2.querySelector("canvas"); // アイコン画像を作成 (元のボタンから画像を取り出す)

    const img = document.createElement("img");
    img.src = IMG_ICON_COLOR_FILTER;
    img.alt = "Color Filter";
    img.style.cssText = "width: 20px; height: 20px;"; // h2の中身をクリアし、アイコンを直接追加 (テキストをアイコンに置換)

    h2.innerHTML = "";
    h2.appendChild(img); // canvasを再追加
    if (canvas) {
      h2.appendChild(document.createTextNode(" "));
      h2.appendChild(canvas);
    } // h2をボタンとして機能させるためのイベントリスナーを追加

    h2.addEventListener("click", () => {
      const colorFilter = ColorFilter.getInstance();
      colorFilter?.showModal();
    }); // h2にボタン/UIスタイルを適用
    this.styleH2(h2 as HTMLElement);

    h2.dataset.mrWplaceIconified = "true";
    console.log("🧑‍🎨 : Paint pixel text replaced with icon, H2 made clickable");
  }

  private styleH2(h2: HTMLElement): void {
    // 親要素 (container) を中央寄せにする必要があるため、h2自身のスタイルに加え、
    // ボタンのように振る舞うためのスタイルを適用します。
    h2.style.cssText = `
      /* ボタンの動作 */
      cursor: pointer;
      user-select: none;
      /* UI調整 - 中央寄せ/インラインフレックス */
      display: inline-flex;
      justify-content: center; /* 子要素（アイコンとキャンバス）をh2内で中央に寄せる */
      align-items: center; /* 垂直方向中央寄せ */
      /* 見た目の調整 */
      padding: 6px 12px; /* クリックしやすいようにパディングを調整 */
      gap: 8px;
      background: rgba(255, 255, 255, 0.7); /* 背景を明るく */
      backdrop-filter: blur(8px);
      border-radius: 8px;
      border: 1px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.15);
      transition: background 0.2s, box-shadow 0.2s      `; // ホバー時のスタイルも追加することで、よりボタンらしくなります
    h2.onmouseover = () => {
      h2.style.backgroundColor = "rgba(255, 255, 255, 0.9)";
    };
    h2.onmouseout = () => {
      h2.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
    };
  }
}
