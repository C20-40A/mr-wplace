/**
 * Beacon (塗り残しファインダー)
 *
 * 選択中の色の「テンプレ未配置ピクセル」が残り threshold 以下になったら、
 * その位置にビーコンを出して探しやすくする。
 *
 * 設計: 描画パス (tile-overlay-renderer) には手を入れない。
 * 残り数は既存の perTileColorStats から求め、残り数が閾値以下のときだけ
 * 該当タイルだけを走査して座標を取り出す (通常 1-2 タイル)。
 */

import { colorpalette } from "@/constants/colors";
import { tilePixelToLatLng } from "@/utils/coordinate";
import { blobToPixels } from "@/utils/pixel-converters";
import { overlayLayers, perTileColorStats } from "../tile-draw/states";
import { getOriginalBlob } from "../tile-draw/last-modified-cache";
import { setBeaconPoints, clearBeaconPoints, type BeaconPoint } from "./canvas";

const TILE_SIZE = 1000;
const SELECTED_COLOR_POLL_MS = 400;
const RECOMPUTE_DEBOUNCE_MS = 300;
/** 閾値以下でしか走査しないので、走るタイル数は実質少数に収まる */
const MAX_SCAN_TILES = 8;
const MAX_BEACON_POINTS = 200;

let enabled = false;
let threshold = 10;
let pollTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastSelectedColor: string | null = null;
let running = false;
let rerunRequested = false;

const getSelectedRgb = (): [number, number, number] | null => {
  const raw = localStorage.getItem("selected-color");
  if (!raw) return null;
  const entry = colorpalette.find((color) => color.id === parseInt(raw));
  return entry ? (entry.rgb as [number, number, number]) : null;
};

const isLayerVisible = (imageKey: string): boolean =>
  overlayLayers.some(
    (layer) => layer.imageKey === imageKey && layer.drawEnabled,
  );

interface TileCandidate {
  imageKey: string;
  tileKey: string;
  tileX: number;
  tileY: number;
}

/**
 * 選択色の残りをテンプレート単位で集計する。
 * NOTE: 全テンプレートの合計で判定すると、遠くの別テンプレに大量の残りがあるだけで
 * 目の前の「残り15px」にビーコンが出なくなるため、テンプレごとに閾値を見る。
 */
const collectCandidates = (colorKey: string): TileCandidate[] => {
  const candidates: TileCandidate[] = [];

  for (const [imageKey, tileStatsMap] of perTileColorStats) {
    if (!isLayerVisible(imageKey)) continue;

    let remaining = 0;
    const tiles: TileCandidate[] = [];
    for (const [tileKey, stats] of tileStatsMap) {
      const left =
        (stats.total.get(colorKey) ?? 0) - (stats.matched.get(colorKey) ?? 0);
      if (left <= 0) continue;
      remaining += left;
      const [tileX, tileY] = tileKey.split(",").map(Number);
      tiles.push({ imageKey, tileKey, tileX, tileY });
    }

    if (remaining === 0 || remaining > threshold) continue;
    candidates.push(...tiles);
  }

  return candidates;
};

const readBitmapPixels = (bitmap: ImageBitmap): Uint8ClampedArray => {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  return ctx.getImageData(0, 0, bitmap.width, bitmap.height).data;
};

/**
 * 1タイル分のオーバーレイと背景を比べ、選択色の未配置座標を集める。
 * 背景タイルが未取得で判定できなかった場合は false を返す。
 */
