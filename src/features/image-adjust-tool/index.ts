import type { DrawPosition } from "@/states/galleryStorage";
import { t } from "@/i18n/manager";
import { TILE_SIZE } from "@/utils/geo-converter";
import { projectScreenPointsToMapPixels } from "@/utils/inject-bridge";
import {
  IMAGE_ADJUST_TOOL_MAP_Z_INDEX,
  IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX,
} from "./constants";

const MIN_FRAME_WIDTH = 48;
const FRAME_MARGIN = 8;
const MAX_VIEWPORT_RATIO = 0.9;
const METRICS_REFRESH_MS = 200;
const OPACITY_SLIDER_MIN = 15;
const OPACITY_SLIDER_MAX = 100;
const OPACITY_SLIDER_STEP = 5;
const DEFAULT_IMAGE_OPACITY = 100;

type Rect = { x: number; y: number; width: number; height: number };
type InteractionType = "drag" | "resize";

type ActiveInteraction = {
  type: InteractionType;
  startClientX: number;
  startClientY: number;
  startRect: Rect;
  pointerId: number;
};

type Metrics = {
  widthPx: number;
  heightPx: number;
  topLeftPixelX: number;
  topLeftPixelY: number;
};

type ConfirmResult = {
  widthPx: number;
  heightPx: number;
  drawPosition: DrawPosition | null;
};

type ImageAdjustToolOptions = {
  imageSrc: string;
  naturalWidth: number;
  naturalHeight: number;
  initialScale: number;
  onConfirm: (result: ConfirmResult) => void | Promise<void>;
  onCancel?: () => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const STYLES = {
  overlay: `
    position: fixed;
    inset: 0;
    z-index: ${IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX};
    pointer-events: none;
  `,
  frame: `
    position: fixed;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    cursor: move;
  `,
  image: `
    width: 100%;
    height: 100%;
    display: block;
    object-fit: fill;
    image-rendering: pixelated;
    pointer-events: none;
    user-select: none;
  `,
  topToolBar: `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    pointer-events: auto;
    z-index: ${IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX + 1};
  `,
  sizeLabel: `
    position: relative;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 11px;
    line-height: 1;
    padding: 0.25rem 0.45rem;
    pointer-events: none;
  `,
  opacitySlider: `
    width: 84px;
    accent-color: #ffffff;
  `,
  resizeHandle: `
    position: absolute;
    right: 0.2rem;
    bottom: 0.2rem;
    width: 16px;
    height: 16px;
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.95);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
    cursor: nwse-resize;
    pointer-events: auto;
  `,
  closeButton: `
    position: fixed;
    top: 16px;
    right: 16px;
    pointer-events: auto;
  `,
  confirmButton: `
    position: fixed;
    left: 50%;
    bottom: 16px;
    transform: translateX(-50%);
    pointer-events: auto;
    min-width: 120px;
  `,
} as const;

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: {
    className?: string;
    style?: string;
    textContent?: string;
    attributes?: Record<string, string>;
  },
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tagName);
  if (options?.className) element.className = options.className;
  if (options?.style) element.style.cssText = options.style;
  if (options?.textContent !== undefined) element.textContent = options.textContent;
  if (options?.attributes) {
    for (const [key, value] of Object.entries(options.attributes)) {
      element.setAttribute(key, value);
    }
  }
  return element;
};

export class ImageAdjustToolMode {
  private readonly options: ImageAdjustToolOptions;
  private readonly aspectRatio: number;

  private mapElement: HTMLElement | null = null;
  private previousMapZIndex = "";

  private overlay: HTMLDivElement | null = null;
  private frame: HTMLDivElement | null = null;
  private frameImage: HTMLImageElement | null = null;
  private resizeHandle: HTMLDivElement | null = null;
  private topToolBar: HTMLDivElement | null = null;
  private sizeLabel: HTMLDivElement | null = null;
  private opacitySlider: HTMLInputElement | null = null;
  private closeButton: HTMLButtonElement | null = null;
  private confirmButton: HTMLButtonElement | null = null;

  private rect: Rect | null = null;
  private activeInteraction: ActiveInteraction | null = null;
  private metrics: Metrics | null = null;
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private metricsPending = false;
  private mounted = false;
  private imageOpacity = DEFAULT_IMAGE_OPACITY / 100;

