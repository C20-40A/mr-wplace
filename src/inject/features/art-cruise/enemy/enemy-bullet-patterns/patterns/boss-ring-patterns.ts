import type {
  ArtCruiseBulletColor,
  ArtCruiseBulletPatternModule,
  ArtCruiseBulletVariant,
  ArtCruiseDenseRingConfig,
  ArtCruiseEnemyBulletSpawn,
} from "../../enemy-rules/types";
import { rainbowColor } from "../utils/colors";
import { TAU } from "../utils/geometry";

/** ボス周囲から大玉を円形に放つ */
export const bossBigRingPattern: ArtCruiseBulletPatternModule = {
  id: "bossBigRing",
  rank: "boss",
  ultimateName: "Grand Orbit",
  fireIntervalMs: 2000,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const count = 34;
    const phase = (ctx.now / 2000) % TAU;

    return Array.from({ length: count }, (_, i) => ({
      angle: phase + (TAU * i) / count,
      speed: 1.55 + (i % 2) * 0.08,
      size: 18,
      delayMs: (i % 3) * 24,
      // 円周方向に色を巡らせ、虹色リングにする
      bulletColor: rainbowColor(i),
      shotSeId: i === 0 ? "enemy-shot" : undefined,
    }));
  },
};

type ResolvedDenseRingConfig = Required<
  Omit<
    ArtCruiseDenseRingConfig,
    "phaseStepRad" | "bulletArt" | "bulletVariant"
  >
> &
  Pick<
    ArtCruiseDenseRingConfig,
    "phaseStepRad" | "bulletArt" | "bulletVariant"
  >;

const DENSE_RING_DEFAULTS = {
  fireSlots: 3,
  cycleSlots: 5,
  slotMs: 420,
  count: 64,
  phaseMs: 1600,
  baseSpeed: 1.25,
  altSpeedAdd: 0.06,
  bulletSize: 7,
  delayMs: 0,
  bulletColor: "red",
} satisfies Required<
  Omit<
    ArtCruiseDenseRingConfig,
    "phaseStepRad" | "bulletArt" | "bulletVariant"
  >
>;

const DENSE_RING_BULLET_COLORS: ArtCruiseBulletColor[] = [
  "blue",
  "red",
  "green",
  "yellow",
  "purple",
];

const DENSE_RING_BULLET_VARIANTS: ArtCruiseBulletVariant[] = [
  "greenCapsule",
  "iceCapsule",
  "kunaiCapsule",
  "smallSilver",
  "silverCapsule",
];

const getDenseRingConfig = (
  config?: ArtCruiseDenseRingConfig,
): ResolvedDenseRingConfig => ({
  ...DENSE_RING_DEFAULTS,
  ...config,
  fireSlots: Math.max(
    1,
    Math.floor(config?.fireSlots ?? DENSE_RING_DEFAULTS.fireSlots),
  ),
  cycleSlots: Math.max(
    1,
    Math.floor(config?.cycleSlots ?? DENSE_RING_DEFAULTS.cycleSlots),
  ),
  slotMs: Math.max(1, config?.slotMs ?? DENSE_RING_DEFAULTS.slotMs),
  count: Math.max(1, Math.floor(config?.count ?? DENSE_RING_DEFAULTS.count)),
  phaseMs: Math.max(1, config?.phaseMs ?? DENSE_RING_DEFAULTS.phaseMs),
  bulletSize: Math.max(1, config?.bulletSize ?? DENSE_RING_DEFAULTS.bulletSize),
  delayMs: Math.max(0, config?.delayMs ?? DENSE_RING_DEFAULTS.delayMs),
});

const getDenseRingBulletArt = (
  config: ResolvedDenseRingConfig,
): Pick<ArtCruiseEnemyBulletSpawn, "bulletColor" | "bulletVariant"> => {
  if (config.bulletArt === "bullet-yellow-circle")
    return { bulletColor: "yellow" };
  if (
    DENSE_RING_BULLET_COLORS.includes(
      config.bulletArt as ArtCruiseBulletColor,
    )
  )
    return { bulletColor: config.bulletArt as ArtCruiseBulletColor };
  if (
    DENSE_RING_BULLET_VARIANTS.includes(
      config.bulletArt as ArtCruiseBulletVariant,
    )
  )
    return { bulletVariant: config.bulletArt as ArtCruiseBulletVariant };
  if (config.bulletVariant) return { bulletVariant: config.bulletVariant };
  return { bulletColor: config.bulletColor };
};

