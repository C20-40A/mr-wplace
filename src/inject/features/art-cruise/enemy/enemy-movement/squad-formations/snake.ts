import type { ArtCruiseStageSpawn } from "../../../stage-director/types";
import type { SquadCommand } from "../squad";
const COUNT = 7;

/**
 * 縦に連なった一列縦隊が、index ごとに位相をずらして S字に蛇行しながら降下する。
 * 後続が先頭の軌跡をなぞるように見え、隙間を縫う回避を要求する。
 */
export const snakeSpawns = (squadId: string): ArtCruiseStageSpawn[] =>
  Array.from({ length: COUNT }, (_, i) => ({
    rank: "grunt" as const,
    delayMs: i === 0 ? 650 : 50,
    xRatio: 0.5,
    // 先頭ほど画面上側、後続は少し上に積む
    yRatio: -0.05 - i * 0.05,
    movement: "none" as const,
    speedScale: 1,
    squadId,
  }));

export const snakeCommands = (): SquadCommand[] => [snakeDescend()];

/**
 * 縦進しながら横に正弦波。squadSine の vx/amplitude を縦横入れ替えた専用版。
 */
const snakeDescend = (): SquadCommand => {
  const baseX: number[] = [];
  const duration = 5.5;
  const vy = 130;
  const amplitude = 150;
  const frequency = 1.6;
  const phasePerIndex = 0.9;
  return {
    duration,
    update(enemies, elapsed, dt) {
      enemies.forEach((enemy, i) => {
        if (!enemy?.view) return;
        if (baseX[i] === undefined) baseX[i] = enemy.view.x;
        enemy.view.y += vy * dt;
        const phase = (enemy.squadIndex ?? i) * phasePerIndex;
        enemy.view.x = baseX[i] + Math.sin(elapsed * frequency + phase) * amplitude;
        enemy.view.rotation = Math.cos(elapsed * frequency + phase) * 0.2;
      });
    },
  };
};
