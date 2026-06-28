import { latLngToTilePixel } from "@/utils/coordinate";
import type { WplaceMap } from "@/inject/types";
import {
  DYNAMIC_ENEMY_ALPHA_THRESHOLD,
  DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE,
  DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MIN_SIZE_PX,
  DYNAMIC_ENEMY_SCAN_INTERVAL_MS,
  DYNAMIC_ENEMY_SCAN_TILE_LIMIT,
  DYNAMIC_ENEMY_SCANNER_POOL_LIMIT,
  getDynamicEnemyMaxSizePx,
} from "../../constants";
import {
  getOriginalBlob,
  getOriginalBlobKeys,
  getOriginalLastModified,
} from "../../../tile-draw/last-modified-cache";
import { createEnemyBitmap } from "./enemy-bitmap-renderer";
import type { ArtCruiseDynamicEnemyCandidate } from "./pixi-enemy-graphic-pool";

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

type RawScanCandidate = {
  id: string;
  width: number;
  height: number;
  opaquePixels: number;
  data: Uint8ClampedArray;
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
  visitedBuffer?: ArrayBuffer;
  error?: string;
};

type ScanResult = {
  candidates: ArtCruiseDynamicEnemyCandidate[];
  // 次回スキャン再開位置 (px index)。全走査済みなら 0。total は走査範囲のpx総数。
  nextOffset: number;
  total: number;
};

type TileScanCache = {
  version: string;
  visited: Uint8Array;
  total: number;
  lastUsedAt: number;
};

type ScanConfig = {
  alphaThreshold: number;
  minSize: number;
  minOpaque: number;
  maxOpaque: number;
  scanYieldInterval: number;
  componentYieldInterval: number;
  neighborOffsets: readonly (readonly [number, number])[];
};

const NEIGHBOR_OFFSETS = [
  [0, -1],
  [-1, 0],
  [1, 0],
  [0, 1],
] as const;

const SCAN_YIELD_INTERVAL = 4096;
const COMPONENT_YIELD_INTERVAL = 2048;
const TILE_SCAN_CACHE_LIMIT = 8;
const NEARBY_CACHE_TILE_RADIUS = 3;

const DYNAMIC_SCAN_CONFIG: ScanConfig = {
  alphaThreshold: DYNAMIC_ENEMY_ALPHA_THRESHOLD,
  minSize: DYNAMIC_ENEMY_MIN_SIZE_PX,
  minOpaque: DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS,
  maxOpaque: DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS,
  scanYieldInterval: SCAN_YIELD_INTERVAL,
  componentYieldInterval: COMPONENT_YIELD_INTERVAL,
  neighborOffsets: NEIGHBOR_OFFSETS,
};

const waitForIdle = () =>
  new Promise<void>((resolve) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 120 });
      return;
    }

    globalThis.setTimeout(resolve, 16);
  });

