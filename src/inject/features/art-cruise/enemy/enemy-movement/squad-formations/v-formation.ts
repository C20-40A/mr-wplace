import type { ArtCruiseStageSpawn } from "../../../stage-director/types";
import type { SquadCommand } from "../squad";
import { squadFormUp, squadWait } from "../primitives";

const COUNT = 3;

// 上から3体が均等間隔で降りてきて、画面上部でとどまる
export const vFormationSpawns = (squadId: string): ArtCruiseStageSpawn[] =>
  Array.from({ length: COUNT }, (_, i) => ({
    rank: "grunt" as const,
    delayMs: i === 0 ? 400 : 120,
    xRatio: 0.25 + (i / (COUNT - 1)) * 0.5,
    yRatio: -0.08,
    movement: "none" as const,
    speedScale: 1,
    squadId,
  }));

export const vFormationCommands = (
  gameWidth: number,
  gameHeight: number,
): SquadCommand[] => [
  // 横均等に整列しながら画面上部へゆっくり降下して停止
  squadFormUp(
    0.5,
    0.14,
    (i, count) => ({ dx: (i / (count - 1) - 0.5) * 0.5, dy: 0 }),
    2.0,
    gameWidth,
    gameHeight,
  ),
  // 画面上部でとどまる
  squadWait(3.5),
];
