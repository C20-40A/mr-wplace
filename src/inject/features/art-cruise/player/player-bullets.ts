import { Assets, Container, Sprite, Texture } from "pixi.js";
import type { ArtCruisePixiPlayerBullet } from "../enemy/types";
import { SpritePool } from "../sprite-pool";

const BULLET_HEART_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAIklEQVR42mNgAIL/QIBMgxlvZVT+I9NwQRjGqpoBGSALAAAA8zThWRsVXAAAAABJRU5ErkJggg==";
const BULLET_SIZE = 14;
const BULLET_START_Y = -15;
const BULLET_X_OFFSETS = [-22, 0, 22] as const;

/** 当たり判定の矩形half-extent。見た目より一回り大きめにして当てやすくする */
const BULLET_HIT_HALF_W = 10;
const BULLET_HIT_HALF_H = 12;

export const PLAYER_BULLET_SPEED = 760;

let loadedTexture: Texture | null = null;
let bulletTexturePromise: Promise<Texture> | null = null;

const loadBulletTexture = () => {
  if (!bulletTexturePromise)
    bulletTexturePromise = Assets.load<Texture>(BULLET_HEART_DATA_URL).then(
      (texture) => {
        texture.source.scaleMode = "nearest";
        loadedTexture = texture;
        return texture;
      },
    );
  return bulletTexturePromise;
};

const applyTexture = (sprite: Sprite, texture: Texture) => {
  sprite.texture = texture;
  sprite.width = BULLET_SIZE;
  sprite.height = BULLET_SIZE;
};

const acquireBulletSprite = (pool: SpritePool) => {
  const sprite = pool.acquire();
  // ロード済みなら同期で設定、未ロードなら後追いで設定
  if (loadedTexture) applyTexture(sprite, loadedTexture);
  else loadBulletTexture().then((texture) => applyTexture(sprite, texture));
  return sprite;
};

let pool: SpritePool | null = null;

const getPool = (layer: Container) => {
  if (!pool) pool = new SpritePool(layer);
  return pool;
};

export function spawnPlayerBullet(
  shipX: number,
  shipY: number,
  layer: Container,
  bullets: ArtCruisePixiPlayerBullet[],
) {
  const bulletPool = getPool(layer);
  BULLET_X_OFFSETS.forEach((offsetX) => {
    const sprite = acquireBulletSprite(bulletPool);
    sprite.position.set(shipX + offsetX, shipY + BULLET_START_Y);
    layer.addChild(sprite);
    bullets.push({
      view: sprite,
      vy: -PLAYER_BULLET_SPEED,
      halfW: BULLET_HIT_HALF_W,
      halfH: BULLET_HIT_HALF_H,
    });
  });
}

export function updatePlayerBullets(
  bullets: ArtCruisePixiPlayerBullet[],
  deltaSeconds: number,
) {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const bullet = bullets[i];
    bullet.view.y += bullet.vy * deltaSeconds;
    if (bullet.view.y > -80) continue;

    pool?.release(bullet.view);
    const last = bullets.pop();
    if (last && i < bullets.length) bullets[i] = last;
  }
}

export function removePlayerBullet(
  bullets: ArtCruisePixiPlayerBullet[],
  index: number,
) {
  const bullet = bullets[index];
  if (!bullet) return;
  pool?.release(bullet.view);
  const last = bullets.pop();
  if (last && index < bullets.length) bullets[index] = last;
}

/** ゲームリセット時にプール内Spriteを破棄する */
export function destroyPlayerBulletPool() {
  pool?.destroy();
  pool = null;
}
