import { isMobileViewport } from "@/constants/breakpoints";
import type { WplaceMap } from "@/inject/types";
import {
  GAME_VIEWPORT_ASPECT_HEIGHT,
  GAME_VIEWPORT_ASPECT_WIDTH,
  GAME_VIEWPORT_MARGIN_PX,
  GAME_VIEWPORT_MAX_HEIGHT_RATIO,
  GAME_VIEWPORT_MAX_WIDTH_RATIO,
} from "./constants";

export type ArtCruiseViewportConfig = {
  aspectWidth?: number;
  aspectHeight?: number;
  marginPx?: number;
  maxWidthRatio?: number;
  maxHeightRatio?: number;
};

type ResizableMap = WplaceMap & {
  resize?: () => void;
};

export class ArtCruiseViewport {
  private root: HTMLDivElement | null = null;
  private frame: HTMLDivElement | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly map: WplaceMap,
    private readonly config: ArtCruiseViewportConfig = {},
  ) {}

  mount = () => {
    if (this.frame) return;

    const root = document.createElement("div");
    root.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 999;
      pointer-events: none;
    `;

    const frame = document.createElement("div");
    frame.style.cssText = `
      position: fixed;
      overflow: hidden;
      pointer-events: none;
      border: 2px solid rgba(103, 232, 249, 0.92);
      border-bottom-color: rgba(244, 114, 182, 0.92);
      border-radius: 8px;
      box-shadow:
        0 0 0 9999px rgba(0, 0, 0, 0.72),
        0 18px 64px rgba(0, 0, 0, 0.52),
        0 0 28px rgba(34, 211, 238, 0.34),
        inset 0 0 0 1px rgba(255, 255, 255, 0.18);
      background: transparent;
    `;

    root.appendChild(frame);
    document.body.appendChild(root);
    this.root = root;
    this.frame = frame;
    window.addEventListener("resize", this.layout);
    this.layout();
  };

  destroy = () => {
    window.removeEventListener("resize", this.layout);
    this.listeners.clear();
    this.root?.remove();
    this.root = null;
    this.frame = null;
    this.resizeMap();
  };

  getFrame = () => this.frame;

  getRect = () =>
    this.frame?.getBoundingClientRect() ??
    new DOMRect(0, 0, window.innerWidth, window.innerHeight);

  onChange = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private layout = () => {
    if (!this.frame) return;

    const mobile = isMobileViewport();
    const margin = this.config.marginPx ?? (mobile ? 4 : GAME_VIEWPORT_MARGIN_PX);
    const maxWidth =
      window.innerWidth *
        (this.config.maxWidthRatio ?? (mobile ? 1 : GAME_VIEWPORT_MAX_WIDTH_RATIO)) -
      margin * 2;
    const maxHeight =
      window.innerHeight *
        (this.config.maxHeightRatio ?? GAME_VIEWPORT_MAX_HEIGHT_RATIO) -
      margin * 2;
    const aspect =
      (this.config.aspectWidth ?? GAME_VIEWPORT_ASPECT_WIDTH) /
      (this.config.aspectHeight ?? GAME_VIEWPORT_ASPECT_HEIGHT);
    const safeMaxWidth = Math.max(160, maxWidth);
    const safeMaxHeight = Math.max(240, maxHeight);
    const widthByHeight = safeMaxHeight * aspect;
    const width = Math.min(safeMaxWidth, widthByHeight);
    const height = width / aspect;
    const left = (window.innerWidth - width) / 2;
    const top = (window.innerHeight - height) / 2;

    this.frame.style.left = `${left}px`;
    this.frame.style.top = `${top}px`;
    this.frame.style.width = `${width}px`;
    this.frame.style.height = `${height}px`;
    this.resizeMap();
    for (const listener of this.listeners) listener();
  };

  private resizeMap = () => {
    const map = this.map as ResizableMap;
    map.resize?.();
  };
}
