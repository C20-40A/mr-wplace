import {
  GAME_LOGICAL_HEIGHT,
  GAME_LOGICAL_WIDTH,
  INPUT_SHIELD_ID,
} from "./constants";
import type { ArtCruiseViewport } from "./viewport";

export type ArtCruisePointerState = {
  x: number;
  y: number;
  hasTarget: boolean;
  shooting: boolean;
};

export class ArtCruiseInput {
  private inputShield: HTMLDivElement | null = null;
  public readonly pointer: ArtCruisePointerState = {
    x: 0,
    y: 0,
    hasTarget: false,
    shooting: false,
  };

  constructor(
    private readonly viewport: ArtCruiseViewport,
    private readonly onStopShooting?: () => void,
  ) {}

  start() {
    if (this.inputShield) return;

    const shield = document.createElement("div");
    shield.id = INPUT_SHIELD_ID;
    shield.style.cssText = `
      position: absolute;
      inset: 0;
      z-index: 2;
      background: transparent;
      cursor: crosshair;
      pointer-events: auto;
      touch-action: none;
    `;
    shield.addEventListener("pointermove", this.handlePointerMove);
    shield.addEventListener("pointerdown", this.handlePointerDown);
    shield.addEventListener("pointerup", this.handlePointerUp);
    shield.addEventListener("pointercancel", this.handlePointerUp);
    shield.addEventListener("mousemove", this.blockInput);
    shield.addEventListener("mouseover", this.blockInput);
    shield.addEventListener("mouseenter", this.blockInput);
    shield.addEventListener("mouseout", this.blockInput);
    shield.addEventListener("mouseleave", this.blockInput);
    shield.addEventListener("wheel", this.blockInput, { passive: false });
    shield.addEventListener("contextmenu", this.blockInput);
    window.addEventListener("blur", this.stopShooting);
    (this.viewport.getFrame() ?? document.body).appendChild(shield);
    this.inputShield = shield;
  }

  stop() {
    if (!this.inputShield) return;

    this.inputShield.removeEventListener("pointermove", this.handlePointerMove);
    this.inputShield.removeEventListener("pointerdown", this.handlePointerDown);
    this.inputShield.removeEventListener("pointerup", this.handlePointerUp);
    this.inputShield.removeEventListener("pointercancel", this.handlePointerUp);
    this.inputShield.removeEventListener("mousemove", this.blockInput);
    this.inputShield.removeEventListener("mouseover", this.blockInput);
    this.inputShield.removeEventListener("mouseenter", this.blockInput);
    this.inputShield.removeEventListener("mouseout", this.blockInput);
    this.inputShield.removeEventListener("mouseleave", this.blockInput);
    this.inputShield.removeEventListener("wheel", this.blockInput);
    this.inputShield.removeEventListener("contextmenu", this.blockInput);
    window.removeEventListener("blur", this.stopShooting);
    this.inputShield.remove();
    this.inputShield = null;
    this.pointer.shooting = false;
  }

  setShooting(shooting: boolean) {
    this.pointer.shooting = shooting;
  }

  private handlePointerMove = (event: PointerEvent) => {
    this.blockInput(event);

    const rect = this.viewport.getRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;

    this.pointer.x = (localX / width) * GAME_LOGICAL_WIDTH;
    this.pointer.y = (localY / height) * GAME_LOGICAL_HEIGHT;
    this.pointer.x = Math.max(0, Math.min(GAME_LOGICAL_WIDTH, this.pointer.x));
    this.pointer.y = Math.max(0, Math.min(GAME_LOGICAL_HEIGHT, this.pointer.y));
    this.pointer.hasTarget = true;
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) {
      this.blockInput(event);
      return;
    }
    this.pointer.shooting = true;
    this.inputShield?.setPointerCapture(event.pointerId);
    this.handlePointerMove(event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    this.stopShooting();
    this.blockInput(event);
  };

  private stopShooting = () => {
    this.pointer.shooting = false;
    this.onStopShooting?.();
  };

  private blockInput = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  };
}
