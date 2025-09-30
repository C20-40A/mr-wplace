import type { TimeTravel } from "./index";

let instance: TimeTravel | null = null;

export function setTimeTravelInstance(tt: TimeTravel): void {
  instance = tt;
}

export function getTimeTravelInstance(): TimeTravel {
  if (!instance) throw new Error("TimeTravel not initialized");
  return instance;
}
