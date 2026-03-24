import { t } from "@/i18n/manager";
import { TILE_SIZE, latLonToPixels } from "@/utils/geo-converter";
import {
  projectMapPixelsToScreenPoints,
  projectScreenPointsToMapPixels,
  releaseAdjustPreviewSessionInInject,
  renderAdjustPreviewInInject,
  setMapProjectionTracking,
} from "@/utils/inject-bridge";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import {
  IMAGE_ADJUST_TOOL_MAP_Z_INDEX,
  MIN_FRAME_WIDTH,
  MAX_VIEWPORT_RATIO,
  METRICS_DRAG_UPDATE_MS,
  DEFAULT_IMAGE_OPACITY,
  createFrameElements,
  applyRectToFrame,
  type Rect,
  type ActiveInteraction,
  type Metrics,
  type FrameElements,
  type ResizeHandleCorner,
} from "./frame";
import {
  PROCESSING_DEBOUNCE_MS,
  PREVIEW_UPDATE_MS,
  injectPanelStyles,
  createToolButtonBar,
  PanelManager,
  type ProcessingState,
} from "./panel";
import { type AdjustToolProcessingParams, type ConfirmResult } from "./processing";

export type { AdjustToolProcessingParams, ConfirmResult };

export type ImageAdjustToolOptions = {
  imageSrc: string;
  naturalWidth: number;
  naturalHeight: number;
  initialScale: number;
  initialDrawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  initialProcessingState?: Partial<ProcessingState>;
  onConfirm: (result: ConfirmResult) => void | Promise<void>;
  onCancel?: () => void;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const createDefaultProcessingState = (): ProcessingState => ({
  brightness: 0,
  contrast: 0,
  saturation: 0,
  ditheringEnabled: false,
  ditheringThreshold: 500,
  ditheringMethod: "ordered",
  quantizationMethod: "rgb-euclidean",
  colorFlattenMode: "none",
  outlineEnabled: false,
  outlineThreshold: 55,
  outlineWidth: 1,
  outlineUseFixedColor: false,
  outlineFixedColor: "#000000",
  selectedColorIds: colorpalette
    .filter((c) => c.id !== TRANSPARENT_COLOR_ID)
    .map((c) => c.id),
});

export class ImageAdjustToolMode {
  private static sessionCounter = 0;

  private readonly options: ImageAdjustToolOptions;
  private readonly aspectRatio: number;
  private readonly previewSessionId = `adjust-preview-${Date.now()}-${++ImageAdjustToolMode.sessionCounter}`;

  private mapElement: HTMLElement | null = null;
  private previousMapZIndex = "";

  private elements: FrameElements | null = null;
  private toolButtonBar: HTMLDivElement | null = null;
  private panelManager: PanelManager | null = null;
  private baseImage: HTMLImageElement | null = null;

  private readonly processingState: ProcessingState;

  private imageOpacity = DEFAULT_IMAGE_OPACITY / 100;
  private rect: Rect | null = null;
  private activeInteraction: ActiveInteraction | null = null;
  private metrics: Metrics | null = null;
  private mapRect: Rect | null = null;
  private metricsPending = false;
  private mapSyncPending = false;
  private queuedMapSync = false;
  private lastMapViewSyncAt = 0;
  private lastMetricsRequestedAt = 0;

  // CSS transform approximation during map movement
  private frameWrapper: HTMLDivElement | null = null;
  private transformBase: {
    centerWorldX: number;
    centerWorldY: number;
    zoom: number;
    screenPerWorld: number; // screen px per world px at base zoom
  } | null = null;
  private previewPending = false;
  private queuedPreviewMetrics: Metrics | null = null;
  private lastPreviewRequestedAt = 0;
  private lastPreviewKey = "";
  private mounted = false;
  private processingDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private previewRequestVersion = 0;

  private readonly onMapViewChanged = (event: MessageEvent): void => {
    if (event.data?.source !== "mr-wplace-map-view-changed") return;
    const settled = event.data?.settled === true;
    const center = event.data?.center as { lng: number; lat: number } | undefined;
    const zoom = event.data?.zoom as number | undefined;

    if (settled) {
      this.clearFrameTransform();
      this.lastMapViewSyncAt = Date.now();
      void this.syncScreenRectFromMap().then(() => {
        if (center && zoom !== undefined) this.saveTransformBase(center, zoom);
      });
      return;
    }

    // During map movement: approximate with CSS transform, skip inject roundtrip
    if (center && zoom !== undefined && this.transformBase) {
      this.applyTransformApproximation(center, zoom);
      return;
    }

    const now = Date.now();
    if (now - this.lastMapViewSyncAt < METRICS_DRAG_UPDATE_MS) return;
    this.lastMapViewSyncAt = now;
    void this.syncScreenRectFromMap();
  };

  private saveTransformBase(center: { lng: number; lat: number }, zoom: number): void {
    if (!this.rect || !this.mapRect) return;
    const [cx, cy] = latLonToPixels(center.lat, center.lng);
    const screenPerWorld = this.mapRect.width > 0 ? this.rect.width / this.mapRect.width : 0;
    if (screenPerWorld <= 0) return;
    this.transformBase = { centerWorldX: cx, centerWorldY: cy, zoom, screenPerWorld };
  }

  private applyTransformApproximation(center: { lng: number; lat: number }, zoom: number): void {
    const base = this.transformBase;
    const wrapper = this.frameWrapper;
    if (!base || !wrapper) return;

    const [newCx, newCy] = latLonToPixels(center.lat, center.lng);
    const scaleRatio = Math.pow(2, zoom - base.zoom);
    const spwNew = base.screenPerWorld * scaleRatio;

    // Frame position in screen coords:
    //   base:    screenCenter + (worldX - baseCx) * spwBase
    //   current: screenCenter + (worldX - newCx)  * spwNew
    // delta = current - base = (baseCx - newCx)*spwNew + worldX*(spwNew - spwBase) - screenCenter*(scaleRatio-1)
    // Expressed as transform on the wrapper (origin=0,0):
    //   translate(tx, ty) scale(scaleRatio)
    // where tx/ty account for both pan and zoom-anchor shift.
    const screenCx = window.innerWidth / 2;
    const screenCy = window.innerHeight / 2;
    const tx = (base.centerWorldX - newCx) * spwNew + screenCx * (1 - scaleRatio);
    const ty = (base.centerWorldY - newCy) * spwNew + screenCy * (1 - scaleRatio);

    wrapper.style.transformOrigin = "0 0";
    wrapper.style.transform = `translate(${tx}px, ${ty}px) scale(${scaleRatio})`;
  }

  private clearFrameTransform(): void {
    if (!this.frameWrapper) return;
    this.frameWrapper.style.transform = "";
    this.frameWrapper.style.transformOrigin = "";
  }

  private readonly onOverlayWheel = (event: WheelEvent): void => {
    const mapRoot = this.mapElement;
    if (!mapRoot) return;
    const wheelTarget =
      mapRoot.querySelector<HTMLElement>(".maplibregl-canvas") ?? mapRoot;
    wheelTarget.dispatchEvent(
      new WheelEvent("wheel", {
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        bubbles: true,
        cancelable: true,
      }),
    );
    event.preventDefault();
  };

  private readonly onMapClickCapture = (event: MouseEvent): void => {
    const overlay = this.elements?.overlay;
    if (!overlay) return;
    const target = event.target as Node | null;
    if (target && overlay.contains(target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  private readonly onFramePointerDown = (event: PointerEvent): void => {
    const frame = this.elements?.frame;
    if (!frame || !this.rect) return;
    if (event.button !== 0) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("[data-resize-handle='true']")
    )
      return;

    this.activeInteraction = {
      type: "drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      pointerId: event.pointerId,
    };
    frame.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  private readonly onResizePointerDown = (event: PointerEvent): void => {
    const frame = this.elements?.frame;
    if (!frame || !this.rect) return;
    if (event.button !== 0) return;
    if (!(event.currentTarget instanceof HTMLElement)) return;

    const resizeCorner = event.currentTarget.dataset
      .resizeCorner as ResizeHandleCorner | undefined;
    if (!resizeCorner) return;

    this.activeInteraction = {
      type: "resize",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      pointerId: event.pointerId,
      resizeCorner,
    };
    frame.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onGlobalPointerMove = (event: PointerEvent): void => {
    if (!this.activeInteraction || !this.rect) return;
    if (event.pointerId !== this.activeInteraction.pointerId) return;

    const dx = event.clientX - this.activeInteraction.startClientX;
    const dy = event.clientY - this.activeInteraction.startClientY;

    if (this.activeInteraction.type === "drag") {
      this.applyRect(
        this.getClampedRect({
          ...this.activeInteraction.startRect,
          x: this.activeInteraction.startRect.x + dx,
          y: this.activeInteraction.startRect.y + dy,
        }),
      );
      this.requestMetricsUpdate();
      return;
    }

    const startRect = this.activeInteraction.startRect;
    const resizeCorner = this.activeInteraction.resizeCorner ?? "bottom-right";
    const widthDeltaMap: Record<ResizeHandleCorner, number> = {
      "top-left": -dx,
      "top-right": dx,
      "bottom-left": -dx,
      "bottom-right": dx,
    };
    const nextWidth = clamp(
      startRect.width + widthDeltaMap[resizeCorner],
      MIN_FRAME_WIDTH,
      this.getMaxScreenWidth(),
    );
    const nextHeight = nextWidth / this.aspectRatio;
    const nextX =
      resizeCorner === "top-left" || resizeCorner === "bottom-left"
        ? startRect.x + (startRect.width - nextWidth)
        : startRect.x;
    const nextY =
      resizeCorner === "top-left" || resizeCorner === "top-right"
        ? startRect.y + (startRect.height - nextHeight)
        : startRect.y;

    this.applyRect(
      this.getClampedRect({
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
      }),
    );
    this.requestMetricsUpdate();
  };

  private readonly onGlobalPointerUp = (event: PointerEvent): void => {
    const frame = this.elements?.frame;
    if (!this.activeInteraction || !frame) return;
    if (event.pointerId !== this.activeInteraction.pointerId) return;
    frame.releasePointerCapture(event.pointerId);
    this.activeInteraction = null;
    this.requestMetricsUpdate(true, true);
  };

  private readonly onWindowResize = (): void => {
    if (!this.mapRect) return;
    void this.syncScreenRectFromMap();
  };

  constructor(options: ImageAdjustToolOptions) {
    this.options = options;
    this.aspectRatio = Math.max(
      0.0001,
      options.naturalWidth / Math.max(1, options.naturalHeight),
    );
    const defaultProcessingState = createDefaultProcessingState();
    this.processingState = {
      ...defaultProcessingState,
      ...options.initialProcessingState,
      selectedColorIds: options.initialProcessingState?.selectedColorIds
        ? [...options.initialProcessingState.selectedColorIds]
        : defaultProcessingState.selectedColorIds,
    };
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

    injectPanelStyles();
    this.createUI();
    this.mountEvents();
    this.mounted = true;
    setMapProjectionTracking(true);
    void this.initPositionFromDrawPosition();
    return true;
  }

  destroy(triggerCancel = false): void {
    if (!this.mounted) return;

    if (this.processingDebounceTimer) {
      clearTimeout(this.processingDebounceTimer);
      this.processingDebounceTimer = null;
    }

    this.panelManager?.destroy();
    this.panelManager = null;

    this.unmountEvents();
    this.elements?.overlay.remove();
    this.elements = null;
    this.toolButtonBar?.remove();
    this.toolButtonBar = null;
    this.baseImage = null;
    this.activeInteraction = null;
    this.rect = null;
    this.mapRect = null;
    this.metrics = null;
    this.transformBase = null;
    this.frameWrapper = null;
    this.mapSyncPending = false;
    this.metricsPending = false;

    if (this.mapElement) {
      this.mapElement.style.zIndex = this.previousMapZIndex;
    }
    this.mapElement = null;
    this.previousMapZIndex = "";
    this.mounted = false;
    setMapProjectionTracking(false);
    releaseAdjustPreviewSessionInInject(this.previewSessionId);

    if (triggerCancel) this.options.onCancel?.();
  }

  private createDPad(): HTMLElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      bottom: 16px;
      right: 16px;
      display: grid;
      grid-template-columns: repeat(3, 28px);
      grid-template-rows: repeat(3, 28px);
      pointer-events: auto;
      z-index: 2002;
    `;

    const addBtn = (
      symbol: string,
      col: string,
      row: string,
      dx: number,
      dy: number,
    ) => {
      const btn = document.createElement("button");
      btn.className = "btn btn-xs btn-neutral";
      btn.textContent = symbol;
      btn.style.cssText = `
        grid-column: ${col};
        grid-row: ${row};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.7rem;
        padding: 0;
        opacity: 0.85;
      `;
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!this.mapRect) return;
        const step = e.shiftKey ? 10 : 1;
        this.mapRect = {
          ...this.mapRect,
          x: this.mapRect.x + dx * step,
          y: this.mapRect.y + dy * step,
        };
        await this.syncScreenRectFromMap(true);
        this.requestMetricsUpdate(true, false);
      });
      container.appendChild(btn);
    };

    addBtn("↑", "2", "1", 0, -1);
    addBtn("←", "1", "2", -1, 0);
    addBtn("→", "3", "2", 1, 0);
    addBtn("↓", "2", "3", 0, 1);

    return container;
  }

  private createUI(): void {
    const baseImage = document.createElement("img");
    baseImage.src = this.options.imageSrc;
    this.baseImage = baseImage;

    const { bar, paletteButton, adjustButton } = createToolButtonBar({
      paletteTitle: "Color Palette",
      adjustTitle: `${t("contrast")} / ${t("brightness")}`,
      onPalette: () => this.panelManager?.toggle("palette"),
      onAdjust: () => this.panelManager?.toggle("adjust"),
    });

    const elements = createFrameElements({
      imageSrc: this.options.imageSrc,
      sizeLabelText: `...`,
      opacityLabelText: t("map_filter_area_opacity"),
      confirmText: t("adjust_tool_confirm"),
      closeText: t("close"),
      onOpacityChange: (opacity) => {
        this.imageOpacity = opacity;
        this.applyImageOpacity();
      },
      onClose: () => {
        if (!confirm(t("adjust_tool_cancel_confirm"))) return;
        this.destroy(true);
      },
      onConfirm: () => void this.handleConfirm(),
    });

    // Wrapper for map-tracking elements only (CSS transform target)
    const frameWrapper = document.createElement("div");
    frameWrapper.style.cssText = "position: fixed; inset: 0; pointer-events: none;";
    frameWrapper.append(elements.frame, elements.topToolBar, elements.sizeInfo, bar);
    elements.overlay.appendChild(frameWrapper);
    elements.overlay.appendChild(this.createDPad());
    document.body.appendChild(elements.overlay);

    this.elements = elements;
    this.toolButtonBar = bar;
    this.frameWrapper = frameWrapper;
    this.panelManager = new PanelManager(
      elements.overlay,
      bar,
      paletteButton,
      adjustButton,
      this.processingState,
      () => this.scheduleProcessedPreview(),
    );

    this.applyRect(this.getInitialRect());
    this.applyImageOpacity();
  }

  private mountEvents(): void {
    const { frame, resizeHandles, topToolBar, closeButton, confirmButton } =
      this.elements!;
    frame.addEventListener("pointerdown", this.onFramePointerDown);
    frame.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    topToolBar.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
    Object.values(resizeHandles).forEach((handle) => {
      handle.addEventListener("pointerdown", this.onResizePointerDown);
    });
    closeButton.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
    confirmButton.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
    this.mapElement?.addEventListener("click", this.onMapClickCapture, true);
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
    window.addEventListener("message", this.onMapViewChanged);
  }

  private unmountEvents(): void {
    const el = this.elements;
    el?.frame.removeEventListener("pointerdown", this.onFramePointerDown);
    el?.frame.removeEventListener("wheel", this.onOverlayWheel);
    Object.values(el?.resizeHandles ?? {}).forEach((handle) => {
      handle.removeEventListener("pointerdown", this.onResizePointerDown);
    });
    el?.topToolBar.removeEventListener("wheel", this.onOverlayWheel);
    el?.closeButton.removeEventListener("wheel", this.onOverlayWheel);
    el?.confirmButton.removeEventListener("wheel", this.onOverlayWheel);
    this.mapElement?.removeEventListener("click", this.onMapClickCapture, true);
    window.removeEventListener("pointermove", this.onGlobalPointerMove);
    window.removeEventListener("pointerup", this.onGlobalPointerUp);
    window.removeEventListener("pointercancel", this.onGlobalPointerUp);
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("message", this.onMapViewChanged);
  }

  private async initPositionFromDrawPosition(): Promise<void> {
    const dp = this.options.initialDrawPosition;
    if (dp && (dp.TLX !== 0 || dp.TLY !== 0 || dp.PxX !== 0 || dp.PxY !== 0)) {
      const worldX = dp.TLX * TILE_SIZE + dp.PxX;
      const worldY = dp.TLY * TILE_SIZE + dp.PxY;
      const naturalW = this.options.naturalWidth;
      const naturalH = this.options.naturalHeight;
      const scale = this.options.initialScale;
      const widthPx = Math.max(1, Math.round(naturalW * scale));
      const heightPx = Math.max(1, Math.round(naturalH * scale));
      this.mapRect = { x: worldX, y: worldY, width: widthPx, height: heightPx };
      await this.syncScreenRectFromMap(true);
      this.requestMetricsUpdate(true);
    } else {
      this.requestMetricsUpdate(true);
    }
  }

  private getInitialRect(): Rect {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxWidth = Math.min(vw * 0.55, vw * MAX_VIEWPORT_RATIO, 380);
    const scaleFactor = clamp(this.options.initialScale, 0.2, 1);
    const width = clamp(maxWidth * scaleFactor, MIN_FRAME_WIDTH, maxWidth);
    const height = width / this.aspectRatio;
    const adjustedHeight = Math.min(height, vh * 0.65);
    const adjustedWidth = adjustedHeight * this.aspectRatio;

    return this.getClampedRect({
      width: adjustedWidth,
      height: adjustedHeight,
      x: (vw - adjustedWidth) * 0.5,
      y: (vh - adjustedHeight) * 0.45,
    });
  }

  private getMaxScreenWidth(): number {
    if (!this.rect || !this.mapRect || this.mapRect.width <= 0) return Infinity;
    return this.options.naturalWidth * (this.rect.width / this.mapRect.width);
  }

  private getClampedRect(rect: Rect): Rect {
    const width = Math.max(MIN_FRAME_WIDTH, rect.width);
    return { width, height: width / this.aspectRatio, x: rect.x, y: rect.y };
  }

  private applyRect(rect: Rect): void {
    if (!this.elements || !this.toolButtonBar) return;
    this.rect = rect;
    applyRectToFrame(
      rect,
      this.elements.frame,
      this.elements.topToolBar,
      this.toolButtonBar,
      this.elements.sizeInfo,
    );
  }

  private applyImageOpacity(): void {
    if (!this.elements) return;
    this.elements.frameImage.style.opacity = `${this.imageOpacity}`;
  }

  private scheduleProcessedPreview(): void {
    if (this.processingDebounceTimer)
      clearTimeout(this.processingDebounceTimer);
    this.processingDebounceTimer = setTimeout(() => {
      this.processingDebounceTimer = null;
      if (this.metrics) this.requestPreviewUpdate(this.metrics, true);
    }, PROCESSING_DEBOUNCE_MS);
  }

  private buildProcessingParams(): AdjustToolProcessingParams {
    const s = this.processingState;
    return {
      adjustments: {
        brightness: s.brightness,
        contrast: s.contrast,
        saturation: s.saturation,
      },
      selectedColorIds: [...s.selectedColorIds],
      ditheringEnabled: s.ditheringEnabled,
      ditheringThreshold: s.ditheringThreshold,
      ditheringMethod: s.ditheringMethod,
      quantizationMethod: s.quantizationMethod,
      colorFlattenMode: s.colorFlattenMode,
      outlineEnabled: s.outlineEnabled,
      outlineThreshold: s.outlineThreshold,
      outlineWidth: s.outlineWidth,
      outlineUseFixedColor: s.outlineUseFixedColor,
      outlineFixedColor: s.outlineFixedColor,
    };
  }

  private requestMetricsUpdate(
    force = false,
    snapTopLeftToPixel = false,
  ): void {
    if (!force) {
      const now = Date.now();
      if (now - this.lastMetricsRequestedAt < METRICS_DRAG_UPDATE_MS) return;
      this.lastMetricsRequestedAt = now;
    } else {
      this.lastMetricsRequestedAt = Date.now();
    }
    void this.updateMetrics(snapTopLeftToPixel);
  }

  private async updateMetrics(
    snapTopLeftToPixel = false,
  ): Promise<Metrics | null> {
    if (this.metricsPending || !this.rect) return this.metrics;
    this.metricsPending = true;

    try {
      const projected = await projectScreenPointsToMapPixels([
        { x: this.rect.x, y: this.rect.y },
        { x: this.rect.x + this.rect.width, y: this.rect.y },
        { x: this.rect.x, y: this.rect.y + this.rect.height },
      ]);
      if (projected.length < 3) return this.metrics;

      const rawWidthPx = Math.max(
        1,
        Math.round(
          Math.hypot(
            projected[1].pixelX - projected[0].pixelX,
            projected[1].pixelY - projected[0].pixelY,
          ),
        ),
      );
      const rawHeightPx = Math.max(
        1,
        Math.round(
          Math.hypot(
            projected[2].pixelX - projected[0].pixelX,
            projected[2].pixelY - projected[0].pixelY,
          ),
        ),
      );
      const widthPx = Math.min(rawWidthPx, this.options.naturalWidth);
      const heightPx = Math.min(rawHeightPx, this.options.naturalHeight);
      const topLeftPixelX = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelX)
        : projected[0].pixelX;
      const topLeftPixelY = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelY)
        : projected[0].pixelY;

      this.metrics = { widthPx, heightPx, topLeftPixelX, topLeftPixelY };
      this.mapRect = {
        x: topLeftPixelX,
        y: topLeftPixelY,
        width: widthPx,
        height: heightPx,
      };

      if (this.elements?.sizeInfo) {
        const totalPixels = widthPx * heightPx;
        const timeStr = this.formatEstimatedTime(totalPixels);
        const newHtml = `${widthPx}×${heightPx}px<br><span style="color:#9ca3af;font-size:0.6rem;">${timeStr}</span>`;
        if (this.elements.sizeInfo.innerHTML !== newHtml)
          this.elements.sizeInfo.innerHTML = newHtml;
      }

      this.requestPreviewUpdate(this.metrics);
      if (snapTopLeftToPixel) void this.syncScreenRectFromMap(true);
      return this.metrics;
    } finally {
      this.metricsPending = false;
    }
  }

  private async syncScreenRectFromMap(
    allowDuringInteraction = false,
  ): Promise<void> {
    if (this.mapSyncPending) {
      this.queuedMapSync = true;
      return;
    }
    if (!this.mapRect || (!allowDuringInteraction && this.activeInteraction))
      return;
    this.mapSyncPending = true;

    try {
      const projected = await projectMapPixelsToScreenPoints([
        { pixelX: this.mapRect.x, pixelY: this.mapRect.y },
        { pixelX: this.mapRect.x + this.mapRect.width, pixelY: this.mapRect.y },
        {
          pixelX: this.mapRect.x,
          pixelY: this.mapRect.y + this.mapRect.height,
        },
      ]);
      if (projected.length < 3) return;

      this.applyRect({
        x: projected[0].x,
        y: projected[0].y,
        width: Math.max(
          1,
          Math.hypot(
            projected[1].x - projected[0].x,
            projected[1].y - projected[0].y,
          ),
        ),
        height: Math.max(
          1,
          Math.hypot(
            projected[2].x - projected[0].x,
            projected[2].y - projected[0].y,
          ),
        ),
      });
    } finally {
      this.mapSyncPending = false;
      if (this.queuedMapSync) {
        this.queuedMapSync = false;
        void this.syncScreenRectFromMap(allowDuringInteraction);
      }
    }
  }

  private requestPreviewUpdate(metrics: Metrics, force = false): void {
    const nextKey = `${metrics.widthPx}x${metrics.heightPx}`;
    if (!force) {
      const now = Date.now();
      if (nextKey === this.lastPreviewKey) return;
      if (now - this.lastPreviewRequestedAt < PREVIEW_UPDATE_MS) return;
      this.lastPreviewRequestedAt = now;
    } else {
      this.lastPreviewRequestedAt = Date.now();
    }
    this.lastPreviewKey = nextKey;

    if (this.previewPending) {
      this.queuedPreviewMetrics = metrics;
      return;
    }
    void this.updatePreview(metrics);
  }

  private async updatePreview(metrics: Metrics): Promise<void> {
    this.previewPending = true;
    try {
      if (!this.elements?.frameImage) return;
      const requestVersion = ++this.previewRequestVersion;
      const result = await renderAdjustPreviewInInject({
        sessionId: this.previewSessionId,
        imageSrc: this.options.imageSrc,
        widthPx: metrics.widthPx,
        heightPx: metrics.heightPx,
        ...this.buildProcessingParams(),
      });
      if (requestVersion !== this.previewRequestVersion) return;
      this.elements.frameImage.src = result.dataUrl;
      this.panelManager?.updateColorStats(result.colorStats);
    } finally {
      this.previewPending = false;
      const queued = this.queuedPreviewMetrics;
      this.queuedPreviewMetrics = null;
      if (queued) this.requestPreviewUpdate(queued, true);
    }
  }

  private async handleConfirm(): Promise<void> {
    const latestMetrics = await this.updateMetrics(true);
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
        processingParams: this.buildProcessingParams(),
      });
      this.destroy(false);
    } catch (error) {
      console.error("🧑‍🎨 : Failed to apply adjust tool result", error);
    }
  }

  private formatEstimatedTime(totalPixels: number): string {
    const totalSeconds = totalPixels * 30;
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    return parts.length > 0 ? parts.join("") : "<1m";
  }

  private toDrawPosition(pixelX: number, pixelY: number) {
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
