import type { Sprite, Texture } from "pixi.js";

export type ArtCruiseEffectContext = {
  sprite: Sprite;
  texture: Texture;
  x: number;
  y: number;
  now: number;
  scale?: number;
};

export type ArtCruiseEffect = {
  sprite: Sprite;
  update: (now: number, deltaSeconds: number) => boolean;
};

export type ArtCruiseEffectSpawner = (
  context: ArtCruiseEffectContext,
) => ArtCruiseEffect;
