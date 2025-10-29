import { Position } from "../features/bookmark/types";
import {
  loadNavigationModeFromStorage,
  getNavigationMode,
} from "../states/navigation-mode";

const LOCATION_KEY = "location";

export const getCurrentPosition = (): Position | null => {
  const location: Position = window.localStorage.getItem(LOCATION_KEY)
    ? JSON.parse(window.localStorage.getItem(LOCATION_KEY)!)
    : null;
  if (!location) return null;
  return { lat: location.lat, lng: location.lng, zoom: location.zoom };
};

export const gotoPosition = async ({ lat, lng, zoom }: Position) => {
  // Load navigation mode from storage
  await loadNavigationModeFromStorage();
  const useFlyTo = getNavigationMode();

  if (useFlyTo) {
    // Use smart navigation (flyTo for close distance, jumpTo for far distance)
    window.postMessage({ source: "wplace-studio-flyto", lat, lng, zoom }, "*");
  } else {
    // Use URL navigation (with reload)
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
  }

  // wplaceのために位置情報を保存
  window.localStorage.setItem("location", JSON.stringify({ lat, lng, zoom }));
};
