import { Position } from "../features/bookmark/types";
import { STORAGE_KEYS } from "../features/bookmark/storage";

export function getCurrentPosition(): Position | null {
  const locationStr = localStorage.getItem(STORAGE_KEYS.location);
  if (locationStr) {
    const location = JSON.parse(locationStr);
    return {
      lat: location.lat,
      lng: location.lng,
      zoom: location.zoom,
    };
  }
  return null;
}

export const gotoPosition = ({ lat, lng, zoom }: Position) => {
  const url = new URL(window.location.href);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lng", lng.toString());
  url.searchParams.set("zoom", zoom.toString());
  window.location.href = url.toString();
};
