import type {
  ArtCruiseBulletPatternModule,
  ArtCruiseEdgeBarrageConfig,
  ArtCruiseEdgeBeamConfig,
  ArtCruiseFlappyGateConfig,
  ArtCruiseFlappyGateSide,
  ArtCruiseEnemyBulletSpawn,
} from "../../enemy-rules/types";
import { rainbowColor } from "../utils/colors";
import {
  axisPosition,
  BULLET_MOTION_SCALE,
  LAUNCHER_MARGIN,
  TAU,
} from "../utils/geometry";

const FROZEN_COLS = 24;
const FROZEN_ROWS = 32;

export const getFrozenLatticeOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const origins: { x: number; y: number }[] = [];
  const left = 0;
  const right = width;
  const top = 0;
  const bottom = height;

  // 上辺・下辺: cols 個を端まで配置
  for (let c = 0; c < FROZEN_COLS; c++) {
    const x = axisPosition(left, right, c, FROZEN_COLS);
    origins.push({ x, y: top });
    origins.push({ x, y: bottom });
  }
  // 左辺・右辺: rows 等分（角は上下辺に含まれるのでスキップ）
  for (let r = 1; r < FROZEN_ROWS - 1; r++) {
    const y = axisPosition(top, bottom, r, FROZEN_ROWS);
    origins.push({ x: left, y });
    origins.push({ x: right, y });
  }
  return origins;
};

/** 画面4辺に格子状タレットを配置し、中央方向へsin速度変化で連射するパターン */
export const bossFrozenLatticePattern: ArtCruiseBulletPatternModule = {
  id: "bossFrozenLattice",
  rank: "boss",
  ultimateName: "Glacial Lattice",
  launcherOrigins: ({ width, height }) =>
    getFrozenLatticeOrigins(width, height),
  fireIntervalMs: 5000,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { width, height } = ctx.bounds;
    const cx = width / 2;
    const cy = height / 2;
    const origins = getFrozenLatticeOrigins(width, height);
    return origins.map((origin, i) => ({
      origin,
      angle: Math.atan2(cy - origin.y, cx - origin.x),
      speed: 1.2 + Math.sin(ctx.now / 800 + i * 0.4) * 0.5,
      size: 8,
      delayMs: i * 18,
      shape: "capsule" as const,
    }));
  },
};

export const getPerimeterGapRingOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const margin = LAUNCHER_MARGIN;
  return [
    { x: width * 0.25, y: margin },
    { x: width * 0.5, y: margin },
    { x: width * 0.75, y: margin },
    { x: margin, y: height * 0.38 },
    { x: width - margin, y: height * 0.38 },
    { x: width * 0.5, y: height - margin },
  ];
};

/** プレイエリア周囲の基点から、3発+2間隔の円形弾幕を放つ */
export const bossPerimeterGapRingPattern: ArtCruiseBulletPatternModule = {
  id: "bossPerimeterGapRing",
  rank: "boss",
  ultimateName: "Sealing Waltz",
  launcherOrigins: ({ width, height }) =>
    getPerimeterGapRingOrigins(width, height),
  fireIntervalMs: 2200,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { width, height } = ctx.bounds;
    const origins = getPerimeterGapRingOrigins(width, height);
    const slots = 30;
    const phase = (ctx.now / 2600) % TAU;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    origins.forEach((origin, originIndex) => {
      for (let slot = 0; slot < slots; slot++) {
        if (slot % 5 >= 3) continue;
        spawns.push({
          origin,
          angle: phase + originIndex * 0.17 + (TAU * slot) / slots,
          speed: 1.28,
          size: 9,
          delayMs: originIndex * 90 + slot * 4,
          // 基点ごとに色を変え、6方向の弾幕を色分けする
          bulletColor: rainbowColor(originIndex),
        });
      }
    });

    return spawns;
  },
};

export const getWeavingStreamOrigins = (
  width: number,
): { x: number; y: number }[] => {
  const originCount = 5;
  const margin = LAUNCHER_MARGIN;
  return Array.from({ length: originCount }, (_, i) => ({
    x: (width * (i + 1)) / (originCount + 1),
    y: margin,
  }));
};

