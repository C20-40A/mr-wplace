/**
 * 弾種定義 — 弾の見た目・当たり判定・形状を一元管理する単一ソース。
 *
 * spawn.shape (パターン側が指定する弾種) をキーに、描画/判定の属性をまとめる。
 * 弾幕パターンは「どの弾種を撃つか(shape)」と「大きさ(size)」だけを決め、
 * hitbox や描画比率といった弾固有の性質はここで定義する。
 */
import type {
  ArtCruiseBulletColor,
  ArtCruiseBulletVariant,
} from "../enemy-rules/types";

/** パターン側が指定する弾種 */
export type ArtCruiseBulletSpawnShape =
  | "circle"
  | "laser"
  | "muzzle"
  | "capsule"
  | "beam"
  | "gateBeam";

/** 当たり判定に使う形状 */
export type ArtCruiseBulletHitShape = "circle" | "capsule" | "ellipse" | "rect";

export type ArtCruiseBulletTypeDef = {
  /** 当たり判定形状 */
  hitShape: ArtCruiseBulletHitShape;
  /** 当たり判定半径 = radius * hitScale (1未満で画像より小さいhitbox) */
  hitScale: number;
  /** ellipse判定時の縦半径比 (radiusY = radius * radiusYRatio)。未指定なら円 */
  radiusYRatio?: number;
};

export const BULLET_TYPES: Record<
  ArtCruiseBulletSpawnShape,
  ArtCruiseBulletTypeDef
> = {
  // laser(beam画像) -> capsule判定(線分+radius)。細長いので判定をやや絞る
  laser: { hitShape: "capsule", hitScale: 0.8 },
  // beam(長い警告つき帯) -> 角丸なしの矩形判定
  beam: { hitShape: "rect", hitScale: 0.72 },
  // gateBeam(Flappy Gate専用の発光壁) -> 見た目に近い矩形判定
  gateBeam: { hitShape: "rect", hitScale: 0.86 },
  // capsule(緑カプセル画像, 7x10) -> ellipse判定。画像比率10/7を判定にも反映
  capsule: { hitShape: "ellipse", hitScale: 0.85, radiusYRatio: 7 / 10 },
  // muzzle(発射炎) -> circle判定
  muzzle: { hitShape: "circle", hitScale: 1 },
  // circle(青弾) -> circle判定。見た目より少し小さめのhitbox
  circle: { hitShape: "circle", hitScale: 0.85 },
};

const CAPSULE_RADIUS_Y_RATIOS: Record<ArtCruiseBulletVariant, number> = {
  greenCapsule: 7 / 10,
  iceCapsule: 7 / 15,
  kunaiCapsule: 7 / 14,
  smallSilver: 1,
  silverCapsule: 8 / 16,
};

const LEGACY_CAPSULE_VARIANT_BY_COLOR: Partial<
  Record<ArtCruiseBulletColor, ArtCruiseBulletVariant>
> = {
  blue: "iceCapsule",
  red: "kunaiCapsule",
  green: "greenCapsule",
  yellow: "greenCapsule",
  purple: "silverCapsule",
};

export const getBulletType = (
  shape: ArtCruiseBulletSpawnShape | undefined,
  color?: ArtCruiseBulletColor,
  variant?: ArtCruiseBulletVariant,
): ArtCruiseBulletTypeDef => {
  const bulletType = BULLET_TYPES[shape ?? "circle"];
  if (shape !== "capsule") return bulletType;
  const capsuleVariant = variant ?? (color && LEGACY_CAPSULE_VARIANT_BY_COLOR[color]);
  if (!capsuleVariant) return bulletType;
  return { ...bulletType, radiusYRatio: CAPSULE_RADIUS_Y_RATIOS[capsuleVariant] };
};
