import { latLngToTilePixel } from "@/utils/coordinate";
import type { WplaceMap } from "@/inject/types";
import {
  DYNAMIC_ENEMY_ALPHA_THRESHOLD,
  DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE,
  DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MAX_SIZE_PX,
  DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MIN_SIZE_PX,
  DYNAMIC_ENEMY_POOL_LIMIT,
  DYNAMIC_ENEMY_SCAN_INTERVAL_MS,
  DYNAMIC_ENEMY_SCAN_TILE_LIMIT,
  DYNAMIC_ENEMY_SCANNER_POOL_LIMIT,
} from "../../constants";
import {
  getOriginalBlob,
  getOriginalLastModified,
} from "../../../tile-draw/last-modified-cache";
import { createEnemyBitmap } from "./enemy-bitmap-renderer";

export type DynamicPixelArtEnemyCandidate = {
  id: string;
  tileKey: string;
  bitmap: ImageBitmap;
  width: number;
  height: number;
  opaquePixels: number;
  scannedAt: number;
};

type DecodedTile = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type ExtractedCandidate = {
  id: string;
  imageData: ImageData;
  width: number;
  height: number;
  opaquePixels: number;
};

type WorkerCandidate = {
  id: string;
  width: number;
  height: number;
  opaquePixels: number;
  buffer: ArrayBuffer;
};

type WorkerScanResponse = {
  candidates?: WorkerCandidate[];
  nextOffset?: number;
  total?: number;
  error?: string;
};

type ScanResult = {
  candidates: DynamicPixelArtEnemyCandidate[];
  // 次回スキャン再開位置 (px index)。全走査済みなら 0。total は走査範囲のpx総数。
  nextOffset: number;
  total: number;
};

const NEIGHBOR_OFFSETS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
] as const;

const SCAN_YIELD_INTERVAL = 4096;
const COMPONENT_YIELD_INTERVAL = 2048;

const waitForIdle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 120 });
      return;
    }

    globalThis.setTimeout(resolve, 16);
  });

let scannerWorker: Worker | null | undefined;

