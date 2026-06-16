import type { SquadCommand } from "../squad";

export const squadLerp = (
  targetXRatio: number,
  targetYRatio: number,
  duration: number,
  gameWidth: number,
  gameHeight: number,
): SquadCommand => {
  let startPos: { x: number; y: number }[] = [];
  return {
    duration,
    update: (enemies, elapsed) => {
      if (startPos.length === 0) {
        startPos = enemies.map((e) => ({
          x: e.view?.x ?? 0,
          y: e.view?.y ?? 0,
        }));
      }
      const t = Math.min(elapsed / duration, 1);
      const targetX = targetXRatio * gameWidth;
      const targetY = targetYRatio * gameHeight;

      enemies.forEach((enemy, i) => {
        if (!enemy?.view) return;
        const start = startPos[i];
        if (!start) return;
        enemy.view.x = start.x + (targetX - start.x) * t;
        enemy.view.y = start.y + (targetY - start.y) * t;
      });
    },
  };
};
