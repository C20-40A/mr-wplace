import type { ArtCruiseEffect, ArtCruiseEffectContext } from "./types";
import { createEffectTexture } from "./texture";

const LIFE_MS = 900;
// ボス撃破: peak / grunt撃破: peak_text
export const RIP_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAOCAYAAADwikbvAAAAT0lEQVR42mP4jwQYgIAYPpzGJghjYyhGl8dlMrJmgjYTpRgLPYgAttAmWuNbGRUwRmcTpRFZEzLGawAuTSTbTrJGXAaQHKfI/ic7yvDJAwAX6ROsyOmmUAAAAABJRU5ErkJggg==";
const GRUNT_RIP_IMAGE_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAECAYAAABREWWJAAAAJUlEQVR42mP4jwQYgIAYPpzGJghjYyhGl8dlMrJmgjYTpRiNBgCsPI9xJMUjngAAAABJRU5ErkJggg==";

export const ripTextureLoader = createEffectTexture(RIP_IMAGE_DATA_URL);
export const gruntRipTextureLoader = createEffectTexture(GRUNT_RIP_IMAGE_DATA_URL);

export const spawnRipImage = ({
  sprite,
  texture,
  x,
  y,
  now,
  scale = 4,
}: ArtCruiseEffectContext): ArtCruiseEffect => {
  sprite.texture = texture;
  sprite.scale.set(scale);
  sprite.position.set(x, y);
  sprite.alpha = 0.6;
  const bornAt = now;

  return {
    sprite,
    update: (time) => {
      const progress = Math.min((time - bornAt) / LIFE_MS, 1);
      sprite.y = y - progress * 50;
      const baseAlpha = 0.6;
      sprite.alpha =
        progress < 0.5 ? baseAlpha : baseAlpha * (1 - (progress - 0.5) / 0.5);
      return progress < 1;
    },
  };
};
