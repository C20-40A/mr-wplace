import { getMapInstanceFromWplace } from "./get-map-instance";

export const changeTileBoundaryVisibility = (visible: boolean): void => {
  const mapInstance = getMapInstanceFromWplace();
  if (!mapInstance) return;
  mapInstance.showTileBoundaries = visible;
  console.log("🧑‍🎨 : Tile boundaries updated:", visible);
};

/**
 * Handle flyTo/jumpTo requests
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

  console.log(
    `🧑‍🎨 : flyTo from (${currentCenter.lat.toFixed(
      2
    )}, ${currentCenter.lng.toFixed(2)}, z${currentZoom}) to (${lat.toFixed(
      2
    )}, ${lng.toFixed(2)}, z${zoom})`
  );

  mapInstance.flyTo({ center: [lng, lat], zoom });
};
