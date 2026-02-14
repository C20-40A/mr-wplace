import { t } from "@/i18n/manager";
import {
  dismissFeatureHint,
  isFeatureHintDismissed,
} from "@/states/feature-hints";

export type HintPlacement = "top" | "bottom" | "left" | "right";

export interface HintTooltipOptions {
  id: string;
  target: HTMLElement;
  message: string;
  title?: string;
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

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${TOOLTIP_CLASS} {
      position: fixed;
      max-width: min(22rem, calc(100vw - 1.5rem));
      padding: 0.75rem 0.875rem;
      border-radius: 0.75rem;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(18, 20, 28, 0.96);
      color: #f5f7ff;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
      z-index: 12000;
      pointer-events: auto;
      line-height: 1.35;
      font-size: 0.82rem;
      backdrop-filter: blur(3px);
    }

    .${TOOLTIP_CLASS}::after {
      content: "";
      position: absolute;
      width: 0;
      height: 0;
      border-style: solid;
    }

    .${TOOLTIP_CLASS}[data-placement="top"]::after {
      left: calc(50% - 7px);
      top: 100%;
      border-width: 8px 7px 0 7px;
      border-color: rgba(18, 20, 28, 0.96) transparent transparent transparent;
    }

    .${TOOLTIP_CLASS}[data-placement="bottom"]::after {
      left: calc(50% - 7px);
      bottom: 100%;
      border-width: 0 7px 8px 7px;
      border-color: transparent transparent rgba(18, 20, 28, 0.96) transparent;
    }

    .${TOOLTIP_CLASS}[data-placement="left"]::after {
      left: 100%;
      top: calc(50% - 7px);
      border-width: 7px 0 7px 8px;
      border-color: transparent transparent transparent rgba(18, 20, 28, 0.96);
    }

    .${TOOLTIP_CLASS}[data-placement="right"]::after {
      right: 100%;
      top: calc(50% - 7px);
      border-width: 7px 8px 7px 0;
      border-color: transparent rgba(18, 20, 28, 0.96) transparent transparent;
    }

    .${TOOLTIP_CLASS} [data-role="header"] {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      margin-bottom: 0.35rem;
    }

    .${TOOLTIP_CLASS} [data-role="title"] {
      font-size: 0.75rem;
      color: rgba(245, 247, 255, 0.78);
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .${TOOLTIP_CLASS} [data-role="close"] {
      border: 0;
      color: rgba(245, 247, 255, 0.85);
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      width: 1.25rem;
      height: 1.25rem;
      font-size: 0.75rem;
      line-height: 1;
      cursor: pointer;
      padding: 0;
      flex-shrink: 0;
    }

    .${TOOLTIP_CLASS} [data-role="close"]:hover {
      background: rgba(255, 255, 255, 0.16);
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
  tooltip.style.left = `${clamp(left, margin, window.innerWidth - tooltipRect.width - margin)}px`;
  tooltip.style.top = `${clamp(top, margin, window.innerHeight - tooltipRect.height - margin)}px`;
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

  const title = document.createElement("div");
  title.dataset.role = "title";
  title.textContent = options.title ?? t("hint_title");

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.dataset.role = "close";
  closeButton.ariaLabel = t("hint_close");
  closeButton.textContent = "✕";

  const message = document.createElement("div");
  message.textContent = options.message;

  header.appendChild(title);
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