/** 東方風 — 超高密度リングを3連射→休止→3連射のwaveで繰り返す */
export const bossDenseRingPattern: ArtCruiseBulletPatternModule = {
  id: "bossDenseRing",
  rank: "boss",
  ultimateName: "Crimson Eclipse",
  fireIntervalMs: 380,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = getDenseRingConfig(ctx.tuning?.denseRing);
    const fireSlots = Math.min(config.fireSlots, config.cycleSlots);
    const slot = Math.floor(ctx.now / config.slotMs) % config.cycleSlots;
    if (slot >= fireSlots) return [];
    const art = getDenseRingBulletArt(config);

    // スロットごとに位相をずらして3連射を少しずつ回転させる
    const phase =
      ((ctx.now / config.phaseMs) % TAU) +
      slot * (config.phaseStepRad ?? TAU / (fireSlots * config.count));

    return Array.from({ length: config.count }, (_, i) => ({
      angle: phase + (TAU * i) / config.count,
      speed: config.baseSpeed + (i % 2) * config.altSpeedAdd,
      size: config.bulletSize,
      delayMs: config.delayMs,
      ...art,
      rotationOffset: -Math.PI / 2,
      shotSeId: i === 0 ? "enemy-shot" : undefined,
      // shape: "capsule" as const,
    }));
  },
};

/** 東方風 — 4腕の銀河渦。発射ステップごとに一定角ずつ回り、腕が虹色に変化する */
export const bossGalaxyVortexPattern: ArtCruiseBulletPatternModule = {
  id: "bossGalaxyVortex",
  rank: "boss",
  ultimateName: "Galaxy Vortex",
  fireIntervalMs: 160,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const arms = 4;
    const step = Math.floor(ctx.now / 160);
    const phase = step * 0.23;
    return Array.from({ length: arms }, (_, i) => ({
      angle: phase + (TAU * i) / arms,
      speed: 1.9 + (i % 2) * 0.25,
      size: 11,
      // 発射ステップで色を進め、渦全体がグラデーションになる
      bulletColor: rainbowColor(step),
      shotSeId: i === 0 && step % 4 === 0 ? "enemy-shot-short" : undefined,
    }));
  },
};

/** 東方風 — 6枚花弁の二重リング。外層と半花弁ずらした内層が時間差で開花する */
export const bossLotusBloomPattern: ArtCruiseBulletPatternModule = {
  id: "bossLotusBloom",
  rank: "boss",
  ultimateName: "Lotus Bloom",
  fireIntervalMs: 1900,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const count = 44;
    const petals = 6;
    const phase = (ctx.now / 3000) % TAU;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    for (let layer = 0; layer < 2; layer++) {
      const offset = phase + layer * (Math.PI / petals);
      for (let i = 0; i < count; i++) {
        const theta = offset + (TAU * i) / count;
        spawns.push({
          angle: theta,
          // 角度に応じた速度差で、展開後に花弁の輪郭を描く
          speed: 1.7 + Math.cos(petals * (theta - offset)) * 0.55 - layer * 0.3,
          size: layer ? 8 : 11,
          delayMs: layer * 260,
          // 花弁単位で色を変え、内層は色相を半周ずらす
          bulletColor: rainbowColor(
            Math.floor((i * petals) / count) + layer * 3,
          ),
        });
      }
    }
    return spawns;
  },
};

/** 東方風 — 全方向リングを連続発射し、後発ほど高速になる多層の速度差弾幕 */
export const bossClusterVolleyPattern: ArtCruiseBulletPatternModule = {
  id: "bossClusterVolley",
  rank: "boss",
  ultimateName: "Velocity Cascade",
  fireIntervalMs: 1700,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const clusters = 5;
    const count = 28;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    for (let cl = 0; cl < clusters; cl++) {
      // リングごとに少し位相をずらして全方向に隙間なく展開
      const phase = ((ctx.now / 1700) % TAU) + cl * (TAU / count / clusters);
      for (let i = 0; i < count; i++) {
        spawns.push({
          angle: phase + (TAU * i) / count,
          // 後発リングほど高速にして、徐々に加速する壁を作る
          speed: 1.3 + cl * 0.55,
          size: 10,
          delayMs: cl * 180,
          bulletColor: rainbowColor(cl),
        });
      }
    }
    return spawns;
  },
};

/** 東方風 — 超巨大弾のゆっくりした円形弾幕 */
export const bossGigantoRingPattern: ArtCruiseBulletPatternModule = {
  id: "bossGigantoRing",
  rank: "boss",
  ultimateName: "Giganto Ring",
  fireIntervalMs: 2000,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const phase = (ctx.now / 4800) % TAU;
    const giants = 14;
    const spawns: ArtCruiseEnemyBulletSpawn[] = Array.from(
      { length: giants },
      (_, i) => ({
        angle: phase + (TAU * i) / giants,
        speed: 1.7,
        size: 40,
        bulletColor: rainbowColor(i),
      }),
    );
    return spawns;
  },
};
