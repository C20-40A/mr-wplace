import { Position } from "../features/bookmark/types";
import { WplaceLocalStorage } from "./wplaceLocalStorage";

export const getCurrentPosition = (): Position | null => {
  const location = WplaceLocalStorage.getClickedPosition();
  if (!location) return null;
  return { lat: location.lat, lng: location.lng, zoom: location.zoom };
};

export const gotoPosition = ({ lat, lng, zoom }: Position) => {
  const url = new URL(window.location.href);
  url.searchParams.set("lat", lat.toString());
  url.searchParams.set("lng", lng.toString());
  url.searchParams.set("zoom", zoom.toString());
  window.location.href = url.toString();
};
