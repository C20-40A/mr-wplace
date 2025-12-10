let instance: TimeTravel | null = null;

export const setTimeTravelInstance = (tt: TimeTravel): void => {
  instance = tt;
};

export const getTimeTravelInstance = (): TimeTravel => {
  if (!instance) throw new Error("TimeTravel not initialized");
  return instance;
};