/** 東方風 — 画面上部に均等配置した基点から、左から順に蛇行する流れ弾をシーケンシャルに撃ち出す */
export const bossWeavingStreamPattern: ArtCruiseBulletPatternModule = {
  id: "bossWeavingStream",
  rank: "boss",
  ultimateName: "Weaving Stream",
  launcherOrigins: ({ width }) => getWeavingStreamOrigins(width),
  shotSeId: "enemy-shot-short",
  fireIntervalMs: 1000,
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { playerPos, now, bounds } = ctx;
    const { width } = bounds;
    const origins = getWeavingStreamOrigins(width);
    const perOrigin = 8;

    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    origins.forEach((origin, originIndex) => {
      // 各基点からプレイヤー方向を基準に、発射タイミングでベース角を蛇行
      const base = Math.atan2(playerPos.y - origin.y, playerPos.x - origin.x);
      const sweep = Math.sin(now / 600 + originIndex * 0.5) * 0.7;
      for (let i = 0; i < perOrigin; i++) {
        const t = i / (perOrigin - 1);
        const weave = Math.sin(t * Math.PI * 3 + now / 200) * 0.5;
        spawns.push({
          origin,
          angle: base + sweep + weave,
          speed: 3.1,
          size: 8,
          // 左の基点から順番にずらし、基点内も連続させる
          delayMs: originIndex * 140 + i * 50,
          shape: "capsule" as const,
          bulletColor: "green",
        });
      }
    });

    return spawns;
  },
};

const STARFALL_COLS = 9;
const STARFALL_TURN_SECONDS = 2.2;

export const getStarfallOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const origins: { x: number; y: number }[] = [];
  for (let i = 0; i < STARFALL_COLS; i++) {
    const x = axisPosition(0, width, i, STARFALL_COLS);
    origins.push({ x, y: 0 });
    origins.push({ x, y: height });
  }
  return origins;
};

/** 東方風 — 上下9基点から中心へ収束して反転する星雨。安地2列が左から右へ周期移動する */
export const bossStarfallPattern: ArtCruiseBulletPatternModule = {
  id: "bossStarfall",
  rank: "boss",
  ultimateName: "Starlight Curtain",
  launcherOrigins: ({ width, height }) => getStarfallOrigins(width, height),
  fireIntervalMs: 520,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { width, height } = ctx.bounds;
    const cx = width / 2;
    const cy = height / 2;
    const origins = getStarfallOrigins(width, height);
    // 安地（撃たない隣接2列）が一定周期で右へ流れる
    const gap = Math.floor(ctx.now / 520) % STARFALL_COLS;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    origins.forEach((origin, i) => {
      const column = Math.floor(i / 2);
      if (column === gap || column === (gap + 1) % STARFALL_COLS) return;
      const dx = cx - origin.x;
      const dy = cy - origin.y;
      const distanceToCenter = Math.hypot(dx, dy);
      const speed =
        (distanceToCenter * 2) / (BULLET_MOTION_SCALE * STARFALL_TURN_SECONDS);
      spawns.push({
        origin,
        angle: Math.atan2(dy, dx),
        speed,
        accel: -speed / STARFALL_TURN_SECONDS,
        size: 9,
        // 丸弾にする
        shape: "circle" as const,
        delayMs: i * 30,
        bulletColor: rainbowColor(i),
      });
    });
    return spawns;
  },
};

export const getAbyssalUpdraftOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const count = 11;
  return Array.from({ length: count }, (_, i) => ({
    x: axisPosition(0, width, i, count),
    y: height,
  }));
};

