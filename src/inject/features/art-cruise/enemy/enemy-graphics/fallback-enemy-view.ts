import { Assets, Sprite, Texture } from "pixi.js";

import {
  DYNAMIC_ENEMY_SIZE_UNITS,
  ENEMY_BOSS_SIZE_UNITS,
} from "../../constants";

const ENEMY_DATA_URLS = [
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAvCAYAAAB6zDPWAAACvElEQVR42tWZPU7EMBCFfScakLaBkqsgSm5ACR09PTfgNlyDysiRZnl5fjN2TDYkK1nRxvbM5/mz15vSZT45HeSTr25u81GADwM7gVrbEnhE2RlyEHZogSPKzha9v3sete7iOT2KsrJImfP49Do1A3as5cqleW3QxgSpHN2Piy2yxJwQtge4cqMHS30qqXKQbKFshPXGVYIdF6q+ypLWREjlRphFHPOVFgVf798zwQzLq/ZAPWD0njKEtcLxcf1ZAefT6TR9KZ0mxN6hVUwJhgk+cSGehVAGxrP1I4sZzt5NsJbBNrF0IqxXklRSmSyrCN7CGBphAW6SU8GiIgXb435csMntCQcFayzGdYYtL8oAe3qWVaCm0ASbCxE4msuyUT9beQYbDJKuZFiMNQPGkGhVEg92FgbRAE4wthy7n2FVTnBycYJxq6oBNhPshUAE0gNb+qJQwLxBniZsVNhHYD05EWxlWYxbZVn8TgLy28tDCIv9qMfblhm2Kl3KsgaFsGrF5cnAaFUFyvOtrxUGyVYvOmeJhgpYWVS6lAUZWG0ECjTxIBqQVS1WIYLlC2ssz1cLRn3GUQyoDjyzeAGXVqchxz2801SwXuIIGC8hfweojUD1ezscK2GFPZnOpy+M4woWzwbKsiqWFGzxTGmcqGhtDClPl8MyN78I6upk5RX0UrasebFqEB5swNEPawqWwqo6Kur1Ilh1tk3KPVjWlOUYVCQTJ18vgwbugeWNwzv+iRLVhF10d9ABmxQwn/6dEhXCDt3KdFq9Sj6G9ZIouJdY5/4rChH+DSZOa8OuXh1WnSHWisthYK+Q2+mrsV26hX5z2NaNytawiX9xqm1y7Wy/iHUbsNta9Y+w6T9gUxQGZbvFu4L/DIGeK3a+SN7nvzXi123aPSzc8+4Xtvcsuivgw/wdeiTYi/0r/gNfRdoGjmTh3AAAAABJRU5ErkJggg==",
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAtCAYAAADcMyneAAACi0lEQVR42s2Zy1FEIRBFicAILFdm4Ebd6XJSsVyagVtjcOXGDMzGBAzAFQraernvNgM85vOqqHofujn0D4YJYe4Vf9vRXkcNGF9OzuLH6flRQma418u33NL9LiFHFGew9+fP3NL9gJ4mmSHFF1c3Wc4A8d2InuEONTmQ5eduwM3ddZwKaLKb28fcEHbFRKdkYKHUu+9JtNSUXIYbmPm/W74td//wlFu6H/BI7p84uArkD0Qee6zH7rX7DsiIHGzFYqARQANCCxpso87IHAUgzrxx1hLOBmJIAIyV0rbwSAtgrCljOHMPQxJgVJarAqYXuEQ5LmfBheVsqWNLYiIpnQhoHIsYTB84BjCO2GX2zgDVUseAKpkUoLH8AdoLLDUKDJWxe1sBlU6EtzABz/wMlpQqISezhgBrOhGcYjcUL5UgD6BiEAE5UZSsGqMJUEF6NYqTBHczDOhZTRX7bkCLDZ65cjO7lwFNzqt9XYCYWbjP8wBrdRDlbBL4jRkKQFSmygLGHG8Q2M1qNeFijLItgG6iKCGOy56lTulkYNIVXEAFp0IAlaYw4A1DLUu98boA2f3bAA1ymwtxIl2A9hHv2SrekmeA9uwVYQ4HDgsJaB1QADotrOkFey3BxOALQAUXnA5yq8WW4SJtLlZbKWfwaYDB2yYlOQZUVq1NvObeArLWwS7eVKok4T3g77O7Q28ZuxVwEfQmi0ni9Vs5dmgC9DKS3cmZXwOETUaYBshwZgUPcgZgywGSLBcOYBD7wp0ffHrZ5sVRC+D8M8RaTRsIm70BuhbfO2Dj6dXoWeF6wPQTteGoN/c5xMF68TNgW7/BM+v9AK44VF8P2Qp4yP9Nms79juHvr5n/uRTXF+vhrW51mY1BAAAAAElFTkSuQmCC",
] as const;

let textures: Texture[] | null = null;

const pickRandom = <T>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const setNearest = (texture: Texture) => {
  texture.source.scaleMode = "nearest";
  return texture;
};

export const preloadFallbackEnemyTextures = async () => {
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

export const createFallbackEnemyView = (
  rank: "grunt" | "boss",
  unitScale: number,
): Sprite => {
  const texture = pickRandom(
    textures ?? ENEMY_DATA_URLS.map((url) => Texture.from(url)),
  );
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
