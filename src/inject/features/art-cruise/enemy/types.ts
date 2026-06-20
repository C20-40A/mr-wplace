import type { Container, Sprite } from "pixi.js";
import type { PooledBulletView } from "../sprite-pool";
import type { ArtCruisePixiDynamicEnemyAsset } from "./enemy-graphics/pixi-enemy-graphic-pool";
import type {
  ArtCruiseBulletColor,
  ArtCruiseBulletVariant,
  ArtCruiseBulletPatternTuning,
  ArtCruiseEnemyConfig,
  ArtCruiseEnemyBulletPatternId,
  ArtCruiseEnemyMovementId,
} from "./enemy-rules/types";
import type { ArtCruiseBossPhaseConfig } from "./boss/boss-pattern-config";

export type ArtCruisePixiEnemy = {
  view: Container;
  vx: number;
  hp: number;
  radius: number;
  phase: number;
  spawnedAt: number;
  /** パターン id ごとの最終発射時刻。ボスの複数パターン同時発射用に独立管理する。 */
  lastFiredAt: Record<string, number>;
  originX?: number;
  originY?: number;
  enteredScreen?: boolean;
  dynamicAsset?: ArtCruisePixiDynamicEnemyAsset;
  config: ArtCruiseEnemyConfig;
  /** 同時発射する弾幕パターン群。通常敵は1要素、ボスはフェーズごとに複数を組み合わせる。 */
  bulletPatterns: ArtCruiseEnemyBulletPatternId[];
  bulletTuning?: ArtCruiseBulletPatternTuning;
  bulletPatternTunings?: Partial<
    Record<ArtCruiseEnemyBulletPatternId, ArtCruiseBulletPatternTuning>
  >;
  bossPhases?: ArtCruiseBossPhaseConfig[];
  bossPhaseIndex?: number;
  invincibleUntil?: number;
  movement: ArtCruiseEnemyMovementId;
  squadId?: string;
  squadIndex?: number;
};

export type ArtCruisePixiPlayerBullet = {
  view: Sprite;
  vy: number;
  /** 当たり判定用の矩形half-extent (中心からX/Y方向の半幅) */
  halfW: number;
  halfH: number;
};

export type ArtCruisePixiEnemyBullet = {
  view: Container;
  /** プール返却用の借用セット参照 */
  pooled: PooledBulletView;
  originX: number;
  originY: number;
  angle: number;
  dirX: number;
  dirY: number;
  moveDirX?: number;
  moveDirY?: number;
  speed: number;
  /** 進行方向への加速度(px/s^2)。負値で減速→停止→逆走。未指定は0。 */
  accel?: number;
  /** 加速度つき移動時の最低速度。未指定なら速度下限なし。 */
  minSpeed?: number;
  radius: number;
  hitRadius: number;
  bornAt: number;
  splitOnBoundary?: boolean;
  boundarySplitDone?: boolean;
  maxAgeMs?: number;
  shape?: "circle" | "capsule" | "ellipse" | "rect";
  length?: number;
  trailMs?: number;
  radiusY?: number;
  warningMs?: number;
  /** circle弾の色アート。boundary split時に引き継ぐ */
  bulletColor?: ArtCruiseBulletColor;
  /** 色とは独立した弾画像。boundary split時に引き継ぐ */
  bulletVariant?: ArtCruiseBulletVariant;
  rotateToAngle?: boolean;
  rotationOffset?: number;
};