  private readonly onFramePointerDown = (event: PointerEvent): void => {
    if (!this.frame || !this.rect) return;
    if (event.button !== 0) return;
    if (event.target === this.resizeHandle) return;

    this.activeInteraction = {
      type: "drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      pointerId: event.pointerId,
    };
    this.frame.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly onResizePointerDown = (event: PointerEvent): void => {
    if (!this.frame || !this.rect) return;
    if (event.button !== 0) return;

    this.activeInteraction = {
      type: "resize",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      pointerId: event.pointerId,
    };
    this.frame.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onGlobalPointerMove = (event: PointerEvent): void => {
    if (!this.activeInteraction || !this.rect) return;
    if (event.pointerId !== this.activeInteraction.pointerId) return;

    const dx = event.clientX - this.activeInteraction.startClientX;
    const dy = event.clientY - this.activeInteraction.startClientY;

    if (this.activeInteraction.type === "drag") {
      const next = this.getClampedRect({
        ...this.activeInteraction.startRect,
        x: this.activeInteraction.startRect.x + dx,
        y: this.activeInteraction.startRect.y + dy,
      });
      this.applyRect(next);
      this.requestMetricsUpdate();
      return;
    }

    const startRect = this.activeInteraction.startRect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidthByViewport = Math.min(
      viewportWidth * MAX_VIEWPORT_RATIO,
      viewportWidth - startRect.x - FRAME_MARGIN,
    );
    const maxHeightByViewport = Math.min(
      viewportHeight * MAX_VIEWPORT_RATIO,
      viewportHeight - startRect.y - FRAME_MARGIN,
    );
    const maxWidth = Math.max(
      MIN_FRAME_WIDTH,
      Math.min(maxWidthByViewport, maxHeightByViewport * this.aspectRatio),
    );
    const nextWidth = clamp(startRect.width + dx, MIN_FRAME_WIDTH, maxWidth);
    const nextHeight = nextWidth / this.aspectRatio;

    this.applyRect(
      this.getClampedRect({
        x: startRect.x,
        y: startRect.y,
        width: nextWidth,
        height: nextHeight,
      }),
    );
    this.requestMetricsUpdate();
  };

  private readonly onGlobalPointerUp = (event: PointerEvent): void => {
    if (!this.activeInteraction || !this.frame) return;
    if (event.pointerId !== this.activeInteraction.pointerId) return;
    this.frame.releasePointerCapture(event.pointerId);
    this.activeInteraction = null;
  };

  private readonly onWindowResize = (): void => {
    if (!this.rect) return;
    this.applyRect(this.getClampedRect(this.rect));
    this.requestMetricsUpdate();
  };

  constructor(options: ImageAdjustToolOptions) {
    this.options = options;
    this.aspectRatio = Math.max(
      0.0001,
      options.naturalWidth / Math.max(1, options.naturalHeight),
    );
  }

  open(): boolean {
    if (this.mounted) return true;

    this.mapElement =
      document.querySelector<HTMLElement>("#map.maplibregl-map") ??
      document.querySelector<HTMLElement>("#map") ??
      document.querySelector<HTMLElement>(".maplibregl-map");
    if (!this.mapElement) {
      console.warn("🧑‍🎨 : map element not found for adjust tool");
      return false;
    }

    this.previousMapZIndex = this.mapElement.style.zIndex;
    this.mapElement.style.zIndex = `${IMAGE_ADJUST_TOOL_MAP_Z_INDEX}`;

    this.createOverlay();
    this.mountEvents();
    this.mounted = true;
    this.requestMetricsUpdate();
    this.metricsTimer = setInterval(() => {
      this.requestMetricsUpdate();
    }, METRICS_REFRESH_MS);
    return true;
  }

  destroy(triggerCancel = false): void {
    if (!this.mounted) return;

    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }

    this.unmountEvents();
    this.overlay?.remove();
    this.overlay = null;
    this.frame = null;
    this.frameImage = null;
    this.resizeHandle = null;
    this.topToolBar = null;
    this.sizeLabel = null;
    this.opacitySlider = null;
    this.closeButton = null;
    this.confirmButton = null;
    this.activeInteraction = null;

    if (this.mapElement) {
      this.mapElement.style.zIndex = this.previousMapZIndex;
    }

    this.mapElement = null;
    this.previousMapZIndex = "";
    this.mounted = false;

    if (triggerCancel) this.options.onCancel?.();
  }

  private createOverlay(): void {
    const overlay = createElement("div", { style: STYLES.overlay });
    overlay.id = "mr-wplace-image-adjust-tool-overlay";

    const frame = createElement("div", { style: STYLES.frame });
    const image = createElement("img", { style: STYLES.image });
    image.src = this.options.imageSrc;
    image.draggable = false;
    image.alt = "adjust-target";

    const sizeLabel = createElement("div", { style: STYLES.sizeLabel });
    sizeLabel.textContent = `${t("adjust_tool_target_size")}: ...`;

    const topToolBar = createElement("div", { style: STYLES.topToolBar });
    const opacitySlider = createElement("input", {
      style: STYLES.opacitySlider,
      attributes: {
        type: "range",
        min: `${OPACITY_SLIDER_MIN}`,
        max: `${OPACITY_SLIDER_MAX}`,
        step: `${OPACITY_SLIDER_STEP}`,
        value: `${DEFAULT_IMAGE_OPACITY}`,
        "aria-label": t("map_filter_area_opacity"),
      },
    });
    opacitySlider.title = t("map_filter_area_opacity");
    opacitySlider.addEventListener("input", () => {
      const sliderValue = Number(opacitySlider.value);
      const bounded = clamp(sliderValue, OPACITY_SLIDER_MIN, OPACITY_SLIDER_MAX);
      this.imageOpacity = bounded / 100;
      this.applyImageOpacity();
    });

    const resizeHandle = createElement("div", { style: STYLES.resizeHandle });

    const closeButton = createElement("button", {
      className: "btn btn-sm btn-circle btn-error",
      style: STYLES.closeButton,
    });
    closeButton.type = "button";
    closeButton.textContent = "✕";
    closeButton.title = t("close");
    closeButton.addEventListener("click", () => {
      if (!confirm(t("adjust_tool_cancel_confirm"))) return;
      this.destroy(true);
    });

    const confirmButton = createElement("button", {
      className: "btn btn-primary",
      style: STYLES.confirmButton,
      textContent: t("adjust_tool_confirm"),
    });
    confirmButton.type = "button";
    confirmButton.addEventListener("click", () => {
      void this.handleConfirm();
    });

    topToolBar.append(sizeLabel, opacitySlider);

    frame.append(image, resizeHandle);
    overlay.append(frame, topToolBar, closeButton, confirmButton);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.frame = frame;
    this.frameImage = image;
    this.resizeHandle = resizeHandle;
    this.topToolBar = topToolBar;
    this.sizeLabel = sizeLabel;
    this.opacitySlider = opacitySlider;
    this.closeButton = closeButton;
    this.confirmButton = confirmButton;

    this.applyRect(this.getInitialRect());
    this.applyImageOpacity();
  }

  private mountEvents(): void {
    this.frame?.addEventListener("pointerdown", this.onFramePointerDown);
    this.resizeHandle?.addEventListener("pointerdown", this.onResizePointerDown);
    window.addEventListener("pointermove", this.onGlobalPointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", this.onGlobalPointerUp, {
      passive: true,
    });
    window.addEventListener("pointercancel", this.onGlobalPointerUp, {
      passive: true,
    });
    window.addEventListener("resize", this.onWindowResize, { passive: true });
  }

