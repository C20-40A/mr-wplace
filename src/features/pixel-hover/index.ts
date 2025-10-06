import { colorpalette } from "../../constants/colors";
import { createPixelHoverFAB, updatePixelHoverFAB } from "./ui";
import { getPixelColorFromTile } from "../../utils/map-control";

const MOUSE_MOVE_THROTTLE_PERIOD = 10; // ms

export class PixelHover {
  private enabled: boolean = false;
  private map: any = null;
  private fab: HTMLButtonElement | null = null;
  private lastColorId: number | null = null;
  private throttleTimer: number | null = null;
  private mouseMoveHandler: ((e: any) => void) | null = null;

  constructor() {}

  public async init(): Promise<void> {
    await this.waitForMap();
    this.createAndAttachFAB();
    console.log("🧑‍🎨 : PixelHover initialized");
  }

  private async waitForMap(): Promise<void> {
    return new Promise((resolve) => {
      let attempts = 0;
      const check = setInterval(() => {
        this.map = (window as any).wplaceMap;
        if (this.map || ++attempts >= 50) {
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

    if (this.enabled) {
      this.mouseMoveHandler = this.handleMapMouseMove.bind(this);
      console.log("MAPあるはず！⚡");
      console.log(this.map);
      this.map?.on("mousemove", this.mouseMoveHandler);
    } else {
      if (this.mouseMoveHandler) {
        this.map?.off("mousemove", this.mouseMoveHandler);
        this.mouseMoveHandler = null;
      }
    }
  }

  private handleMapMouseMove(e: any): void {
    console.log("キターーーーーー");
    if (this.throttleTimer !== null) return;

    this.throttleTimer = window.setTimeout(() => {
      console.log(e);
      this.processPixel(e);
      this.throttleTimer = null;
    }, MOUSE_MOVE_THROTTLE_PERIOD);
  }

  private async processPixel(e: any): Promise<void> {
    if (!e.lngLat) return;

    const { lat, lng } = e.lngLat;
    const color = await getPixelColorFromTile(lat, lng);

    if (!color || color.a === 0) return;

    console.log("🧑‍🎨 : Tile pixel color:", color, { lat, lng });

    const colorId = this.findClosestColorId(color.r, color.g, color.b);
    if (colorId !== null && colorId !== this.lastColorId) {
      this.selectColor(colorId);
      this.lastColorId = colorId;
    }
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
