import type { SquadCommand } from "../squad";

/**
 * 横方向に進みつつ、各機が縦に正弦波を描く。
 * squadIndex に応じて位相をずらすことで、隊列がS字の帯のように波打つ。
 */
export const squadSine = (
  vx: number,
  amplitude: number,
  frequency: number,
  duration: number,
  phasePerIndex = 0.6,
): SquadCommand => {
  const baseY: number[] = [];
  return {
    duration,
    update(enemies, elapsed, dt) {
      enemies.forEach((enemy, i) => {
        if (!enemy?.view) return;
        if (baseY[i] === undefined) baseY[i] = enemy.view.y;
        enemy.view.x += vx * dt;
        const phase = (enemy.squadIndex ?? i) * phasePerIndex;
        enemy.view.y = baseY[i] + Math.sin(elapsed * frequency + phase) * amplitude;
        enemy.view.rotation = Math.cos(elapsed * frequency + phase) * 0.12;
      });
    },
  };
};
