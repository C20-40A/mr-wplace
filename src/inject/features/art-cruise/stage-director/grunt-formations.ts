import type { ArtCruiseStageSpawn } from "./types";
import type { ArtCruiseEnemyMovementId } from "../enemy/enemy-rules/types";
import {
  vFormationSpawns,
  straightPassSpawns,
  snakeSpawns,
} from "../enemy/enemy-movement/squad-formations";

// grunt spawn の薄いコンストラクタ。bulletPattern は config 側で後付けするため未指定。
const grunt = (
  delayMs: number,
  yRatio: number,
  speedScale = 1,
  xRatio?: number,
  movement: ArtCruiseEnemyMovementId = "frontCross",
): ArtCruiseStageSpawn => ({
  rank: "grunt",
  delayMs,
  xRatio,
  yRatio,
  movement,
  speedScale,
});

/**
 * フォーメーションごとの spawn 列生成関数。
 * 隊形(movement/座標) のみを定義し、bulletPattern は grunt-level-config 側で割り当てる。
 * squad 系は squad-formations の生成関数へ委譲する。
 */
export const GRUNT_FORMATION_BUILDERS = {
  // 正面から1体ずつ間を取って降りてくる立ち上がり用
  opening: (): ArtCruiseStageSpawn[] => [
    grunt(900, 0.24, 0.95),
    grunt(1100, 0.52, 1.04),
    grunt(1000, 0.36, 1),
  ],

  // 正面から波打つように連続降下
  rollingWave: (): ArtCruiseStageSpawn[] => [
    grunt(620, 0.3, 0.96),
    grunt(120, 0.5, 1.02),
    grunt(120, 0.7, 0.98),
    grunt(620, 0.42, 1),
    grunt(120, 0.62, 1.04),
    grunt(120, 0.34, 0.94),
  ],

  // 正面から細かく刻むスウォーム
  staggeredSwarm: (): ArtCruiseStageSpawn[] => [
    grunt(520, 0.28, 0.95),
    grunt(90, 0.5, 1.05),
    grunt(90, 0.36, 1),
    grunt(560, 0.6, 0.98),
    grunt(90, 0.44, 1.02),
  ],

  // 上辺から縦に降りる横一列
  topLine: (): ArtCruiseStageSpawn[] =>
    [0.24, 0.38, 0.52, 0.66].map((xRatio, i) =>
      grunt(220 + i * 120, -0.08, 0.82, xRatio, "downLine"),
    ),

  // 左右対称の斜め進入
  mirroredDiagonals: (): ArtCruiseStageSpawn[] => [
    grunt(420, -0.08, 0.92, 0.26, "diagonalRight"),
    grunt(0, -0.12, 0.92, 0.74, "diagonalLeft"),
    grunt(360, -0.08, 0.98, 0.34, "diagonalRight"),
    grunt(0, -0.12, 0.98, 0.66, "diagonalLeft"),
  ],

  // 横からのぞき込む小隊
  sidePeekers: (): ArtCruiseStageSpawn[] => [
    grunt(550, 0.25, 0.85, 1.08, "sidePeek"),
    grunt(400, 0.44, 0.89, 1.08, "sidePeek"),
    grunt(400, 0.63, 0.93, 1.08, "sidePeek"),
  ],

  // 横から波状に押し寄せる
  sideCrestWave: (): ArtCruiseStageSpawn[] => [
    grunt(520, 0.24, 0.9, 1.08, "sidePeek"),
    grunt(70, 0.34, 0.94, 1.08, "sidePeek"),
    grunt(70, 0.44, 0.98, 1.08, "sidePeek"),
    grunt(740, 0.56, 1, 1.08, "sidePeek"),
    grunt(80, 0.46, 0.96, 1.08, "sidePeek"),
    grunt(80, 0.36, 0.92, 1.08, "sidePeek"),
  ],

  // ボス撃破直後の追い込みラッシュ
  afterBossRush: (): ArtCruiseStageSpawn[] => [
    grunt(900, 0.18, 1.16),
    grunt(320, 0.34, 1.2),
    grunt(320, 0.5, 1.14),
    grunt(650, 0.26, 1.08),
  ],

  // squad 隊形系
  vFormation: (): ArtCruiseStageSpawn[] =>
    vFormationSpawns(`vFormation_${Date.now()}`),
  straightPass: (): ArtCruiseStageSpawn[] =>
    straightPassSpawns(`straightPass_${Date.now()}`),
  snake: (): ArtCruiseStageSpawn[] => snakeSpawns(`snake_${Date.now()}`),
} as const;

export type GruntFormationId = keyof typeof GRUNT_FORMATION_BUILDERS;

/** 全フォーメーション id 一覧(デバッグ用に level 非依存で列挙) */
export const ALL_GRUNT_FORMATION_IDS = Object.keys(
  GRUNT_FORMATION_BUILDERS,
) as GruntFormationId[];