/** 東方風 — 画面下の基点から上昇弾。安地2列が周期移動 */
export const bossAbyssalUpdraftPattern: ArtCruiseBulletPatternModule = {
  id: "bossAbyssalUpdraft",
  rank: "boss",
  ultimateName: "Abyss Updraft",
  launcherOrigins: ({ width, height }) =>
    getAbyssalUpdraftOrigins(width, height),
  fireIntervalMs: 640,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { bounds } = ctx;
    const config = ctx.tuning?.abyssalUpdraft;
    const origins = getAbyssalUpdraftOrigins(bounds.width, bounds.height);
    const step = Math.floor(ctx.now / 640);
    const gap =
      (step * 5 + Math.floor(Math.sin(step * 1.7) * 3)) % origins.length;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    origins.forEach((origin, i) => {
      if (i === gap || i === (gap + 1) % origins.length) return;
      const wobble = Math.sin(step * 0.9 + i * 1.3);
      const spread = config?.spreadRad === undefined
        ? 0
        : (Math.random() - 0.5) * config.spreadRad;
      spawns.push({
        origin,
        angle: -Math.PI / 2 + wobble * 0.08 + spread,
        speed: 1.86 + ((step + i * 2) % 5) * 0.08,
        size: 9,
        shape: "capsule" as const,
        bulletVariant: "greenCapsule",
        delayMs: i * 18 + ((step * 7 + i * 11) % 36),
        bulletColor: rainbowColor(i),
      });
    });
    return spawns;
  },
};

export const getRovingTurretOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] =>
  Array.from({ length: 6 }, (_, i) => ({
    x: width * (0.14 + 0.72 * (i / 5)),
    y: height * (0.12 + 0.34 * ((i % 2) - 0)),
  }));

/** 東方風 — 発射基点が毎回移動するタレット。基点から連続弾（リング連射）を放つ */
export const bossRovingTurretPattern: ArtCruiseBulletPatternModule = {
  id: "bossRovingTurret",
  rank: "boss",
  ultimateName: "Wandering Cannon",
  launcherOrigins: ({ width, height }) => getRovingTurretOrigins(width, height),
  fireIntervalMs: 1100,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { width, height } = ctx.bounds;
    const origins = getRovingTurretOrigins(width, height);
    // 発射ごとに基点を1つずつ巡回させ、発射基点を毎回移動させる
    const step = Math.floor(ctx.now / 1100);
    const origin = origins[step % origins.length];
    const count = 20;
    // 1発射内で複数リングを時間差で重ねる連続弾
    const bursts = 3;
    const burstGapMs = 130;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    for (let b = 0; b < bursts; b++) {
      const spin = b * (TAU / count / bursts);
      for (let i = 0; i < count; i++) {
        spawns.push({
          origin,
          angle: spin + (TAU * i) / count,
          speed: 1.9,
          size: 9,
          delayMs: b * burstGapMs,
          bulletColor: rainbowColor(step + b),
        });
      }
    }
    return spawns;
  },
};

const EDGE_BARRAGE_DEFAULTS = {
  aimAtPlayer: false,
  fireMode: "sequence",
  turretGapPx: 24,
  bulletsPerWave: 16,
  delayStepMs: 22,
  randomDelayMs: 80,
  spreadRad: 0.04,
  baseSpeed: 2.15,
  accel: 0,
} satisfies Required<ArtCruiseEdgeBarrageConfig>;
const SIDE_KUNAI_FIRE_INTERVAL_MS = 720;
const TOP_ICE_FIRE_INTERVAL_MS = 680;
const EDGE_BEAM_FIRE_INTERVAL_MS = 3600;

const getEdgeBarrageConfig = (
  config?: ArtCruiseEdgeBarrageConfig,
): Required<ArtCruiseEdgeBarrageConfig> => ({
  ...EDGE_BARRAGE_DEFAULTS,
  ...config,
  turretGapPx: Math.max(
    8,
    config?.turretGapPx ?? EDGE_BARRAGE_DEFAULTS.turretGapPx,
  ),
  bulletsPerWave: Math.max(
    1,
    config?.bulletsPerWave ?? EDGE_BARRAGE_DEFAULTS.bulletsPerWave,
  ),
});

export const getSideKunaiBarrageOrigins = (
  width: number,
  height: number,
  gapPx = EDGE_BARRAGE_DEFAULTS.turretGapPx,
): { x: number; y: number }[] => {
  const countPerSide = Math.max(
    2,
    Math.ceil(height / Math.max(8, gapPx)) + 1,
  );
  const origins: { x: number; y: number }[] = [];
  for (let i = 0; i < countPerSide; i++) {
    const y = axisPosition(0, height, i, countPerSide);
    origins.push({ x: 0, y });
    origins.push({ x: width, y });
  }
  return origins;
};

