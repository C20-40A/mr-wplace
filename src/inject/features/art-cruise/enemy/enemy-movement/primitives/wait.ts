import type { SquadCommand } from "../squad";

export const squadWait = (duration: number): SquadCommand => ({
  duration,
  update: () => {},
});
