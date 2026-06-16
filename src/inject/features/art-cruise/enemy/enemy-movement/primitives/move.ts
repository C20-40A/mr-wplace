import type { SquadCommand } from "../squad";

export const squadMove = (
  vx: number,
  vy: number,
  duration: number,
): SquadCommand => ({
  duration,
  update(enemies, _, dt) {
    for (const enemy of enemies) {
      if (!enemy?.view) continue;
      enemy.view.x += vx * dt;
      enemy.view.y += vy * dt;
    }
  },
});