const scanPixelArtCandidates = async (
  config: ScanConfig,
  tileKey: string,
  width: number,
  height: number,
  data: Uint8ClampedArray,
  visited: Uint8Array,
  startOffset: number,
  maxCandidates: number,
  maxSize: number,
  wait?: () => Promise<void>,
): Promise<{
  candidates: RawScanCandidate[];
  nextOffset: number;
  total: number;
}> => {
  const isOpaque = (pixelIndex: number) =>
    data[pixelIndex * 4 + 3] > config.alphaThreshold;

  const isUsableComponent = (
    componentWidth: number,
    componentHeight: number,
    opaquePixels: number,
    minX: number,
    minY: number,
    maxX: number,
    maxY: number,
  ) => {
    if (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1)
      return false;
    if (componentWidth < config.minSize || componentHeight < config.minSize)
      return false;
    if (componentWidth > maxSize || componentHeight > maxSize) return false;
    if (opaquePixels < config.minOpaque) return false;
    return opaquePixels <= config.maxOpaque;
  };

  const extractComponent = async (start: number, queue: Int32Array) => {
    let readIndex = 0;
    let writeIndex = 1;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    let tooLarge = false;

    visited[start] = 1;
    queue[0] = start;

    while (readIndex < writeIndex) {
      if (wait && readIndex % config.componentYieldInterval === 0) await wait();

      const index = queue[readIndex++];
      const x = index % width;
      const y = Math.floor(index / width);

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      for (const [offsetX, offsetY] of config.neighborOffsets) {
        const nextX = x + offsetX;
        const nextY = y + offsetY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height)
          continue;

        const nextIndex = nextY * width + nextX;
        if (visited[nextIndex] || !isOpaque(nextIndex)) continue;

        visited[nextIndex] = 1;
        queue[writeIndex++] = nextIndex;
        if (writeIndex > config.maxOpaque) tooLarge = true;
      }
    }

    if (tooLarge) return null;

    const componentWidth = maxX - minX + 1;
    const componentHeight = maxY - minY + 1;
    if (!isUsableComponent(
      componentWidth,
      componentHeight,
      writeIndex,
      minX,
      minY,
      maxX,
      maxY,
    ))
      return null;

    const output = new Uint8ClampedArray(componentWidth * componentHeight * 4);
    for (let i = 0; i < writeIndex; i++) {
      const sourceIndex = queue[i];
      const sourceX = sourceIndex % width;
      const sourceY = Math.floor(sourceIndex / width);
      const sourceOffset = sourceIndex * 4;
      const targetOffset = ((sourceY - minY) * componentWidth + sourceX - minX) * 4;

      output[targetOffset] = data[sourceOffset];
      output[targetOffset + 1] = data[sourceOffset + 1];
      output[targetOffset + 2] = data[sourceOffset + 2];
      output[targetOffset + 3] = data[sourceOffset + 3];
    }

    return {
      id: `${tileKey}:${minX},${minY},${componentWidth},${componentHeight},${writeIndex}`,
      width: componentWidth,
      height: componentHeight,
      opaquePixels: writeIndex,
      data: output,
    };
  };

  const total = width * height;
  const scanOffset =
    startOffset < 0
      ? Math.floor(Math.random() * total) % (total || 1)
      : startOffset % (total || 1);
  const queue = new Int32Array(total);
  const candidates: RawScanCandidate[] = [];

  let i = 0;
  for (; i < total; i++) {
    if (wait && i % config.scanYieldInterval === 0) await wait();
    if (candidates.length >= maxCandidates) break;

    const start = (scanOffset + i) % total;
    if (visited[start] || !isOpaque(start)) continue;

    const result = await extractComponent(start, queue);
    if (result) candidates.push(result);
  }

  const nextOffset = i >= total ? 0 : (scanOffset + i) % total;
  return { candidates, nextOffset, total };
};

const buildScannerWorkerSource = () => `
  const DYNAMIC_SCAN_CONFIG = ${JSON.stringify(DYNAMIC_SCAN_CONFIG)};
  const scanPixelArtCandidates = ${scanPixelArtCandidates.toString()};

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
      const { tileKey, blob, startOffset, maxCandidates, maxSize, visitedBuffer } = event.data;
      const decoded = await decodeInWorker(blob);
      const total = decoded.width * decoded.height;
      const visited = visitedBuffer && visitedBuffer.byteLength === total
        ? new Uint8Array(visitedBuffer)
        : new Uint8Array(total);
      const { candidates, nextOffset } = await scanPixelArtCandidates(
        DYNAMIC_SCAN_CONFIG,
        tileKey,
        decoded.width,
        decoded.height,
        decoded.data,
        visited,
        startOffset,
        maxCandidates,
        maxSize,
      );
      self.postMessage({
        candidates: candidates.map((candidate) => ({
          id: candidate.id,
          width: candidate.width,
          height: candidate.height,
          opaquePixels: candidate.opaquePixels,
          buffer: candidate.data.buffer,
        })),
        nextOffset,
        total,
        visitedBuffer: visited.buffer,
      }, [
        visited.buffer,
        ...candidates.map((candidate) => candidate.data.buffer),
      ]);
    } catch (error) {
      self.postMessage({ error: error instanceof Error ? error.message : String(error) });
    }
  };
`;

