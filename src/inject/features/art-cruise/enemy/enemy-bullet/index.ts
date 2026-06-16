import { Assets, Sprite, Texture } from "pixi.js";
import {
  BEAM_RED_DATA_URL,
  BULLET_CAPSULE_GREEN_DATA_URL,
  BULLET_COLOR_DATA_URLS,
  LAUNCHER_DATA_URL,
} from "./data-urls";
import type { ArtCruiseBulletSpawnShape } from "./bullet-types";
import type { ArtCruiseBulletColor } from "../enemy-rules/types";
import type { BulletViewPool, PooledBulletView } from "../../sprite-pool";

type EnemyBulletViewOptions = {
  shape?: ArtCruiseBulletSpawnShape;
  length?: number;
  /** circle弾の色アート選択。未指定はblue。 */
  bulletColor?: ArtCruiseBulletColor;
};

// ロード完了済みTexture。プール再利用時に同期適用してチラつきを防ぐ。
const loadedTextureCache: Record<string, Texture | undefined> = {};
const texturePromiseCache: Record<string, Promise<Texture> | null> = {};
const pendingTextureKeys = new WeakMap<Sprite, string>();

// circle弾(色別) + 特殊弾のdata-urlを一元化。キーがそのままテクスチャ識別子。
const DATA_URLS: Record<string, string> = {
  ...BULLET_COLOR_DATA_URLS,
  beam: BEAM_RED_DATA_URL,
  launcher: LAUNCHER_DATA_URL,
  capsuleGreen: BULLET_CAPSULE_GREEN_DATA_URL,
};

const loadTexture = (key: string): Promise<Texture> => {
  if (!texturePromiseCache[key])
    texturePromiseCache[key] = Assets.load<Texture>(DATA_URLS[key]).then(
      (texture) => {
        texture.source.scaleMode = "nearest";
        loadedTextureCache[key] = texture;
        return texture;
      },
    );
  return texturePromiseCache[key]!;
};

// ロード済みなら同期で適用、未ロードなら後追いで適用する。
const applyTexture = (
  sprite: Sprite,
  key: string,
  apply: (s: Sprite) => void,
) => {
  pendingTextureKeys.set(sprite, key);
  const loaded = loadedTextureCache[key];
  if (loaded) {
    sprite.texture = loaded;
    apply(sprite);
    return;
  }
  loadTexture(key).then((texture) => {
    if (pendingTextureKeys.get(sprite) !== key) return;
    sprite.texture = texture;
    apply(sprite);
  });
};

// プールから借りたSpriteは前の弾の状態が残るため、形状ごとに全プロパティを上書きする。
const resetSprite = (sprite: Sprite) => {
  sprite.anchor.set(0.5);
  sprite.rotation = 0;
  sprite.blendMode = "add";
  sprite.alpha = 1;
};

export const createPixiEnemyBulletView = (
  pool: BulletViewPool,
  radius = 7,
  options: EnemyBulletViewOptions = {},
): PooledBulletView => {
  const pooled = pool.acquire();
  resetSprite(pooled.sprite);

  if (options.shape === "laser")
    configureLaser(pooled.sprite, radius, options.length ?? 120);
  else if (options.shape === "muzzle") configureMuzzle(pooled.sprite, radius);
  else if (options.shape === "capsule") configureCapsule(pooled.sprite, radius);
  else configureCircle(pooled.sprite, radius, options.bulletColor);

  return pooled;
};

const configureCircle = (
  sprite: Sprite,
  radius: number,
  color: ArtCruiseBulletColor = "blue",
) => {
  const size = radius * 3;
  // 色ごとに用意したpixel artテクスチャを直接使う(tintなし)。
  applyTexture(sprite, color, (s) => {
    s.width = size;
    s.height = size;
  });
};

// beam-red.png is 10x50 (width:height = 1:5)
const BEAM_ASPECT = 50 / 10;

const configureLaser = (sprite: Sprite, radius: number, length: number) => {
  // 画像は上(-Y)が先頭。anchorを横中央・縦上端に設定し、+90度回転でローカル+X方向を先頭に向ける。
  sprite.anchor.set(0.5, 0);
  sprite.rotation = Math.PI / 2;

  // width = hitboxのradiusに合わせ、heightはアスペクト比維持。lengthが十分大きければlengthで上書き。
  applyTexture(sprite, "beam", (s) => {
    const beamWidth = radius * 2;
    const naturalHeight = beamWidth * BEAM_ASPECT;
    // lengthが自然な高さより大きい場合はlengthに引き伸ばす（アスペクト比は崩れるが意図的）
    s.width = beamWidth;
    s.height = Math.max(length, naturalHeight);
  });
};

const configureMuzzle = (sprite: Sprite, radius: number) => {
  // 画像は炎が下（-Y方向が先頭）。anchorを横中央・縦下端に設定し、+90度回転でローカル+X方向が先頭になる。
  sprite.anchor.set(0.5, 1);
  sprite.rotation = Math.PI / 2;

  applyTexture(sprite, "beam", (s) => {
    const beamWidth = radius * 2;
    s.width = beamWidth;
    s.height = beamWidth * BEAM_ASPECT;
  });
};

const configureCapsule = (sprite: Sprite, radius: number) => {
  // 画像は縦長(7x10)、進行方向はX軸なので-90度回転して縦軸をX軸に向ける
  sprite.rotation = -Math.PI / 2;

  // 画像の実ピクセル比率 7:10 をそのまま維持
  applyTexture(sprite, "capsuleGreen", (s) => {
    s.width = radius * 2;
    s.height = radius * 2 * (10 / 7);
  });
};

const LAUNCHER_SIZE = 24;

export const createLauncherSprite = (): Sprite => {
  const sprite = new Sprite(Texture.EMPTY);
  sprite.anchor.set(0.5);
  applyTexture(sprite, "launcher", (s) => {
    s.width = LAUNCHER_SIZE;
    s.height = LAUNCHER_SIZE;
    s.alpha = 0.5;
  });
  return sprite;
};
