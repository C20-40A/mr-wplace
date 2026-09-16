/**
 * map canvas の上に重ねる HTML canvas の共通ライフサイクル。
 * paint guide / beacon など「map 座標に追従する自前描画」で共有する。
 */

import { getMapInstanceFromWplace } from "./get-map-instance";

const getMapCanvas = (): HTMLCanvasElement | null => {
  const map = getMapInstanceFromWplace() as any;
  return map?.getCanvas?.() ?? null;
};

/** map canvas の兄弟として overlay canvas を作る (pointer-events:none の表示専用) */
export const getOrCreateMapOverlayCanvas = (
  id: string,
  zIndex: number,
): HTMLCanvasElement | null => {
  const mapCanvas = getMapCanvas();
  const parent = mapCanvas?.parentElement;
  if (!parent) return null;

  const existing = parent.querySelector(`#${id}`) as HTMLCanvasElement | null;
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  canvas.id = id;
  canvas.style.cssText = `position:absolute;top:0;left:0;pointer-events:none;z-index:${zIndex};`;
  parent.appendChild(canvas);
  return canvas;
};

/** map canvas と同じ表示サイズへ合わせる (変化時のみ代入) */
export const syncMapOverlayCanvasSize = (canvas: HTMLCanvasElement): void => {
  const mapCanvas = getMapCanvas();
  if (!mapCanvas) return;
  const w = mapCanvas.offsetWidth;
  const h = mapCanvas.offsetHeight;
  if (canvas.width === w && canvas.height === h) return;
  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
};
