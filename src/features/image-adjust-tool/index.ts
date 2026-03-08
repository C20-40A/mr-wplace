import { t } from "@/i18n/manager";
import { TILE_SIZE } from "@/utils/geo-converter";
import {
  projectMapPixelsToScreenPoints,
  projectScreenPointsToMapPixels,
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
} from "./frame";
import {
  PROCESSING_DEBOUNCE_MS,
  PREVIEW_UPDATE_MS,
  injectPanelStyles,
  createToolButtonBar,
  PanelManager,
  type ProcessingState,
} from "./panel";
import {
  applyProcessing,
  renderPreviewCanvas,
  type AdjustToolProcessingParams,
  type ConfirmResult,
} from "./processing";

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
  private readonly options: ImageAdjustToolOptions;
  private readonly aspectRatio: number;

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
  private lastMetricsRequestedAt = 0;
  private previewPending = false;
  private queuedPreviewMetrics: Metrics | null = null;
  private lastPreviewRequestedAt = 0;
  private lastPreviewKey = "";
  private mounted = false;
  private processingDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onMapViewChanged = (event: MessageEvent): void => {
    if (event.data?.source !== "mr-wplace-map-view-changed") return;
    void this.syncScreenRectFromMap();
  };

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
    if (event.target === this.elements?.resizeHandle) return;

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

    this.activeInteraction = {
      type: "resize",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      pointerId: event.pointerId,
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
    const nextWidth = Math.max(MIN_FRAME_WIDTH, startRect.width + dx);
    this.applyRect(
      this.getClampedRect({
        x: startRect.x,
        y: startRect.y,
        width: nextWidth,
        height: nextWidth / this.aspectRatio,
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
      selectedColorIds:
        options.initialProcessingState?.selectedColorIds
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
    this.mapSyncPending = false;
    this.metricsPending = false;

    if (this.mapElement) {
      this.mapElement.style.zIndex = this.previousMapZIndex;
    }
    this.mapElement = null;
    this.previousMapZIndex = "";
    this.mounted = false;
    setMapProjectionTracking(false);

    if (triggerCancel) this.options.onCancel?.();
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
      sizeLabelText: `${t("adjust_tool_target_size")}: ...`,
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

    elements.overlay.appendChild(bar);
    document.body.appendChild(elements.overlay);

    this.elements = elements;
    this.toolButtonBar = bar;
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
    const { frame, resizeHandle, topToolBar, closeButton, confirmButton } =
      this.elements!;
    frame.addEventListener("pointerdown", this.onFramePointerDown);
    frame.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    topToolBar.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    resizeHandle.addEventListener("pointerdown", this.onResizePointerDown);
    closeButton.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    confirmButton.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    this.mapElement?.addEventListener("click", this.onMapClickCapture, true);
    window.addEventListener("pointermove", this.onGlobalPointerMove, { passive: true });
    window.addEventListener("pointerup", this.onGlobalPointerUp, { passive: true });
    window.addEventListener("pointercancel", this.onGlobalPointerUp, { passive: true });
    window.addEventListener("resize", this.onWindowResize, { passive: true });
    window.addEventListener("message", this.onMapViewChanged);
  }

  private unmountEvents(): void {
    const el = this.elements;
    el?.frame.removeEventListener("pointerdown", this.onFramePointerDown);
    el?.frame.removeEventListener("wheel", this.onOverlayWheel);
    el?.resizeHandle.removeEventListener("pointerdown", this.onResizePointerDown);
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

  private getClampedRect(rect: Rect): Rect {
    const width = Math.max(MIN_FRAME_WIDTH, rect.width);
    return { width, height: width / this.aspectRatio, x: rect.x, y: rect.y };
  }

  private applyRect(rect: Rect): void {
    if (!this.elements || !this.toolButtonBar) return;
    this.rect = rect;
    applyRectToFrame(rect, this.elements.frame, this.elements.topToolBar, this.toolButtonBar);
  }

  private applyImageOpacity(): void {
    if (!this.elements) return;
    this.elements.frameImage.style.opacity = `${this.imageOpacity}`;
  }

  private scheduleProcessedPreview(): void {
    if (this.processingDebounceTimer) clearTimeout(this.processingDebounceTimer);
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

  private requestMetricsUpdate(force = false, snapTopLeftToPixel = false): void {
    if (!force) {
      const now = Date.now();
      if (now - this.lastMetricsRequestedAt < METRICS_DRAG_UPDATE_MS) return;
      this.lastMetricsRequestedAt = now;
    } else {
      this.lastMetricsRequestedAt = Date.now();
    }
    void this.updateMetrics(snapTopLeftToPixel);
  }

  private async updateMetrics(snapTopLeftToPixel = false): Promise<Metrics | null> {
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
        Math.round(Math.hypot(projected[1].pixelX - projected[0].pixelX, projected[1].pixelY - projected[0].pixelY)),
      );
      const heightPx = Math.max(
        1,
        Math.round(Math.hypot(projected[2].pixelX - projected[0].pixelX, projected[2].pixelY - projected[0].pixelY)),
      );
      const topLeftPixelX = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelX)
        : projected[0].pixelX;
      const topLeftPixelY = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelY)
        : projected[0].pixelY;

      this.metrics = { widthPx, heightPx, topLeftPixelX, topLeftPixelY };
      this.mapRect = { x: topLeftPixelX, y: topLeftPixelY, width: widthPx, height: heightPx };

      if (this.elements?.sizeLabel) {
        const labelText = `${t("adjust_tool_target_size")}: ${widthPx}×${heightPx}px`;
        if (this.elements.sizeLabel.textContent !== labelText)
          this.elements.sizeLabel.textContent = labelText;
      }

      this.requestPreviewUpdate(this.metrics);
      if (snapTopLeftToPixel) void this.syncScreenRectFromMap(true);
      return this.metrics;
    } finally {
      this.metricsPending = false;
    }
  }

  private async syncScreenRectFromMap(allowDuringInteraction = false): Promise<void> {
    if (this.mapSyncPending || !this.mapRect || (!allowDuringInteraction && this.activeInteraction))
      return;
    this.mapSyncPending = true;

    try {
      const projected = await projectMapPixelsToScreenPoints([
        { pixelX: this.mapRect.x, pixelY: this.mapRect.y },
        { pixelX: this.mapRect.x + this.mapRect.width, pixelY: this.mapRect.y },
        { pixelX: this.mapRect.x, pixelY: this.mapRect.y + this.mapRect.height },
      ]);
      if (projected.length < 3) return;

      this.applyRect({
        x: projected[0].x,
        y: projected[0].y,
        width: Math.max(
          MIN_FRAME_WIDTH,
          Math.hypot(projected[1].x - projected[0].x, projected[1].y - projected[0].y),
        ),
        height: Math.max(
          MIN_FRAME_WIDTH / this.aspectRatio,
          Math.hypot(projected[2].x - projected[0].x, projected[2].y - projected[0].y),
        ),
      });
    } finally {
      this.mapSyncPending = false;
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
      const sourceImage = this.baseImage;
      if (!sourceImage || !this.elements?.frameImage) return;

      const previewCanvas = await renderPreviewCanvas(
        sourceImage,
        metrics.widthPx,
        metrics.heightPx,
      );
      const processedCanvas = await applyProcessing(
        previewCanvas,
        this.buildProcessingParams(),
        sourceImage,
      );
      this.elements.frameImage.src = processedCanvas.toDataURL("image/png");
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
