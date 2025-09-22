import { findNextLevelBadgeContainer } from "../../constants/selectors";
import { WPlaceUserData } from "../../types/user-data";
import { setupElementObserver } from "../../components/element-observer";

export class NextLevelBadge {
  private badge: HTMLElement;
  private container: Element | null = null;

  constructor() {
    this.badge = this.createBadge();
  }

  private createBadge(): HTMLElement {
    const badge = document.createElement("div");
    badge.style.cssText = `
      background-color: oklch(42.551% .161 282.339);
      color: white;
      padding: 2px 6px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      min-width: 40px;
      justify-content: center;
      margin-bottom: 12px;
    `;
    return badge;
  }

  init(): boolean {
    setupElementObserver([
      {
        id: "next-level-badge",
        getTargetElement: findNextLevelBadgeContainer,
        createElement: (container) => {
          const button = this.badge;
          button.id = "next-level-badge";
          container.className += " flex flex-col-reverse gap-1";
          container.prepend(button);
          this.container = container;
        },
      },
    ]);

    this.hide(); // 初期状態は非表示、データ取得後に表示
    return true;
  }

  update(pixels: number): void {
    this.badge.textContent = `↗️ ${new Intl.NumberFormat().format(pixels)}`;
  }

  hide(): void {
    this.badge.style.display = "none";
  }

  show(): void {
    this.badge.style.display = "inline-flex";
  }

  updateFromUserData(userData: WPlaceUserData): void {
    if (userData.level === undefined || userData.pixelsPainted === undefined) {
      console.warn("🧑‍🎨: User data missing level or pixelsPainted");
      this.hide();
      return;
    }

    const nextLevelPixels = Math.ceil(
      Math.pow(Math.floor(userData.level) * Math.pow(30, 0.65), 1 / 0.65) -
        userData.pixelsPainted
    );
    console.log("🧑‍🎨: Next level pixels:", nextLevelPixels);

    this.update(Math.max(0, nextLevelPixels));
    this.show();
  }
}
