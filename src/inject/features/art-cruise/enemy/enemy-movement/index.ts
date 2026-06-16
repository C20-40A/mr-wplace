import type { ArtCruisePixiEnemy } from "../types";

export const moveDownLine = (
  enemy: ArtCruisePixiEnemy,
  elapsed: number,
  deltaSeconds: number,
) => {
  const speed = Math.abs(enemy.vx);
  enemy.view.y += speed * 0.72 * deltaSeconds;
  enemy.view.rotation = Math.sin(elapsed * 1.8 + enemy.phase) * 0.02;
};

export const moveDiagonalLeft = (
  enemy: ArtCruisePixiEnemy,
  _elapsed: number,
  deltaSeconds: number,
) => {
  const speed = Math.abs(enemy.vx);
  enemy.view.x -= speed * 0.38 * deltaSeconds;
  enemy.view.y += speed * 0.68 * deltaSeconds;
  enemy.view.rotation = -0.14;
};

export const moveDiagonalRight = (
  enemy: ArtCruisePixiEnemy,
  _elapsed: number,
  deltaSeconds: number,
) => {
  const speed = Math.abs(enemy.vx);
  enemy.view.x += speed * 0.38 * deltaSeconds;
  enemy.view.y += speed * 0.68 * deltaSeconds;
  enemy.view.rotation = 0.14;
};

// 出てきた端からのぞき込んで弾を撃ち、再び同じ端へ退場する動き。
// 進入方向(vx の符号)で内向き/退場向きを反転し、左右どちらの spawn でも
// 確実に画面外まで戻す。戻りきらないと isOutOfBounds で消えず波が残留し、
// クリアゲートが解除されず進行不能になるため、退場量は depth + margin を必ず超える。
const SIDE_PEEK_DEPTH = 150;
const SIDE_PEEK_LEAVE_DISTANCE = SIDE_PEEK_DEPTH + 320;

export const moveSidePeek = (
  enemy: ArtCruisePixiEnemy,
  elapsed: number,
  _deltaSeconds: number,
) => {
  enemy.originX ??= enemy.view.x;
  enemy.originY ??= enemy.view.y;
  // 内向き = 画面中心へ向かう符号。vx は spawn 時に中心向きで設定される。
  const inward = Math.sign(enemy.vx) || -1;
  const enter = Math.min(elapsed / 1.2, 1);
  const leave = Math.min(Math.max(0, elapsed - 2.2) / 1.3, 1);
  const depth = SIDE_PEEK_DEPTH * Math.sin(enter * Math.PI * 0.5);
  const retreat = leave * SIDE_PEEK_LEAVE_DISTANCE;
  enemy.view.x = enemy.originX + inward * (depth - retreat);
  enemy.view.y = enemy.originY + Math.sin(elapsed * 2 + enemy.phase) * 18;
  enemy.view.rotation = Math.sin(elapsed * 2) * 0.04;
};

export const moveDefault = (
  enemy: ArtCruisePixiEnemy,
  elapsed: number,
  deltaSeconds: number,
) => {
  enemy.view.x += enemy.vx * deltaSeconds;
  enemy.view.y = (enemy.originY ?? enemy.view.y) + Math.sin(elapsed * 2.2 + enemy.phase) * 20;
  enemy.view.rotation = Math.sin(elapsed * 2.2 + enemy.phase) * 0.03;
};

export const updatePixiEnemyMovement = (
  enemy: ArtCruisePixiEnemy,
  now: number,
  deltaSeconds: number,
) => {
  if (!enemy?.view) return;
  const elapsed = (now - enemy.spawnedAt) / 1000;
  enemy.originX ??= enemy.view.x;
  enemy.originY ??= enemy.view.y;

  switch (enemy.movement) {
    case "downLine":
      moveDownLine(enemy, elapsed, deltaSeconds);
      break;
    case "diagonalLeft":
      moveDiagonalLeft(enemy, elapsed, deltaSeconds);
      break;
    case "diagonalRight":
      moveDiagonalRight(enemy, elapsed, deltaSeconds);
      break;
    case "sidePeek":
      moveSidePeek(enemy, elapsed, deltaSeconds);
      break;
    case "none":
      // 動きの制御をSquadや専用controllerなどの外部に委ねる場合
      break;
    default:
      moveDefault(enemy, elapsed, deltaSeconds);
      break;
  }
};
