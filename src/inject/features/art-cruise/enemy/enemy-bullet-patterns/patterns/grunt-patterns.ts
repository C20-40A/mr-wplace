import type {
  ArtCruiseBulletColor,
  ArtCruiseBulletPatternModule,
  ArtCruiseBulletVariant,
  ArtCruiseEnemyBulletSpawn,
} from "../../enemy-rules/types";
import { TAU } from "../utils/geometry";

const BURST_BULLET_COLORS: ArtCruiseBulletColor[] = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
];

const BURST_BULLET_VARIANTS: ArtCruiseBulletVariant[] = [
  "greenCapsule",
  "iceCapsule",
  "kunaiCapsule",
  "smallSilver",
  "silverCapsule",
];

const getBurstBulletArt = (
  bulletArt: string,
): Pick<ArtCruiseEnemyBulletSpawn, "bulletColor" | "bulletVariant"> => {
  if (bulletArt === "bullet-yellow-circle") return { bulletColor: "yellow" };
  if (BURST_BULLET_COLORS.includes(bulletArt as ArtCruiseBulletColor))
    return { bulletColor: bulletArt as ArtCruiseBulletColor };
  if (BURST_BULLET_VARIANTS.includes(bulletArt as ArtCruiseBulletVariant))
    return { bulletVariant: bulletArt as ArtCruiseBulletVariant };
  return {};
};

export const nonePattern: ArtCruiseBulletPatternModule = {
  id: "none",
  ultimateName: "Silent Sky",
  fireIntervalMs: Infinity,
  create: () => [],
};

export const aimedFanPattern: ArtCruiseBulletPatternModule = {
  id: "aimedFan",
  ultimateName: "Hunter Fan",
  fireIntervalMs: 1200,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { enemyPos, playerPos } = ctx;
    const count = 7;
    const spread = 0.52;
    // 常にプレイヤーの方向を向く
    const base = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x);

    return Array.from({ length: count }, (_, i) => {
      const t = count <= 1 ? 0 : i / (count - 1) - 0.5;
      return {
        angle: base + t * spread,
        speed: 3.0,
        size: 7,
        delayMs: Math.abs(i - Math.floor(count / 2)) * 32,
        shotSeId: i === Math.floor(count / 2) ? "enemy-shot-short" : undefined,
      };
    });
  },
};

export const ringPulsePattern: ArtCruiseBulletPatternModule = {
  id: "ringPulse",
  ultimateName: "Pulse Ring",
  fireIntervalMs: 1400,
  shotSeId: "enemy-shot-short",
  create: (): ArtCruiseEnemyBulletSpawn[] => {
    const count = 30;
    return Array.from({ length: count }, (_, i) => ({
      angle: (Math.PI * 2 * i) / count,
      speed: 1.76 + (i % 3) * 0.05,
      size: i % 6 === 0 ? 14 : 10,
      delayMs: (i % 2) * 36,
      shotSeId: i === 0 ? "enemy-shot-short" : undefined,
      bulletColor: "purple",
    }));
  },
};