const scanTile = async (
  candidate: TileCandidate,
  rgb: [number, number, number],
  points: BeaconPoint[],
): Promise<boolean> => {
  const { tileX, tileY } = candidate;
  const bgBlob = getOriginalBlob(`${tileX},${tileY}`);
  if (!bgBlob) return false;

  const instance = overlayLayers.find(
    (layer) => layer.imageKey === candidate.imageKey && layer.drawEnabled,
  );
  if (!instance?.tiles) return true;

  const { pixels: bgPixels, width: bgWidth } = await blobToPixels(bgBlob);
  const [targetR, targetG, targetB] = rgb;
  const v2Key = `${tileX},${tileY}`;

  for (const overlayKey of Object.keys(instance.tiles)) {
    const isV2 = overlayKey === v2Key;
    if (!isV2 && !overlayKey.startsWith(candidate.tileKey)) continue;

    const bitmap = instance.tiles[overlayKey];
    if (!bitmap) continue;

    const parts = overlayKey.split(",");
    const offsetX = isV2 ? 0 : Number(parts[2]);
    const offsetY = isV2 ? 0 : Number(parts[3]);
    const { width, height } = bitmap;
    const data = readBitmapPixels(bitmap);

    for (let y = 0; y < height; y++) {
      const tileY1 = offsetY + y;
      if (tileY1 < 0 || tileY1 >= TILE_SIZE) continue;
      let i = y * width * 4;
      for (let x = 0; x < width; x++, i += 4) {
        if (data[i + 3] === 0) continue;
        if (data[i] !== targetR || data[i + 1] !== targetG || data[i + 2] !== targetB)
          continue;

        const tileX1 = offsetX + x;
        if (tileX1 < 0 || tileX1 >= TILE_SIZE) continue;

        const bgI = (tileY1 * bgWidth + tileX1) * 4;
        if (bgI + 3 >= bgPixels.length) continue;
        // 背景が既に同色 = 配置済みなので対象外
        if (
          bgPixels[bgI + 3] > 0 &&
          bgPixels[bgI] === targetR &&
          bgPixels[bgI + 1] === targetG &&
          bgPixels[bgI + 2] === targetB
        )
          continue;

        points.push(
          tilePixelToLatLng(tileX, tileY, tileX1 + 0.5, tileY1 + 0.5),
        );
      }
    }
  }

  return true;
};

const recompute = async (): Promise<void> => {
  if (running) {
    rerunRequested = true;
    return;
  }
  running = true;

  try {
    if (!enabled) return clearBeaconPoints();

    const rgb = getSelectedRgb();
    if (!rgb) return clearBeaconPoints();

    const candidates = collectCandidates(`${rgb[0]},${rgb[1]},${rgb[2]}`);
    if (candidates.length === 0) return clearBeaconPoints();

    const points: BeaconPoint[] = [];
    let missingBackground = 0;
    for (const candidate of candidates.slice(0, MAX_SCAN_TILES))
      if (!(await scanTile(candidate, rgb, points))) missingBackground++;

    if (points.length === 0)
      console.log(
        "🧑‍🎨 : Beacon found no target pixel",
        `tiles=${candidates.length}`,
        `missingBackground=${missingBackground}`,
      );

    // stats が一時的にずれても描画が暴れないよう上限を設ける
    setBeaconPoints(points.slice(0, MAX_BEACON_POINTS));
  } catch (error) {
    console.warn("🧑‍🎨 : Beacon recompute failed", error);
  } finally {
    running = false;
    if (rerunRequested) {
      rerunRequested = false;
      scheduleBeaconRecompute();
    }
  }
};

/** 統計更新やペイントのたびに呼ばれるので debounce する */
export const scheduleBeaconRecompute = (): void => {
  if (!enabled || debounceTimer !== null) return;
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void recompute();
  }, RECOMPUTE_DEBOUNCE_MS);
};

const startSelectedColorPolling = (): void => {
  if (pollTimer !== null) return;
  lastSelectedColor = localStorage.getItem("selected-color");
  pollTimer = setInterval(() => {
    const current = localStorage.getItem("selected-color");
    if (current === lastSelectedColor) return;
    lastSelectedColor = current;
    clearBeaconPoints();
    scheduleBeaconRecompute();
  }, SELECTED_COLOR_POLL_MS);
};

const stopSelectedColorPolling = (): void => {
  if (pollTimer === null) return;
  clearInterval(pollTimer);
  pollTimer = null;
  lastSelectedColor = null;
};

export const setBeaconSettings = (settings: {
  enabled: boolean;
  threshold: number;
}): void => {
  enabled = settings.enabled === true;
  threshold = settings.threshold;

  if (!enabled) {
    stopSelectedColorPolling();
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    clearBeaconPoints();
    return;
  }

  startSelectedColorPolling();
  scheduleBeaconRecompute();
};
