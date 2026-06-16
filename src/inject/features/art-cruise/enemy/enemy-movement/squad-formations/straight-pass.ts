import type { ArtCruiseStageSpawn } from "../../../stage-director/types";
import type { SquadCommand } from "../squad";
import { squadMove } from "../primitives";

const COUNT = 4;

/**
 * 画面外上から等間隔で入場し、中央を通過して画面外下へ抜ける直線飛行。
 */
export const straightPassSpawns = (squadId: string): ArtCruiseStageSpawn[] =>
  Array.from({ length: COUNT }, (_, i) => ({
    rank: "grunt" as const,
    delayMs: i === 0 ? 500 : 200,
    xRatio: 0.2 + (i / (COUNT - 1)) * 0.6,
    yRatio: -0.08,
    movement: "none" as const,
    speedScale: 1,
    squadId,
  }));

export const straightPassCommands = (gameHeight: number): SquadCommand[] => [
  // 画面上外から下外までゆっくり直線通過
  squadMove(0, 60, (gameHeight * 1.2) / 60),
];
