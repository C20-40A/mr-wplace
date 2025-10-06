import { colorpalette } from "../../constants/colors";
import { createPixelHoverFAB, updatePixelHoverFAB } from "./ui";

const MOUSE_MOVE_THROTTLE_PERIOD = 10; // ms

export class PixelHover {
  private enabled: boolean = false;
  private canvas: HTMLCanvasElement | null = null;
  private fab: HTMLButtonElement | null = null;
  private tempCanvas: HTMLCanvasElement;
  private tempCtx: CanvasRenderingContext2D;
  private lastColorId: number | null = null;
  private throttleTimer: number | null = null;

  constructor() {
    this.tempCanvas = document.createElement("canvas");
    this.tempCanvas.width = 1;
    this.tempCanvas.height = 1;
    this.tempCtx = this.tempCanvas.getContext("2d", {
      willReadFrequently: true,
    })!;
  }

  public async init(): Promise<void> {
    await this.waitForCanvas();
    this.createAndAttachFAB();
    console.log("🧑‍🎨 : PixelHover initialized");
  }

  private async waitForCanvas(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = setInterval(() => {
        this.canvas = document.querySelector(".maplibregl-canvas");
        if (this.canvas || ++attempts >= 50) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
  }

  private createAndAttachFAB(): void {
    this.fab = createPixelHoverFAB();
    this.fab.addEventListener("click", this.handleFABClick);

    this.fab.style.cssText = `
      position: fixed;
      top: 50%;
      right: 1rem;
      transform: translateY(-50%);
      z-index: 9999;
    `;

    document.body.appendChild(this.fab);
  }

  private handleFABClick = (): void => {
    this.toggle();
    if (this.fab) updatePixelHoverFAB(this.fab, this.enabled);
  };

  public toggle(): void {
    this.enabled = !this.enabled;
    console.log("🧑‍🎨 : PixelHover", this.enabled ? "enabled" : "disabled");

    if (this.enabled)
      this.canvas?.addEventListener("mousemove", this.handleMouseMove);
    else this.canvas?.removeEventListener("mousemove", this.handleMouseMove);
  }

  private handleMouseMove = (event: MouseEvent): void => {
    if (this.throttleTimer !== null) return;

    this.throttleTimer = window.setTimeout(() => {
      this.processPixel(event);
      this.throttleTimer = null;
    }, MOUSE_MOVE_THROTTLE_PERIOD);
  };

  private processPixel(event: MouseEvent): void {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const dpr = window.devicePixelRatio || 1;
    const pixelX = Math.floor(x * dpr);
    const pixelY = Math.floor(y * dpr);

    requestAnimationFrame(() => {
      this.tempCtx.clearRect(0, 0, 1, 1);
      this.tempCtx.drawImage(this.canvas!, pixelX, pixelY, 1, 1, 0, 0, 1, 1);

      const imageData = this.tempCtx.getImageData(0, 0, 1, 1);
      const [r, g, b, a] = imageData.data;

      console.log("🧑‍🎨 : Canvas2D (RAF) result:", {
        r,
        g,
        b,
        a,
        pixelX,
        pixelY,
      });

      if (a === 0) return;

      const colorId = this.findClosestColorId(r, g, b);
      if (colorId !== null && colorId !== this.lastColorId) {
        this.selectColor(colorId);
        this.lastColorId = colorId;
      }
    });
  }

  private findClosestColorId(r: number, g: number, b: number): number | null {
    let minDistance = Infinity;
    let closestColorId: number | null = null;

    for (const color of colorpalette) {
      const [pr, pg, pb] = color.rgb;
      const distance = Math.sqrt(
        Math.pow(r - pr, 2) + Math.pow(g - pg, 2) + Math.pow(b - pb, 2)
      );

      if (distance < minDistance) {
        minDistance = distance;
        closestColorId = color.id;
      }
    }

    return closestColorId;
  }

  private selectColor(colorId: number): void {
    const colorElement = document.getElementById(`color-${colorId}`);
    if (!colorElement) {
      console.error("🧑‍🎨 : PixelHover - Color element not found:", colorId);
      return;
    }

    console.log("🧑‍🎨 : PixelHover - Clicking color ID:", colorId);
    colorElement.click();
  }
}
