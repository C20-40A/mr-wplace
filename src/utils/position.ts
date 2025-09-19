import { Position } from "../features/bookmark/types";
import { WplaceLocalStorage } from "./wplaceLocalStorage";
import { flyToPosition } from "./map-control";

export const getCurrentPosition = (): Position | null => {
  const location = WplaceLocalStorage.getClickedPosition();
  if (!location) return null;
  return { lat: location.lat, lng: location.lng, zoom: location.zoom };
};

export const gotoPosition = ({ lat, lng, zoom }: Position) => {
  // Try MapLibre flyTo first (no reload)
  if (flyToPosition(lat, lng, zoom)) return;

  // Fallback to URL navigation (with reload)
  const url = new URL(window.location.href);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lng", lng.toString());
  url.searchParams.set("zoom", zoom.toString());
  window.location.href = url.toString();
};