const getScannerWorker = () => {
  if (scannerWorker !== undefined) return scannerWorker;

  try {
    const source = `
      const NEIGHBOR_OFFSETS = ${JSON.stringify(NEIGHBOR_OFFSETS)};
      const ALPHA_THRESHOLD = ${DYNAMIC_ENEMY_ALPHA_THRESHOLD};
      const MAX_CANDIDATES = ${DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE};
      const MIN_SIZE = ${DYNAMIC_ENEMY_MIN_SIZE_PX};
      const MAX_SIZE = ${DYNAMIC_ENEMY_MAX_SIZE_PX};
      const MIN_OPAQUE = ${DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS};
      const MAX_OPAQUE = ${DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS};

      const isOpaque = (data, pixelIndex) => data[pixelIndex * 4 + 3] > ALPHA_THRESHOLD;
      const isUsableComponent = (tileWidth, tileHeight, width, height, opaquePixels, minX, minY, maxX, maxY) => {
        if (minX === 0 || minY === 0 || maxX === tileWidth - 1 || maxY === tileHeight - 1) return false;
        if (width < MIN_SIZE || height < MIN_SIZE) return false;
        if (width > MAX_SIZE || height > MAX_SIZE) return false;
        if (opaquePixels < MIN_OPAQUE) return false;
        return opaquePixels <= MAX_OPAQUE;
      };

      const extractComponent = (tileKey, tileWidth, tileHeight, data, visited, queue, start) => {
        let readIndex = 0;
        let writeIndex = 1;
        let minX = start % tileWidth;
        let maxX = minX;
        let minY = Math.floor(start / tileWidth);
        let maxY = minY;
        let tooLarge = false;

        visited[start] = 1;
        queue[0] = start;

        while (readIndex < writeIndex) {
          const index = queue[readIndex++];
          const x = index % tileWidth;
          const y = Math.floor(index / tileWidth);

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;

          for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
            const nextX = x + offsetX;
            const nextY = y + offsetY;
            if (nextX < 0 || nextY < 0 || nextX >= tileWidth || nextY >= tileHeight) continue;

            const nextIndex = nextY * tileWidth + nextX;
            if (visited[nextIndex] || !isOpaque(data, nextIndex)) continue;

            visited[nextIndex] = 1;
            queue[writeIndex++] = nextIndex;
            if (writeIndex > MAX_OPAQUE) tooLarge = true;
          }
        }

        if (tooLarge) return null;

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;
        if (!isUsableComponent(tileWidth, tileHeight, width, height, writeIndex, minX, minY, maxX, maxY)) return null;

        const output = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < writeIndex; i++) {
          const sourceIndex = queue[i];
          const sourceX = sourceIndex % tileWidth;
          const sourceY = Math.floor(sourceIndex / tileWidth);
          const sourceOffset = sourceIndex * 4;
          const targetOffset = ((sourceY - minY) * width + sourceX - minX) * 4;

          output[targetOffset] = data[sourceOffset];
          output[targetOffset + 1] = data[sourceOffset + 1];
          output[targetOffset + 2] = data[sourceOffset + 2];
          output[targetOffset + 3] = data[sourceOffset + 3];
        }

        return {
          id: tileKey + ":" + minX + "," + minY + "," + width + "," + height + "," + writeIndex,
          width,
          height,
          opaquePixels: writeIndex,
          buffer: output.buffer,
        };
      };

      const scan = (tileKey, width, height, data, startOffset, maxCandidates) => {
        const total = width * height;
        // startOffset < 0 は「ランダム開始」の合図。それ以外は px 絶対位置を正規化。
        const scanOffset =
          startOffset < 0
            ? Math.floor(Math.random() * total) % (total || 1)
            : startOffset % (total || 1);
        const limit = maxCandidates > 0 ? maxCandidates : MAX_CANDIDATES;
        const visited = new Uint8Array(total);
        const queue = new Int32Array(total);
        const candidates = [];

        let i = 0;
        for (; i < total; i++) {
          if (candidates.length >= limit) break;
          const start = (scanOffset + i) % total;
          if (visited[start] || !isOpaque(data, start)) continue;

          const result = extractComponent(tileKey, width, height, data, visited, queue, start);
          if (result) candidates.push(result);
        }
        // 次回はこの続き(走査済みの直後)から再開する。全走査し切ったら 0 に戻す。
        const nextOffset = i >= total ? 0 : (scanOffset + i) % total;
        return { candidates, nextOffset, total };
      };

      // blob 経路: worker 内で decode (createImageBitmap + OffscreenCanvas) して
      // getImageData まで行い、メインスレッドの 4MB 走査を肩代わりする。
      const decodeInWorker = async (blob) => {
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("no 2d context in worker");
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return { data: image.data, width: canvas.width, height: canvas.height };
      };

      self.onmessage = async (event) => {
        try {
          const { tileKey, width, height, buffer, blob, startOffset, maxCandidates } = event.data;
          let data;
          let scanWidth = width;
          let scanHeight = height;
          if (blob) {
            const decoded = await decodeInWorker(blob);
            data = decoded.data;
            scanWidth = decoded.width;
            scanHeight = decoded.height;
          } else {
            data = new Uint8ClampedArray(buffer);
          }

          const { candidates, nextOffset, total } = scan(tileKey, scanWidth, scanHeight, data, startOffset, maxCandidates);
          self.postMessage({ candidates, nextOffset, total }, candidates.map((candidate) => candidate.buffer));
        } catch (error) {
          self.postMessage({ error: error instanceof Error ? error.message : String(error) });
        }
      };
    `;
    const url = URL.createObjectURL(new Blob([source], { type: "text/javascript" }));
    scannerWorker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.warn("🧑‍🎨 : Art cruise dynamic enemy worker unavailable", error);
    scannerWorker = null;
  }

  return scannerWorker;
};
const createRasterCanvas = (
  width: number,
  height: number,
): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined")
    return new OffscreenCanvas(width, height);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const decodeTile = async (blob: Blob): Promise<DecodedTile> => {
  const bitmap = await createImageBitmap(blob);
  const canvas = createRasterCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new Error("Failed to decode art cruise enemy tile");

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
};