export const getTopIceRainOrigins = (
  width: number,
  gapPx = EDGE_BARRAGE_DEFAULTS.turretGapPx,
): { x: number; y: number }[] => {
  const count = Math.max(2, Math.ceil(width / Math.max(8, gapPx)) + 1);
  return Array.from({ length: count }, (_, i) => ({
    x: axisPosition(0, width, i, count),
    y: 0,
  }));
};

const pickEdgeBarrageOriginIndexes = (
  total: number,
  step: number,
  mode: ArtCruiseEdgeBarrageConfig["fireMode"],
  count: number,
): number[] => {
  if (mode === "all")
    return Array.from({ length: total }, (_, i) => i);

  if (mode === "random") {
    const indexes = new Set<number>();
    while (indexes.size < Math.min(count, total))
      indexes.add(Math.floor(Math.random() * total));
    return Array.from(indexes);
  }

  const start = (step * count) % total;
  return Array.from(
    { length: Math.min(count, total) },
    (_, i) => (start + i) % total,
  );
};

const EDGE_BEAM_DEFAULTS = {
  turretLayout: "perimeter",
  fireMode: "random",
  beamCount: 4,
  beamsPerTurret: 1,
  angleMode: "straight",
  fixedAngle: Math.PI / 2,
  warningMs: 920,
  lifeMs: 760,
  delayStepMs: 120,
  spreadRad: 0.12,
} satisfies Required<ArtCruiseEdgeBeamConfig>;

const getEdgeBeamConfig = (
  config?: ArtCruiseEdgeBeamConfig,
): Required<ArtCruiseEdgeBeamConfig> => ({
  ...EDGE_BEAM_DEFAULTS,
  ...config,
  beamCount: Math.max(1, config?.beamCount ?? EDGE_BEAM_DEFAULTS.beamCount),
  beamsPerTurret: Math.max(
    1,
    config?.beamsPerTurret ?? EDGE_BEAM_DEFAULTS.beamsPerTurret,
  ),
  warningMs: Math.max(200, config?.warningMs ?? EDGE_BEAM_DEFAULTS.warningMs),
  lifeMs: Math.max(180, config?.lifeMs ?? EDGE_BEAM_DEFAULTS.lifeMs),
});

export const getEdgeBeamOrigins = (
  width: number,
  height: number,
  layout: ArtCruiseEdgeBeamConfig["turretLayout"] =
    EDGE_BEAM_DEFAULTS.turretLayout,
): { x: number; y: number }[] => {
  if (layout === "corners")
    return [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ];

  const topCount = 7;
  if (layout === "top")
    return Array.from({ length: topCount }, (_, i) => ({
      x: axisPosition(0, width, i, topCount),
      y: 0,
    }));

  const sideCount = 5;
  const origins: { x: number; y: number }[] = [];
  for (let i = 0; i < topCount; i++) {
    const x = axisPosition(0, width, i, topCount);
    origins.push({ x, y: 0 }, { x, y: height });
  }
  for (let i = 1; i < sideCount - 1; i++) {
    const y = axisPosition(0, height, i, sideCount);
    origins.push({ x: 0, y }, { x: width, y });
  }
  return origins;
};

const getEdgeBeamAngle = (
  origin: { x: number; y: number },
  bounds: { width: number; height: number },
  config: Required<ArtCruiseEdgeBeamConfig>,
) => {
  if (config.angleMode === "fixed") return config.fixedAngle;
  if (config.angleMode === "random") return Math.random() * TAU;
  if (config.angleMode === "center")
    return Math.atan2(bounds.height / 2 - origin.y, bounds.width / 2 - origin.x);

  if (origin.y <= 0) return Math.PI / 2;
  if (origin.y >= bounds.height) return -Math.PI / 2;
  if (origin.x <= 0) return 0;
  if (origin.x >= bounds.width) return Math.PI;

  return Math.atan2(bounds.height / 2 - origin.y, bounds.width / 2 - origin.x);
};

