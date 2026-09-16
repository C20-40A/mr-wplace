/**
 * Beacon Canvas Overlay
 *
 * 選択色の塗り残しを「外側へ広がる半透明の赤い波」で強調表示する。
 * map canvas の上に重ねた HTML canvas に rAF で描画する。
 */

import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import {
  getOrCreateMapOverlayCanvas,
  syncMapOverlayCanvasSize,
} from "../map-instance/overlay-canvas";

const CANVAS_ID = "mr-wplace-beacon-canvas";
const WAVE_PERIOD_MS = 1600;
const WAVE_COUNT = 2;
const MIN_RADIUS = 6;
const MAX_RADIUS = 46;
const CORE_RADIUS = 5;
const BEACON_RGB = "255,0,0";

export interface BeaconPoint {
  key: string;
  lat: number;
  lng: number;
}

/** tile/pixel 単位で消せるように key を持たせる */
export const beaconPointKey = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): string => `${tileX},${tileY},${pixelX},${pixelY}`;

let points = new Map<string, BeaconPoint>();
let canvas: HTMLCanvasElement | null = null;
let rafId: number | null = null;

const drawFrame = (timestamp: number): void => {
  rafId = requestAnimationFrame(drawFrame);

  const c = (canvas =
    canvas?.isConnected === true
      ? canvas
      : getOrCreateMapOverlayCanvas(CANVAS_ID, 11));
  if (!c) return;

  syncMapOverlayCanvasSize(c);
  const ctx = c.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, c.width, c.height);
  if (points.size === 0) return;

  const map = getMapInstanceFromWplace() as any;
  if (!map) return;

  const phase = (timestamp % WAVE_PERIOD_MS) / WAVE_PERIOD_MS;

  for (const point of points.values()) {
    const { x, y } = map.project([point.lng, point.lat]);
    if (
      x < -MAX_RADIUS ||
      y < -MAX_RADIUS ||
      x > c.width + MAX_RADIUS ||
      y > c.height + MAX_RADIUS
    )
      continue;

    for (let wave = 0; wave < WAVE_COUNT; wave++) {
      // 波ごとに位相をずらし、外側へ広がりながら薄くなる
      const progress = (phase + wave / WAVE_COUNT) % 1;
      const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * progress;
      const fade = 1 - progress;

      // 赤背景の上でも沈まないよう、白 → 赤 → 透明のグラデーションにする
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `rgba(255,255,255,${0.42 * fade})`);
      gradient.addColorStop(0.45, `rgba(255,72,72,${0.3 * fade})`);
      gradient.addColorStop(1, `rgba(${BEACON_RGB},0)`);

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
      // 白ハローの上に赤線を重ね、明背景/赤背景どちらでも輪郭が残るようにする
      ctx.lineWidth = 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * fade})`;
      ctx.stroke();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = `rgba(${BEACON_RGB},${0.95 * fade})`;
      ctx.stroke();
    }

    // 中心は白コアから赤へ抜けるグラデーション (黒枠は使わない)
    const core = ctx.createRadialGradient(x, y, 0, x, y, CORE_RADIUS);
    core.addColorStop(0, "rgba(255,255,255,0.95)");
    core.addColorStop(0.55, `rgba(255,64,64,0.95)`);
    core.addColorStop(1, `rgba(${BEACON_RGB},0.2)`);
    ctx.beginPath();
    ctx.arc(x, y, CORE_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
  }
};

const startRaf = (): void => {
  if (rafId === null) rafId = requestAnimationFrame(drawFrame);
};

const stopRaf = (): void => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
  canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
};

/** 表示する beacon 位置を差し替える。空なら rAF ごと止める */
export const setBeaconPoints = (next: BeaconPoint[]): void => {
  points = new Map(next.map((point) => [point.key, point]));
  if (points.size === 0) {
    stopRaf();
    return;
  }
  startRaf();
};

export const clearBeaconPoints = (): void => setBeaconPoints([]);

/** ペイントされた地点のビーコンは即座に消す (再計算を待たない) */
export const clearBeaconPointAt = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
): void => {
  if (!points.delete(beaconPointKey(tileX, tileY, pixelX, pixelY))) return;
  if (points.size === 0) stopRaf();
};

export const destroyBeaconCanvas = (): void => {
  clearBeaconPoints();
  canvas?.remove();
  canvas = null;
};
