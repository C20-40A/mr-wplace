// --- Constants ---

export const IMAGE_ADJUST_TOOL_MAP_Z_INDEX = 2000;
const OVERLAY_Z_INDEX = 2001;

export const MIN_FRAME_WIDTH = 48;
export const MAX_VIEWPORT_RATIO = 0.9;
export const METRICS_DRAG_UPDATE_MS = 80;
export const OPACITY_SLIDER_MIN = 15;
export const OPACITY_SLIDER_MAX = 100;
export const OPACITY_SLIDER_STEP = 5;
export const DEFAULT_IMAGE_OPACITY = 100;

// --- Types ---

export type Rect = { x: number; y: number; width: number; height: number };
export type InteractionType = "drag" | "resize";

export type ActiveInteraction = {
  type: InteractionType;
  startClientX: number;
  startClientY: number;
  startRect: Rect;
  pointerId: number;
};

export type Metrics = {
  widthPx: number;
  heightPx: number;
  topLeftPixelX: number;
  topLeftPixelY: number;
};

// --- Styles ---

const STYLES = {
  overlay: `
    position: fixed;
    inset: 0;
    z-index: ${OVERLAY_Z_INDEX};
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
  topToolBar: `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 0.45rem;
    pointer-events: auto;
    z-index: ${OVERLAY_Z_INDEX + 1};
  `,
  sizeInfo: `
    position: fixed;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 11px;
    line-height: 1;
    padding: 0.25rem 0.45rem;
    pointer-events: none;
    z-index: ${OVERLAY_Z_INDEX + 1};
  `,
  opacitySlider: `
    width: 84px;
    accent-color: #ffffff;
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

// --- DOM helper ---

const createElement = <K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  options?: {
    className?: string;
    style?: string;
    textContent?: string;
    attributes?: Record<string, string>;
  },
): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tagName);
  if (options?.className) el.className = options.className;
  if (options?.style) el.style.cssText = options.style;
  if (options?.textContent !== undefined) el.textContent = options.textContent;
  if (options?.attributes) {
    for (const [k, v] of Object.entries(options.attributes))
      el.setAttribute(k, v);
  }
  return el;
};

// --- Frame elements ---

export type FrameElements = {
  overlay: HTMLDivElement;
  frame: HTMLDivElement;
  frameImage: HTMLImageElement;
  resizeHandle: HTMLDivElement;
  topToolBar: HTMLDivElement;
  sizeInfo: HTMLDivElement;
  opacitySlider: HTMLInputElement;
  closeButton: HTMLButtonElement;
  confirmButton: HTMLButtonElement;
};

export const createFrameElements = (options: {
  imageSrc: string;
  sizeLabelText: string;
  opacityLabelText: string;
  confirmText: string;
  closeText: string;
  onOpacityChange: (opacity: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}): FrameElements => {
  const overlay = createElement("div", { style: STYLES.overlay });
  overlay.id = "mr-wplace-image-adjust-tool-overlay";

  const frame = createElement("div", { style: STYLES.frame });
  const frameImage = createElement("img", { style: STYLES.image });
  frameImage.src = options.imageSrc;
  frameImage.draggable = false;
  frameImage.alt = "adjust-target";

  const resizeHandle = createElement("div", { style: STYLES.resizeHandle });

  const sizeInfo = createElement("div", { style: STYLES.sizeInfo });
  sizeInfo.textContent = options.sizeLabelText;

  const opacitySlider = createElement("input", {
    style: STYLES.opacitySlider,
    attributes: {
      type: "range",
      min: `${OPACITY_SLIDER_MIN}`,
      max: `${OPACITY_SLIDER_MAX}`,
      step: `${OPACITY_SLIDER_STEP}`,
      value: `${DEFAULT_IMAGE_OPACITY}`,
      "aria-label": options.opacityLabelText,
    },
  });
  opacitySlider.title = options.opacityLabelText;
  opacitySlider.addEventListener("input", () => {
    const v = Math.min(
      OPACITY_SLIDER_MAX,
      Math.max(OPACITY_SLIDER_MIN, Number(opacitySlider.value)),
    );
    options.onOpacityChange(v / 100);
  });

  const topToolBar = createElement("div", { style: STYLES.topToolBar });
  topToolBar.append(opacitySlider);

  const closeButton = createElement("button", {
    className: "btn btn-sm btn-circle btn-error",
    style: STYLES.closeButton,
  });
  closeButton.type = "button";
  closeButton.textContent = "✕";
  closeButton.title = options.closeText;
  closeButton.addEventListener("click", options.onClose);

  const confirmButton = createElement("button", {
    className: "btn btn-primary",
    style: STYLES.confirmButton,
    textContent: options.confirmText,
  });
  confirmButton.type = "button";
  confirmButton.addEventListener("click", options.onConfirm);

  frame.append(frameImage, resizeHandle);
  overlay.append(frame, topToolBar, sizeInfo, closeButton, confirmButton);

  return {
    overlay,
    frame,
    frameImage,
    resizeHandle,
    topToolBar,
    sizeInfo,
    opacitySlider,
    closeButton,
    confirmButton,
  };
};

export const applyRectToFrame = (
  rect: Rect,
  frame: HTMLDivElement,
  topToolBar: HTMLDivElement,
  toolButtonBar: HTMLDivElement,
  sizeInfo: HTMLDivElement,
): void => {
  frame.style.left = `${rect.x}px`;
  frame.style.top = `${rect.y}px`;
  frame.style.width = `${rect.width}px`;
  frame.style.height = `${rect.height}px`;

  const belowY = rect.y + rect.height + 4;
  topToolBar.style.left = `${rect.x}px`;
  topToolBar.style.top = `${belowY}px`;

  toolButtonBar.style.left = `${rect.x}px`;
  toolButtonBar.style.top = `${rect.y - 30}px`;

  sizeInfo.style.left = `${rect.x + rect.width}px`;
  sizeInfo.style.top = `${belowY}px`;
  sizeInfo.style.transform = "translateX(-100%)";
};
