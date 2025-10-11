import { Position } from "../features/bookmark/types";
import { WplaceLocalStorage } from "./wplaceLocalStorage";
import { flyToPosition } from "./map-control";
import { loadNavigationModeFromStorage, getNavigationMode } from "./navigation-mode";

export const getCurrentPosition = (): Position | null => {
  const location = WplaceLocalStorage.getClickedPosition();
  if (!location) return null;
  return { lat: location.lat, lng: location.lng, zoom: location.zoom };
};

export const gotoPosition = async ({ lat, lng, zoom }: Position) => {
  // Load navigation mode from storage
  await loadNavigationModeFromStorage();
  const useFlyTo = getNavigationMode();

  if (useFlyTo) {
    // Use smart navigation (flyTo for close distance, jumpTo for far distance)
    flyToPosition(lat, lng, zoom);
  } else {
    // Use URL navigation (with reload)
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
  }
};
