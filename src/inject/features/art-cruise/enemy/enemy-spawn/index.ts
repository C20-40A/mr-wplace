import { Sprite } from "pixi.js";
import {
  DYNAMIC_ENEMY_SIZE_UNITS,
  ENEMY_BOSS_SIZE_UNITS,
  ENEMY_SPEED,
} from "../../constants";
import { createFallbackEnemyView } from "../enemy-graphics/fallback-enemy-view";
import type { ArtCruisePixiDynamicEnemyAsset } from "../enemy-graphics/pixi-enemy-graphic-pool";
import { getBulletPatternFireInterval } from "../enemy-bullet-patterns";
import {
  getRandomGruntDefinition,
  getEnemyDefinition,
} from "../enemy-rules/enemy-definitions";
import type {
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyRank,
} from "../enemy-rules/types";
import type { ArtCruisePixiEnemy } from "../types";

// No local ENEMY_SPEED

/** パターン別の初期発射時刻。少しジッターを入れて一斉発射を避ける。 */
const initialLastFiredAt = (
  now: number,
  patterns: ArtCruiseEnemyBulletPatternId[],
): Record<string, number> =>
  Object.fromEntries(
    patterns.map((p) => [p, now - Math.random() * getBulletPatternFireInterval(p)]),
  );

type CreateEnemyOptions = {
  now: number;
  dynamicAsset: ArtCruisePixiDynamicEnemyAsset | null;
  unitScale: number;
  rank?: ArtCruiseEnemyRank;
  enemyId?: string;
};

export const createPixiEnemy = ({
  now,
  dynamicAsset,
  unitScale,
  rank = "grunt",
  enemyId,
}: CreateEnemyOptions): ArtCruisePixiEnemy => {
  if (dynamicAsset) {
    return createDynamicPixiEnemy(now, dynamicAsset, unitScale);
  }

  const definition = enemyId
    ? getEnemyDefinition(enemyId)
    : rank === "boss"
    ? getEnemyDefinition("bossDrone")
    : getRandomGruntDefinition();

  const def = definition ?? getEnemyDefinition("bossDrone")!;
  return createStaticPixiEnemy(now, def, unitScale);
};

const createDynamicPixiEnemy = (
  now: number,
  asset: ArtCruisePixiDynamicEnemyAsset,
  unitScale: number,
): ArtCruisePixiEnemy => {
  const sprite = new Sprite(asset.texture);
  const size =
    asset.config.rank === "boss"
      ? ENEMY_BOSS_SIZE_UNITS
      : DYNAMIC_ENEMY_SIZE_UNITS;
  const pixelSize = size * unitScale;
  sprite.anchor.set(0.5);
  sprite.width = asset.aspect >= 1 ? pixelSize : pixelSize * asset.aspect;
  sprite.height = asset.aspect >= 1 ? pixelSize / asset.aspect : pixelSize;

  const bulletPattern = asset.getBulletPattern();
  return {
    view: sprite,
    vx: -ENEMY_SPEED * (0.9 + Math.random() * 0.3),
    hp: asset.config.hp,
    radius: asset.radius,
    phase: Math.random() * Math.PI * 2,
    spawnedAt: now,
    lastFiredAt: initialLastFiredAt(now, [bulletPattern]),
    dynamicAsset: asset,
    config: asset.config,
    movement: asset.movement,
    bulletPatterns: [bulletPattern],
  };
};

const createStaticPixiEnemy = (
  now: number,
  def: NonNullable<ReturnType<typeof getEnemyDefinition>>,
  unitScale: number,
): ArtCruisePixiEnemy => {
  const config = def.createConfig();
  const isBoss = config.rank === "boss";
  const bulletPattern = def.getBulletPattern();
  const view = createFallbackEnemyView(config.rank, unitScale);

  return {
    view,
    vx: -ENEMY_SPEED * (isBoss ? 0.72 : 1),
    hp: config.hp,
    radius:
      (isBoss ? ENEMY_BOSS_SIZE_UNITS : DYNAMIC_ENEMY_SIZE_UNITS) *
      unitScale *
      0.46,
    phase: Math.random() * Math.PI * 2,
    spawnedAt: now,
    lastFiredAt: initialLastFiredAt(now, [bulletPattern]),
    config,
    movement: def.movement,
    bulletPatterns: [bulletPattern],
  };
};
