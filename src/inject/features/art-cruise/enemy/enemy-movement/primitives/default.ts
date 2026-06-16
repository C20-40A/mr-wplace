import type { SquadCommand } from "../squad";

export const squadDefault = (duration: number): SquadCommand => ({
  duration,
  update: (enemies, elapsed, dt) => {
    for (const enemy of enemies) {
      if (!enemy?.view) continue;
      enemy.view.x += enemy.vx * dt;
      enemy.view.y =
        (enemy.originY ?? enemy.view.y) +
        Math.sin(elapsed * 2.2 + enemy.phase) * 20;
      enemy.view.rotation = Math.sin(elapsed * 2.2 + enemy.phase) * 0.03;
    }
  },
});
