// Map instance ready state (memory only)
let mapInstanceReady = false;

export const setMapInstanceReady = (ready: boolean): void => {
  mapInstanceReady = ready;
};

export const getMapInstanceReady = (): boolean => {
  return mapInstanceReady;
};