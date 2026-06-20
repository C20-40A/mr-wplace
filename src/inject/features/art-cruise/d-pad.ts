import { isMobileViewport } from "@/constants/breakpoints";
import { D_PAD_ROOT_ID } from "./constants";

export type ArtCruiseDPadDirection = {
  x: number;
  y: number;
};

type ArtCruiseDPadOptions = {
  onDirectionChange: (direction: ArtCruiseDPadDirection) => void;
  onActiveChange: (active: boolean) => void;
};

type StickState = {
  base: HTMLDivElement;
  knob: HTMLDivElement;
};

const PAD_SIZE = 112;
const KNOB_SIZE = 48;
const STICK_RADIUS = (PAD_SIZE - KNOB_SIZE) / 2;

const clampStickVector = (x: number, y: number) => {
  const distance = Math.hypot(x, y);
  if (distance <= STICK_RADIUS) return { x, y };

  const scale = STICK_RADIUS / distance;
  return { x: x * scale, y: y * scale };
};

const normalizeDirection = (x: number, y: number) => ({
  x: x / STICK_RADIUS,
  y: y / STICK_RADIUS,
});

const createStick = (): StickState => {
  const base = document.createElement("div");
  base.style.cssText = `
    position: relative;
    width: ${PAD_SIZE}px;
    height: ${PAD_SIZE}px;
    border: 1px solid rgba(103, 232, 249, 0.45);
    border-bottom-color: rgba(244, 114, 182, 0.5);
    border-radius: 50%;
    background:
      radial-gradient(circle at 50% 50%, rgba(224, 250, 255, 0.1) 0 2px, transparent 3px),
      radial-gradient(circle at 50% 50%, rgba(34, 211, 238, 0.14), rgba(2, 6, 23, 0.3) 62%, rgba(2, 6, 23, 0.42));
    box-shadow:
      inset 0 0 22px rgba(34, 211, 238, 0.18),
      0 0 18px rgba(34, 211, 238, 0.18);
    pointer-events: auto;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  `;

  const knob = document.createElement("div");
  knob.style.cssText = `
    position: absolute;
    left: 50%;
    top: 50%;
    width: ${KNOB_SIZE}px;
    height: ${KNOB_SIZE}px;
    border: 1px solid rgba(224, 250, 255, 0.58);
    border-bottom-color: rgba(244, 114, 182, 0.62);
    border-radius: 50%;
    background:
      radial-gradient(circle at 36% 30%, rgba(255, 255, 255, 0.24), transparent 28%),
      rgba(8, 47, 73, 0.48);
    box-shadow:
      inset 0 0 16px rgba(34, 211, 238, 0.2),
      0 0 14px rgba(244, 114, 182, 0.16);
    transform: translate(-50%, -50%);
    pointer-events: none;
  `;

  base.appendChild(knob);
  return { base, knob };
};

export class ArtCruiseDPad {
  private root: HTMLDivElement | null = null;
  private enabled = true;
  private readonly sticks = new Map<number, StickState>();
  private readonly directions = new Map<number, ArtCruiseDPadDirection>();

  constructor(private readonly options: ArtCruiseDPadOptions) {}

  mount = () => {
    if (this.root) return;

    const root = document.createElement("div");
    root.id = D_PAD_ROOT_ID;
    root.style.cssText = `
      position: fixed;
      inset: auto 0 18px 0;
      z-index: 1002;
      display: none;
      justify-content: space-between;
      align-items: flex-end;
      padding: 0 max(18px, env(safe-area-inset-right)) 0 max(18px, env(safe-area-inset-left));
      pointer-events: none;
      opacity: 0.72;
    `;

    root.append(this.createPad(), this.createPad());
    document.body.appendChild(root);
    this.root = root;
    window.addEventListener("resize", this.syncVisibility);
    this.syncVisibility();
  };

  destroy = () => {
    window.removeEventListener("resize", this.syncVisibility);
    this.root?.remove();
    this.root = null;
    this.sticks.clear();
    this.directions.clear();
    this.notify();
  };

  setEnabled = (enabled: boolean) => {
    this.enabled = enabled;
    if (!enabled) this.resetAllSticks();
    this.syncVisibility();
    this.notify();
  };

  private createPad = () => {
    const stick = createStick();
    stick.base.addEventListener("pointerdown", this.handlePointerDown);
    stick.base.addEventListener("pointermove", this.handlePointerMove);
    stick.base.addEventListener("pointerup", this.handlePointerUp);
    stick.base.addEventListener("pointercancel", this.handlePointerUp);
    stick.base.addEventListener("lostpointercapture", this.handlePointerUp);
    return stick.base;
  };

  private handlePointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    const base = event.currentTarget as HTMLDivElement;
    const knob = base.firstElementChild as HTMLDivElement | null;
    if (!knob) return;

    base.setPointerCapture(event.pointerId);
    this.sticks.set(event.pointerId, { base, knob });
    this.updateStick(event);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.sticks.has(event.pointerId)) return;

    event.preventDefault();
    event.stopPropagation();
    this.updateStick(event);
  };

  private handlePointerUp = (event: PointerEvent) => {
    const stick = this.sticks.get(event.pointerId);
    if (!stick) return;

    event.preventDefault();
    event.stopPropagation();
    this.setKnobOffset(stick.knob, 0, 0);
    this.sticks.delete(event.pointerId);
    this.directions.delete(event.pointerId);
    this.notify();
  };

  private updateStick = (event: PointerEvent) => {
    const stick = this.sticks.get(event.pointerId);
    if (!stick) return;

    const rect = stick.base.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offset = clampStickVector(event.clientX - centerX, event.clientY - centerY);
    this.setKnobOffset(stick.knob, offset.x, offset.y);
    this.directions.set(event.pointerId, normalizeDirection(offset.x, offset.y));
    this.notify();
  };

  private notify = () => {
    let x = 0;
    let y = 0;
    for (const direction of this.directions.values()) {
      x += direction.x;
      y += direction.y;
    }

    const distance = Math.hypot(x, y);
    const scale = distance > 1 ? 1 / distance : 1;
    const direction = { x: x * scale, y: y * scale };
    const active = Math.hypot(direction.x, direction.y) > 0.05;
    this.options.onDirectionChange(active ? direction : { x: 0, y: 0 });
    this.options.onActiveChange(active);
  };

  private resetAllSticks = () => {
    for (const stick of this.sticks.values()) this.setKnobOffset(stick.knob, 0, 0);
    this.sticks.clear();
    this.directions.clear();
  };

  private setKnobOffset = (knob: HTMLDivElement, x: number, y: number) => {
    knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  };

  private syncVisibility = () => {
    if (!this.root) return;
    this.root.style.display = this.enabled && isMobileViewport() ? "flex" : "none";
  };
}