const getSpreadAngle = (
  baseAngle: number,
  beamIndex: number,
  total: number,
  spreadRad: number,
) => {
  if (total <= 1) return baseAngle;
  const t = total === 1 ? 0.5 : beamIndex / (total - 1);
  return baseAngle + (t - 0.5) * spreadRad;
};

export const bossEdgeBeamPattern: ArtCruiseBulletPatternModule = {
  id: "bossEdgeBeam",
  rank: "boss",
  ultimateName: "Warning Beam",
  fireIntervalMs: EDGE_BEAM_FIRE_INTERVAL_MS,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = getEdgeBeamConfig(ctx.tuning?.edgeBeam);
    const origins = getEdgeBeamOrigins(
      ctx.bounds.width,
      ctx.bounds.height,
      config.turretLayout,
    );
    const step = Math.floor(ctx.now / EDGE_BEAM_FIRE_INTERVAL_MS);
    const indexes = pickEdgeBarrageOriginIndexes(
      origins.length,
      step,
      config.fireMode,
      config.beamCount,
    );
    const length = Math.hypot(ctx.bounds.width, ctx.bounds.height) + 220;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    indexes.forEach((index, order) => {
      const origin = origins[index];
      const baseAngle = getEdgeBeamAngle(origin, ctx.bounds, config);
      for (let i = 0; i < config.beamsPerTurret; i++)
        spawns.push({
          origin,
          angle: getSpreadAngle(
            baseAngle,
            i,
            config.beamsPerTurret,
            config.spreadRad,
          ),
          speed: 0,
          size: 11,
          shape: "beam" as const,
          length,
          warningMs: config.warningMs,
          delayMs: config.warningMs + order * config.delayStepMs,
          maxAgeMs: config.lifeMs,
          shotSeId: order === 0 && i === 0 ? "enemy-shot" : undefined,
        });
    });
    return spawns;
  },
};

type FlappyGateResolvedSide = Exclude<
  ArtCruiseFlappyGateSide,
  "random" | "cycle"
>;

const FLAPPY_GATE_SIDES: FlappyGateResolvedSide[] = [
  "right",
  "top",
  "left",
  "bottom",
];

const getFlappyGateConfig = (
  config?: ArtCruiseFlappyGateConfig,
): Required<ArtCruiseFlappyGateConfig> => ({
  side: config?.side ?? "right",
  gateCount: Math.max(1, Math.floor(config?.gateCount ?? 1)),
  gapSize: Math.max(72, config?.gapSize ?? 132),
  thickness: Math.max(8, config?.thickness ?? 20),
  baseSpeed: Math.max(0.1, config?.baseSpeed ?? 2.65),
  delayStepMs: Math.max(0, config?.delayStepMs ?? 380),
  lifeMs: Math.max(400, config?.lifeMs ?? 4200),
  gapJitterPx: config?.gapJitterPx ?? 90,
  gapMoveMinPx: Math.max(0, config?.gapMoveMinPx ?? 36),
  gapMoveMaxPx: Math.max(1, config?.gapMoveMaxPx ?? 118),
});

const seededUnit = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const getBoundedFlappyGapStart = ({
  step,
  minStart,
  maxStart,
  minMove,
  maxMove,
  jitter,
}: {
  step: number;
  minStart: number;
  maxStart: number;
  minMove: number;
  maxMove: number;
  jitter: number;
}) => {
  const range = Math.max(0, maxStart - minStart);
  if (range <= 0) return minStart;

  const safeMaxMove = Math.max(1, Math.min(maxMove, range));
  const safeMinMove = Math.min(minMove, safeMaxMove);
  let gapStart =
    minStart +
    range / 2 +
    (seededUnit(17) - 0.5) * Math.min(jitter, range);
  gapStart = Math.max(minStart, Math.min(maxStart, gapStart));

  for (let i = 1; i <= step; i++) {
    const direction = seededUnit(i * 2 + 31) < 0.5 ? -1 : 1;
    const distance =
      safeMinMove + seededUnit(i * 2 + 32) * (safeMaxMove - safeMinMove);
    let next = gapStart + direction * distance;
    if (next < minStart || next > maxStart)
      next = gapStart - direction * distance;
    gapStart = Math.max(minStart, Math.min(maxStart, next));
  }

  return gapStart;
};

