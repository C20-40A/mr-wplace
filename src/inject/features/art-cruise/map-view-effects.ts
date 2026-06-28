import type { ArtCruiseMapLike } from "./runtime";
import {
  HIDDEN_MARKER_STYLE_ID,
  VIEW_CROP_TOP_RATIO,
  VIEW_VISIBLE_RATIO,
} from "./constants";

type CanvasStyleSnapshot = Pick<
  CSSStyleDeclaration,
  "transform" | "transformOrigin" | "height" | "willChange"
>;

export class ArtCruiseMapViewEffects {
  private hiddenMarkerStyle: HTMLStyleElement | null = null;
  private mapCanvas: HTMLCanvasElement | null = null;
  private originalCanvasStyle: Partial<CanvasStyleSnapshot> | null = null;

  constructor(private readonly map: ArtCruiseMapLike) {}

  apply = () => {
    this.applyCroppedView();
    this.hideMapMarkers();
  };

  restore = () => {
    this.restoreMapMarkers();
    this.restoreCroppedView();
  };

  private applyCroppedView = () => {
    const map = this.map as ArtCruiseMapLike & {
      getCanvas?: () => HTMLCanvasElement;
    };
    const canvas = map.getCanvas?.();
    if (!canvas || this.mapCanvas) return;

    this.mapCanvas = canvas;
    this.originalCanvasStyle = {
      transform: canvas.style.transform,
      transformOrigin: canvas.style.transformOrigin,
      height: canvas.style.height,
      willChange: canvas.style.willChange,
    };
    canvas.style.transformOrigin = "top center";
    canvas.style.transform = `scaleY(${1 / VIEW_VISIBLE_RATIO}) translateY(-${
      VIEW_CROP_TOP_RATIO * 100
    }%)`;
    canvas.style.height = "100%";
    canvas.style.willChange = "transform";
  };

  private hideMapMarkers = () => {
    if (this.hiddenMarkerStyle) return;

    const style = document.createElement("style");
    style.id = HIDDEN_MARKER_STYLE_ID;
    style.textContent = `
      #map .maplibregl-marker {
        visibility: hidden !important;
        pointer-events: none !important;
      }

      #map .maplibregl-marker[aria-label="Map marker"][role="button"].text-yellow-400 {
        visibility: hidden !important;
        pointer-events: none !important;
      }
    `;
    document.head.appendChild(style);
    this.hiddenMarkerStyle = style;
  };

  private restoreMapMarkers = () => {
    this.hiddenMarkerStyle?.remove();
    this.hiddenMarkerStyle = null;
  };

  private restoreCroppedView = () => {
    if (!this.mapCanvas || !this.originalCanvasStyle) return;

    this.mapCanvas.style.transform = this.originalCanvasStyle.transform ?? "";
    this.mapCanvas.style.transformOrigin =
      this.originalCanvasStyle.transformOrigin ?? "";
    this.mapCanvas.style.height = this.originalCanvasStyle.height ?? "";
    this.mapCanvas.style.willChange = this.originalCanvasStyle.willChange ?? "";
    this.mapCanvas = null;
    this.originalCanvasStyle = null;
  };
}
