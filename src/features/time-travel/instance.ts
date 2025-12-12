import type { TimeTravelAPI } from "@/core/di";

let instance: TimeTravelAPI | null = null;

export const setTimeTravelInstance = (tt: TimeTravelAPI): void => {
  instance = tt;
};

export const getTimeTravelInstance = (): TimeTravelAPI => {
  if (!instance) throw new Error("TimeTravel not initialized");
  return instance;
};