let scannerWorker: Worker | null | undefined;

const getScannerWorker = () => {
  if (scannerWorker !== undefined) return scannerWorker;

  try {
    const source = buildScannerWorkerSource();
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

const parseTileKey = (tileKey: string) => {
  const [x, y] = tileKey.split(",").map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  return { x, y };
};

export class DynamicPixelArtEnemyScanner {
  private readonly candidates: ArtCruiseDynamicEnemyCandidate[] = [];
  private readonly tileVersions = new Map<string, string>();
  private readonly completedVersions = new Map<string, string>();
  // tile ごとの次回スキャン開始 px index。pool が埋まるまで続きから網羅走査する。
  private readonly scanCursors = new Map<string, number>();
  // tile/version ごとの連結成分訪問済み bitmap。途中終了した続きで同じ成分を掘り直さない。
  private readonly scanCaches = new Map<string, TileScanCache>();
  private maxSizePx = getDynamicEnemyMaxSizePx();
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

  setMaxSizePx = (sizePx: number) => {
    if (this.maxSizePx === sizePx) return;

    this.maxSizePx = sizePx;
    this.clearCandidates();
    this.tileVersions.clear();
    this.completedVersions.clear();
    this.scanCursors.clear();
    this.scanCaches.clear();
    this.lastScanAt = -DYNAMIC_ENEMY_SCAN_INTERVAL_MS;
    this.version += 1;
  };

  destroy = () => {
    this.clearCandidates();
    this.tileVersions.clear();
    this.completedVersions.clear();
    this.scanCursors.clear();
    this.scanCaches.clear();
    scannerWorker?.terminate();
    scannerWorker = undefined;
  };

  private scanNearbyTiles = async () => {
    let scannedCount = 0;
    let foundCount = 0;
    let skippedNoBlob = 0;
    let skippedCompleted = 0;
    const nearbyTileKeys = this.getNearbyTileKeys();
    const centerTileKey = nearbyTileKeys[0] ?? "";
    this.pruneScanCaches(new Set(nearbyTileKeys));

    for (const tileKey of nearbyTileKeys) {
      if (scannedCount >= DYNAMIC_ENEMY_SCAN_TILE_LIMIT) break;

      const blob = getOriginalBlob(tileKey);
      if (!blob) {
        skippedNoBlob += 1;
        continue;
      }

      const version = `${getOriginalLastModified(tileKey) ?? "unknown"}:${blob.size}`;
      const versionChanged = this.tileVersions.get(tileKey) !== version;
      if (versionChanged) {
        // タイル内容が変わったらカーソルをリセットして最初から走査し直す。
        this.tileVersions.set(tileKey, version);
        this.completedVersions.delete(tileKey);
        this.scanCursors.delete(tileKey);
        this.scanCaches.delete(tileKey);
      } else if (this.completedVersions.get(tileKey) === version) {
        // 未更新タイルで一周走査済み (cursor 削除済み) なら再走査しない。
        // stop 条件は「タイル内を一周しきった」に一本化している。
        skippedCompleted += 1;
        continue;
      }

      scannedCount += 1;

      await waitForIdle();
      // pool 満杯時は古い候補を 1 体ずつ入れ替えるよう取得数を 1 に絞る (緩やかな新陳代謝)。
      const poolFull = this.candidates.length >= DYNAMIC_ENEMY_SCANNER_POOL_LIMIT;
      const maxCandidates = poolFull ? 1 : DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE;
      // 初回 (cursor 未設定) はランダム開始、以降は前回の続きから網羅走査する。
      const cursor = this.scanCursors.get(tileKey);
      const maxSizePx = this.maxSizePx;
      const result = await this.extractCandidates(
        tileKey,
        blob,
        version,
        cursor,
        maxCandidates,
        maxSizePx,
      );
      if (this.maxSizePx !== maxSizePx) {
        for (const candidate of result.candidates) candidate.bitmap.close();
        continue;
      }

      // nextOffset===0 は一周完了。次回以降はタイル更新まで走査しない。
      if (result.nextOffset === 0) {
        this.scanCursors.delete(tileKey);
        this.scanCaches.delete(tileKey);
        this.completedVersions.set(tileKey, version);
      } else {
        this.scanCursors.set(tileKey, result.nextOffset);
      }

      foundCount += result.candidates.length;

      for (const candidate of result.candidates) this.addCandidate(candidate);
      console.log("🧑‍🎨 : Art cruise dynamic enemies scanned", {
        tileKey,
        count: result.candidates.length,
        nextOffset: result.nextOffset,
        completed: result.nextOffset === 0,
        pool: this.candidates.length,
      });
    }

    console.log("🧑‍🎨 : Art cruise dynamic enemy scan tick", {
      centerTileKey,
      candidates: foundCount,
      scanned: scannedCount,
      skippedCompleted,
      skippedNoBlob,
      queued: nearbyTileKeys.length,
    });
  };

  private getNearbyTileKeys = () => {
    const center = this.map.getCenter();
    const { TLX, TLY } = latLngToTilePixel(center.lat, center.lng);
    const fixedTileKeys = [
      [TLX, TLY],
      [TLX, TLY - 1],
      [TLX + 1, TLY - 1],
      [TLX - 1, TLY - 1],
      [TLX + 1, TLY],
      [TLX - 1, TLY],
      [TLX, TLY + 1],
      [TLX + 1, TLY + 1],
      [TLX - 1, TLY + 1],
      [TLX, TLY - 2],
    ].map(([x, y]) => `${x},${y}`);
    const seen = new Set(fixedTileKeys);
    const cachedTileKeys = getOriginalBlobKeys()
      .filter((tileKey) => {
        if (seen.has(tileKey)) return false;

        const tile = parseTileKey(tileKey);
        if (!tile) return false;

        const dx = tile.x - TLX;
        const dy = tile.y - TLY;
        return (
          Math.abs(dx) <= NEARBY_CACHE_TILE_RADIUS &&
          Math.abs(dy) <= NEARBY_CACHE_TILE_RADIUS
        );
      })
      .sort((a, b) => {
        const tileA = parseTileKey(a);
        const tileB = parseTileKey(b);
        if (!tileA || !tileB) return 0;

        const dxA = Math.abs(tileA.x - TLX);
        const dyA = tileA.y - TLY;
        const dxB = Math.abs(tileB.x - TLX);
        const dyB = tileB.y - TLY;
        const scoreA = Math.abs(dyA) * 2 + dxA + (dyA > 0 ? 4 : 0);
        const scoreB = Math.abs(dyB) * 2 + dxB + (dyB > 0 ? 4 : 0);
        return scoreA - scoreB;
      });

    return [...fixedTileKeys, ...cachedTileKeys];
  };

  private addCandidate = (candidate: ArtCruiseDynamicEnemyCandidate) => {
    if (this.candidates.length >= DYNAMIC_ENEMY_SCANNER_POOL_LIMIT) {
      const removed = this.candidates.shift();
      removed?.bitmap.close();
    }

    this.candidates.push(candidate);
    this.version += 1;
  };

  private clearCandidates = () => {
    for (const candidate of this.candidates) candidate.bitmap.close();
    this.candidates.length = 0;
  };

  private getCachedVisited = (tileKey: string, version: string) => {
    const cache = this.scanCaches.get(tileKey);
    if (!cache || cache.version !== version) return undefined;
    cache.lastUsedAt = performance.now();
    return cache.visited;
  };

  private setScanCache = (
    tileKey: string,
    version: string,
    total: number,
    visited: Uint8Array,
  ) => {
    this.scanCaches.set(tileKey, {
      version,
      visited,
      total,
      lastUsedAt: performance.now(),
    });
    this.pruneScanCaches();
  };

  private getOrCreateScanCache = (tileKey: string, version: string, total: number) => {
    const cache = this.scanCaches.get(tileKey);
    if (cache?.version === version && cache.total === total) {
      cache.lastUsedAt = performance.now();
      return cache;
    }

    const next = {
      version,
      visited: new Uint8Array(total),
      total,
      lastUsedAt: performance.now(),
    };
    this.scanCaches.set(tileKey, next);
    this.pruneScanCaches();
    return next;
  };

  private pruneScanCaches = (activeTileKeys?: Set<string>) => {
    if (activeTileKeys) {
      for (const tileKey of this.scanCaches.keys()) {
        if (!activeTileKeys.has(tileKey)) this.scanCaches.delete(tileKey);
      }
    }

    while (this.scanCaches.size > TILE_SCAN_CACHE_LIMIT) {
      let oldestKey: string | null = null;
      let oldestAt = Infinity;
      for (const [tileKey, cache] of this.scanCaches) {
        if (cache.lastUsedAt >= oldestAt) continue;
        oldestKey = tileKey;
        oldestAt = cache.lastUsedAt;
      }
      if (!oldestKey) return;
      this.scanCaches.delete(oldestKey);
    }
  };

  private extractCandidates = async (
    tileKey: string,
    blob: Blob,
    version: string,
    cursor: number | undefined,
    maxCandidates: number,
    maxSizePx: number,
  ): Promise<ScanResult> => {
    // cursor 未設定なら -1 (ランダム開始) を worker/fallback に渡す。
    const startOffset = cursor ?? -1;

    // 優先経路: worker 内で decode (createImageBitmap + OffscreenCanvas) + scan を
    // 一括実行し、メインスレッドの 4MB getImageData/走査を肩代わりさせる。
    const workerResult = await this.extractCandidatesInWorker(
      tileKey,
      blob,
      version,
      startOffset,
      maxCandidates,
      maxSizePx,
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
    const cache = this.getOrCreateScanCache(tileKey, version, total);
    const result = await scanPixelArtCandidates(
      DYNAMIC_SCAN_CONFIG,
      tileKey,
      tile.width,
      tile.height,
      tile.data,
      cache.visited,
      startOffset,
      maxCandidates,
      maxSizePx,
      waitForIdle,
    );
    const candidates = await Promise.all(
      result.candidates.map(async (candidate) => ({
        id: candidate.id,
        tileKey,
        bitmap: await createEnemyBitmap(
          new ImageData(
            new Uint8ClampedArray(candidate.data),
            candidate.width,
            candidate.height,
          ),
        ),
        width: candidate.width,
        height: candidate.height,
        opaquePixels: candidate.opaquePixels,
        scannedAt: performance.now(),
      })),
    );
    return { candidates, nextOffset: result.nextOffset, total };
  };

  private extractCandidatesInWorker = (
    tileKey: string,
    blob: Blob,
    version: string,
    startOffset: number,
    maxCandidates: number,
    maxSizePx: number,
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

        if (event.data.visitedBuffer && event.data.total)
          this.setScanCache(
            tileKey,
            version,
            event.data.total,
            new Uint8Array(event.data.visitedBuffer),
          );

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
      worker.postMessage({
        tileKey,
        blob,
        startOffset,
        maxCandidates,
        maxSize: maxSizePx,
        visitedBuffer: this.getCachedVisited(tileKey, version)?.buffer,
      });
    }).catch((error) => {
      console.warn("🧑‍🎨 : Art cruise dynamic enemy worker scan failed", error);
      scannerWorker?.terminate();
      scannerWorker = null;
      return null;
    });
  };
}
