import type { ArtCruiseSquad } from "./squad";
import type { SquadCommand } from "./squad";
import {
  vFormationCommands,
  sideSlideCommands,
  straightPassCommands,
  snakeCommands,
} from "./squad-formations";
import { squadDefault } from "./primitives";

type CommandFactory = (gameWidth: number, gameHeight: number) => SquadCommand[];

/**
 * squadId の prefix と コマンド生成関数の対応表。
 * 新フォーメーションは spawns 側の squadId prefix と合わせてここへ追加する。
 */
const COMMAND_FACTORIES: Record<string, CommandFactory> = {
  vFormation: (w, h) => vFormationCommands(w, h),
  straightPass: (_w, h) => straightPassCommands(h),
  snake: () => snakeCommands(),
  sideSlide: () => sideSlideCommands(),
};

export const initializeSquadCommands = (
  squad: ArtCruiseSquad,
  squadId: string,
  gameWidth: number,
  gameHeight: number,
) => {
  const entry = Object.entries(COMMAND_FACTORIES).find(([prefix]) =>
    squadId.startsWith(prefix),
  );
  squad.setCommands(
    entry ? entry[1](gameWidth, gameHeight) : [squadDefault(999)],
  );
};
