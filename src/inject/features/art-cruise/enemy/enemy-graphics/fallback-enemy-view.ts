import { Assets, Sprite, Texture } from "pixi.js";

import { GalleryRepository } from "@/inject/db/gallery-repository";
import type { GalleryMetadata } from "@/inject/db/schema-v2";
import {
  DYNAMIC_ENEMY_ALPHA_THRESHOLD,
  DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS,
  DYNAMIC_ENEMY_MIN_SIZE_PX,
  DYNAMIC_ENEMY_SIZE_UNITS,
  ENEMY_BOSS_SIZE_UNITS,
  getDynamicEnemyMaxSizePx,
  getGalleryEnemyFallbackEnabled,
} from "../../constants";

const ENEMY_DATA_URLS = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAvCAYAAAB6zDPWAAACvElEQVR42tWZPU7EMBCFfScakLaBkqsgSm5ACR09PTfgNlyDysiRZnl5fjN2TDYkK1nRxvbM5/mz15vSZT45HeSTr25u81GADwM7gVrbEnhE2RlyEHZogSPKzha9v3sete7iOT2KsrJImfP49Do1A3as5cqleW3QxgSpHN2Piy2yxJwQtge4cqMHS30qqXKQbKFshPXGVYIdF6q+ypLWREjlRphFHPOVFgVf798zwQzLq/ZAPWD0njKEtcLxcf1ZAefT6TR9KZ0mxN6hVUwJhgk+cSGehVAGxrP1I4sZzt5NsJbBNrF0IqxXklRSmSyrCN7CGBphAW6SU8GiIgXb435csMntCQcFayzGdYYtL8oAe3qWVaCm0ASbCxE4msuyUT9beQYbDJKuZFiMNQPGkGhVEg92FgbRAE4wthy7n2FVTnBycYJxq6oBNhPshUAE0gNb+qJQwLxBniZsVNhHYD05EWxlWYxbZVn8TgLy28tDCIv9qMfblhm2Kl3KsgaFsGrF5cnAaFUFyvOtrxUGyVYvOmeJhgpYWVS6lAUZWG0ECjTxIBqQVS1WIYLlC2ssz1cLRn3GUQyoDjyzeAGXVqchxz2801SwXuIIGC8hfweojUD1ezscK2GFPZnOpy+M4woWzwbKsiqWFGzxTGmcqGhtDClPl8MyN78I6upk5RX0UrasebFqEB5swNEPawqWwqo6Kur1Ilh1tk3KPVjWlOUYVCQTJ18vgwbugeWNwzv+iRLVhF10d9ABmxQwn/6dEhXCDt3KdFq9Sj6G9ZIouJdY5/4rChH+DSZOa8OuXh1WnSHWisthYK+Q2+mrsV26hX5z2NaNytawiX9xqm1y7Wy/iHUbsNta9Y+w6T9gUxQGZbvFu4L/DIGeK3a+SN7nvzXi123aPSzc8+4Xtvcsuivgw/wdeiTYi/0r/gNfRdoGjmTh3AAAAABJRU5ErkJggg==",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAtCAYAAADcMyneAAACi0lEQVR42s2Zy1FEIRBFicAILFdm4Ebd6XJSsVyagVtjcOXGDMzGBAzAFQraernvNgM85vOqqHofujn0D4YJYe4Vf9vRXkcNGF9OzuLH6flRQma418u33NL9LiFHFGew9+fP3NL9gJ4mmSHFF1c3Wc4A8d2InuEONTmQ5eduwM3ddZwKaLKb28fcEHbFRKdkYKHUu+9JtNSUXIYbmPm/W74td//wlFu6H/BI7p84uArkD0Qee6zH7rX7DsiIHGzFYqARQANCCxpso87IHAUgzrxx1hLOBmJIAIyV0rbwSAtgrCljOHMPQxJgVJarAqYXuEQ5LmfBheVsqWNLYiIpnQhoHIsYTB84BjCO2GX2zgDVUseAKpkUoLH8AdoLLDUKDJWxe1sBlU6EtzABz/wMlpQqISezhgBrOhGcYjcUL5UgD6BiEAE5UZSsGqMJUEF6NYqTBHczDOhZTRX7bkCLDZ65cjO7lwFNzqt9XYCYWbjP8wBrdRDlbBL4jRkKQFSmygLGHG8Q2M1qNeFijLItgG6iKCGOy56lTulkYNIVXEAFp0IAlaYw4A1DLUu98boA2f3bAA1ymwtxIl2A9hHv2SrekmeA9uwVYQ4HDgsJaB1QADotrOkFey3BxOALQAUXnA5yq8WW4SJtLlZbKWfwaYDB2yYlOQZUVq1NvObeArLWwS7eVKok4T3g77O7Q28ZuxVwEfQmi0ni9Vs5dmgC9DKS3cmZXwOETUaYBshwZgUPcgZgywGSLBcOYBD7wp0ffHrZ5sVRC+D8M8RaTRsIm70BuhbfO2Dj6dXoWeF6wPQTteGoN/c5xMF68TNgW7/BM+v9AK44VF8P2Qp4yP9Nms79juHvr5n/uRTXF+vhrW51mY1BAAAAAElFTkSuQmCC",
] as const;

