import { Container } from "pixi.js";
import type { ArtCruisePixiEnemyBullet } from "./types";
import { updatePixiEnemyBulletMovement } from "./enemy-bullet-movement";
import { createPixiEnemyBulletView } from "./enemy-bullet";
import { getBulletType } from "./enemy-bullet/bullet-types";
import { BulletViewPool } from "../sprite-pool";
import type { ArtCruiseEnemyBulletSpawn } from "./enemy-rules/types";

type BoundaryHit = {
  x: number;
  y: number;
  angle: number;
};

type BulletPosition = {
  x: number;
  y: number;
  radius: number;
};

const getBoundaryHit = (
  bullet: ArtCruisePixiEnemyBullet,
  bounds: { width: number; height: number },
): BoundaryHit | null => {
  const x0 = bullet.originX;
  const y0 = bullet.originY;
  const x1 = bullet.view.x;
  const y1 = bullet.view.y;

  if (x1 >= 0 && x1 <= bounds.width && y1 >= 0 && y1 <= bounds.height)
    return null;

  const dx = x1 - x0;
  const dy = y1 - y0;
  let hit: BoundaryHit | null = null;
  let bestT = Infinity;

  const check = (t: number, axis: "x" | "y") => {
    if (t < 0 || t > 1 || t >= bestT) return;
    const x = x0 + dx * t;
    const y = y0 + dy * t;
    if (x < -1 || x > bounds.width + 1 || y < -1 || y > bounds.height + 1)
      return;
    bestT = t;
    hit = {
      x,
      y,
      angle: axis === "x" ? Math.PI - bullet.angle : -bullet.angle,
    };
  };

  if (dx < 0) check((0 - x0) / dx, "x");
  if (dx > 0) check((bounds.width - x0) / dx, "x");
  if (dy < 0) check((0 - y0) / dy, "y");
  if (dy > 0) check((bounds.height - y0) / dy, "y");

  return hit;
};

export class ArtCruiseEnemyBulletManager {
  private bullets: ArtCruisePixiEnemyBullet[] = [];
  private readonly pool = new BulletViewPool();

  constructor(
    private readonly container: Container,
    private readonly maxCount: number,
  ) {}

  addBullets(
    spawns: ArtCruiseEnemyBulletSpawn[],
    originX: number,
    originY: number,
    now: number,
  ) {
    for (const spawn of spawns) {
      if (this.bullets.length >= this.maxCount) {
        this.removeBulletAt(0);
      }

      const radius = spawn.size ?? 7;
      const origin = spawn.origin ?? { x: originX, y: originY };
      const pooled = createPixiEnemyBulletView(this.pool, radius, {
        shape: spawn.shape,
        length: spawn.length,
        bulletColor: spawn.bulletColor,
        bulletVariant: spawn.bulletVariant,
      });
      const { view } = pooled;
      view.position.set(origin.x, origin.y);
      view.rotation =
        spawn.rotateToAngle === false
          ? 0
          : spawn.angle + (spawn.rotationOffset ?? 0);
      view.visible = !spawn.delayMs;
      this.container.addChild(view);

      const bulletType = getBulletType(
        spawn.shape,
        spawn.bulletColor,
        spawn.bulletVariant,
      );
      const dirX = Math.cos(spawn.angle);
      const dirY = Math.sin(spawn.angle);
      const moveDirX =
        spawn.moveAngle === undefined ? undefined : Math.cos(spawn.moveAngle);
      const moveDirY =
        spawn.moveAngle === undefined ? undefined : Math.sin(spawn.moveAngle);

      this.bullets.push({
        view,
        pooled,
        originX: origin.x,
        originY: origin.y,
        angle: spawn.angle,
        dirX,
        dirY,
        moveDirX,
        moveDirY,
        speed: spawn.speed * 74,
        accel: spawn.accel != null ? spawn.accel * 74 : undefined,
        minSpeed: spawn.minSpeed != null ? spawn.minSpeed * 74 : undefined,
        radius,
        hitRadius: radius * bulletType.hitScale,
        bornAt: now + (spawn.delayMs ?? 0),
        splitOnBoundary: spawn.splitOnBoundary,
        maxAgeMs: spawn.maxAgeMs,
        shape: bulletType.hitShape,
        radiusY: bulletType.radiusYRatio
          ? radius * bulletType.radiusYRatio
          : undefined,
        length: spawn.length,
        warningMs: spawn.warningMs,
        trailMs: spawn.trailMs,
        bulletColor: spawn.bulletColor,
        bulletVariant: spawn.bulletVariant,
        rotateToAngle: spawn.rotateToAngle,
        rotationOffset: spawn.rotationOffset,
      });
    }
  }

