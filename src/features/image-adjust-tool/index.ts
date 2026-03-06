import type { DrawPosition } from "@/states/galleryStorage";
import { t } from "@/i18n/manager";
import { TILE_SIZE } from "@/utils/geo-converter";
import {
  projectMapPixelsToScreenPoints,
  projectScreenPointsToMapPixels,
  setMapProjectionTracking,
} from "@/utils/inject-bridge";
import { colorpalette, TRANSPARENT_COLOR_ID } from "@/constants/colors";
import { ColorPalette } from "@/components/color-palette";
import type {
  ColorFlattenMode,
  DitheringMethod,
  ImageAdjustments,
  QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";
import {
  IMAGE_ADJUST_TOOL_MAP_Z_INDEX,
  IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX,
} from "./constants";

const MIN_FRAME_WIDTH = 48;
const MAX_VIEWPORT_RATIO = 0.9;
const METRICS_DRAG_UPDATE_MS = 80;
const PREVIEW_UPDATE_MS = 160;
const OPACITY_SLIDER_MIN = 15;
const OPACITY_SLIDER_MAX = 100;
const OPACITY_SLIDER_STEP = 5;
const DEFAULT_IMAGE_OPACITY = 100;
const PROCESSING_DEBOUNCE_MS = 200;

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

export type AdjustToolProcessingParams = {
  adjustments: ImageAdjustments;
  selectedColorIds: number[];
  ditheringEnabled: boolean;
  ditheringThreshold: number;
  ditheringMethod: DitheringMethod;
  quantizationMethod: QuantizationMethod;
  colorFlattenMode: ColorFlattenMode;
  outlineEnabled: boolean;
  outlineThreshold: number;
  outlineWidth: number;
  outlineUseFixedColor: boolean;
  outlineFixedColor: string;
};

type ConfirmResult = {
  widthPx: number;
  heightPx: number;
  drawPosition: DrawPosition | null;
  processingParams: AdjustToolProcessingParams;
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
    border: 1px solid;
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
  toolButtonBar: `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    pointer-events: auto;
    z-index: ${IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX + 2};
  `,
  toolButton: `
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  toolButtonActive: `
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.9);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  floatingPanel: `
    position: fixed;
    background: var(--color-base-100, #fff);
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    padding: 0.75rem;
    pointer-events: auto;
    z-index: ${IMAGE_ADJUST_TOOL_OVERLAY_Z_INDEX + 3};
    max-height: 70vh;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    min-width: 280px;
    max-width: 340px;
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
  private baseImage: HTMLImageElement | null = null;

  // Tool UI
  private toolButtonBar: HTMLDivElement | null = null;
  private paletteButton: HTMLButtonElement | null = null;
  private adjustButton: HTMLButtonElement | null = null;
  private floatingPanel: HTMLDivElement | null = null;
  private activePanel: "palette" | "adjust" | null = null;
  private colorPalette: ColorPalette | null = null;

  // Processing state
  private selectedColorIds: number[] = colorpalette
    .filter((c) => c.id !== TRANSPARENT_COLOR_ID)
    .map((c) => c.id);
  private brightness = 0;
  private contrast = 0;
  private saturation = 0;
  private ditheringEnabled = false;
  private ditheringThreshold = 500;
  private ditheringMethod: DitheringMethod = "ordered";
  private quantizationMethod: QuantizationMethod = "rgb-euclidean";
  private colorFlattenMode: ColorFlattenMode = "none";
  private outlineEnabled = false;
  private outlineThreshold = 55;
  private outlineWidth = 1;
  private outlineUseFixedColor = false;
  private outlineFixedColor = "#000000";

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
  private imageOpacity = DEFAULT_IMAGE_OPACITY / 100;
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
    const nextWidth = Math.max(MIN_FRAME_WIDTH, startRect.width + dx);
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

    this.injectStyles();
    this.createOverlay();
    this.mountEvents();
    this.mounted = true;
    this.requestMetricsUpdate(true);
    setMapProjectionTracking(true);
    return true;
  }

  destroy(triggerCancel = false): void {
    if (!this.mounted) return;

    if (this.processingDebounceTimer) {
      clearTimeout(this.processingDebounceTimer);
      this.processingDebounceTimer = null;
    }

    this.colorPalette?.destroy();
    this.colorPalette = null;

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
    this.baseImage = null;
    this.toolButtonBar = null;
    this.paletteButton = null;
    this.adjustButton = null;
    this.floatingPanel = null;
    this.activePanel = null;
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

  private injectStyles(): void {
    const styleId = "mr-wplace-adjust-tool-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .iat-panel-section { margin-bottom: 0.5rem; }
      .iat-panel-section:last-child { margin-bottom: 0; }
      .iat-slider-row {
        display: flex; align-items: center; gap: 0.4rem;
      }
      .iat-slider-row input[type="range"] { flex: 1; min-width: 0; }
      .iat-slider-label {
        font-size: 0.75rem; font-weight: 500; margin-bottom: 0.2rem;
        display: flex; justify-content: space-between; align-items: center;
      }
      .iat-slider-value { font-size: 0.7rem; color: #9ca3af; }
      .iat-hint { font-size: 0.65rem; color: #9ca3af; }
      .iat-checkbox-row {
        display: flex; align-items: center; gap: 0.4rem;
        font-size: 0.75rem; cursor: pointer;
      }
      .iat-select { font-size: 0.72rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; border: 1px solid #d1d5db; }
      .iat-select-row { display: flex; gap: 0.35rem; align-items: center; }
      .iat-select-row select { flex: 1; min-width: 0; }
      .iat-outline-params {
        display: flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;
      }
      .iat-outline-params .iat-slider-row { flex: 1; }
    `;
    document.head.appendChild(style);
  }

  private createOverlay(): void {
    const overlay = createElement("div", { style: STYLES.overlay });
    overlay.id = "mr-wplace-image-adjust-tool-overlay";

    const frame = createElement("div", { style: STYLES.frame });
    const image = createElement("img", { style: STYLES.image });
    image.src = this.options.imageSrc;
    image.draggable = false;
    image.alt = "adjust-target";
    const baseImage = createElement("img");
    baseImage.src = this.options.imageSrc;

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

    // Tool button bar
    const toolButtonBar = createElement("div", { style: STYLES.toolButtonBar });
    const paletteButton = createElement("button", {
      style: STYLES.toolButton,
      textContent: "🎨",
    });
    paletteButton.type = "button";
    paletteButton.title = "Color Palette";
    paletteButton.addEventListener("click", () => this.togglePanel("palette"));

    const adjustButton = createElement("button", {
      style: STYLES.toolButton,
      textContent: "⚙️",
    });
    adjustButton.type = "button";
    adjustButton.title = t("contrast") + " / " + t("brightness");
    adjustButton.addEventListener("click", () => this.togglePanel("adjust"));

    toolButtonBar.append(paletteButton, adjustButton);

    topToolBar.append(sizeLabel, opacitySlider);

    frame.append(image, resizeHandle);
    overlay.append(frame, topToolBar, toolButtonBar, closeButton, confirmButton);
    document.body.appendChild(overlay);

    this.overlay = overlay;
    this.frame = frame;
    this.frameImage = image;
    this.baseImage = baseImage;
    this.resizeHandle = resizeHandle;
    this.topToolBar = topToolBar;
    this.sizeLabel = sizeLabel;
    this.opacitySlider = opacitySlider;
    this.closeButton = closeButton;
    this.confirmButton = confirmButton;
    this.toolButtonBar = toolButtonBar;
    this.paletteButton = paletteButton;
    this.adjustButton = adjustButton;

    this.applyRect(this.getInitialRect());
    this.applyImageOpacity();
  }

  // --- Panel management ---

  private togglePanel(panel: "palette" | "adjust"): void {
    if (this.activePanel === panel) {
      this.closePanel();
      return;
    }
    this.openPanel(panel);
  }

  private openPanel(panel: "palette" | "adjust"): void {
    this.closePanel();
    this.activePanel = panel;

    const floatingPanel = createElement("div", { style: STYLES.floatingPanel });
    floatingPanel.id = "iat-floating-panel";

    if (panel === "palette") {
      this.buildPalettePanel(floatingPanel);
      if (this.paletteButton) this.paletteButton.style.cssText = STYLES.toolButtonActive;
    } else {
      this.buildAdjustPanel(floatingPanel);
      if (this.adjustButton) this.adjustButton.style.cssText = STYLES.toolButtonActive;
    }

    this.overlay?.appendChild(floatingPanel);
    this.floatingPanel = floatingPanel;
    this.positionFloatingPanel();
  }

  private closePanel(): void {
    this.colorPalette?.destroy();
    this.colorPalette = null;
    this.floatingPanel?.remove();
    this.floatingPanel = null;
    this.activePanel = null;
    if (this.paletteButton) this.paletteButton.style.cssText = STYLES.toolButton;
    if (this.adjustButton) this.adjustButton.style.cssText = STYLES.toolButton;
  }

  private positionFloatingPanel(): void {
    if (!this.floatingPanel || !this.toolButtonBar) return;
    const barRect = this.toolButtonBar.getBoundingClientRect();
    this.floatingPanel.style.left = `${barRect.left}px`;
    this.floatingPanel.style.top = `${barRect.top - 8}px`;
    this.floatingPanel.style.transform = "translateY(-100%)";
  }

  private buildPalettePanel(container: HTMLDivElement): void {
    const paletteContainer = document.createElement("div");
    paletteContainer.style.cssText = "min-height: 100px;";
    container.appendChild(paletteContainer);

    this.colorPalette = new ColorPalette(paletteContainer, {
      selectedColorIds: this.selectedColorIds,
      onChange: (colorIds) => {
        this.selectedColorIds = colorIds;
        this.scheduleProcessedPreview();
      },
      hasExtraColorsBitmap: true,
      showDisableUnusedButton: true,
      controlSize: "xs",
      sortOrder: "least-remaining",
    });
  }

  private buildAdjustPanel(container: HTMLDivElement): void {
    // Brightness
    container.appendChild(this.createSliderSection(
      t("brightness"), this.brightness, -100, 100, 1,
      (v) => { this.brightness = v; this.scheduleProcessedPreview(); },
    ));

    // Contrast
    container.appendChild(this.createSliderSection(
      t("contrast"), this.contrast, -100, 100, 1,
      (v) => { this.contrast = v; this.scheduleProcessedPreview(); },
    ));

    // Saturation
    container.appendChild(this.createSliderSection(
      t("saturation"), this.saturation, -100, 100, 1,
      (v) => { this.saturation = v; this.scheduleProcessedPreview(); },
    ));

    // Quantization method + color flatten
    const selectSection = document.createElement("div");
    selectSection.className = "iat-panel-section";
    const selectRow = document.createElement("div");
    selectRow.className = "iat-select-row";

    const qSelect = this.createSelect(
      [
        { value: "rgb-euclidean", label: t("quantization_rgb_euclidean") },
        { value: "weighted-rgb", label: t("quantization_weighted_rgb") },
        { value: "lab", label: t("quantization_lab") },
        { value: "oklab", label: t("quantization_oklab") },
      ],
      this.quantizationMethod,
      (v) => { this.quantizationMethod = v as QuantizationMethod; this.scheduleProcessedPreview(); },
    );
    const cfSelect = this.createSelect(
      [
        { value: "none", label: t("color_flatten_none") },
        { value: "light", label: t("color_flatten_light") },
        { value: "medium", label: t("color_flatten_medium") },
      ],
      this.colorFlattenMode,
      (v) => { this.colorFlattenMode = v as ColorFlattenMode; this.scheduleProcessedPreview(); },
    );
    selectRow.append(qSelect, cfSelect);
    selectSection.appendChild(selectRow);
    container.appendChild(selectSection);

    // Dithering
    const ditherSection = document.createElement("div");
    ditherSection.className = "iat-panel-section";
    const ditherRow = document.createElement("div");
    ditherRow.className = "iat-checkbox-row";
    const ditherCb = document.createElement("input");
    ditherCb.type = "checkbox";
    ditherCb.className = "checkbox checkbox-sm";
    ditherCb.checked = this.ditheringEnabled;

    const ditherMethodSelect = this.createSelect(
      [
        { value: "ordered", label: "Ordered" },
        { value: "floyd-steinberg", label: "Floyd" },
      ],
      this.ditheringMethod,
      (v) => { this.ditheringMethod = v as DitheringMethod; this.scheduleProcessedPreview(); },
    );
    ditherMethodSelect.disabled = !this.ditheringEnabled;
    ditherMethodSelect.style.width = "5rem";

    ditherCb.addEventListener("change", () => {
      this.ditheringEnabled = ditherCb.checked;
      ditherMethodSelect.disabled = !ditherCb.checked;
      ditherThresholdSlider.disabled = !ditherCb.checked;
      this.scheduleProcessedPreview();
    });

    ditherRow.append(ditherCb, document.createTextNode(t("dithering")), ditherMethodSelect);
    ditherSection.appendChild(ditherRow);

    const ditherThresholdSlider = this.createRangeInput(
      this.ditheringThreshold, 0, 1500, 50, !this.ditheringEnabled,
      (v) => { this.ditheringThreshold = v; this.scheduleProcessedPreview(); },
    );
    const ditherSliderRow = document.createElement("div");
    ditherSliderRow.className = "iat-slider-row";
    const ditherHintL = document.createElement("span");
    ditherHintL.className = "iat-hint";
    ditherHintL.textContent = "0";
    const ditherHintR = document.createElement("span");
    ditherHintR.className = "iat-hint";
    ditherHintR.textContent = "1500";
    ditherSliderRow.append(ditherHintL, ditherThresholdSlider, ditherHintR);
    ditherSection.appendChild(ditherSliderRow);
    container.appendChild(ditherSection);

    // Outline
    const outlineSection = document.createElement("div");
    outlineSection.className = "iat-panel-section";
    const outlineRow = document.createElement("div");
    outlineRow.className = "iat-checkbox-row";
    const outlineCb = document.createElement("input");
    outlineCb.type = "checkbox";
    outlineCb.className = "checkbox checkbox-sm";
    outlineCb.checked = this.outlineEnabled;

    const outlineColorCb = document.createElement("input");
    outlineColorCb.type = "checkbox";
    outlineColorCb.className = "checkbox checkbox-sm";
    outlineColorCb.checked = this.outlineUseFixedColor;
    outlineColorCb.disabled = !this.outlineEnabled;

    const outlineColorInput = document.createElement("input");
    outlineColorInput.type = "color";
    outlineColorInput.value = this.outlineFixedColor;
    outlineColorInput.style.cssText = "width: 1.5rem; height: 1.2rem; padding: 0; border: none;";
    outlineColorInput.disabled = !this.outlineEnabled || !this.outlineUseFixedColor;

    const thresholdSlider = this.createRangeInput(
      this.outlineThreshold, 0, 200, 1, !this.outlineEnabled,
      (v) => { this.outlineThreshold = v; this.scheduleProcessedPreview(); },
    );
    const widthSlider = this.createRangeInput(
      this.outlineWidth, 1, 4, 1, !this.outlineEnabled,
      (v) => { this.outlineWidth = v; this.scheduleProcessedPreview(); },
    );

    outlineCb.addEventListener("change", () => {
      this.outlineEnabled = outlineCb.checked;
      thresholdSlider.disabled = !outlineCb.checked;
      widthSlider.disabled = !outlineCb.checked;
      outlineColorCb.disabled = !outlineCb.checked;
      outlineColorInput.disabled = !outlineCb.checked || !outlineColorCb.checked;
      this.scheduleProcessedPreview();
    });

    outlineColorCb.addEventListener("change", () => {
      this.outlineUseFixedColor = outlineColorCb.checked;
      outlineColorInput.disabled = !outlineColorCb.checked;
      this.scheduleProcessedPreview();
    });

    outlineColorInput.addEventListener("change", () => {
      if (!/^#[0-9a-f]{6}$/i.test(outlineColorInput.value)) return;
      this.outlineFixedColor = outlineColorInput.value;
      this.scheduleProcessedPreview();
    });

    outlineRow.append(
      outlineCb, document.createTextNode(t("outline_preserve")),
      outlineColorCb, outlineColorInput,
    );
    outlineSection.appendChild(outlineRow);

    const outlineParams = document.createElement("div");
    outlineParams.className = "iat-outline-params";
    const sensRow = document.createElement("div");
    sensRow.className = "iat-slider-row";
    const sensLabel = document.createElement("span");
    sensLabel.className = "iat-hint";
    sensLabel.textContent = t("outline_sensitivity");
    sensRow.append(sensLabel, thresholdSlider);
    const wRow = document.createElement("div");
    wRow.className = "iat-slider-row";
    const wLabel = document.createElement("span");
    wLabel.className = "iat-hint";
    wLabel.textContent = t("outline_width");
    wRow.append(wLabel, widthSlider);
    outlineParams.append(sensRow, wRow);
    outlineSection.appendChild(outlineParams);
    container.appendChild(outlineSection);
  }

  private createSliderSection(
    label: string, value: number, min: number, max: number, step: number,
    onChange: (v: number) => void,
  ): HTMLDivElement {
    const section = document.createElement("div");
    section.className = "iat-panel-section";

    const labelRow = document.createElement("div");
    labelRow.className = "iat-slider-label";
    const labelText = document.createElement("span");
    labelText.textContent = label;
    const valueSpan = document.createElement("span");
    valueSpan.className = "iat-slider-value";
    valueSpan.textContent = `${value}`;
    labelRow.append(labelText, valueSpan);

    const sliderRow = document.createElement("div");
    sliderRow.className = "iat-slider-row";
    const hintL = document.createElement("span");
    hintL.className = "iat-hint";
    hintL.textContent = `${min}`;
    const slider = this.createRangeInput(value, min, max, step, false, (v) => {
      valueSpan.textContent = `${v}`;
      onChange(v);
    });
    const hintR = document.createElement("span");
    hintR.className = "iat-hint";
    hintR.textContent = `${max}`;
    sliderRow.append(hintL, slider, hintR);

    section.append(labelRow, sliderRow);
    return section;
  }

  private createRangeInput(
    value: number, min: number, max: number, step: number, disabled: boolean,
    onChange: (v: number) => void,
  ): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "range";
    input.className = "range range-xs";
    input.min = `${min}`;
    input.max = `${max}`;
    input.step = `${step}`;
    input.value = `${value}`;
    input.disabled = disabled;
    input.addEventListener("input", () => onChange(Number(input.value)));
    return input;
  }

  private createSelect(
    options: { value: string; label: string }[],
    currentValue: string,
    onChange: (v: string) => void,
  ): HTMLSelectElement {
    const select = document.createElement("select");
    select.className = "iat-select";
    for (const opt of options) {
      const option = document.createElement("option");
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === currentValue) option.selected = true;
      select.appendChild(option);
    }
    select.addEventListener("change", () => onChange(select.value));
    return select;
  }

  // --- Processing pipeline ---

  private scheduleProcessedPreview(): void {
    if (this.processingDebounceTimer) clearTimeout(this.processingDebounceTimer);
    this.processingDebounceTimer = setTimeout(() => {
      this.processingDebounceTimer = null;
      if (this.metrics) this.requestPreviewUpdate(this.metrics, true);
    }, PROCESSING_DEBOUNCE_MS);
  }

  private buildProcessingParams(): AdjustToolProcessingParams {
    return {
      adjustments: { brightness: this.brightness, contrast: this.contrast, saturation: this.saturation },
      selectedColorIds: [...this.selectedColorIds],
      ditheringEnabled: this.ditheringEnabled,
      ditheringThreshold: this.ditheringThreshold,
      ditheringMethod: this.ditheringMethod,
      quantizationMethod: this.quantizationMethod,
      colorFlattenMode: this.colorFlattenMode,
      outlineEnabled: this.outlineEnabled,
      outlineThreshold: this.outlineThreshold,
      outlineWidth: this.outlineWidth,
      outlineUseFixedColor: this.outlineUseFixedColor,
      outlineFixedColor: this.outlineFixedColor,
    };
  }

  // --- Event mounting ---

  private mountEvents(): void {
    this.frame?.addEventListener("pointerdown", this.onFramePointerDown);
    this.frame?.addEventListener("wheel", this.onOverlayWheel, { passive: false });
    this.resizeHandle?.addEventListener("pointerdown", this.onResizePointerDown);
    this.topToolBar?.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
    this.closeButton?.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
    this.confirmButton?.addEventListener("wheel", this.onOverlayWheel, {
      passive: false,
    });
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
    this.frame?.removeEventListener("pointerdown", this.onFramePointerDown);
    this.frame?.removeEventListener("wheel", this.onOverlayWheel);
    this.resizeHandle?.removeEventListener(
      "pointerdown",
      this.onResizePointerDown,
    );
    this.topToolBar?.removeEventListener("wheel", this.onOverlayWheel);
    this.closeButton?.removeEventListener("wheel", this.onOverlayWheel);
    this.confirmButton?.removeEventListener("wheel", this.onOverlayWheel);
    window.removeEventListener("pointermove", this.onGlobalPointerMove);
    window.removeEventListener("pointerup", this.onGlobalPointerUp);
    window.removeEventListener("pointercancel", this.onGlobalPointerUp);
    window.removeEventListener("resize", this.onWindowResize);
    window.removeEventListener("message", this.onMapViewChanged);
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
    const width = Math.max(MIN_FRAME_WIDTH, rect.width);
    const height = width / this.aspectRatio;

    return {
      width,
      height,
      x: rect.x,
      y: rect.y,
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

    if (this.toolButtonBar) {
      this.toolButtonBar.style.left = `${rect.x}px`;
      this.toolButtonBar.style.top = `${Math.max(8, rect.y - 58)}px`;
    }
  }

  private applyImageOpacity(): void {
    if (!this.frameImage) return;
    this.frameImage.style.opacity = `${this.imageOpacity}`;
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

      const topLeftPixelX = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelX)
        : projected[0].pixelX;
      const topLeftPixelY = snapTopLeftToPixel
        ? Math.floor(projected[0].pixelY)
        : projected[0].pixelY;

      this.metrics = {
        widthPx,
        heightPx,
        topLeftPixelX,
        topLeftPixelY,
      };
      this.mapRect = {
        x: topLeftPixelX,
        y: topLeftPixelY,
        width: widthPx,
        height: heightPx,
      };

      if (this.sizeLabel) {
        const labelText = `${t("adjust_tool_target_size")}: ${widthPx}×${heightPx}px`;
        if (this.sizeLabel.textContent !== labelText) {
          this.sizeLabel.textContent = labelText;
        }
      }
      this.requestPreviewUpdate(this.metrics);
      if (snapTopLeftToPixel) void this.syncScreenRectFromMap(true);
      return this.metrics;
    } finally {
      this.metricsPending = false;
    }
  }

  private async syncScreenRectFromMap(allowDuringInteraction = false): Promise<void> {
    if (
      this.mapSyncPending ||
      !this.mapRect ||
      (!allowDuringInteraction && this.activeInteraction)
    ) {
      return;
    }
    this.mapSyncPending = true;

    try {
      const projected = await projectMapPixelsToScreenPoints([
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

      if (projected.length < 3) return;

      this.applyRect({
        x: projected[0].x,
        y: projected[0].y,
        width: Math.max(
          MIN_FRAME_WIDTH,
          Math.hypot(
            projected[1].x - projected[0].x,
            projected[1].y - projected[0].y,
          ),
        ),
        height: Math.max(
          MIN_FRAME_WIDTH / this.aspectRatio,
          Math.hypot(
            projected[2].x - projected[0].x,
            projected[2].y - projected[0].y,
          ),
        ),
      });
    } finally {
      this.mapSyncPending = false;
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
      if (!sourceImage || !this.frameImage) return;

      if (!sourceImage.complete || sourceImage.naturalWidth < 1) {
        await new Promise<void>((resolve, reject) => {
          sourceImage.onload = () => resolve();
          sourceImage.onerror = () =>
            reject(new Error("adjust tool preview source load failed"));
        });
      }

      const targetWidth = Math.max(1, Math.round(metrics.widthPx));
      const targetHeight = Math.max(1, Math.round(metrics.heightPx));
      const previewCanvas = document.createElement("canvas");
      previewCanvas.width = targetWidth;
      previewCanvas.height = targetHeight;
      const ctx = previewCanvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);

      const processedCanvas = await this.applyProcessing(previewCanvas);
      this.frameImage.src = processedCanvas.toDataURL("image/png");
    } finally {
      this.previewPending = false;
      const queued = this.queuedPreviewMetrics;
      this.queuedPreviewMetrics = null;
      if (queued) this.requestPreviewUpdate(queued, true);
    }
  }

  private async applyProcessing(canvas: HTMLCanvasElement): Promise<HTMLCanvasElement> {
    const { createProcessedCanvasFromBitmap, createOutlinePreservedBitmap } =
      await import("@/features/gallery/routes/image-editor/canvas-processor");

    let sourceBitmap: ImageBitmap;

    if (this.outlineEnabled && this.baseImage) {
      // Outline needs original image + scale to detect edges properly
      const scale = canvas.width / this.baseImage.naturalWidth;
      sourceBitmap = await createOutlinePreservedBitmap(
        this.baseImage,
        scale,
        {
          enabled: true,
          threshold: this.outlineThreshold,
          width: this.outlineWidth,
          useFixedColor: this.outlineUseFixedColor,
          fixedColor: this.outlineFixedColor,
        },
      );
    } else {
      sourceBitmap = await createImageBitmap(canvas);
    }

    try {
      return await createProcessedCanvasFromBitmap(
        sourceBitmap,
        { brightness: this.brightness, contrast: this.contrast, saturation: this.saturation },
        this.selectedColorIds,
        this.ditheringEnabled,
        this.ditheringThreshold,
        this.ditheringMethod,
        true, // GPU fixed
        this.quantizationMethod,
        this.colorFlattenMode,
        new Set<string>(),
      );
    } finally {
      sourceBitmap.close();
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
