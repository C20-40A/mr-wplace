import { getMapInstanceFromWplace } from "./get-map-instance";

export const changeTileBoundaryVisibility = (visible: boolean): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) return;
  mapInstance.showTileBoundaries = visible;
  console.log("🧑‍🎨 : Tile boundaries updated:", visible);
};

// Distance threshold for smart navigation (adjustable)
const SMART_NAV_THRESHOLD = 4;

/**
 * Handle flyTo/jumpTo requests with smart navigation
 * - Close distance: flyTo (animated)
 * - Far distance: jumpTo (instant)
 */
export const handleMapInstanceFlyTo = (data: {
  lat: number;
  lng: number;
  zoom: number;
}): void => {
  const { lat, lng, zoom } = data;

  const mapInstance = getMapInstanceFromWplace();

  // If map instance not available, fallback to URL navigation
  if (!mapInstance) {
    console.log("🧑‍🎨 : Map instance not available, using URL navigation");
    const url = new URL(window.location.href);
    url.searchParams.set("lat", lat.toString());
    url.searchParams.set("lng", lng.toString());
    url.searchParams.set("zoom", zoom.toString());
    window.location.href = url.toString();
    return;
  }

  // Get current position
  const currentCenter = mapInstance.getCenter();
  const currentZoom = mapInstance.getZoom();

  // Calculate simple distance (fast)
  const latDiff = Math.abs(currentCenter.lat - lat);
  const lngDiff = Math.abs(currentCenter.lng - lng);
  const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

  // Smart navigation: jumpTo for far distance, flyTo for close
  const useJump = distance > SMART_NAV_THRESHOLD;

  console.log(
    `🧑‍🎨 : ${useJump ? "jumpTo" : "flyTo"} from (${currentCenter.lat.toFixed(
      2
    )}, ${currentCenter.lng.toFixed(2)}, z${currentZoom}) to (${lat.toFixed(
      2
    )}, ${lng.toFixed(2)}, z${zoom}) [distance: ${distance.toFixed(2)}]`
  );

  if (useJump) {
    mapInstance.jumpTo({ center: [lng, lat], zoom });
  } else {
    mapInstance.flyTo({ center: [lng, lat], zoom });
  }
};
