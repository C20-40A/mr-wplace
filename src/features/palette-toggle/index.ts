import { PaletteToggleStorage } from "./storage";

const COLOR_SELECTOR = "#color-1";

export class PaletteToggle {
  private button: HTMLButtonElement | null = null;
  private observer: MutationObserver | null = null;
  private targetElement: HTMLElement | null = null;
  private visible: boolean = true;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    // Load saved state
    this.visible = await PaletteToggleStorage.get();
    console.log("🧑‍🎨 : Palette toggle initialized, visible:", this.visible);

    // Start observing
    this.runObserver();
  }

  private createButton(targetElement: HTMLElement): void {
    // Remove existing button if any
    if (this.button) {
      this.button.remove();
    }

    this.button = document.createElement("button");
    this.button.textContent = "👁️";

    // Apply inline styles to match the bookmarklet
    Object.assign(this.button.style, {
      position: "fixed",
      top: "50%",
      left: "0",
      transform: "translateY(-50%)",
      zIndex: "99999",
      padding: "5px",
      fontSize: "16px",
      background: "#333",
      color: "white",
      border: "none",
      cursor: "pointer",
      borderRadius: "0 5px 5px 0",
    });

    this.button.onclick = () => this.toggle(targetElement);

    document.body.appendChild(this.button);
    console.log("🧑‍🎨 : Palette toggle button created");
  }

  private async toggle(targetElement: HTMLElement): Promise<void> {
    this.visible = await PaletteToggleStorage.toggle();
    this.applyVisibility(targetElement);
    console.log("🧑‍🎨 : Palette visibility toggled:", this.visible);
  }

  private applyVisibility(targetElement: HTMLElement): void {
    if (this.visible) {
      targetElement.removeAttribute("hidden");
    } else {
      targetElement.setAttribute("hidden", "");
    }
  }

  private runObserver(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Find the color picker element
    const colorElement = document.querySelector(COLOR_SELECTOR);
    const targetElement = colorElement?.parentElement?.parentElement as HTMLElement | null;

    if (targetElement) {
      this.targetElement = targetElement;
      this.createButton(targetElement);
      this.applyVisibility(targetElement);
    } else if (this.button) {
      // Target element not found, remove button
      this.button.remove();
      this.button = null;
      this.targetElement = null;
    }

    // Re-observe DOM changes
    this.observer = new MutationObserver(() => {
      this.observer?.disconnect();
      this.runObserver();
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
}