  private unmountEvents(): void {
    this.frame?.removeEventListener("pointerdown", this.onFramePointerDown);
    this.resizeHandle?.removeEventListener(
      "pointerdown",
      this.onResizePointerDown,
    );
    window.removeEventListener("pointermove", this.onGlobalPointerMove);
    window.removeEventListener("pointerup", this.onGlobalPointerUp);
    window.removeEventListener("pointercancel", this.onGlobalPointerUp);
    window.removeEventListener("resize", this.onWindowResize);
  }

  private getInitialRect(): Rect {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const maxWidth = Math.min(
      viewportWidth * 0.55,
      viewportWidth * MAX_VIEWPORT_RATIO,
      380,
    );
    const scaleFactor = clamp(this.options.initialScale, 0.2, 1);
    const width = clamp(maxWidth * scaleFactor, MIN_FRAME_WIDTH, maxWidth);
    const height = width / this.aspectRatio;
    const adjustedHeight = Math.min(height, viewportHeight * 0.65);
    const adjustedWidth = adjustedHeight * this.aspectRatio;

    return this.getClampedRect({
      width: adjustedWidth,
      height: adjustedHeight,
      x: (viewportWidth - adjustedWidth) * 0.5,
      y: (viewportHeight - adjustedHeight) * 0.45,
    });
  }

