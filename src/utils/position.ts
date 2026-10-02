import { Position } from "../features/bookmark/types";
import { TILE_SIZE, ZOOM_LEVEL } from "./geo-converter";
import {
  loadNavigationModeFromStorage,
  getNavigationMode,
} from "../states/navigation-mode";

const LOCATION_KEY = "location";

/** Wplaceのワールドピクセル範囲を画面に収めるズーム。 */
export const getPixelExtentZoom = (
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  maxZoom = 14,
): number => {
  if (![width, height, viewportWidth, viewportHeight].every(
    (value) => Number.isFinite(value) && value > 0,
  )) return maxZoom;

  const padding = 56;
  const scale = Math.min(
    Math.max(1, viewportWidth - padding * 2) / width,
    Math.max(1, viewportHeight - padding * 2) / height,
  );
  // 地図のズーム0は512 CSS px、Wplaceのタイルは1000画像px。
  return Math.max(0, Math.min(maxZoom, ZOOM_LEVEL + Math.log2(scale * TILE_SIZE / 512)));
};

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
    window.postMessage({ source: "mr-wplace-map-flyto", lat, lng, zoom }, "*");
    // wplaceのために位置情報を保存
    window.localStorage.setItem("location", JSON.stringify({ lat, lng, zoom }));
  } else {
    // Use URL navigation (with reload)
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
  }
};
