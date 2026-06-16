import type { Graphics } from "pixi.js";
import {
  getBulletHitbox,
  strokeBulletHitbox,
} from "../enemy/enemy-bullet/hitbox";
import type { ArtCruiseEnemyEntity } from "../enemy";
import type {
  ArtCruisePixiPlayerBullet,
  ArtCruisePixiEnemyBullet,
} from "../enemy/types";

const STROKE_WIDTH = 3;

const drawRect = (
  g: Graphics,
  x: number,
  y: number,
  halfW: number,
  halfH: number,
  color: string,
) =>
  g
    .rect(x - halfW, y - halfH, halfW * 2, halfH * 2)
    .stroke({ color, width: STROKE_WIDTH, alpha: 0.9 });

type HitboxOverlaySources = {
  bullets: readonly ArtCruisePixiPlayerBullet[];
  enemies: readonly ArtCruiseEnemyEntity[];
  enemyBullets: readonly ArtCruisePixiEnemyBullet[];
};

/** デバッグ用に自弾/敵/敵弾の当たり判定矩形を debugGraphics へ描画する */
export const drawDebugHitboxes = (
  g: Graphics,
  { bullets, enemies, enemyBullets }: HitboxOverlaySources,
) => {
  g.clear();

  for (const bullet of bullets)
    drawRect(g, bullet.view.x, bullet.view.y, bullet.halfW, bullet.halfH, "#ff2d55");

  for (const enemy of enemies)
    drawRect(g, enemy.view.x, enemy.view.y, enemy.radius, enemy.radius, "#facc15");

  // 敵弾は判定と同じ hitbox(getBulletHitbox)を描く -> 表示と判定が常に一致
  for (const bullet of enemyBullets)
    strokeBulletHitbox(g, getBulletHitbox(bullet), "#a78bfa", STROKE_WIDTH);
};
