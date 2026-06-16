import type { ArtCruisePixiEnemyBullet } from "../types";

export const updatePixiEnemyBulletMovement = (
  bullet: ArtCruisePixiEnemyBullet,
  now: number,
) => {
  if (now < bullet.bornAt) {
    bullet.view.visible = false;
    return;
  }

  bullet.view.visible = true;
  if (bullet.maxAgeMs && bullet.shape === "capsule")
    bullet.view.alpha = getBulletAlpha(bullet, now);

  const elapsed = (now - bullet.bornAt) / 1000;

  // 進行方向への等加速度運動。accel が負なら減速後に逆走する。
  const distance =
    bullet.accel === undefined
      ? bullet.speed * elapsed
      : bullet.speed * elapsed + 0.5 * bullet.accel * elapsed * elapsed;

  bullet.view.x = bullet.originX + bullet.dirX * distance;
  bullet.view.y = bullet.originY + bullet.dirY * distance;
};

const getBulletAlpha = (bullet: ArtCruisePixiEnemyBullet, now: number) => {
  if (!bullet.maxAgeMs || bullet.shape !== "capsule") return 1;

  const age = now - bullet.bornAt;
  const fadeIn = Math.min(220, bullet.maxAgeMs * 0.16);
  const fadeOut = Math.min(620, bullet.maxAgeMs * 0.22);
  const entering = Math.min(1, age / fadeIn);
  const leaving = Math.min(1, (bullet.maxAgeMs - age) / fadeOut);
  return Math.max(0, Math.min(entering, leaving));
};
