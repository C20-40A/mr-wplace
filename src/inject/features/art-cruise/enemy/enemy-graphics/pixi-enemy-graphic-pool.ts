import { Texture } from "pixi.js";
import {
  DYNAMIC_ENEMY_POOL_LIMIT,
  DYNAMIC_ENEMY_SIZE_UNITS,
  ENEMY_BOSS_SIZE_UNITS,
} from "../../constants";
import { getEnemyDefinition, getRandomGruntDefinition } from "../enemy-rules/enemy-definitions";
import type {
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyConfig,
  ArtCruiseEnemyMovementId,
  ArtCruiseEnemyRank,
} from "../enemy-rules/types";
import type {
  DynamicPixelArtEnemyCandidate,
  DynamicPixelArtEnemyScanner,
} from "./dynamic-pixel-art-scanner";

/** take() で払い出される敵 1 体分のアセット。take 毎に def を付与して生成する。 */
export type ArtCruisePixiDynamicEnemyAsset = {
  id: string;
  texture: Texture;
  aspect: number;
  config: ArtCruiseEnemyConfig;
  movement: ArtCruiseEnemyMovementId;
  getBulletPattern: () => ArtCruiseEnemyBulletPatternId;
  radius: number;
};

/** pool が保持する画像 + メタ情報。rank/def は持たず、take 時に動的判定する。 */
type PooledGraphic = {
  id: string;
  texture: Texture;
  aspect: number;
  size: number;
  createdAt: number;
  lastUsedAt: number;
  // 表示中の敵がこの texture を共有する数。0 になるまで破棄しない。
  refCount: number;
  // pool から退避済みだが使用中のため破棄を保留している
  pendingDestroy: boolean;
};

/** 上位 N 個の最大画像を boss 候補とする */
const BOSS_TOP_COUNT = 2;

const createTextureCanvas = (
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

export class ArtCruisePixiEnemyGraphicPool {
  // size 降順は take 時に都度評価。pool 自体は投入順 (createdAt 昇順) を保つ。
  private readonly pool: PooledGraphic[] = [];
  private readonly ids = new Set<string>();
  // id -> graphic。pool 退避後も release で破棄判定するため参照を保持する。
  private readonly byId = new Map<string, PooledGraphic>();
  private syncedScannerVersion = -1;

  constructor(
    private readonly scanner: DynamicPixelArtEnemyScanner,
    private readonly getUnitScale: () => number,
  ) {}

  update = () => {
    const version = this.scanner.getVersion();
    if (version === this.syncedScannerVersion) return;
    this.syncedScannerVersion = version;

    for (const candidate of this.scanner.getCandidates()) {
      if (this.ids.has(candidate.id)) continue;
      this.enqueue(candidate);
    }
  };

  take = (rank?: ArtCruiseEnemyRank) => {
    if (!this.pool.length) return null;

    const sorted = [...this.pool].sort((a, b) => b.size - a.size);
    const bossSet = new Set(sorted.slice(0, BOSS_TOP_COUNT));
    const wantBoss = rank === "boss";

    const candidates = this.pool.filter((g) =>
      wantBoss ? bossSet.has(g) : !bossSet.has(g),
    );
    // 対象 rank の候補が空なら反対側にフォールバックして枯渇を避ける。
    const graphic = this.pickLeastRecent(candidates.length ? candidates : this.pool);
    if (!graphic) return null;

    graphic.lastUsedAt = performance.now();
    graphic.refCount += 1;
    const resolvedRank: ArtCruiseEnemyRank =
      wantBoss && candidates.length ? "boss" : rank ?? "grunt";
    return this.buildAsset(graphic, resolvedRank);
  };

  // 敵除去時に呼ぶ。使用中 (refCount>0) は破棄せず、退避保留中なら 0 で破棄する。
  release = (id: string) => {
    const graphic = this.byId.get(id);
    if (!graphic) return;
    graphic.refCount = Math.max(0, graphic.refCount - 1);
    if (graphic.refCount === 0 && graphic.pendingDestroy) {
      this.byId.delete(id);
      graphic.texture.destroy(true);
    }
  };

  destroy = () => {
    for (const graphic of this.byId.values()) graphic.texture.destroy(true);
    this.pool.length = 0;
    this.ids.clear();
    this.byId.clear();
  };

  private enqueue = (candidate: DynamicPixelArtEnemyCandidate) => {
    const graphic: PooledGraphic = {
      id: candidate.id,
      texture: this.createTexture(candidate.bitmap),
      aspect: candidate.width / candidate.height,
      size: this.getCandidateSize(candidate),
      createdAt: performance.now(),
      lastUsedAt: 0,
      refCount: 0,
      pendingDestroy: false,
    };
    this.pool.push(graphic);
    this.ids.add(graphic.id);
    this.byId.set(graphic.id, graphic);

    // 24 超は投入時刻が最古のものから out (最終アクセスは無関係)。
    while (this.pool.length > DYNAMIC_ENEMY_POOL_LIMIT) {
      const removed = this.pool.shift();
      if (!removed) break;
      this.ids.delete(removed.id);
      // 表示中の敵が共有していたら破棄を保留し、release で 0 になってから破棄する。
      if (removed.refCount > 0) {
        removed.pendingDestroy = true;
        continue;
      }
      this.byId.delete(removed.id);
      removed.texture.destroy(true);
    }
  };

  // 未使用 (refCount=0) を優先し、その中で最終アクセスが古いものを選ぶ。
  // 同一 texture の同時共有を減らし、退避時の破棄保留を起きにくくする。
  private pickLeastRecent = (graphics: PooledGraphic[]) => {
    const isBetter = (g: PooledGraphic, best: PooledGraphic) => {
      const gFree = g.refCount === 0;
      const bestFree = best.refCount === 0;
      if (gFree !== bestFree) return gFree;
      return g.lastUsedAt < best.lastUsedAt;
    };
    let best: PooledGraphic | null = null;
    for (const graphic of graphics) {
      if (!best || isBetter(graphic, best)) best = graphic;
    }
    return best;
  };

  private buildAsset = (
    graphic: PooledGraphic,
    rank: ArtCruiseEnemyRank,
  ): ArtCruisePixiDynamicEnemyAsset => {
    const def = this.getDefinition(rank);
    return {
      id: graphic.id,
      texture: graphic.texture,
      aspect: graphic.aspect,
      config: def.createConfig(),
      movement: def.movement,
      getBulletPattern: def.getBulletPattern,
      radius: this.getRadius(rank),
    };
  };

  private createTexture = (bitmap: ImageBitmap) => {
    const canvas = createTextureCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error("Failed to create art cruise enemy texture");

    ctx.drawImage(bitmap, 0, 0);

    const texture = Texture.from(canvas);
    texture.source.scaleMode = "nearest";
    return texture;
  };

  private getCandidateSize = (candidate: DynamicPixelArtEnemyCandidate) =>
    candidate.opaquePixels * 10_000 + candidate.width * candidate.height;

  private getDefinition = (rank: ArtCruiseEnemyRank) => {
    if (rank === "boss") return getEnemyDefinition("bossDrone")!;
    return getRandomGruntDefinition()!;
  };

  private getRadius = (rank: ArtCruiseEnemyRank) => {
    const size =
      rank === "boss" ? ENEMY_BOSS_SIZE_UNITS : DYNAMIC_ENEMY_SIZE_UNITS;
    return size * this.getUnitScale() * 0.46;
  };
}
