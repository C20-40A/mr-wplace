import type {
  ArtCruiseBulletPatternModule,
  ArtCruiseEnemyBulletSpawn,
  ArtCruiseReflectLaserConfig,
} from "../../enemy-rules/types";
import { rainbowColor } from "../utils/colors";

/** ボス用の幻想的なサイン波弾幕 */
export const bossSineWavePattern: ArtCruiseBulletPatternModule = {
  id: "bossSineWave",
  ultimateName: "Prismatic Wave",
  fireIntervalMs: 1800,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { enemyPos, playerPos, now } = ctx;
    const count = 30;
    const timeFactor = now / 100;

    // プレイヤー方向を中心に、サイン波でベースのアングルを揺らす
    const playerAngle = Math.atan2(
      playerPos.y - enemyPos.y,
      playerPos.x - enemyPos.x,
    );
    const baseShift = Math.sin(timeFactor * 1.2) * 0.8;
    const baseAngle = playerAngle + baseShift;

    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      // さらに個別の弾も揺らすことで螺旋状、あるいは波状の美しい広がりを作る
      const wave = Math.sin(timeFactor * 3 + t * Math.PI * 4) * 0.35;

      return {
        angle: baseAngle + (t - 0.5) * 1.0 + wave,
        speed: 2.1 + Math.cos(t * Math.PI) * 0.4,
        size: 10,
        delayMs: i * 20,
        // 弧に沿って色を巡らせ、波打つレインボーにする
        bulletColor: rainbowColor(i),
        shotSeId: i === 0 ? "enemy-shot-short" : undefined,
      };
    });
  },
};

const REFLECT_LASER_DEFAULT_OFFSETS = [-0.46, -0.28, -0.1, 0.1, 0.28, 0.46];

const REFLECT_LASER_DEFAULTS = {
  offsets: REFLECT_LASER_DEFAULT_OFFSETS,
  count: 6,
  weaveRad: 0.16,
  weaveMs: 700,
  baseSpeed: 2.7,
  altSpeedAdd: 0.18,
  bulletSize: 15,
  delayStepMs: 120,
  splitOnBoundary: true,
  lifeMs: 7600,
  length: 168,
  trailMs: 520,
} satisfies Required<ArtCruiseReflectLaserConfig>;

const getReflectLaserConfig = (
  config?: ArtCruiseReflectLaserConfig,
): Required<ArtCruiseReflectLaserConfig> => ({
  ...REFLECT_LASER_DEFAULTS,
  ...config,
});

const resolveReflectLaserOffsets = (
  config: Required<ArtCruiseReflectLaserConfig>,
  rawConfig?: ArtCruiseReflectLaserConfig,
) => {
  if (rawConfig?.offsets?.length) return rawConfig.offsets;
  if (rawConfig?.count === undefined) return REFLECT_LASER_DEFAULT_OFFSETS;
  const count = Math.max(1, Math.floor(config.count));
  const defaults = REFLECT_LASER_DEFAULT_OFFSETS;
  if (count === defaults.length) return REFLECT_LASER_DEFAULT_OFFSETS;
  if (count === 1) return [0];
  const min = defaults[0];
  const max = defaults[defaults.length - 1];
  return Array.from(
    { length: count },
    (_, i) => min + ((max - min) * i) / (count - 1),
  );
};

/** 画面枠への衝突点から、反射方向のレーザー弾を一度だけ追加発射する */
export const bossReflectLaserPattern: ArtCruiseBulletPatternModule = {
  id: "bossReflectLaser",
  rank: "boss",
  ultimateName: "Reflection Ray",
  fireIntervalMs: 1800,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { enemyPos, playerPos, now } = ctx;
    const rawConfig = ctx.tuning?.reflectLaser;
    const config = getReflectLaserConfig(rawConfig);
    const offsets = resolveReflectLaserOffsets(config, rawConfig);
    const base = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x);
    const weave = Math.sin(now / config.weaveMs) * config.weaveRad;

    return offsets.map((offset, i) => ({
      angle: base + offset + weave,
      speed: config.baseSpeed + (i % 2) * config.altSpeedAdd,
      size: config.bulletSize,
      delayMs: i * config.delayStepMs,
      splitOnBoundary: config.splitOnBoundary,
      maxAgeMs: config.lifeMs,
      shape: "laser",
      length: config.length,
      trailMs: config.trailMs,
      shotSeId: i === 0 ? "enemy-shot" : undefined,
    }));
  },
};
