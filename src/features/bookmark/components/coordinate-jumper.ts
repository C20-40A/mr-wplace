import { llzToTilePixel, tilePixelToLatLng } from "../../../utils/coordinate";
import { gotoPosition } from "../../../utils/position";

export const createCoordinateJumper = (): HTMLDivElement => {
  const container = document.createElement("div");
  container.style.borderTop = "1px solid rgba(255, 255, 255, 0.1)";
  container.style.padding = "0.5rem 0";

  container.innerHTML = `
    <details>
      <summary style="cursor: pointer;">🌐 Coordinate Jumper</summary>
      <div class="flex flex-wrap gap-3 items-center justify-start overflow-x-auto px-2">

        <!-- Group 1: Lat/Lng -->
        <div class="flex items-center gap-2 p-2 rounded-md border border-base-300 bg-base-200/50" style="white-space: nowrap;">
          <span class="text-xs font-semibold text-gray-500">Geo</span>
          <label class="text-sm">Lat</label>
          <input id="wps-jump-lat" type="number" step="any" class="input input-sm input-bordered w-24">
          <label class="text-sm">Lng</label>
          <input id="wps-jump-lng" type="number" step="any" class="input input-sm input-bordered w-24">
        </div>

        <!-- Group 2: Tile + Pixel -->
        <div class="flex items-center gap-2 p-2 rounded-md border border-base-300 bg-base-200/50" style="white-space: nowrap;">
          <span class="text-xs font-semibold text-gray-500">Tile / Pixel</span>
          <label class="text-sm">Tile X</label>
          <input id="wps-jump-tile-x" type="number" class="input input-sm input-bordered w-16">
          <label class="text-sm">Y</label>
          <input id="wps-jump-tile-y" type="number" class="input input-sm input-bordered w-16">
          <label class="text-sm">Px X</label>
          <input id="wps-jump-pixel-x" type="number" min="0" max="999" class="input input-sm input-bordered w-16">
          <label class="text-sm">Y</label>
          <input id="wps-jump-pixel-y" type="number" min="0" max="999" class="input input-sm input-bordered w-16">
        </div>

        <button id="wps-jump-btn" class="btn btn-sm btn-primary whitespace-nowrap">
          ✈ Jump
        </button>
      </div>
    </details>
  `;

  // Input elements
  const latInput = container.querySelector("#wps-jump-lat") as HTMLInputElement;
  const lngInput = container.querySelector("#wps-jump-lng") as HTMLInputElement;
  const tileXInput = container.querySelector(
    "#wps-jump-tile-x"
  ) as HTMLInputElement;
  const tileYInput = container.querySelector(
    "#wps-jump-tile-y"
  ) as HTMLInputElement;
  const pixelXInput = container.querySelector(
    "#wps-jump-pixel-x"
  ) as HTMLInputElement;
  const pixelYInput = container.querySelector(
    "#wps-jump-pixel-y"
  ) as HTMLInputElement;
  const jumpBtn = container.querySelector("#wps-jump-btn") as HTMLButtonElement;

  let isUpdating = false; // Prevent circular updates

  // Lat/Lng → Tile/Pixel
  const updateTileFromLatLng = () => {
    if (isUpdating) return;
    isUpdating = true;

    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!isNaN(lat) && !isNaN(lng)) {
      const coords = llzToTilePixel(lat, lng);
      tileXInput.value = coords.TLX.toString();
      tileYInput.value = coords.TLY.toString();
      pixelXInput.value = coords.PxX.toString();
      pixelYInput.value = coords.PxY.toString();
    }

    isUpdating = false;
  };

  // Tile/Pixel → Lat/Lng
  const updateLatLngFromTile = () => {
    if (isUpdating) return;
    isUpdating = true;

    const tileX = parseInt(tileXInput.value);
    const tileY = parseInt(tileYInput.value);
    const pixelX = parseInt(pixelXInput.value) || 0;
    const pixelY = parseInt(pixelYInput.value) || 0;

    if (!isNaN(tileX) && !isNaN(tileY)) {
      const coords = tilePixelToLatLng(tileX, tileY, pixelX, pixelY);
      latInput.value = coords.lat.toFixed(6);
      lngInput.value = coords.lng.toFixed(6);
    }

    isUpdating = false;
  };

  // Event listeners
  latInput.addEventListener("input", updateTileFromLatLng);
  lngInput.addEventListener("input", updateTileFromLatLng);
  tileXInput.addEventListener("input", updateLatLngFromTile);
  tileYInput.addEventListener("input", updateLatLngFromTile);
  pixelXInput.addEventListener("input", updateLatLngFromTile);
  pixelYInput.addEventListener("input", updateLatLngFromTile);

  // Jump button
  jumpBtn.addEventListener("click", () => {
    const lat = parseFloat(latInput.value);
    const lng = parseFloat(lngInput.value);

    if (!isNaN(lat) && !isNaN(lng)) {
      gotoPosition({ lat, lng, zoom: 11 });
    }
  });

  return container;
};
