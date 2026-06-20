import {
  D_PAD_TARGET_SPEED,
  GAME_LOGICAL_HEIGHT,
  GAME_LOGICAL_WIDTH,
  INPUT_SHIELD_ID,
} from "./constants";
import { ArtCruiseDPad, type ArtCruiseDPadDirection } from "./d-pad";
import type { ArtCruiseViewport } from "./viewport";

const KEYBOARD_FINE_MOVE_RATE = 0.28;
const SHIFT_CODES = new Set(["ShiftLeft", "ShiftRight"]);
const SHOOTING_KEY_CODES = new Set(["Space", ...SHIFT_CODES]);
const KEYBOARD_DIRECTIONS: Record<string, ArtCruiseDPadDirection> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const isTextInputTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
};

export type ArtCruisePointerState = {
  x: number;
  y: number;
  hasTarget: boolean;
  shooting: boolean;
};

export class ArtCruiseInput {
  private inputShield: HTMLDivElement | null = null;
  private readonly dPad = new ArtCruiseDPad({
    onDirectionChange: (direction) => {
      this.dPadDirection = direction;
    },
    onActiveChange: (active) => {
      this.dPadActive = active;
      this.updateShootingState();
    },
  });
  private dPadDirection: ArtCruiseDPadDirection = { x: 0, y: 0 };
  private dPadActive = false;
  private pointerActive = false;
  private readonly pressedKeys = new Set<string>();
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
    window.addEventListener("blur", this.handleBlur);
    window.addEventListener("keydown", this.handleKeyDown, true);
    window.addEventListener("keyup", this.handleKeyUp, true);
    (this.viewport.getFrame() ?? document.body).appendChild(shield);
    this.inputShield = shield;
    this.dPad.mount();
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
    window.removeEventListener("blur", this.handleBlur);
    window.removeEventListener("keydown", this.handleKeyDown, true);
    window.removeEventListener("keyup", this.handleKeyUp, true);
    this.inputShield.remove();
    this.inputShield = null;
    this.dPad.destroy();
    this.pressedKeys.clear();
    this.pointerActive = false;
    this.pointer.shooting = false;
  }

  setShooting(shooting: boolean) {
    this.pointer.shooting = shooting;
  }

  setDPadEnabled(enabled: boolean) {
    this.dPad.setEnabled(enabled);
  }

  setTarget(x: number, y: number) {
    this.pointer.x = Math.max(0, Math.min(GAME_LOGICAL_WIDTH, x));
    this.pointer.y = Math.max(0, Math.min(GAME_LOGICAL_HEIGHT, y));
    this.pointer.hasTarget = true;
  }

  updateDirectionalTarget(deltaSeconds: number) {
    const keyboardDirection = this.getKeyboardDirection();
    const hasKeyboardInput = this.hasMovementKeyPressed();
    this.updateShootingState();
    if (!this.dPadActive && !hasKeyboardInput) return;

    if (!this.pointer.hasTarget)
      this.setTarget(GAME_LOGICAL_WIDTH * 0.5, GAME_LOGICAL_HEIGHT * 0.78);

    const keyboardSpeedRate = this.hasShiftPressed()
      ? KEYBOARD_FINE_MOVE_RATE
      : 1;
    const direction = {
      x: this.dPadDirection.x + keyboardDirection.x * keyboardSpeedRate,
      y: this.dPadDirection.y + keyboardDirection.y * keyboardSpeedRate,
    };
    const speed = D_PAD_TARGET_SPEED * deltaSeconds;
    this.setTarget(
      this.pointer.x + direction.x * speed,
      this.pointer.y + direction.y * speed,
    );
  }

  private getKeyboardDirection = () => {
    let x = 0;
    let y = 0;
    for (const code of this.pressedKeys) {
      const direction = KEYBOARD_DIRECTIONS[code];
      if (!direction) continue;
      x += direction.x;
      y += direction.y;
    }
    return this.normalizeDirection(x, y);
  };

  private hasShiftPressed = () => {
    for (const code of SHIFT_CODES)
      if (this.pressedKeys.has(code)) return true;
    return false;
  };

  private normalizeDirection = (x: number, y: number): ArtCruiseDPadDirection => {
    const length = Math.hypot(x, y);
    if (length <= 1) return { x, y };
    return { x: x / length, y: y / length };
  };

  private handleKeyDown = (event: KeyboardEvent) => {
    if (
      !KEYBOARD_DIRECTIONS[event.code] &&
      !SHOOTING_KEY_CODES.has(event.code)
    )
      return;
    if (isTextInputTarget(event.target))
      return;
    this.pressedKeys.add(event.code);
    this.updateShootingState();
    this.blockInput(event);
  };

  private handleKeyUp = (event: KeyboardEvent) => {
    if (
      !KEYBOARD_DIRECTIONS[event.code] &&
      !SHOOTING_KEY_CODES.has(event.code)
    )
      return;
    if (!this.pressedKeys.has(event.code) && isTextInputTarget(event.target))
      return;
    this.pressedKeys.delete(event.code);
    this.updateShootingState();
    this.blockInput(event);
  };

  private updateShootingState = () => {
    this.pointer.shooting =
      this.pointerActive ||
      this.dPadActive ||
      this.hasMovementKeyPressed() ||
      this.hasShootingKeyPressed();
  };

  private hasShootingKeyPressed = () => {
    for (const code of this.pressedKeys)
      if (SHOOTING_KEY_CODES.has(code)) return true;
    return false;
  };

  private hasMovementKeyPressed = () => {
    for (const code of this.pressedKeys)
      if (KEYBOARD_DIRECTIONS[code]) return true;
    return false;
  };

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
    this.pointerActive = true;
    this.updateShootingState();
    this.inputShield?.setPointerCapture(event.pointerId);
    this.handlePointerMove(event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    this.stopShooting();
    this.blockInput(event);
  };

  private stopShooting = () => {
    this.pointerActive = false;
    this.dPadActive = false;
    this.updateShootingState();
    this.onStopShooting?.();
  };

  private handleBlur = () => {
    this.stopShooting();
    this.pressedKeys.clear();
  };

  private blockInput = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
  };
}
