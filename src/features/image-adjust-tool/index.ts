import { t } from "@/i18n/manager";
import {
  TILE_SIZE,
  ZOOM_LEVEL,
  metersToLatLon,
  pixelsToMeters,
} from "@/utils/geo-converter";
import { gotoPosition } from "@/utils/position";
import {
  projectMapPixelsToScreenPointsWithView,
  projectScreenPointsToMapPixels,
  releaseAdjustPreviewSessionInInject,
  renderAdjustPreviewInInject,
  setMapProjectionAnchor,
  setMapProjectionTracking,
} from "@/utils/inject-bridge";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { DEFAULT_QUANTIZATION_METHOD } from "@/features/gallery/routes/image-editor/canvas-processor";
import {
  IMAGE_ADJUST_TOOL_MAP_Z_INDEX,
  MIN_FRAME_WIDTH,
  MAX_VIEWPORT_RATIO,
  METRICS_DRAG_UPDATE_MS,
  DEFAULT_IMAGE_OPACITY,
  FAR_MODE_MIN_SCREEN_PX,
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
  quantizationMethod: DEFAULT_QUANTIZATION_METHOD,
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
  private dPad: HTMLElement | null = null;
  private baseImage: HTMLImageElement | null = null;
  private coordInputs: {
    container: HTMLDivElement;
    tlx: HTMLInputElement;
    tly: HTMLInputElement;
    pxx: HTMLInputElement;
    pxy: HTMLInputElement;
  } | null = null;

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
  private lastMapZoom: number | null = null;

  // Far mode: when the target is too small on screen to see the image, it is
  // shown as a pin and dragged in world space (size preserved, projection based).
  private farMode = false;
  // Screen px per world px reported by inject (map's own scale), used to turn a
  // screen drag into an exact world delta without dividing by a tiny clamped rect.
  private mapScale: number | null = null;

  // CSS transform approximation during map movement
  private frameWrapper: HTMLDivElement | null = null;
  private transformBase: {
    zoom: number;
    // Screen (client) position of the anchored world pixel at the base view.
    anchorScreenX: number;
    anchorScreenY: number;
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
    const zoom = event.data?.zoom as number | undefined;
    const anchor = event.data?.anchor as
      | { x: number; y: number }
      | null
      | undefined;
    const scale = event.data?.scale as number | undefined;

    if (zoom !== undefined) this.lastMapZoom = zoom;
    if (typeof scale === "number" && Number.isFinite(scale) && scale > 0)
      this.mapScale = scale;

    if (settled) {
      // While an interaction is active the drag/resize owns the frame's screen
      // rect, so skip the projection sync (syncScreenRectFromMap also guards on
      // activeInteraction, but we avoid the roundtrip entirely here).
      this.lastMapViewSyncAt = Date.now();
      void this.syncScreenRectFromMap();
      return;
    }

    // While the user is moving/resizing the frame, the interaction owns the
    // frame's screen rect. Do NOT also apply the map-follow transform: a
    // wheel-zoom during the drag would otherwise scale/offset the frame, making
    // it lag the cursor and appear to shrink. Clear any stale transform instead.
    if (this.activeInteraction) {
      this.clearFrameTransform();
      return;
    }

    // During map movement: follow the map with a CSS transform anchored to the
    // map's own projection of the frame's world top-left. Exact and roundtrip-free.
    if (anchor && zoom !== undefined && this.transformBase) {
      this.applyTransformApproximation(anchor, zoom);
      return;
    }

    // No transform available: fall back to a throttled exact projection sync.
    const now = Date.now();
    if (now - this.lastMapViewSyncAt < METRICS_DRAG_UPDATE_MS) return;
    this.lastMapViewSyncAt = now;
    void this.syncScreenRectFromMap();
  };

  /**
   * Anchor the CSS-transform follow to the frame's world top-left. The base
   * screen position is exactly the frame's projected rect, and inject streams
   * the same world pixel projected with the map's own `project()`. Because both
   * sides use the map projection, the frame cannot drift at any zoom level,
   * bearing or pitch.
   */
  private saveTransformBase(zoom: number): void {
    if (!this.mounted || !this.rect || !this.mapRect) return;
    this.transformBase = {
      zoom,
      anchorScreenX: this.rect.x,
      anchorScreenY: this.rect.y,
    };
    // Send the anchored world pixel so inject streams its exact projection with
    // the map's own `project()` (no drift at any zoom / bearing / pitch).
    setMapProjectionAnchor({
      pixelX: this.mapRect.x,
      pixelY: this.mapRect.y,
    });
  }

  private applyTransformApproximation(
    anchor: { x: number; y: number },
    zoom: number,
  ): void {
    const base = this.transformBase;
    const wrapper = this.frameWrapper;
    if (!base || !wrapper) return;

    // Keep the anchored world pixel at its exact projected screen position and
    // scale everything else about it: new = scale * base + translate.
    const scaleRatio = Math.pow(2, zoom - base.zoom);
    const tx = anchor.x - base.anchorScreenX * scaleRatio;
    const ty = anchor.y - base.anchorScreenY * scaleRatio;

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

    // The interaction owns the frame transform from here on; drop any map-follow
    // transform that may still be applied from a previous map movement.
    this.clearFrameTransform();
    this.activeInteraction = {
      type: "drag",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startRect: { ...this.rect },
      startMapRect: this.mapRect ? { ...this.mapRect } : undefined,
      worldScale:
        this.mapScale && this.mapScale > 0
          ? this.mapScale
          : this.mapRect && this.mapRect.width > 0
            ? this.rect.width / this.mapRect.width
            : 0,
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

    // The interaction owns the frame transform from here on.
    this.clearFrameTransform();
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
      const { startMapRect, worldScale } = this.activeInteraction;
      // Far mode: move in world space so a big drag crosses countries. Both the
      // scale and the on-screen size are frozen at drag start, so a mid-drag
      // zoom can never distort the target's size.
      if (this.farMode && startMapRect && worldScale && worldScale > 0) {
        const worldDx = dx / worldScale;
        const worldDy = dy / worldScale;
        const nextMapRect = this.clampWorldRect({
          ...startMapRect,
          x: startMapRect.x + worldDx,
          y: startMapRect.y + worldDy,
        });
        this.mapRect = nextMapRect;
        // Derive the on-screen position from the (possibly clamped) world rect so
        // the pin never separates from the target at the world edges.
        this.applyRect({
          x:
            this.activeInteraction.startRect.x +
            (nextMapRect.x - startMapRect.x) * worldScale,
          y:
            this.activeInteraction.startRect.y +
            (nextMapRect.y - startMapRect.y) * worldScale,
          width: this.activeInteraction.startRect.width,
          height: this.activeInteraction.startRect.height,
        });
        this.applyMetricsFromMapRect();
        return;
      }
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
    const wasFarDrag =
      this.farMode && this.activeInteraction.type === "drag";
    this.activeInteraction = null;
    // Far mode already holds an exact world rect; just re-project the screen
    // rect (and re-anchor). Recomputing metrics from the tiny screen rect would
    // quantise the world size at low zoom.
    if (wasFarDrag) {
      this.applyMetricsFromMapRect();
      void this.syncScreenRectFromMap(true);
      return;
    }
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
    void this.initFrame();
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
    this.coordInputs?.container.remove();
    this.coordInputs = null;
    this.dPad?.remove();
    this.dPad = null;
    this.baseImage = null;
    this.activeInteraction = null;
    this.rect = null;
    this.mapRect = null;
    this.metrics = null;
    this.transformBase = null;
    this.frameWrapper = null;
    this.farMode = false;
    this.mapScale = null;
    this.mapSyncPending = false;
    this.metricsPending = false;

    if (this.mapElement) {
      this.mapElement.style.zIndex = this.previousMapZIndex;
    }
    this.mapElement = null;
    this.previousMapZIndex = "";
    this.mounted = false;
    setMapProjectionTracking(false);
    setMapProjectionAnchor(null);
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

  /**
   * TLX / TLY / PxX / PxY を直接入力してフレームを配置する UI。
   * 現在のフレーム位置も常時反映される。
   */
  private createCoordInput(): HTMLDivElement {
    const container = document.createElement("div");
    container.style.cssText = `
      position: fixed;
      left: 16px;
      bottom: 16px;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.72);
      color: #fff;
      font-size: 0.7rem;
      pointer-events: auto;
      z-index: 2002;
    `;

    const inputStyle = `
      width: 3.2rem;
      height: 22px;
      padding: 0 2px;
      font-size: 0.7rem;
      text-align: center;
      color: #fff;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 4px;
    `;

    const createInput = (placeholder: string, max?: number) => {
      const input = document.createElement("input");
      input.type = "number";
      input.placeholder = placeholder;
      input.title = placeholder;
      input.style.cssText = inputStyle;
      if (max !== undefined) input.max = `${max}`;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.applyCoordInputs();
        }
      });
      input.addEventListener("pointerdown", (e) => e.stopPropagation());
      return input;
    };

    const tlx = createInput("TLX");
    const tly = createInput("TLY");
    const pxx = createInput("PxX", 999);
    const pxy = createInput("PxY", 999);

    const applyButton = document.createElement("button");
    applyButton.className = "btn btn-xs btn-primary";
    applyButton.type = "button";
    applyButton.textContent = "📍";
    applyButton.title = t("goto_map");
    applyButton.style.cssText = "height: 22px; min-height: 22px; padding: 0 8px;";
    applyButton.addEventListener("pointerdown", (e) => e.stopPropagation());
    applyButton.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.applyCoordInputs();
    });

    container.append(tlx, tly, pxx, pxy, applyButton);
    this.coordInputs = { container, tlx, tly, pxx, pxy };
    return container;
  }

  /** フレーム位置を座標入力欄に反映する（編集中の欄は触らない）。 */
  private updateCoordInputs(): void {
    const inputs = this.coordInputs;
    if (!inputs || !this.mapRect) return;

    const { TLX, TLY, PxX, PxY } = this.toDrawPosition(
      this.mapRect.x,
      this.mapRect.y,
    );
    const set = (el: HTMLInputElement, value: number) => {
      if (document.activeElement === el) return;
      const next = `${value}`;
      if (el.value !== next) el.value = next;
    };
    set(inputs.tlx, TLX);
    set(inputs.tly, TLY);
    set(inputs.pxx, PxX);
    set(inputs.pxy, PxY);
  }

  /** 入力された座標へフレームを移動する。画面外ならマップも移動する。 */
  private async applyCoordInputs(): Promise<void> {
    const inputs = this.coordInputs;
    if (!inputs || !this.mapRect) return;

    const tlx = Math.floor(Number(inputs.tlx.value));
    const tly = Math.floor(Number(inputs.tly.value));
    const pxx = Math.floor(Number(inputs.pxx.value));
    const pxy = Math.floor(Number(inputs.pxy.value));
    if ([tlx, tly, pxx, pxy].some((value) => !Number.isFinite(value))) return;

    this.mapRect = {
      ...this.mapRect,
      x: tlx * TILE_SIZE + pxx,
      y: tly * TILE_SIZE + pxy,
    };

    const synced = await this.syncScreenRectFromMap(true);
    this.applyMetricsFromMapRect();
    if (this.metrics) this.requestPreviewUpdate(this.metrics, true);

    if (synced && !this.isFrameOnScreen()) {
      await this.gotoFrameCenter();
    }
    this.updateCoordInputs();
  }

  private isFrameOnScreen(): boolean {
    if (!this.rect) return false;
    const margin = 24;
    return (
      this.rect.x + this.rect.width >= margin &&
      this.rect.x <= window.innerWidth - margin &&
      this.rect.y + this.rect.height >= margin &&
      this.rect.y <= window.innerHeight - margin
    );
  }

  private async gotoFrameCenter(): Promise<void> {
    if (!this.mapRect) return;
    const centerX = this.mapRect.x + this.mapRect.width / 2;
    const centerY = this.mapRect.y + this.mapRect.height / 2;
    const [metersX, metersY] = pixelsToMeters(centerX, centerY);
    const [lat, lng] = metersToLatLon(metersX, metersY);
    await gotoPosition({ lat, lng, zoom: this.lastMapZoom ?? ZOOM_LEVEL });
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
    frameWrapper.id = "mr-wplace-image-adjust-follow";
    frameWrapper.style.cssText =
      "position: fixed; inset: 0; pointer-events: none;";
    frameWrapper.append(elements.frame, elements.topToolBar, elements.sizeInfo, bar);
    elements.overlay.appendChild(frameWrapper);
    this.dPad = this.createDPad();
    elements.overlay.appendChild(this.dPad);
    elements.overlay.appendChild(this.createCoordInput());
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

  /**
   * The frame's footprint is defined in world (wplace) pixels and only then
   * projected to the screen. Deriving the size here — instead of from the
   * viewport — keeps the placed size independent of the current map zoom.
   */
  private getInitialWorldSize(): { width: number; height: number } {
    const scale = clamp(this.options.initialScale, 0.05, 1);
    const naturalWidth = Math.max(1, this.options.naturalWidth);
    const naturalHeight = Math.max(1, this.options.naturalHeight);
    return {
      width: clamp(Math.round(naturalWidth * scale), 1, naturalWidth),
      height: clamp(Math.round(naturalHeight * scale), 1, naturalHeight),
    };
  }

  private async initFrame(): Promise<void> {
    const { width, height } = this.getInitialWorldSize();
    const dp = this.options.initialDrawPosition;

    let topLeftWorld: { x: number; y: number } | null = null;
    if (dp && (dp.TLX !== 0 || dp.TLY !== 0 || dp.PxX !== 0 || dp.PxY !== 0)) {
      topLeftWorld = {
        x: dp.TLX * TILE_SIZE + dp.PxX,
        y: dp.TLY * TILE_SIZE + dp.PxY,
      };
    } else {
      // No placement yet: center the frame on the current viewport center.
      const [center] = await projectScreenPointsToMapPixels([
        { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      ]);
      if (center) {
        topLeftWorld = {
          x: center.pixelX - width / 2,
          y: center.pixelY - height / 2,
        };
      }
    }

    if (!topLeftWorld) {
      // Projection unavailable: fall back to the viewport-based rect.
      this.requestMetricsUpdate(true);
      return;
    }

    this.mapRect = { x: topLeftWorld.x, y: topLeftWorld.y, width, height };
    await this.syncScreenRectFromMap(true);
    this.applyMetricsFromMapRect();

    if (this.metrics) this.requestPreviewUpdate(this.metrics, true);
  }

  private applyMetricsFromMapRect(): void {
    if (!this.mapRect) return;
    const widthPx = Math.max(1, Math.round(this.mapRect.width));
    const heightPx = Math.max(1, Math.round(this.mapRect.height));
    this.metrics = {
      widthPx,
      heightPx,
      topLeftPixelX: this.mapRect.x,
      topLeftPixelY: this.mapRect.y,
    };
    this.updateSizeInfo(widthPx, heightPx);
    this.updateCoordInputs();
  }

  private updateSizeInfo(widthPx: number, heightPx: number): void {
    if (!this.elements?.sizeInfo) return;
    const totalPixels = widthPx * heightPx;
    const timeStr = this.formatEstimatedTime(totalPixels);
    const newHtml = `${widthPx}×${heightPx}px<br><span style="color:#9ca3af;font-size:0.6rem;">${timeStr}</span>`;
    if (this.elements.sizeInfo.innerHTML !== newHtml)
      this.elements.sizeInfo.innerHTML = newHtml;
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
    this.updateFarMode();
  }

  /**
   * Toggle the pin/far representation based on the current on-screen size.
   * Far mode swaps the whole overlay chrome for a single pin, which can be
   * dragged in world space so the target can be moved across long distances
   * without the screen-rect clamping (MIN_FRAME_WIDTH) distorting its world size.
   */
  private updateFarMode(): void {
    if (!this.elements) return;
    const far =
      !!this.rect &&
      Math.min(this.rect.width, this.rect.height) < FAR_MODE_MIN_SCREEN_PX;
    if (far === this.farMode) return;
    this.farMode = far;

    const show = far ? "none" : "";
    this.elements.frameImage.style.display = far ? "none" : "";
    this.elements.locationPin.style.display = far ? "block" : "none";
    for (const handle of Object.values(this.elements.resizeHandles))
      handle.style.display = show;
    // Pin only while far: hide the image chrome, tool bars and helpers.
    this.elements.topToolBar.style.display = show;
    this.elements.sizeInfo.style.display = show;
    if (this.toolButtonBar) this.toolButtonBar.style.display = show;
    if (this.dPad) this.dPad.style.display = show;
    if (this.coordInputs) this.coordInputs.container.style.display = show;
    this.elements.frame.style.border = far
      ? "0"
      : "1.5px dashed rgba(37, 99, 235, 0.95)";
    if (far) this.panelManager?.close();
  }

  /** Keep the target fully inside the wplace world pixel bounds. */
  private clampWorldRect(rect: Rect): Rect {
    const worldPx = TILE_SIZE * Math.pow(2, ZOOM_LEVEL);
    return {
      ...rect,
      x: clamp(rect.x, 0, Math.max(0, worldPx - rect.width)),
      y: clamp(rect.y, 0, Math.max(0, worldPx - rect.height)),
    };
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

      this.updateSizeInfo(widthPx, heightPx);
      this.updateCoordInputs();

      this.requestPreviewUpdate(this.metrics);
      if (snapTopLeftToPixel) void this.syncScreenRectFromMap(true);
      return this.metrics;
    } finally {
      this.metricsPending = false;
    }
  }

  private async syncScreenRectFromMap(
    allowDuringInteraction = false,
  ): Promise<boolean> {
    if (this.mapSyncPending) {
      this.queuedMapSync = true;
      return false;
    }
    if (!this.mapRect || (!allowDuringInteraction && this.activeInteraction))
      return false;
    this.mapSyncPending = true;
    let applied = false;

    try {
      const { points: projected, zoom } =
        await projectMapPixelsToScreenPointsWithView([
          { pixelX: this.mapRect.x, pixelY: this.mapRect.y },
          {
            pixelX: this.mapRect.x + this.mapRect.width,
            pixelY: this.mapRect.y,
          },
          {
            pixelX: this.mapRect.x,
            pixelY: this.mapRect.y + this.mapRect.height,
          },
        ]);
      if (projected.length < 3) return false;

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
      // Pair the freshly projected rect with the zoom it was projected at, so
      // the CSS-transform follow uses the exact scale for this rect.
      if (zoom !== null) this.lastMapZoom = zoom;
      applied = true;
      return true;
    } finally {
      this.mapSyncPending = false;
      // Whenever the committed rect is refreshed, re-anchor the CSS-transform
      // follow so it always matches the projected rect (and stream the new
      // anchor world pixel to inject for the next movement). Resetting the
      // transform here keeps `rect` (left/top) and the transform consistent:
      // the new projected rect is the identity-transform baseline.
      if (applied && this.lastMapZoom !== null) {
        this.clearFrameTransform();
        this.saveTransformBase(this.lastMapZoom);
      }
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
      if (this.elements.pinPopupImage)
        this.elements.pinPopupImage.src = result.dataUrl;
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
