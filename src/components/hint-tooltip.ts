import { t } from "@/i18n/manager";
import {
  dismissFeatureHint,
  isFeatureHintDismissed,
} from "@/states/feature-hints";
import { runtime } from "@/utils/browser-api";

export type HintPlacement = "top" | "bottom" | "left" | "right";

export interface HintTooltipOptions {
  id: string;
  target: HTMLElement;
  message: string;
  title?: string;
  iconSrc?: string;
  placement?: HintPlacement;
  offset?: number;
}

interface ActiveHintState {
  id: string;
  close: (markDismissed: boolean) => Promise<void>;
}

const STYLE_ID = "mr-wplace-hint-tooltip-style";
const TOOLTIP_CLASS = "mr-wplace-hint-tooltip";
const queue: HintTooltipOptions[] = [];
const pendingHintIds = new Set<string>();
let activeHint: ActiveHintState | null = null;

const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;

  const dotFontUrl = runtime.getURL(
    "assets/fonts/khdotfont-20150527/KH-Dot-Akihabara-16.ttf",
  );
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @font-face {
      font-family: "KHDotAkihabara";
      src: url("${dotFontUrl}") format("truetype");
    }

    .${TOOLTIP_CLASS} {
      position: fixed;
      max-width: min(30ch, calc(100vw - 1.5rem));
      padding: 8px;
      border: 2px solid #fff;
      border-radius: 0;
      background: #000;
      color: #fff;
      box-shadow: none;
      z-index: 12000;
      pointer-events: auto;
      line-height: 1.45;
      font-size: 12px;
      font-family: "KHDotAkihabara", monospace;
      letter-spacing: 0.02em;
      image-rendering: pixelated;
    }

    .${TOOLTIP_CLASS}::before,
    .${TOOLTIP_CLASS}::after {
      content: "";
      position: absolute;
      display: none;
      background: #000;
      pointer-events: none;
      box-sizing: border-box;
    }

    .${TOOLTIP_CLASS}[data-placement="top"]::after,
    .${TOOLTIP_CLASS}[data-placement="top"]::before {
      display: block;
    }

    .${TOOLTIP_CLASS}[data-placement="top"]::after {
      left: var(--mr-hint-arrow-x, calc(50% - 4px));
      top: 100%;
      width: 8px;
      height: 4px;
      border-left: 2px solid #fff;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="top"]::before {
      left: calc(var(--mr-hint-arrow-x, calc(50% - 4px)) + 2px);
      top: calc(100% + 4px);
      width: 4px;
      height: 2px;
      border-left: 2px solid #fff;
      border-right: 2px solid #fff;
      border-bottom: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="bottom"]::after,
    .${TOOLTIP_CLASS}[data-placement="bottom"]::before {
      display: block;
    }

    .${TOOLTIP_CLASS}[data-placement="bottom"]::after {
      left: var(--mr-hint-arrow-x, calc(50% - 4px));
      bottom: 100%;
      width: 8px;
      height: 4px;
      border-left: 2px solid #fff;
      border-right: 2px solid #fff;
      border-top: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="bottom"]::before {
      left: calc(var(--mr-hint-arrow-x, calc(50% - 4px)) + 2px);
      bottom: calc(100% + 4px);
      width: 4px;
      height: 2px;
      border-left: 2px solid #fff;
      border-right: 2px solid #fff;
      border-top: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="left"]::after,
    .${TOOLTIP_CLASS}[data-placement="left"]::before {
      display: block;
    }

    .${TOOLTIP_CLASS}[data-placement="left"]::after {
      left: 100%;
      top: var(--mr-hint-arrow-y, calc(50% - 4px));
      width: 4px;
      height: 8px;
      border-top: 2px solid #fff;
      border-bottom: 2px solid #fff;
      border-right: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="left"]::before {
      left: calc(100% + 4px);
      top: calc(var(--mr-hint-arrow-y, calc(50% - 4px)) + 2px);
      width: 2px;
      height: 4px;
      border-top: 2px solid #fff;
      border-bottom: 2px solid #fff;
      border-right: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="right"]::after,
    .${TOOLTIP_CLASS}[data-placement="right"]::before {
      display: block;
    }

    .${TOOLTIP_CLASS}[data-placement="right"]::after {
      right: 100%;
      top: var(--mr-hint-arrow-y, calc(50% - 4px));
      width: 4px;
      height: 8px;
      border-top: 2px solid #fff;
      border-bottom: 2px solid #fff;
      border-left: 2px solid #fff;
    }

    .${TOOLTIP_CLASS}[data-placement="right"]::before {
      right: calc(100% + 4px);
      top: calc(var(--mr-hint-arrow-y, calc(50% - 4px)) + 2px);
      width: 2px;
      height: 4px;
      border-top: 2px solid #fff;
      border-bottom: 2px solid #fff;
      border-left: 2px solid #fff;
    }

    .${TOOLTIP_CLASS} [data-role="header"] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #fff;
    }

    .${TOOLTIP_CLASS} [data-role="title"] {
      font-size: 12px;
      color: #fff;
      font-weight: normal;
      letter-spacing: 0.08em;
      white-space: nowrap;
      text-transform: uppercase;
    }

    .${TOOLTIP_CLASS} [data-role="title-wrap"] {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .${TOOLTIP_CLASS} [data-role="icon-frame"] {
      width: 18px;
      height: 18px;
      border: 1px solid #fff;
      padding: 1px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background: #000;
    }

    .${TOOLTIP_CLASS} [data-role="icon"] {
      width: 14px;
      height: 14px;
      flex-shrink: 0;
      object-fit: cover;
      image-rendering: pixelated;
    }

    .${TOOLTIP_CLASS} [data-role="close"] {
      border: 1px solid #fff;
      color: #fff;
      background: #000;
      width: 16px;
      height: 16px;
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
      font-family: inherit;
    }

    .${TOOLTIP_CLASS} [data-role="close"]:hover {
      background: #fff;
      color: #000;
    }

    .${TOOLTIP_CLASS} [data-role="close"]:active {
      background: #000;
      color: #fff;
    }

    .${TOOLTIP_CLASS} [data-role="message"] {
      white-space: pre-wrap;
      word-break: break-word;
    }

    .${TOOLTIP_CLASS} [data-role="message"]::before {
      content: ">> ";
    }
  `;

  (document.head || document.documentElement).appendChild(style);
};

const getPlacementFallbacks = (
  preferred: HintPlacement,
): readonly HintPlacement[] => {
  switch (preferred) {
    case "bottom":
      return ["bottom", "top", "right", "left"];
    case "left":
      return ["left", "right", "top", "bottom"];
    case "right":
      return ["right", "left", "top", "bottom"];
    default:
      return ["top", "bottom", "right", "left"];
  }
};

const choosePlacement = (
  preferred: HintPlacement,
  targetRect: DOMRect,
  tooltipWidth: number,
  tooltipHeight: number,
  offset: number,
): HintPlacement => {
  const space = {
    top: targetRect.top,
    bottom: window.innerHeight - targetRect.bottom,
    left: targetRect.left,
    right: window.innerWidth - targetRect.right,
  } as const;

  const required = {
    top: tooltipHeight + offset + 12,
    bottom: tooltipHeight + offset + 12,
    left: tooltipWidth + offset + 12,
    right: tooltipWidth + offset + 12,
  } as const;

  const fallbacks = getPlacementFallbacks(preferred);
  const exactMatch = fallbacks.find((side) => space[side] >= required[side]);
  if (exactMatch) return exactMatch;

  return fallbacks.reduce((best, current) =>
    space[current] > space[best] ? current : best,
  );
};

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const ARROW_HALF = 4;
const ARROW_FULL = ARROW_HALF * 2;
const ARROW_EDGE_PADDING = 8;

const updateArrowOffset = (
  tooltip: HTMLDivElement,
  targetRect: DOMRect,
  placement: HintPlacement,
  tooltipRect: DOMRect,
  left: number,
  top: number,
): void => {
  if (placement === "top" || placement === "bottom") {
    const targetCenterX = targetRect.left + targetRect.width / 2;
    const arrowLeft = clamp(
      targetCenterX - left - ARROW_HALF,
      ARROW_EDGE_PADDING,
      tooltipRect.width - ARROW_FULL - ARROW_EDGE_PADDING,
    );
    tooltip.style.setProperty("--mr-hint-arrow-x", `${arrowLeft}px`);
    tooltip.style.removeProperty("--mr-hint-arrow-y");
    return;
  }

  const targetCenterY = targetRect.top + targetRect.height / 2;
  const arrowTop = clamp(
    targetCenterY - top - ARROW_HALF,
    ARROW_EDGE_PADDING,
    tooltipRect.height - ARROW_FULL - ARROW_EDGE_PADDING,
  );
  tooltip.style.setProperty("--mr-hint-arrow-y", `${arrowTop}px`);
  tooltip.style.removeProperty("--mr-hint-arrow-x");
};

const positionTooltip = (
  tooltip: HTMLDivElement,
  target: HTMLElement,
  preferredPlacement: HintPlacement,
  offset: number,
): void => {
  const targetRect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const placement = choosePlacement(
    preferredPlacement,
    targetRect,
    tooltipRect.width,
    tooltipRect.height,
    offset,
  );

  const margin = 8;
  let left = 0;
  let top = 0;

  if (placement === "top" || placement === "bottom") {
    left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    top =
      placement === "top"
        ? targetRect.top - tooltipRect.height - offset
        : targetRect.bottom + offset;
  } else {
    left =
      placement === "left"
        ? targetRect.left - tooltipRect.width - offset
        : targetRect.right + offset;
    top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
  }

  tooltip.dataset.placement = placement;
  const clampedLeft = clamp(
    left,
    margin,
    window.innerWidth - tooltipRect.width - margin,
  );
  const clampedTop = clamp(
    top,
    margin,
    window.innerHeight - tooltipRect.height - margin,
  );
  tooltip.style.left = `${clampedLeft}px`;
  tooltip.style.top = `${clampedTop}px`;
  updateArrowOffset(
    tooltip,
    targetRect,
    placement,
    tooltipRect,
    clampedLeft,
    clampedTop,
  );
};

const dequeueAndShow = async (): Promise<void> => {
  if (activeHint || queue.length === 0) return;

  const options = queue.shift();
  if (!options) return;

  pendingHintIds.delete(options.id);

  if (!options.target.isConnected) {
    void dequeueAndShow();
    return;
  }

  const isDismissed = await isFeatureHintDismissed(options.id);
  if (isDismissed) {
    void dequeueAndShow();
    return;
  }

  ensureStyles();

  const tooltip = document.createElement("div");
  tooltip.className = TOOLTIP_CLASS;

  const header = document.createElement("div");
  header.dataset.role = "header";

  const titleWrap = document.createElement("div");
  titleWrap.dataset.role = "title-wrap";

  if (options.iconSrc) {
    const iconFrame = document.createElement("span");
    iconFrame.dataset.role = "icon-frame";
    const icon = document.createElement("img");
    icon.dataset.role = "icon";
    icon.src = options.iconSrc;
    icon.alt = "";
    iconFrame.appendChild(icon);
    titleWrap.appendChild(iconFrame);
  }

  const title = document.createElement("div");
  title.dataset.role = "title";
  title.textContent = options.title ?? t("hint_title");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.role = "close";
  closeButton.ariaLabel = t("hint_close");
  closeButton.textContent = "✕";

  const message = document.createElement("div");
  message.dataset.role = "message";
  message.textContent = options.message;

  titleWrap.appendChild(title);
  header.appendChild(titleWrap);
  header.appendChild(closeButton);
  tooltip.appendChild(header);
  tooltip.appendChild(message);
  document.body.appendChild(tooltip);

  const placement = options.placement ?? "top";
  const offset = options.offset ?? 10;
  positionTooltip(tooltip, options.target, placement, offset);

  let settleRafId: number | null = null;
  let delayedUpdateTimeoutId: number | null = null;

  const handlePositionUpdate = () => {
    if (!options.target.isConnected) {
      void activeHint?.close(false);
      return;
    }
    positionTooltip(tooltip, options.target, placement, offset);
  };

  const settlingStartedAt = performance.now();
  const runSettlingPositionUpdate = () => {
    handlePositionUpdate();
    if (performance.now() - settlingStartedAt >= 1000) return;
    settleRafId = window.requestAnimationFrame(runSettlingPositionUpdate);
  };
  settleRafId = window.requestAnimationFrame(runSettlingPositionUpdate);
  delayedUpdateTimeoutId = window.setTimeout(handlePositionUpdate, 800);

  const handleOutsidePointerDown = (event: MouseEvent) => {
    const eventTarget = event.target as Node | null;
    if (!eventTarget) return;
    if (tooltip.contains(eventTarget)) return;
    if (options.target.contains(eventTarget)) return;
    void activeHint?.close(true);
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    void activeHint?.close(true);
  };

  const handleTargetClick = () => {
    void activeHint?.close(true);
  };

  const lifecycleObserver = new MutationObserver(() => {
    if (!options.target.isConnected) {
      void activeHint?.close(false);
    }
  });
  lifecycleObserver.observe(document.body, { childList: true, subtree: true });
  const targetResizeObserver = new ResizeObserver(handlePositionUpdate);
  targetResizeObserver.observe(options.target);

  const close = async (markDismissed: boolean): Promise<void> => {
    if (activeHint?.id !== options.id) return;

    if (settleRafId !== null) window.cancelAnimationFrame(settleRafId);
    if (delayedUpdateTimeoutId !== null) {
      window.clearTimeout(delayedUpdateTimeoutId);
    }
    window.removeEventListener("resize", handlePositionUpdate);
    window.removeEventListener("scroll", handlePositionUpdate, true);
    document.removeEventListener("mousedown", handleOutsidePointerDown, true);
    document.removeEventListener("keydown", handleEscape, true);
    options.target.removeEventListener("click", handleTargetClick);
    lifecycleObserver.disconnect();
    targetResizeObserver.disconnect();

    tooltip.remove();

    if (markDismissed) {
      await dismissFeatureHint(options.id);
    }

    activeHint = null;
    void dequeueAndShow();
  };

  activeHint = { id: options.id, close };

  closeButton.addEventListener("click", () => {
    void activeHint?.close(true);
  });
  options.target.addEventListener("click", handleTargetClick);
  window.addEventListener("resize", handlePositionUpdate);
  window.addEventListener("scroll", handlePositionUpdate, true);
  document.addEventListener("mousedown", handleOutsidePointerDown, true);
  document.addEventListener("keydown", handleEscape, true);
};

export const showHintTooltipOnce = async (
  options: HintTooltipOptions,
): Promise<void> => {
  if (!options.target.isConnected) return;
  if (activeHint?.id === options.id || pendingHintIds.has(options.id)) return;

  pendingHintIds.add(options.id);

  const dismissed = await isFeatureHintDismissed(options.id);
  if (dismissed) {
    pendingHintIds.delete(options.id);
    return;
  }

  queue.push(options);
  void dequeueAndShow();
};
