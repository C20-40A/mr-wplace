import type {
  ArtCruiseBulletColor,
  ArtCruiseBulletPatternContext,
  ArtCruiseBulletPatternMeta,
  ArtCruiseBulletPatternTuning,
  ArtCruiseBulletPatternModule,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyBulletSpawn,
  ArtCruiseEnemyRank,
} from "../enemy-rules/types";
import { RAINBOW_COLOR_SEQUENCE } from "../enemy-bullet/data-urls";

// ── individual pattern modules ────────────────────────────────────────────────

const TAU = Math.PI * 2;

const LAUNCHER_MARGIN = 42;
const BULLET_MOTION_SCALE = 74;

/** 水平に等間隔配置した発射基点を生成する共通ヘルパー */
const horizontalOrigins = (
  count: number,
  span: number,
  y: number,
): { x: number; y: number }[] =>
  Array.from({ length: count }, (_, i) => ({
    x: (span * (i + 0.5)) / count,
    y,
  }));

// ── bullet colors ─────────────────────────────────────────────────────────────

/** index を色アートシーケンスに循環マップ。レインボー弾幕用。 */
const rainbowColor = (index: number): ArtCruiseBulletColor =>
  RAINBOW_COLOR_SEQUENCE[
    ((index % RAINBOW_COLOR_SEQUENCE.length) + RAINBOW_COLOR_SEQUENCE.length) %
      RAINBOW_COLOR_SEQUENCE.length
  ];

const nonePattern: ArtCruiseBulletPatternModule = {
  id: "none",
  ultimateName: "Silent Sky",
  fireIntervalMs: Infinity,
  create: () => [],
};

const aimedFanPattern: ArtCruiseBulletPatternModule = {
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

const ringPulsePattern: ArtCruiseBulletPatternModule = {
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

/** 狭角の斜め連射 — 小型雑魚向け */
const spreadBurstPattern: ArtCruiseBulletPatternModule = {
  id: "spreadBurst",
  ultimateName: "Scatter Burst",
  fireIntervalMs: 1100,
  shotSeId: "enemy-shot-short",
  create: (): ArtCruiseEnemyBulletSpawn[] => {
    const base = Math.PI / 2;
    const offsets = [-0.42, -0.24, -0.08, 0.08, 0.24, 0.42];
    return offsets.map((offset, i) => ({
      angle: base + offset,
      speed: 2.62 + i * 0.05,
      size: 10,
      delayMs: i * 22,
      shotSeId: i === 0 ? "enemy-shot-short" : undefined,
      bulletColor: "yellow",
    }));
  },
};

/** 固定方向の多方向射撃 — 画面の動き幅が大きい中型敵向け */
const crossFirePattern: ArtCruiseBulletPatternModule = {
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

/** ボス用の幻想的なサイン波弾幕 */
const bossSineWavePattern: ArtCruiseBulletPatternModule = {
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

/** プレイヤーを狙った高速連射 */
const aimedBurstPattern: ArtCruiseBulletPatternModule = {
  id: "aimedBurst",
  ultimateName: "Needle Rush",
  fireIntervalMs: 1600,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { enemyPos, playerPos } = ctx;
    const count = 5;
    const base = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x);

    return Array.from({ length: count }, (_, i) => ({
      angle: base + (Math.random() - 0.5) * 0.05,
      speed: 3.5 + i * 0.1,
      size: 9,
      delayMs: i * 100,
      shotSeId: i === 0 ? "enemy-shot-short" : undefined,
    }));
  },
};

// ---- BOSS ----

/** ボス周囲から大玉を円形に放つ */
const bossBigRingPattern: ArtCruiseBulletPatternModule = {
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

const FROZEN_COLS = 24;
const FROZEN_ROWS = 32;

const frozenAxisPosition = (
  start: number,
  end: number,
  index: number,
  count: number,
) =>
  count <= 1
    ? (start + end) / 2
    : start + ((end - start) * index) / (count - 1);

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
    const x = frozenAxisPosition(left, right, c, FROZEN_COLS);
    origins.push({ x, y: top });
    origins.push({ x, y: bottom });
  }
  // 左辺・右辺: rows 等分（角は上下辺に含まれるのでスキップ）
  for (let r = 1; r < FROZEN_ROWS - 1; r++) {
    const y = frozenAxisPosition(top, bottom, r, FROZEN_ROWS);
    origins.push({ x: left, y });
    origins.push({ x: right, y });
  }
  return origins;
};

/** 画面4辺に格子状タレットを配置し、中央方向へsin速度変化で連射するパターン */
const bossFrozenLatticePattern: ArtCruiseBulletPatternModule = {
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
const bossPerimeterGapRingPattern: ArtCruiseBulletPatternModule = {
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

/** 画面枠への衝突点から、反射方向のレーザー弾を一度だけ追加発射する */
const bossReflectLaserPattern: ArtCruiseBulletPatternModule = {
  id: "bossReflectLaser",
  rank: "boss",
  ultimateName: "Reflection Ray",
  fireIntervalMs: 1800,
  shotSeId: "enemy-shot",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { enemyPos, playerPos, now } = ctx;
    const base = Math.atan2(playerPos.y - enemyPos.y, playerPos.x - enemyPos.x);
    const offsets = [-0.46, -0.28, -0.1, 0.1, 0.28, 0.46];
    const weave = Math.sin(now / 700) * 0.16;

    return offsets.map((offset, i) => ({
      angle: base + offset + weave,
      speed: 2.7 + (i % 2) * 0.18,
      size: 15,
      delayMs: i * 120,
      splitOnBoundary: true,
      maxAgeMs: 7600,
      shape: "laser",
      length: 168,
      trailMs: 520,
      shotSeId: i === 0 ? "enemy-shot" : undefined,
    }));
  },
};

/** 東方風 — 超高密度リングを3連射→休止→3連射のwaveで繰り返す */
const bossDenseRingPattern: ArtCruiseBulletPatternModule = {
  id: "bossDenseRing",
  rank: "boss",
  ultimateName: "Crimson Eclipse",
  fireIntervalMs: 380,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    // 1サイクル = 3発射 + 2休止 = 5スロット × 420ms = 2100ms
    const FIRE_SLOTS = 3;
    const CYCLE_SLOTS = 5;
    const slot = Math.floor(ctx.now / 420) % CYCLE_SLOTS;
    if (slot >= FIRE_SLOTS) return [];

    const count = 64;
    // スロットごとに位相をずらして3連射を少しずつ回転させる
    const phase =
      ((ctx.now / 1600) % TAU) + slot * (TAU / (FIRE_SLOTS * count));

    return Array.from({ length: count }, (_, i) => ({
      angle: phase + (TAU * i) / count,
      speed: 1.25 + (i % 2) * 0.06,
      size: 7,
      delayMs: 0,
      // Crimson Eclipse — 深紅の弾アート
      bulletColor: "red",
      shotSeId: i === 0 ? "enemy-shot" : undefined,
      // shape: "capsule" as const,
    }));
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
const bossWeavingStreamPattern: ArtCruiseBulletPatternModule = {
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
          bulletColor: rainbowColor(originIndex),
        });
      }
    });

    return spawns;
  },
};