/** 汎用バースト射撃 — 扇状/狙い撃ち/連射を tuning で切り替える */
export const burstPattern: ArtCruiseBulletPatternModule = {
  id: "burst",
  ultimateName: "Scatter Burst",
  fireIntervalMs: 1100,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = ctx.tuning?.burst;
    const bulletCount = Math.max(1, Math.floor(config?.bulletCount ?? 6));
    const spreadRad = config?.spreadRad ?? 0.84;
    const base = config?.aimAtPlayer
      ? Math.atan2(
          ctx.playerPos.y - ctx.enemyPos.y,
          ctx.playerPos.x - ctx.enemyPos.x,
        )
      : Math.PI / 2;
    const repeatCount = Math.max(1, Math.floor(config?.repeatCount ?? 1));
    const repeatDelayMs = config?.repeatDelayMs ?? 140;
    const baseSpeed = config?.baseSpeed ?? 2.62;
    const speedStep = config?.speedStep ?? 0.05;
    const bulletSize = config?.bulletSize ?? 10;
    const delayStepMs = config?.delayStepMs ?? 22;
    const angleJitterRad = config?.angleJitterRad ?? 0;
    const bulletArt = config?.bulletArt ?? "bullet-yellow-circle";
    const art = getBurstBulletArt(bulletArt);
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    for (let repeat = 0; repeat < repeatCount; repeat++) {
      for (let i = 0; i < bulletCount; i++) {
        const t = bulletCount <= 1 ? 0 : i / (bulletCount - 1) - 0.5;
        spawns.push({
          angle: base + t * spreadRad + (Math.random() - 0.5) * angleJitterRad,
          speed: baseSpeed + i * speedStep,
          accel: config?.accel,
          minSpeed: config?.minSpeed,
          size: bulletSize,
          delayMs: repeat * repeatDelayMs + i * delayStepMs,
          shotSeId:
            repeat === 0 && i === 0 ? "enemy-shot-short" : undefined,
          ...art,
          rotationOffset: -Math.PI / 2,
        });
      }
    }

    return spawns;
  },
};

/** 固定方向の多方向射撃 — 画面の動き幅が大きい中型敵向け */
export const crossFirePattern: ArtCruiseBulletPatternModule = {
  id: "crossFire",
  ultimateName: "Crossfire",
  fireIntervalMs: 300,
  shotSeId: "enemy-shot-short",
  create: (): ArtCruiseEnemyBulletSpawn[] => {
    const angles = [
      Math.PI / 2,
      Math.PI * 0.43,
      Math.PI * 0.57,
      Math.PI * 0.36,
      Math.PI * 0.64,
    ];
    const speed = 2.12;
    return angles.map((angle, i) => ({
      angle,
      speed,
      size: 10,
      delayMs: i * 18,
      shotSeId: i === 0 ? "enemy-shot-short" : undefined,
    }));
  },
};

/** 東方風 — 双腕螺旋。時間で回転する2本の弾列を連続発射する */
export const spiralShotPattern: ArtCruiseBulletPatternModule = {
  id: "spiralShot",
  ultimateName: "Twin Spiral",
  fireIntervalMs: 120,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const arms = 2;
    const phase = (ctx.now / 520) % TAU;
    return Array.from({ length: arms }, (_, i) => ({
      angle: phase + (TAU * i) / arms,
      speed: 2.2,
      size: 9,
    }));
  },
};

/** 東方風 — 花弁リング。角度に応じた速度差で、展開後に4枚花弁の形を描く */
export const petalRingPattern: ArtCruiseBulletPatternModule = {
  id: "petalRing",
  ultimateName: "Petal Ring",
  fireIntervalMs: 1600,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const count = 24;
    const petals = 4;
    const phase = (ctx.now / 2400) % TAU;
    return Array.from({ length: count }, (_, i) => {
      const theta = phase + (TAU * i) / count;
      return {
        angle: theta,
        speed: 1.9 + Math.cos(petals * (theta - phase)) * 0.45,
        size: 9,
        shotSeId: i === 0 ? "enemy-shot-short" : undefined,
      };
    });
  },
};

/** 東方風 — 左右交互に傾く下向き扇。揺れが2拍周期で予測可能 */
export const switchFanPattern: ArtCruiseBulletPatternModule = {
  id: "switchFan",
  ultimateName: "Switching Fan",
  fireIntervalMs: 700,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const lean = (Math.floor(ctx.now / 700) % 2 ? 1 : -1) * 0.3;
    const offsets = [-0.3, -0.15, 0, 0.15, 0.3];
    return offsets.map((offset, i) => ({
      angle: Math.PI / 2 + lean + offset,
      speed: 2.5,
      size: 9,
      delayMs: i * 24,
      shotSeId: i === 0 ? "enemy-shot-short" : undefined,
    }));
  },
};