let textures: Texture[] | null = null;
let galleryTextures: Texture[] = [];
let galleryRepo: GalleryRepository | null = null;
let galleryLoadPromise: Promise<void> | null = null;
let galleryLoadSizePx = 0;

const GALLERY_FALLBACK_TEXTURE_LIMIT = 12;
const GALLERY_FALLBACK_MAX_ATTEMPTS = 24;

const pickRandom = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const setNearest = (texture: Texture) => {
  texture.source.scaleMode = "nearest";
  return texture;
};

export const preloadFallbackEnemyTextures = async () => {
  await preloadGalleryFallbackEnemyTextures();
  if (textures) return;
  try {
    textures = await Promise.all(
      ENEMY_DATA_URLS.map((url) => Assets.load<Texture>(url).then(setNearest)),
    );
  } catch (error) {
    console.warn("🧑‍🎨 : Art cruise fallback enemy preload failed", error);
    textures = null;
  }
};

export const refreshGalleryFallbackEnemyTextures = () => {
  galleryLoadSizePx = 0;
  for (const texture of galleryTextures) texture.destroy(true);
  galleryTextures = [];
  return preloadGalleryFallbackEnemyTextures();
};

const preloadGalleryFallbackEnemyTextures = async () => {
  if (!getGalleryEnemyFallbackEnabled()) return;

  const maxSizePx = getDynamicEnemyMaxSizePx();
  if (galleryTextures.length > 0 && galleryLoadSizePx === maxSizePx) return;
  if (galleryLoadPromise) return galleryLoadPromise;

  galleryLoadPromise = loadGalleryFallbackEnemyTextures(maxSizePx).finally(() => {
    galleryLoadPromise = null;
  });
  return galleryLoadPromise;
};

const loadGalleryFallbackEnemyTextures = async (maxSizePx: number) => {
  try {
    galleryRepo ??= new GalleryRepository();
    await galleryRepo.init();
    const metadata = await galleryRepo.getAllMetadata();
    const candidates = shuffle(
      metadata.filter((item) => isGalleryMetadataUsable(item, maxSizePx)),
    );
    const nextTextures: Texture[] = [];

    for (const item of candidates.slice(0, GALLERY_FALLBACK_MAX_ATTEMPTS)) {
      const texture = await createGalleryFallbackTexture(item, maxSizePx);
      if (!texture) continue;
      nextTextures.push(texture);
      if (nextTextures.length >= GALLERY_FALLBACK_TEXTURE_LIMIT) break;
    }

    for (const texture of galleryTextures) texture.destroy(true);
    galleryTextures = nextTextures;
    galleryLoadSizePx = maxSizePx;
    console.log("🧑‍🎨 : Art cruise gallery fallback enemies loaded", {
      count: galleryTextures.length,
      maxSizePx,
    });
  } catch (error) {
    console.warn("🧑‍🎨 : Art cruise gallery fallback enemy preload failed", error);
  }
};

const isGalleryMetadataUsable = (
  metadata: GalleryMetadata,
  maxSizePx: number,
) =>
  metadata.width >= DYNAMIC_ENEMY_MIN_SIZE_PX &&
  metadata.height >= DYNAMIC_ENEMY_MIN_SIZE_PX &&
  metadata.width <= maxSizePx &&
  metadata.height <= maxSizePx;

const createGalleryFallbackTexture = async (
  metadata: GalleryMetadata,
  maxSizePx: number,
) => {
  if (!galleryRepo) return null;

  const blob = await galleryRepo.getImage(metadata.id);
  if (!blob) return null;

  const bitmap = await createImageBitmap(blob);
  try {
    if (
      bitmap.width < DYNAMIC_ENEMY_MIN_SIZE_PX ||
      bitmap.height < DYNAMIC_ENEMY_MIN_SIZE_PX ||
      bitmap.width > maxSizePx ||
      bitmap.height > maxSizePx
    )
      return null;

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const opaquePixels = countOpaquePixels(image.data);
    if (
      opaquePixels < DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS ||
      opaquePixels > DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS
    )
      return null;

    return setNearest(Texture.from(canvas));
  } finally {
    bitmap.close();
  }
};

const countOpaquePixels = (data: Uint8ClampedArray) => {
  let count = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! > DYNAMIC_ENEMY_ALPHA_THRESHOLD) count += 1;
  }
  return count;
};

const shuffle = <T>(items: T[]) => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
};

export const createFallbackEnemyView = (
  rank: "grunt" | "boss",
  unitScale: number,
): Sprite => {
  const fallbackTextures =
    getGalleryEnemyFallbackEnabled() && galleryTextures.length > 0
      ? galleryTextures
      : textures ?? ENEMY_DATA_URLS.map((url) => Texture.from(url));
  const texture = pickRandom(fallbackTextures);
  setNearest(texture);

  const sprite = new Sprite(texture);
  const size = rank === "boss" ? ENEMY_BOSS_SIZE_UNITS : DYNAMIC_ENEMY_SIZE_UNITS;
  const pixelSize = size * unitScale;
  const aspect = texture.width / texture.height;

  sprite.anchor.set(0.5);
  sprite.width = aspect >= 1 ? pixelSize : pixelSize * aspect;
  sprite.height = aspect >= 1 ? pixelSize / aspect : pixelSize;
  return sprite;
};
