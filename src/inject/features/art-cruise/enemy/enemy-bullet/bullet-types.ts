/**
 * 弾種定義 — 弾の見た目・当たり判定・形状を一元管理する単一ソース。
 *
 * spawn.shape (パターン側が指定する弾種) をキーに、描画/判定の属性をまとめる。
 * 弾幕パターンは「どの弾種を撃つか(shape)」と「大きさ(size)」だけを決め、
 * hitbox や描画比率といった弾固有の性質はここで定義する。
 */

/** パターン側が指定する弾種 */
export type ArtCruiseBulletSpawnShape =
  | "circle"
  | "laser"
  | "muzzle"
  | "capsule";

/** 当たり判定に使う形状 */
export type ArtCruiseBulletHitShape = "circle" | "capsule" | "ellipse";

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
  // capsule(緑カプセル画像, 7x10) -> ellipse判定。画像比率10/7を判定にも反映
  capsule: { hitShape: "ellipse", hitScale: 0.85, radiusYRatio: 7 / 10 },
  // muzzle(発射炎) -> circle判定
  muzzle: { hitShape: "circle", hitScale: 1 },
  // circle(青弾) -> circle判定。見た目より少し小さめのhitbox
  circle: { hitShape: "circle", hitScale: 0.85 },
};

export const getBulletType = (
  shape: ArtCruiseBulletSpawnShape | undefined,
): ArtCruiseBulletTypeDef => BULLET_TYPES[shape ?? "circle"];
