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
 * Paint pixel のテキストをアイコンボタンに変更し、
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
          this.replaceTextWithIconButton(container);
        },
      },
    ]);
  }

  private replaceTextWithIconButton(container: Element): void {
    const h2 = container.querySelector("h2");
    if (!h2) return;

    // 既に置換済みか確認
    if (h2.dataset.mrWplaceIconified) return;

    // テキストが Paint pixel 系か確認
    const hasText = PAINT_PIXEL_TEXTS.some((text) =>
      h2.textContent?.includes(text)
    );
    if (!hasText) return;

    // canvas要素を保持
    const canvas = h2.querySelector("canvas");

    // ボタンを作成
    const button = document.createElement("button");
    button.className = "btn btn-ghost btn-xs p-0";
    button.style.cssText = "vertical-align: middle; min-height: auto; height: auto;";

    const img = document.createElement("img");
    img.src = IMG_ICON_COLOR_FILTER;
    img.alt = "Color Filter";
    img.style.cssText = "width: 20px; height: 20px;";
    button.appendChild(img);

    button.addEventListener("click", () => {
      const colorFilter = ColorFilter.getInstance();
      colorFilter?.showModal();
    });

    // h2の中身をクリア
    h2.innerHTML = "";
    h2.appendChild(button);
    h2.appendChild(document.createTextNode(" "));

    // canvasを再追加
    if (canvas) h2.appendChild(canvas);

    h2.dataset.mrWplaceIconified = "true";
    console.log("🧑‍🎨 : Paint pixel text replaced with icon button");
  }
}
