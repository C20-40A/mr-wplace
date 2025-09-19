export const flyToPosition = (lat: number, lng: number, zoom: number = 16): boolean => {
  window.postMessage({
    source: "wplace-studio-flyto",
    lat, lng, zoom
  }, "*");
  return true;
};

export const isMapAvailable = (): boolean => {
  return !!(window as any).wplaceMap;
};