  private getClampedRect(rect: Rect): Rect {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const maxWidthByViewport = Math.min(
      viewportWidth * MAX_VIEWPORT_RATIO,
      viewportWidth - FRAME_MARGIN * 2,
    );
    const maxHeightByViewport = Math.min(
      viewportHeight * MAX_VIEWPORT_RATIO,
      viewportHeight - FRAME_MARGIN * 2,
    );
    const maxWidth = Math.max(
      MIN_FRAME_WIDTH,
      Math.min(maxWidthByViewport, maxHeightByViewport * this.aspectRatio),
    );
    const width = clamp(rect.width, MIN_FRAME_WIDTH, maxWidth);
    const height = width / this.aspectRatio;
    const maxX = Math.max(FRAME_MARGIN, viewportWidth - width - FRAME_MARGIN);
    const maxY = Math.max(FRAME_MARGIN, viewportHeight - height - FRAME_MARGIN);

    return {
      width,
      height,
      x: clamp(rect.x, FRAME_MARGIN, maxX),
      y: clamp(rect.y, FRAME_MARGIN, maxY),
    };
  }

  private applyRect(rect: Rect): void {
    if (!this.frame) return;
    this.rect = rect;
    this.frame.style.left = `${rect.x}px`;
    this.frame.style.top = `${rect.y}px`;
    this.frame.style.width = `${rect.width}px`;
    this.frame.style.height = `${rect.height}px`;

    if (this.topToolBar) {
      this.topToolBar.style.left = `${rect.x}px`;
      this.topToolBar.style.top = `${Math.max(8, rect.y - 30)}px`;
    }
  }

  private applyImageOpacity(): void {
    if (!this.frameImage) return;
    this.frameImage.style.opacity = `${this.imageOpacity}`;
  }

  private requestMetricsUpdate(): void {
    void this.updateMetrics();
  }

  private async updateMetrics(): Promise<Metrics | null> {
    if (this.metricsPending || !this.rect) return this.metrics;
    this.metricsPending = true;

    try {
      const projected = await projectScreenPointsToMapPixels([
        { x: this.rect.x, y: this.rect.y },
        { x: this.rect.x + this.rect.width, y: this.rect.y },
        { x: this.rect.x, y: this.rect.y + this.rect.height },
      ]);

      if (projected.length < 3) return this.metrics;

      const widthPx = Math.max(
        1,
        Math.round(
          Math.hypot(
            projected[1].pixelX - projected[0].pixelX,
            projected[1].pixelY - projected[0].pixelY,
          ),
        ),
      );
      const heightPx = Math.max(
        1,
        Math.round(
          Math.hypot(
            projected[2].pixelX - projected[0].pixelX,
            projected[2].pixelY - projected[0].pixelY,
          ),
        ),
      );

      this.metrics = {
        widthPx,
        heightPx,
        topLeftPixelX: projected[0].pixelX,
        topLeftPixelY: projected[0].pixelY,
      };

      if (this.sizeLabel) {
        this.sizeLabel.textContent = `${t("adjust_tool_target_size")}: ${widthPx}×${heightPx}px`;
      }
      return this.metrics;
    } finally {
      this.metricsPending = false;
    }
  }

  private async handleConfirm(): Promise<void> {
    const latestMetrics = await this.updateMetrics();
    if (!latestMetrics) return;

    const drawPosition = this.toDrawPosition(
      latestMetrics.topLeftPixelX,
      latestMetrics.topLeftPixelY,
    );
    try {
      await this.options.onConfirm({
        widthPx: latestMetrics.widthPx,
        heightPx: latestMetrics.heightPx,
        drawPosition,
      });
      this.destroy(false);
    } catch (error) {
      console.error("🧑‍🎨 : Failed to apply adjust tool result", error);
    }
  }

  private toDrawPosition(pixelX: number, pixelY: number): DrawPosition {
    const worldX = Math.floor(pixelX);
    const worldY = Math.floor(pixelY);
    const localX = ((worldX % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;
    const localY = ((worldY % TILE_SIZE) + TILE_SIZE) % TILE_SIZE;

    return {
      TLX: Math.floor((worldX - localX) / TILE_SIZE),
      TLY: Math.floor((worldY - localY) / TILE_SIZE),
      PxX: localX,
      PxY: localY,
    };
  }
}
