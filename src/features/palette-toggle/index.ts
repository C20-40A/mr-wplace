import { registerPaintToolbarButton } from "@/features/paint-toolbar";
import { PaletteToggleStorage } from "./storage";

const COLOR_SELECTOR = "#color-1";

export class PaletteToggle {
  private button: HTMLButtonElement | null = null;
  private colorDisplay: HTMLDivElement | null = null;
  private colorObserver: MutationObserver | null = null;
  private domObserver: MutationObserver | null = null;
  private isHidden: boolean = false;
  private colorObserverRefreshScheduled = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    console.log("🧑‍🎨 : Palette toggle initialized");

    this.setupUI();
    this.observeColorChanges();

    // Load saved state without blocking hint/button creation
    this.isHidden = await PaletteToggleStorage.get();
    this.applyPaletteStateIfNeeded();
  }

  private findPaletteContainer(): HTMLElement | null {
    // Use same logic as original bookmarklet: #color-1's parent's parent
    const colorButton = document.querySelector(COLOR_SELECTOR);
    return colorButton?.parentElement?.parentElement as HTMLElement | null;
  }

  private createEyeIcon(isOpen: boolean): SVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");

    if (isOpen) {
      // Eye icon (open)
      svg.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
      `;
    } else {
      // Eye-off icon (closed)
      svg.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
      `;
    }

    return svg;
  }

  private setupUI(): void {
    registerPaintToolbarButton({
      id: "palette-toggle-btn",
      tip: "Toggle color palette visibility",
      icon: "",
      className: "btn btn-sm btn-ghost p-0",
      onClick: () => void this.toggle(),
      onCreate: (button) => {
        this.button = button;
        button.appendChild(this.createEyeIcon(true));

        // Current color display (badge on top-right)
        this.colorDisplay = document.createElement("div");
        this.colorDisplay.className =
          "w-3 h-3 rounded-full border border-base-300";
        this.colorDisplay.style.cssText = `
          position: absolute;
          top: -4px;
          right: -4px;
          min-width: 0.75rem;
          min-height: 0.75rem;
          display: none;
        `;
        // tooltip wrapper (position:relative) 基準でバッジを配置
        (button.parentElement ?? button).appendChild(this.colorDisplay);
        this.updateCurrentColor();

        // Restore palette state when button is created
        this.applyPaletteStateIfNeeded();

        console.log("🧑‍🎨 : Palette toggle button created");
      },
    });
  }

  private async toggle(): Promise<void> {
    const paletteContainer = this.findPaletteContainer();
    if (!paletteContainer) {
      console.log("🧑‍🎨 : Palette container not found");
      return;
    }

    // Toggle hidden attribute (same as bookmarklet)
    this.isHidden = paletteContainer.hasAttribute("hidden");
    if (this.isHidden) {
      paletteContainer.removeAttribute("hidden");
      this.isHidden = false;
      console.log("🧑‍🎨 : Palette shown");
    } else {
      paletteContainer.setAttribute("hidden", "");
      this.isHidden = true;
      console.log("🧑‍🎨 : Palette hidden");
    }

    // Save state to storage
    await PaletteToggleStorage.set(this.isHidden);

    this.updateEyeIcon();

    // Update color display visibility
    if (this.colorDisplay) {
      this.colorDisplay.style.display = this.isHidden ? "block" : "none";
    }
  }

  /** colorDisplay を残したまま目アイコンだけ差し替える */
  private updateEyeIcon(): void {
    const current = this.button?.querySelector("svg");
    current?.replaceWith(this.createEyeIcon(!this.isHidden));
  }

  private applyPaletteStateIfNeeded(): void {
    if (!this.isHidden) return;

    const paletteContainer = this.findPaletteContainer();
    if (!paletteContainer) return;

    // Apply hidden state
    paletteContainer.setAttribute("hidden", "");

    this.updateEyeIcon();

    // Update color display visibility
    if (this.colorDisplay) {
      this.colorDisplay.style.display = "block";
    }

    console.log("🧑‍🎨 : Palette state restored (hidden)");
  }

  private updateCurrentColor(): void {
    if (!this.colorDisplay) return;

    // Find selected color button (with ring-2 or similar selected state)
    const selectedColorButton = document.querySelector(
      'button[id^="color-"].ring-2, button[id^="color-"].ring-4',
    ) as HTMLButtonElement | null;

    if (selectedColorButton) {
      const bgColor =
        window.getComputedStyle(selectedColorButton).backgroundColor;
      this.colorDisplay.style.backgroundColor = bgColor;
    } else {
      // Fallback: use first color button
      const firstColorButton = document.querySelector(
        'button[id^="color-"]',
      ) as HTMLButtonElement | null;
      if (firstColorButton) {
        const bgColor =
          window.getComputedStyle(firstColorButton).backgroundColor;
        this.colorDisplay.style.backgroundColor = bgColor;
      }
    }
  }

  private observeColorChanges(): void {
    // Observe changes to color buttons to update current color display
    this.colorObserver = new MutationObserver(() => {
      this.updateCurrentColor();
    });

    this.domObserver = new MutationObserver(() => {
      this.scheduleColorObserverRefresh();
    });

    this.domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    this.refreshColorObservers();
  }

  private scheduleColorObserverRefresh(): void {
    if (this.colorObserverRefreshScheduled) return;
    this.colorObserverRefreshScheduled = true;
    requestAnimationFrame(() => {
      this.colorObserverRefreshScheduled = false;
      this.refreshColorObservers();
    });
  }

  private refreshColorObservers(): void {
    this.colorObserver?.disconnect();

    const colorButtons = document.querySelectorAll('button[id^="color-"]');
    colorButtons.forEach((button) => {
      this.colorObserver?.observe(button, {
        attributes: true,
        attributeFilter: ["class"],
      });
    });

    this.updateCurrentColor();
  }
}