export class DynamicPixelArtEnemyScanner {
  private readonly candidates: DynamicPixelArtEnemyCandidate[] = [];
  private readonly scannedVersions = new Map<string, string>();
  // tile ごとの次回スキャン開始 px index。pool が埋まるまで続きから網羅走査する。
  private readonly scanCursors = new Map<string, number>();
  private scanning = false;
  private lastScanAt = -DYNAMIC_ENEMY_SCAN_INTERVAL_MS;
  private version = 0;

  constructor(private readonly map: WplaceMap) {}

  update = (now: number) => {
    if (this.scanning) return;
    if (now - this.lastScanAt < DYNAMIC_ENEMY_SCAN_INTERVAL_MS) return;

    this.lastScanAt = now;
    this.scanning = true;
    void this.scanNearbyTiles()
      .catch((error) => {
        console.warn("🧑‍🎨 : Art cruise dynamic enemy scan failed", error);
      })
      .finally(() => {
        this.scanning = false;
      });
  };

  getCandidates = () => this.candidates;
  getVersion = () => this.version;

  destroy = () => {
    for (const candidate of this.candidates) candidate.bitmap.close();
    this.candidates.length = 0;
    this.scannedVersions.clear();
    this.scanCursors.clear();
    scannerWorker?.terminate();
    scannerWorker = undefined;
  };

  private scanNearbyTiles = async () => {
    let scannedCount = 0;

    for (const tileKey of this.getNearbyTileKeys()) {
      if (scannedCount >= DYNAMIC_ENEMY_SCAN_TILE_LIMIT) return;

      const blob = getOriginalBlob(tileKey);
      if (!blob) continue;

      const version = `${getOriginalLastModified(tileKey) ?? "unknown"}:${blob.size}`;
      const versionChanged = this.scannedVersions.get(tileKey) !== version;
      if (versionChanged) {
        // タイル内容が変わったらカーソルをリセットして最初から走査し直す。
        this.scannedVersions.set(tileKey, version);
        this.scanCursors.delete(tileKey);
      } else if (!this.scanCursors.has(tileKey)) {
        // 未更新タイルで一周走査済み (cursor 削除済み) なら再走査しない。
        // stop 条件は「タイル内を一周しきった」に一本化している。
        continue;
      }

      scannedCount += 1;

      await waitForIdle();
      // pool 満杯時は古い候補を 1 体ずつ入れ替えるよう取得数を 1 に絞る (緩やかな新陳代謝)。
      const poolFull = this.candidates.length >= DYNAMIC_ENEMY_SCANNER_POOL_LIMIT;
      const maxCandidates = poolFull ? 1 : DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE;
      // 初回 (cursor 未設定) はランダム開始、以降は前回の続きから網羅走査する。
      const cursor = this.scanCursors.get(tileKey);
      const result = await this.extractCandidates(tileKey, blob, cursor, maxCandidates);

      // nextOffset===0 は一周完了。次回以降はタイル更新まで走査しない。
      if (result.nextOffset === 0) this.scanCursors.delete(tileKey);
      else this.scanCursors.set(tileKey, result.nextOffset);

      if (!result.candidates.length) continue;

      for (const candidate of result.candidates) this.addCandidate(candidate);
      console.log("🧑‍🎨 : Art cruise dynamic enemies scanned", {
        tileKey,
        count: result.candidates.length,
        nextOffset: result.nextOffset,
        pool: this.candidates.length,
      });
    }
  };

