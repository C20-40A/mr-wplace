import type { ArtCruiseEffect, ArtCruiseEffectContext } from "./types";
import { createEffectTexture } from "./texture";

const LIFE_MS = 500;
const HIT_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAECAYAAABREWWJAAAAKElEQVR42mP4DwQMSOA/EoDx0Wm4PLpmZIXIirHyidGMjcbpTGKdDQDCN3uF3iM6iwAAAABJRU5ErkJggg==";

export const hitTextureLoader = createEffectTexture(HIT_IMAGE_DATA_URL);

export const spawnHitImage = ({
  sprite,
  texture,
  x,
  y,
  now,
}: ArtCruiseEffectContext): ArtCruiseEffect => {
  sprite.texture = texture;
  sprite.scale.set(4);
  sprite.position.set(x, y);
  sprite.alpha = 0.8;
  const bornAt = now;

  return {
    sprite,
    update: (time) => {
      const progress = Math.min((time - bornAt) / LIFE_MS, 1);
      sprite.y = y - progress * 30;
      const baseAlpha = 0.8;
      sprite.alpha =
        progress < 0.6 ? baseAlpha : baseAlpha * (1 - (progress - 0.6) / 0.4);
      return progress < 1;
    },
  };
};
