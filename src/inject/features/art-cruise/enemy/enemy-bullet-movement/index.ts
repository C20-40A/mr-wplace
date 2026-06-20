import type { ArtCruisePixiEnemyBullet } from "../types";

export const updatePixiEnemyBulletMovement = (
  bullet: ArtCruisePixiEnemyBullet,
  now: number,
) => {
  if (bullet.shape === "rect") {
    updateBeamState(bullet, now);
    return;
  }

  if (now < bullet.bornAt) {
    if (bullet.view.visible) bullet.view.visible = false;
    return;
  }

  if (!bullet.view.visible) bullet.view.visible = true;
  if (bullet.maxAgeMs && bullet.shape === "capsule")
    bullet.view.alpha = getBulletAlpha(bullet, now);

  const elapsed = (now - bullet.bornAt) / 1000;

  // 進行方向への等加速度運動。accel が負なら減速後に逆走する。
  const distance = getBulletDistance(bullet, elapsed);

  bullet.view.x = bullet.originX + bullet.dirX * distance;
  bullet.view.y = bullet.originY + bullet.dirY * distance;
};

const updateBeamState = (bullet: ArtCruisePixiEnemyBullet, now: number) => {
  const warningMs = bullet.warningMs ?? 900;
  const startsAt = bullet.bornAt - warningMs;

  const elapsed = Math.max(0, (now - bullet.bornAt) / 1000);
  const distance = getBulletDistance(bullet, elapsed);
  const moveDirX = bullet.moveDirX ?? bullet.dirX;
  const moveDirY = bullet.moveDirY ?? bullet.dirY;
  bullet.view.x = bullet.originX + moveDirX * distance;
  bullet.view.y = bullet.originY + moveDirY * distance;

  if (now < startsAt) {
    if (bullet.view.visible) bullet.view.visible = false;
    return;
  }

  if (!bullet.view.visible) bullet.view.visible = true;
  const warning = bullet.pooled.warning;
  const beam = bullet.pooled.beam;

  if (now < bullet.bornAt) {
    const t = (now - startsAt) / Math.max(1, warningMs);
    if (warning) {
      if (!warning.visible) warning.visible = true;
      warning.alpha = 0.22 + Math.sin(t * Math.PI * 7) * 0.12 + t * 0.42;
    }
    if (beam?.visible) beam.visible = false;
    return;
  }

  if (warning?.visible) warning.visible = false;
  if (beam) {
    if (!beam.visible) beam.visible = true;
    beam.alpha = getBeamAlpha(bullet, now);
  }
};

const getBulletDistance = (
  bullet: ArtCruisePixiEnemyBullet,
  elapsed: number,
) => {
  if (bullet.accel === undefined)
    return bullet.speed * elapsed;

  if (
    bullet.minSpeed === undefined ||
    bullet.accel >= 0
  )
    return bullet.speed * elapsed + 0.5 * bullet.accel * elapsed * elapsed;

  if (bullet.speed <= bullet.minSpeed)
    return bullet.minSpeed * elapsed;

  const clampAt = (bullet.minSpeed - bullet.speed) / bullet.accel;
  if (elapsed <= clampAt)
    return bullet.speed * elapsed + 0.5 * bullet.accel * elapsed * elapsed;

  const clampDistance =
    bullet.speed * clampAt + 0.5 * bullet.accel * clampAt * clampAt;
  return clampDistance + bullet.minSpeed * (elapsed - clampAt);
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

const getBeamAlpha = (bullet: ArtCruisePixiEnemyBullet, now: number) => {
  if (!bullet.maxAgeMs) return 1;

  const age = now - bullet.bornAt;
  const fadeIn = Math.min(180, bullet.maxAgeMs * 0.2);
  const fadeOut = Math.min(260, bullet.maxAgeMs * 0.24);
  const entering = Math.min(1, age / fadeIn);
  const leaving = Math.min(1, (bullet.maxAgeMs - age) / fadeOut);
  return Math.max(0, Math.min(entering, leaving));
};