  private getNearbyTileKeys = () => {
    const center = this.map.getCenter();
    const { TLX, TLY } = latLngToTilePixel(center.lat, center.lng);
    return [
      [TLX, TLY],
      [TLX + 1, TLY],
      [TLX - 1, TLY],
      [TLX, TLY + 1],
      [TLX, TLY - 1],
    ].map(([x, y]) => `${x},${y}`);
  };

  private addCandidate = (candidate: DynamicPixelArtEnemyCandidate) => {
    if (this.candidates.length >= DYNAMIC_ENEMY_SCANNER_POOL_LIMIT) {
      const removed = this.candidates.shift();
      removed?.bitmap.close();
    }

    this.candidates.push(candidate);
    this.version += 1;
  };

  private extractCandidates = async (
    tileKey: string,
    blob: Blob,
    cursor: number | undefined,
    maxCandidates: number,
  ): Promise<ScanResult> => {
    // cursor 未設定なら -1 (ランダム開始) を worker/fallback に渡す。
    const startOffset = cursor ?? -1;

    // 優先経路: worker 内で decode (createImageBitmap + OffscreenCanvas) + scan を
    // 一括実行し、メインスレッドの 4MB getImageData/走査を肩代わりさせる。
    const workerResult = await this.extractCandidatesInWorker(
      tileKey,
      blob,
      startOffset,
      maxCandidates,
    );
    if (workerResult) {
      const candidates = await Promise.all(
        workerResult.candidates.map(async (candidate) => ({
          id: candidate.id,
          tileKey,
          bitmap: await createEnemyBitmap(candidate.imageData),
          width: candidate.width,
          height: candidate.height,
          opaquePixels: candidate.opaquePixels,
          scannedAt: performance.now(),
        })),
      );
      return { candidates, nextOffset: workerResult.nextOffset, total: workerResult.total };
    }

    // フォールバック: worker 不在/decode 不可環境ではメインで decode + 走査する。
    const tile = await decodeTile(blob);
    const total = tile.width * tile.height;
    const scanOffset =
      startOffset < 0
        ? Math.floor(Math.random() * total) % (total || 1)
        : startOffset % (total || 1);
    const visited = new Uint8Array(total);
    const queue = new Int32Array(total);
    const candidates: DynamicPixelArtEnemyCandidate[] = [];

    let i = 0;
    for (; i < total; i++) {
      if (i % SCAN_YIELD_INTERVAL === 0) await waitForIdle();
      if (candidates.length >= maxCandidates) break;
      const start = (scanOffset + i) % total;
      if (visited[start] || !this.isOpaque(tile.data, start)) continue;

      const result = await this.extractComponent(tileKey, tile, visited, queue, start);
      if (result) candidates.push(result);
    }

    const nextOffset = i >= total ? 0 : (scanOffset + i) % total;
    return { candidates, nextOffset, total };
  };