const resolveFlappyGateSide = (
  side: ArtCruiseFlappyGateSide,
  step: number,
): FlappyGateResolvedSide => {
  if (side === "cycle") return FLAPPY_GATE_SIDES[step % FLAPPY_GATE_SIDES.length];
  if (side === "random")
    return FLAPPY_GATE_SIDES[Math.floor(Math.random() * FLAPPY_GATE_SIDES.length)];
  return side;
};

const getFlappyGateGeometry = (
  side: FlappyGateResolvedSide,
  width: number,
  height: number,
) => {
  if (side === "left")
    return { x: 0, y: 0, angle: Math.PI / 2, moveAngle: 0, crossSize: height };
  if (side === "top")
    return { x: 0, y: 0, angle: 0, moveAngle: Math.PI / 2, crossSize: width };
  if (side === "bottom")
    return { x: 0, y: height, angle: 0, moveAngle: -Math.PI / 2, crossSize: width };
  return { x: width, y: 0, angle: Math.PI / 2, moveAngle: Math.PI, crossSize: height };
};

const createFlappyGateSegments = ({
  side,
  width,
  height,
  gapStart,
  gapSize,
  thickness,
  speed,
  lifeMs,
  delayMs,
  shotSeId,
}: {
  side: FlappyGateResolvedSide;
  width: number;
  height: number;
  gapStart: number;
  gapSize: number;
  thickness: number;
  speed: number;
  lifeMs: number;
  delayMs: number;
  shotSeId?: ArtCruiseEnemyBulletSpawn["shotSeId"];
}): ArtCruiseEnemyBulletSpawn[] => {
  const overscan = thickness * 2;
  const gapEnd = gapStart + gapSize;
  const geometry = getFlappyGateGeometry(side, width, height);
  const makeSegment = (
    crossStart: number,
    length: number,
    segmentShotSeId?: ArtCruiseEnemyBulletSpawn["shotSeId"],
  ): ArtCruiseEnemyBulletSpawn => ({
    origin:
      side === "left" || side === "right"
        ? { x: geometry.x, y: crossStart }
        : { x: crossStart, y: geometry.y },
    angle: geometry.angle,
    moveAngle: geometry.moveAngle,
    speed,
    size: thickness,
    shape: "gateBeam",
    length,
    warningMs: 0,
    delayMs,
    maxAgeMs: lifeMs,
    shotSeId: segmentShotSeId,
  });

  return [
    makeSegment(-overscan, gapStart + overscan, shotSeId),
    makeSegment(gapEnd, geometry.crossSize - gapEnd + overscan),
  ];
};

export const bossFlappyGatePattern: ArtCruiseBulletPatternModule = {
  id: "bossFlappyGate",
  rank: "boss",
  ultimateName: "Gate Line",
  fireIntervalMs: 1500,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = getFlappyGateConfig(ctx.tuning?.flappyGate);
    const { width, height } = ctx.bounds;
    const phase = Math.floor(ctx.now / 1500);
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    for (let gateIndex = 0; gateIndex < config.gateCount; gateIndex++) {
      const side = resolveFlappyGateSide(config.side, phase + gateIndex);
      const crossSize = side === "left" || side === "right" ? height : width;
      const gapSize = Math.min(config.gapSize, crossSize * 0.72);
      const minStart = config.thickness;
      const maxStart = Math.max(minStart, crossSize - gapSize - config.thickness);
      const step = phase * config.gateCount + gateIndex;
      const gapStart = getBoundedFlappyGapStart({
        step,
        minStart,
        maxStart,
        minMove: config.gapMoveMinPx,
        maxMove: config.gapMoveMaxPx,
        jitter: config.gapJitterPx,
      });
      spawns.push(
        ...createFlappyGateSegments({
          side,
          width,
          height,
          gapStart,
          gapSize,
          thickness: config.thickness,
          speed: config.baseSpeed,
          lifeMs: config.lifeMs,
          delayMs: gateIndex * config.delayStepMs,
          shotSeId: gateIndex === 0 ? "enemy-shot" : undefined,
        }),
      );
    }

    return spawns;
  },
};