  update(now: number, bounds: { width: number; height: number }) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i];
      updatePixiEnemyBulletMovement(bullet, now);
      const splitSpawn = this.takeBoundarySplitSpawn(bullet, now, bounds);
      if (splitSpawn?.origin)
        this.addBullets([splitSpawn], splitSpawn.origin.x, splitSpawn.origin.y, now);

      if (bullet.maxAgeMs && now - bullet.bornAt > bullet.maxAgeMs) {
        this.removeBulletAt(i);
        continue;
      }

      // 画面内に少しでも残っているなら続行
      // レーザー(capsule)は後方端も考慮: 先頭から-length方向にbodyが伸びる
      const tailOffset = bullet.shape === "capsule" && bullet.length ? bullet.length : 0;
      const headOffset = bullet.shape === "rect" && bullet.length ? bullet.length : 0;
      const tailX = bullet.view.x - bullet.dirX * tailOffset;
      const tailY = bullet.view.y - bullet.dirY * tailOffset;
      const headX = bullet.view.x + bullet.dirX * headOffset;
      const headY = bullet.view.y + bullet.dirY * headOffset;
      const minX = Math.min(bullet.view.x, tailX, headX) - bullet.radius;
      const maxX = Math.max(bullet.view.x, tailX, headX) + bullet.radius;
      const minY = Math.min(bullet.view.y, tailY, headY) - bullet.radius;
      const maxY = Math.max(bullet.view.y, tailY, headY) + bullet.radius;
      if (maxX >= 0 && minX <= bounds.width && maxY >= 0 && minY <= bounds.height) {
        continue;
      }

      this.removeBulletAt(i);
    }
  }

  private removeBulletAt(index: number) {
    const bullet = this.bullets[index];
    if (!bullet) return;

    this.pool.release(bullet.pooled);
    const last = this.bullets.pop();
    if (last && index < this.bullets.length) this.bullets[index] = last;
  }

  get activeBullets() {
    return this.bullets;
  }

  get activeBulletCount() {
    return this.bullets.length;
  }

  clearForEnemyDefeat(now: number, maxSamples = 90): BulletPosition[] {
    let visibleCount = 0;
    for (const bullet of this.bullets)
      if (bullet.view.visible && now >= bullet.bornAt) visibleCount++;

    const step = Math.max(1, Math.ceil(visibleCount / maxSamples));
    const positions: BulletPosition[] = [];
    let visibleIndex = 0;

    for (const bullet of this.bullets) {
      if (!bullet.view.visible || now < bullet.bornAt) continue;
      if (visibleIndex++ % step !== 0) continue;
      positions.push({
        x: bullet.view.x,
        y: bullet.view.y,
        radius: bullet.radius,
      });
    }

    this.reset();
    return positions;
  }

  private takeBoundarySplitSpawn(
    bullet: ArtCruisePixiEnemyBullet,
    now: number,
    bounds: { width: number; height: number },
  ): ArtCruiseEnemyBulletSpawn | null {
    if (
      !bullet.splitOnBoundary ||
      bullet.boundarySplitDone ||
      now < bullet.bornAt
    )
      return null;

    const hit = getBoundaryHit(bullet, bounds);
    if (!hit) return null;

    bullet.boundarySplitDone = true;
    return {
      origin: { x: hit.x, y: hit.y },
      angle: hit.angle,
      moveAngle: hit.angle,
      speed: bullet.speed / 74,
      minSpeed: bullet.minSpeed === undefined ? undefined : bullet.minSpeed / 74,
      size: bullet.radius,
      maxAgeMs: bullet.maxAgeMs,
      shape: bullet.shape === "capsule" ? "laser" : "circle",
      length: bullet.length,
      warningMs: bullet.warningMs,
      trailMs: bullet.trailMs,
      bulletColor: bullet.bulletColor,
      bulletVariant: bullet.bulletVariant,
      rotateToAngle: bullet.rotateToAngle,
      rotationOffset: bullet.rotationOffset,
    };
  }

  reset() {
    for (const bullet of this.bullets) {
      this.pool.release(bullet.pooled);
    }
    this.bullets = [];
  }
}