/** 東方風 — 双腕螺旋。時間で回転する2本の弾列を連続発射する */
const spiralShotPattern: ArtCruiseBulletPatternModule = {
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
const petalRingPattern: ArtCruiseBulletPatternModule = {
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
const switchFanPattern: ArtCruiseBulletPatternModule = {
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

/** 東方風 — 4腕の銀河渦。発射ステップごとに一定角ずつ回り、腕が虹色に変化する */
const bossGalaxyVortexPattern: ArtCruiseBulletPatternModule = {
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
const bossLotusBloomPattern: ArtCruiseBulletPatternModule = {
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

const STARFALL_COLS = 9;
const STARFALL_TURN_SECONDS = 2.2;

export const getStarfallOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const origins: { x: number; y: number }[] = [];
  for (let i = 0; i < STARFALL_COLS; i++) {
    const x = frozenAxisPosition(0, width, i, STARFALL_COLS);
    origins.push({ x, y: 0 });
    origins.push({ x, y: height });
  }
  return origins;
};

/** 東方風 — 上下9基点から中心へ収束して反転する星雨。安地2列が左から右へ周期移動する */
const bossStarfallPattern: ArtCruiseBulletPatternModule = {
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

/** 東方風 — 全方向リングを連続発射し、後発ほど高速になる多層の速度差弾幕 */
const bossClusterVolleyPattern: ArtCruiseBulletPatternModule = {
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

export const getAbyssalUpdraftOrigins = (
  width: number,
  height: number,
): { x: number; y: number }[] => {
  const count = 11;
  return Array.from({ length: count }, (_, i) => ({
    x: frozenAxisPosition(0, width, i, count),
    y: height,
  }));
};

/** 東方風 — 画面下の基点から上昇弾。安地2列が周期移動 */
const bossAbyssalUpdraftPattern: ArtCruiseBulletPatternModule = {
  id: "bossAbyssalUpdraft",
  rank: "boss",
  ultimateName: "Abyss Updraft",
  launcherOrigins: ({ width, height }) =>
    getAbyssalUpdraftOrigins(width, height),
  fireIntervalMs: 640,
  shotSeId: "enemy-shot-short",
  create: (ctx): ArtCruiseEnemyBulletSpawn[] => {
    const { bounds } = ctx;
    const origins = getAbyssalUpdraftOrigins(bounds.width, bounds.height);
    const step = Math.floor(ctx.now / 640);
    const gap =
      (step * 5 + Math.floor(Math.sin(step * 1.7) * 3)) % origins.length;
    const spawns: ArtCruiseEnemyBulletSpawn[] = [];
    origins.forEach((origin, i) => {
      if (i === gap || i === (gap + 1) % origins.length) return;
      const wobble = Math.sin(step * 0.9 + i * 1.3);
      spawns.push({
        origin,
        angle: -Math.PI / 2 + wobble * 0.08,
        speed: 1.86 + ((step + i * 2) % 5) * 0.08,
        size: 9,
        shape: "capsule" as const,
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
const bossRovingTurretPattern: ArtCruiseBulletPatternModule = {
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

/** 東方風 — 超巨大弾のゆっくりした円形弾幕 */
const bossGigantoRingPattern: ArtCruiseBulletPatternModule = {
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

// ── registry ──────────────────────────────────────────────────────────────────

const PATTERN_REGISTRY = new Map<
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseBulletPatternModule
>(
  [
    nonePattern,
    aimedFanPattern,
    ringPulsePattern,
    spreadBurstPattern,
    crossFirePattern,
    bossSineWavePattern,
    aimedBurstPattern,
    bossBigRingPattern,
    bossPerimeterGapRingPattern,
    bossReflectLaserPattern,
    bossDenseRingPattern,
    bossWeavingStreamPattern,
    spiralShotPattern,
    petalRingPattern,
    switchFanPattern,
    bossGalaxyVortexPattern,
    bossLotusBloomPattern,
    bossStarfallPattern,
    bossFrozenLatticePattern,
    bossClusterVolleyPattern,
    bossAbyssalUpdraftPattern,
    bossRovingTurretPattern,
    bossGigantoRingPattern,
  ].map((m) => [m.id, m]),
);

/** 登録済み弾幕パターン id の一覧（debug 用） */
export const ART_CRUISE_BULLET_PATTERN_IDS = Array.from(
  PATTERN_REGISTRY.keys(),
);

export const getBulletPatternFireInterval = (
  pattern: ArtCruiseEnemyBulletPatternId,
  tuning?: ArtCruiseBulletPatternTuning,
): number =>
  (PATTERN_REGISTRY.get(pattern)?.fireIntervalMs ?? 1200) *
  (tuning?.intervalScale ?? 1);

export const getBulletPatternShotSeId = (
  pattern: ArtCruiseEnemyBulletPatternId,
) => PATTERN_REGISTRY.get(pattern)?.shotSeId;

/** パターンのメタ情報を取得（rank / ultimateName / launcherOrigins） */
export const getBulletPatternMeta = (
  pattern: ArtCruiseEnemyBulletPatternId,
): ArtCruiseBulletPatternMeta | undefined => PATTERN_REGISTRY.get(pattern);

/** rank で絞り込んだパターン id 一覧（boss 抽選などに利用） */
export const getBulletPatternIdsByRank = (
  rank: ArtCruiseEnemyRank,
): ArtCruiseEnemyBulletPatternId[] =>
  Array.from(PATTERN_REGISTRY.values())
    .filter((m) => (m.rank ?? "grunt") === rank)
    .map((m) => m.id);

/** ランチャー基点を返す。launcherOrigins 未定義のパターンは null。 */
export const getBulletPatternLauncherOrigins = (
  pattern: ArtCruiseEnemyBulletPatternId,
  bounds: { width: number; height: number },
): { x: number; y: number }[] | null =>
  PATTERN_REGISTRY.get(pattern)?.launcherOrigins?.(bounds) ?? null;

export const createEnemyBulletSpawns = (
  pattern: ArtCruiseEnemyBulletPatternId,
  ctx: ArtCruiseBulletPatternContext,
): ArtCruiseEnemyBulletSpawn[] => {
  const spawns = PATTERN_REGISTRY.get(pattern)?.create(ctx) ?? [];
  const tuning = ctx.tuning;
  if (!tuning) return spawns;

  const speedScale = tuning.speedScale ?? 1;
  const accelScale = tuning.accelScale ?? speedScale;
  const sizeScale = tuning.sizeScale ?? 1;
  const delayScale = tuning.delayScale ?? 1;

  return spawns.map((spawn) => ({
    ...spawn,
    speed: spawn.speed * speedScale,
    accel: spawn.accel === undefined ? undefined : spawn.accel * accelScale,
    size: spawn.size === undefined ? undefined : spawn.size * sizeScale,
    delayMs:
      spawn.delayMs === undefined ? undefined : spawn.delayMs * delayScale,
    length: spawn.length === undefined ? undefined : spawn.length * sizeScale,
  }));
};

/** 新パターンモジュールを外部から登録できる拡張ポイント */
export const registerBulletPattern = (module: ArtCruiseBulletPatternModule) =>
  PATTERN_REGISTRY.set(module.id, module);
