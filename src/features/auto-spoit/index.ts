import { setupElementObserver } from "../../components/element-observer";
import { findPaintPixelControls } from "../../constants/selectors";
import { createAutoSpoitButton } from "./ui";
import { AutoSpoitStorage } from "./storage";

export class AutoSpoit {
  private enabled: boolean = true;
  private button: HTMLButtonElement | null = null;
  
  constructor() {
    this.init();
  }
  
  private async init(): Promise<void> {
    this.enabled = await AutoSpoitStorage.get();
    this.setupUI();
  }
  
  private setupUI(): void {
    setupElementObserver([
      {
        id: "auto-spoit-btn",
        getTargetElement: findPaintPixelControls,
        createElement: (container) => {
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.setAttribute("data-tip", "Toggle auto color picker");
          
          this.button = createAutoSpoitButton(this.enabled);
          this.button.id = "auto-spoit-btn";
          this.button.addEventListener("click", () => this.toggle());
          
          tooltip.appendChild(this.button);
          container.appendChild(tooltip);
          console.log("🧑‍🎨 : Auto spoit button added");
        },
      },
    ]);
  }
  
  isEnabled(): boolean {
    return this.enabled;
  }
  
  async toggle(): Promise<void> {
    this.enabled = await AutoSpoitStorage.toggle();
    console.log("🧑‍🎨 : Auto spoit toggled:", this.enabled);
    
    if (this.button) {
      // ボタンの見た目を更新
      this.button.classList.toggle("text-primary", this.enabled);
      this.button.classList.toggle("text-base-content", !this.enabled);
      this.button.style.opacity = this.enabled ? "1" : "0.5";
    }
  }
}