/** 画面左右を隙間なく埋めるタレット列から、中央方向へkunaiを撃つ */
export const bossSideKunaiBarragePattern: ArtCruiseBulletPatternModule = {
  id: "bossSideKunaiBarrage",
  rank: "boss",
  ultimateName: "Kunai Crossfire",
  launcherOrigins: ({ width, height }) =>
    getSideKunaiBarrageOrigins(width, height),
  fireIntervalMs: SIDE_KUNAI_FIRE_INTERVAL_MS,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = getEdgeBarrageConfig(ctx.tuning?.sideKunai);
    const { width, height } = ctx.bounds;
    const origins = getSideKunaiBarrageOrigins(
      width,
      height,
      config.turretGapPx,
    );
    const step = Math.floor(ctx.now / SIDE_KUNAI_FIRE_INTERVAL_MS);
    const indexes = pickEdgeBarrageOriginIndexes(
      origins.length,
      step,
      config.fireMode,
      config.bulletsPerWave,
    );
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    for (let order = 0; order < indexes.length; order++) {
      const index = indexes[order];
      const origin = origins[index];
      const fromLeft = origin.x < width / 2;
      const angle = config.aimAtPlayer
        ? Math.atan2(ctx.playerPos.y - origin.y, ctx.playerPos.x - origin.x)
        : fromLeft
          ? 0
          : Math.PI;
      const spread = config.spreadRad === 0
        ? 0
        : (Math.random() - 0.5) * config.spreadRad;
      const randomDelay =
        config.fireMode === "random"
          ? Math.floor(Math.random() * config.randomDelayMs)
          : 0;

      spawns.push({
        origin,
        angle: angle + spread,
        speed: config.baseSpeed,
        accel: config.accel || undefined,
        size: 8,
        delayMs: order * config.delayStepMs + randomDelay,
        shape: "capsule" as const,
        bulletVariant: "kunaiCapsule",
        bulletColor: fromLeft ? "red" : "purple",
      });
    }

    return spawns;
  },
};

/** 画面上辺を隙間なく埋めるタレット列から、下方向へice capsuleを降らせる */
export const bossTopIceRainPattern: ArtCruiseBulletPatternModule = {
  id: "bossTopIceRain",
  rank: "boss",
  ultimateName: "Icefall Curtain",
  launcherOrigins: ({ width }) => getTopIceRainOrigins(width),
  fireIntervalMs: TOP_ICE_FIRE_INTERVAL_MS,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const config = getEdgeBarrageConfig(ctx.tuning?.topIce);
    const { width } = ctx.bounds;
    const origins = getTopIceRainOrigins(width, config.turretGapPx);
    const step = Math.floor(ctx.now / TOP_ICE_FIRE_INTERVAL_MS);
    const indexes = pickEdgeBarrageOriginIndexes(
      origins.length,
      step,
      config.fireMode,
      config.bulletsPerWave,
    );
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];

    for (let order = 0; order < indexes.length; order++) {
      const origin = origins[indexes[order]];
      const angle = config.aimAtPlayer
        ? Math.atan2(ctx.playerPos.y - origin.y, ctx.playerPos.x - origin.x)
        : Math.PI / 2;
      const spread = config.spreadRad === 0
        ? 0
        : (Math.random() - 0.5) * config.spreadRad;
      const randomDelay =
        config.fireMode === "random"
          ? Math.floor(Math.random() * config.randomDelayMs)
          : 0;

      spawns.push({
        origin,
        angle: angle + spread,
        speed: config.baseSpeed,
        accel: config.accel || undefined,
        size: 8,
        delayMs: order * config.delayStepMs + randomDelay,
        shape: "capsule" as const,
        bulletVariant: "iceCapsule",
        bulletColor: "blue",
      });
    }

    return spawns;
  },
};
