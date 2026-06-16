import type { SquadCommand } from "../squad";

/**
 * 隊列の重心を中心に各機を円周上へ配置し、回転させながら中心ごと移動させる。
 * angularSpeed: rad/s。drift: 中心の移動速度 (vx, vy)。
 */
export const squadOrbit = (
  radius: number,
  angularSpeed: number,
  duration: number,
  driftX = 0,
  driftY = 40,
): SquadCommand => {
  let centerX = 0;
  let centerY = 0;
  let initialized = false;
  return {
    duration,
    update(enemies, elapsed, dt) {
      if (!initialized) {
        const live = enemies.filter((e) => e?.view);
        if (live.length === 0) return;
        centerX =
          live.reduce((sum, e) => sum + e.view.x, 0) / live.length;
        centerY =
          live.reduce((sum, e) => sum + e.view.y, 0) / live.length;
        initialized = true;
      }
      centerX += driftX * dt;
      centerY += driftY * dt;

      const count = enemies.length || 1;
      enemies.forEach((enemy, i) => {
        if (!enemy?.view) return;
        const baseAngle = (Math.PI * 2 * (enemy.squadIndex ?? i)) / count;
        const angle = baseAngle + elapsed * angularSpeed;
        enemy.view.x = centerX + Math.cos(angle) * radius;
        enemy.view.y = centerY + Math.sin(angle) * radius;
        enemy.view.rotation = angle + Math.PI / 2;
      });
    },
  };
};
