import { Position } from "../features/bookmark/types";
import { STORAGE_KEYS } from "../features/bookmark/storage";

export function getCurrentPosition(): Position | null {
  try {
    const locationStr = localStorage.getItem(STORAGE_KEYS.location);
    if (locationStr) {
      const location = JSON.parse(locationStr);
      return {
        lat: location.lat,
        lng: location.lng,
        zoom: location.zoom,
      };
    }
  } catch (error) {
    console.error("WPlace Studio: 位置取得エラー:", error);
  }
  return null;
}
