import { setupElementObserver } from "../../components/element-observer";
import { findPaintPixelControls } from "../../constants/selectors";
import { createColorIsolateButton } from "./ui";

export class ColorIsolate {
  private enabled: boolean = false;
  private button: HTMLButtonElement | null = null;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    this.setupUI();
  }

  private setupUI(): void {
    setupElementObserver([
      {
        id: "color-isolate-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "選択中の色のみ表示");

          this.button = createColorIsolateButton(this.enabled);
          this.button.id = "color-isolate-btn";
          this.button.addEventListener("click", () => this.toggle());

          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Color isolate button added");
        },
      },
    ]);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async toggle(): Promise<void> {
    this.enabled = !this.enabled;
    console.log("🧑‍🎨 : Color isolate toggled:", this.enabled);

    if (this.button) {
      // ボタンの見た目を更新
      this.button.classList.toggle("text-primary", this.enabled);
      this.button.classList.toggle("text-base-content", !this.enabled);
      this.button.style.opacity = this.enabled ? "1" : "0.5";
    }

    // TODO: 実際のフィルター処理を実装
  }
}
