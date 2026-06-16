/**
 * 敵弾の当たり判定形状 — 判定とデバッグ描画の単一ソース。
 *
 * 弾から `BulletHitbox`(絞り係数を焼き込んだ実効形状)を一度だけ導出し、
 * - `hitTestBullet`  : プレイヤー被弾判定
 * - `strokeBulletHitbox` : デバッグ表示
 * の両方が同じ hitbox を消費する。これにより判定と表示が原理的にズレない。
 */
import type { Graphics } from "pixi.js";

/** capsule(laser)判定を見た目より絞る係数。長さ・横幅それぞれに適用 */
const CAPSULE_LENGTH_SCALE = 0.8;
const CAPSULE_WIDTH_SCALE = 0.5;
/** 先頭(x,y)側をこの割合だけ内側に絞る(length比) */
const CAPSULE_HEAD_INSET = 0.06;

export type BulletHitbox =
  | { kind: "circle"; x: number; y: number; r: number }
  | {
      kind: "ellipse";
      x: number;
      y: number;
      angle: number;
      rx: number;
      ry: number;
    }
  | {
      kind: "capsule";
      x: number;
      y: number;
      angle: number;
      length: number;
      r: number;
    };

type HittableBullet = {
  view: { x: number; y: number };
  angle: number;
  dirX?: number;
  dirY?: number;
  hitRadius: number;
  shape?: "circle" | "capsule" | "ellipse";
  length?: number;
  radiusY?: number;
};

const hitTestCapsule = (
  x: number,
  y: number,
  cos: number,
  sin: number,
  length: number,
  r: number,
  px: number,
  py: number,
  playerR: number,
) => {
  const dx = px - x;
  const dy = py - y;
  const along = dx * cos + dy * sin;
  if (along < -length || along > 0) return false;
  const perp = Math.abs(-dx * sin + dy * cos);
  return perp <= r + playerR;
};

const hitTestEllipse = (
  x: number,
  y: number,
  cos: number,
  sin: number,
  rx: number,
  ry: number,
  px: number,
  py: number,
  playerR: number,
) => {
  const dx = px - x;
  const dy = py - y;
  const local = (dx * cos + dy * sin) / (rx + playerR);
  const perp = (-dx * sin + dy * cos) / (ry + playerR);
  return local * local + perp * perp <= 1;
};

/** 弾から実効当たり判定形状を導出する(絞り係数込み) */
export const getBulletHitbox = (bullet: HittableBullet): BulletHitbox => {
  const { x, y } = bullet.view;

  if (bullet.shape === "capsule" && bullet.length) {
    const cos = bullet.dirX ?? Math.cos(bullet.angle);
    const sin = bullet.dirY ?? Math.sin(bullet.angle);
    const length = bullet.length * CAPSULE_LENGTH_SCALE;
    const headInset = length * CAPSULE_HEAD_INSET;
    return {
      kind: "capsule",
      // 先頭を inset 分だけ後ろ(-angle方向)へ下げ、その分 length を縮める
      x: x - cos * headInset,
      y: y - sin * headInset,
      angle: bullet.angle,
      length: length - headInset,
      r: bullet.hitRadius * CAPSULE_WIDTH_SCALE,
    };
  }

  if (bullet.shape === "ellipse")
    return {
      kind: "ellipse",
      x,
      y,
      angle: bullet.angle,
      rx: bullet.hitRadius,
      ry: bullet.radiusY ?? bullet.hitRadius,
    };

  return { kind: "circle", x, y, r: bullet.hitRadius };
};

/** 毎フレーム用: BulletHitboxオブジェクトを生成せず直接被弾判定する */
export const hitTestHittableBullet = (
  bullet: HittableBullet,
  px: number,
  py: number,
  playerR: number,
): boolean => {
  const { x, y } = bullet.view;

  if (bullet.shape === "capsule" && bullet.length) {
    const cos = bullet.dirX ?? Math.cos(bullet.angle);
    const sin = bullet.dirY ?? Math.sin(bullet.angle);
    const length = bullet.length * CAPSULE_LENGTH_SCALE;
    const headInset = length * CAPSULE_HEAD_INSET;
    return hitTestCapsule(
      x - cos * headInset,
      y - sin * headInset,
      cos,
      sin,
      length - headInset,
      bullet.hitRadius * CAPSULE_WIDTH_SCALE,
      px,
      py,
      playerR,
    );
  }

  if (bullet.shape === "ellipse")
    return hitTestEllipse(
      x,
      y,
      bullet.dirX ?? Math.cos(bullet.angle),
      bullet.dirY ?? Math.sin(bullet.angle),
      bullet.hitRadius,
      bullet.radiusY ?? bullet.hitRadius,
      px,
      py,
      playerR,
    );

  const dx = px - x;
  const dy = py - y;
  const r = bullet.hitRadius + playerR;
  return dx * dx + dy * dy <= r * r;
};

/** プレイヤー(半径 playerR の点円)が hitbox に接触しているか */
export const hitTestBullet = (
  h: BulletHitbox,
  px: number,
  py: number,
  playerR: number,
): boolean => {
  if (h.kind === "capsule") {
    // 先頭(x,y)から -angle 方向に length 伸びる帯。射影[-length,0]内かつ垂線距離判定
    return hitTestCapsule(
      h.x,
      h.y,
      Math.cos(h.angle),
      Math.sin(h.angle),
      h.length,
      h.r,
      px,
      py,
      playerR,
    );
  }

  if (h.kind === "ellipse") {
    // playerR を各軸半径に加算した楕円内判定(プレイヤーを円→楕円膨張で近似)
    return hitTestEllipse(
      h.x,
      h.y,
      Math.cos(h.angle),
      Math.sin(h.angle),
      h.rx,
      h.ry,
      px,
      py,
      playerR,
    );
  }

  const dx = px - h.x;
  const dy = py - h.y;
  const r = h.r + playerR;
  return dx * dx + dy * dy <= r * r;
};

/** デバッグ表示: hitbox 形状をそのまま stroke する(playerR は含めない) */
export const strokeBulletHitbox = (
  g: Graphics,
  h: BulletHitbox,
  color: string,
  width: number,
) => {
  if (h.kind === "capsule") {
    const cos = Math.cos(h.angle);
    const sin = Math.sin(h.angle);
    const nx = -sin * h.r;
    const ny = cos * h.r;
    const tailX = h.x - cos * h.length;
    const tailY = h.y - sin * h.length;
    g.moveTo(h.x + nx, h.y + ny)
      .lineTo(tailX + nx, tailY + ny)
      .lineTo(tailX - nx, tailY - ny)
      .lineTo(h.x - nx, h.y - ny)
      .lineTo(h.x + nx, h.y + ny)
      .stroke({ color, width, alpha: 0.9 });
    return;
  }

  if (h.kind === "ellipse") {
    const cos = Math.cos(h.angle);
    const sin = Math.sin(h.angle);
    const steps = 32;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      const lx = h.rx * Math.cos(t);
      const ly = h.ry * Math.sin(t);
      const ex = h.x + lx * cos - ly * sin;
      const ey = h.y + lx * sin + ly * cos;
      if (i === 0) g.moveTo(ex, ey);
      else g.lineTo(ex, ey);
    }
    g.stroke({ color, width, alpha: 0.9 });
    return;
  }

  g.circle(h.x, h.y, h.r).stroke({ color, width, alpha: 0.9 });
};
