import { setupElementObserver } from "@/components/element-observer";
import { findPaintPixelControls } from "@/constants/selectors";
import { sendShowUnplacedOnlyToInject } from "@/content";
import { createShowUnplacedOnlyButton } from "./ui";
import {
  getShowUnplacedOnly,
  setShowUnplacedOnly,
  subscribeShowUnplacedOnly,
} from "@/states/showUnplacedOnly";

export class ShowUnplacedOnly {
  private button: HTMLButtonElement | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Subscribe to state changes
    this.unsubscribe = subscribeShowUnplacedOnly((enabled) => {
      this.updateButton(enabled);
    });

    this.setupUI();
  }

  private setupUI(): void {
    setupElementObserver([
      {
        id: "show-unplaced-only-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Show unplaced pixels only");
          this.button = createShowUnplacedOnlyButton(getShowUnplacedOnly());
          this.button.id = "show-unplaced-only-btn";
          this.button.addEventListener("click", () => this.toggle());
          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Show unplaced only button added");
        },
      },
    ]);
  }

  private updateButton(enabled: boolean): void {
    if (this.button) {
      this.button.classList.toggle("text-primary", enabled);
      this.button.classList.toggle("text-base-content", !enabled);
      this.button.style.opacity = enabled ? "1" : "0.5";
    }
  }

  toggle(): void {
    const newState = !getShowUnplacedOnly();
    setShowUnplacedOnly(newState);
    sendShowUnplacedOnlyToInject(newState);
    console.log("🧑‍🎨 : Show unplaced only toggled:", newState);
  }

  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}