  private extractCandidatesInWorker = (
    tileKey: string,
    blob: Blob,
    startOffset: number,
    maxCandidates: number,
  ): Promise<{
    candidates: ExtractedCandidate[];
    nextOffset: number;
    total: number;
  } | null> => {
    const worker = getScannerWorker();
    if (!worker) return Promise.resolve(null);

    return new Promise<{
      candidates: ExtractedCandidate[];
      nextOffset: number;
      total: number;
    } | null>((resolve, reject) => {
      const cleanup = () => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
      };
      const handleMessage = (event: MessageEvent<WorkerScanResponse>) => {
        cleanup();
        if (event.data.error) {
          reject(new Error(event.data.error));
          return;
        }

        resolve({
          candidates: (event.data.candidates ?? []).map((candidate) => ({
            id: candidate.id,
            imageData: new ImageData(
              new Uint8ClampedArray(candidate.buffer),
              candidate.width,
              candidate.height,
            ),
            width: candidate.width,
            height: candidate.height,
            opaquePixels: candidate.opaquePixels,
          })),
          nextOffset: event.data.nextOffset ?? 0,
          total: event.data.total ?? 0,
        });
      };
      const handleError = (error: ErrorEvent) => {
        cleanup();
        reject(error.error ?? new Error(error.message));
      };

      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      // Blob は構造化クローンで worker に渡る (内部データはコピーされず効率的)。
      // worker 側で decode できればメインの 4MB getImageData を完全に省ける。
      worker.postMessage({ tileKey, blob, startOffset, maxCandidates });
    }).catch((error) => {
      console.warn("🧑‍🎨 : Art cruise dynamic enemy worker scan failed", error);
      scannerWorker?.terminate();
      scannerWorker = null;
      return null;
    });
  };

  private extractComponent = async (
    tileKey: string,
    tile: DecodedTile,
    visited: Uint8Array,
    queue: Int32Array,
    start: number,
  ): Promise<DynamicPixelArtEnemyCandidate | null> => {
    let readIndex = 0;
    let writeIndex = 1;
    let minX = start % tile.width;
    let maxX = minX;
    let minY = Math.floor(start / tile.width);
    let maxY = minY;
    let tooLarge = false;

    visited[start] = 1;
    queue[0] = start;

    while (readIndex < writeIndex) {
      if (readIndex % COMPONENT_YIELD_INTERVAL === 0) await waitForIdle();
      const index = queue[readIndex++];
      const x = index % tile.width;
      const y = Math.floor(index / tile.width);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const [offsetX, offsetY] of NEIGHBOR_OFFSETS) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (
          nextX < 0 ||
          nextY < 0 ||
          nextX >= tile.width ||
          nextY >= tile.height
        ) {
          continue;
        }

        const nextIndex = nextY * tile.width + nextX;
        if (visited[nextIndex] || !this.isOpaque(tile.data, nextIndex)) continue;

        visited[nextIndex] = 1;
        queue[writeIndex++] = nextIndex;
        if (writeIndex > DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS) tooLarge = true;
      }
    }

    if (tooLarge) return null;

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    if (!this.isUsableComponent(tile, width, height, writeIndex, minX, minY, maxX, maxY))
      return null;

    const imageData = new ImageData(width, height);
    for (let i = 0; i < writeIndex; i++) {
      const sourceIndex = queue[i];
      const sourceX = sourceIndex % tile.width;
      const sourceY = Math.floor(sourceIndex / tile.width);
      const sourceOffset = sourceIndex * 4;
      const targetOffset = ((sourceY - minY) * width + sourceX - minX) * 4;

      imageData.data[targetOffset] = tile.data[sourceOffset];
      imageData.data[targetOffset + 1] = tile.data[sourceOffset + 1];
      imageData.data[targetOffset + 2] = tile.data[sourceOffset + 2];
      imageData.data[targetOffset + 3] = tile.data[sourceOffset + 3];
    }

    return {
      id: `${tileKey}:${minX},${minY},${width},${height},${writeIndex}`,
      tileKey,
      bitmap: await createEnemyBitmap(imageData),
      width,
      height,
      opaquePixels: writeIndex,
      scannedAt: performance.now(),
    };
  };

  private isUsableComponent = (
    tile: DecodedTile,
    width: number,
    height: number,
    opaquePixels: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) => {
    if (minX === 0 || minY === 0 || maxX === tile.width - 1 || maxY === tile.height - 1)
      return false;
    if (width < DYNAMIC_ENEMY_MIN_SIZE_PX || height < DYNAMIC_ENEMY_MIN_SIZE_PX)
      return false;
    if (width > DYNAMIC_ENEMY_MAX_SIZE_PX || height > DYNAMIC_ENEMY_MAX_SIZE_PX)
      return false;
    if (opaquePixels < DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS) return false;
    return opaquePixels <= DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS;
  };

  private isOpaque = (data: Uint8ClampedArray, pixelIndex: number) =>
    data[pixelIndex * 4 + 3] > DYNAMIC_ENEMY_ALPHA_THRESHOLD;
}
