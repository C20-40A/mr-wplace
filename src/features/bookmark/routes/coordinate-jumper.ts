import { latLngToTilePixel, tilePixelToLatLng } from "@/utils/coordinate";
import { gotoPosition } from "@/utils/position";
import { t } from "@/i18n/manager";

export const renderCoordinateJumper = (container: HTMLElement): void => {
  container.innerHTML = t`
    <div class="flex flex-col gap-4" style="padding: 1rem;">
      
      <!-- Geo Coordinates -->
      <div class="flex flex-col gap-2 p-4 rounded-lg border border-base-300 bg-base-200/50">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-semibold">🌐 ${"geographic_coordinates"}</span>
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Lat</label>
            <input id="wps-jump-lat" type="number" step="any" 
              class="input input-sm input-bordered w-28"
              placeholder="35.6812">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Lng</label>
            <input id="wps-jump-lng" type="number" step="any" 
              class="input input-sm input-bordered w-28"
              placeholder="139.7671">
          </div>
        </div>
      </div>

      <!-- Tile Coordinates -->
      <div class="flex flex-col gap-2 p-4 rounded-lg border border-base-300 bg-base-200/50">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-sm font-semibold">🗺️ ${"tile_coordinates"}</span>
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Tile X</label>
            <input id="wps-jump-tile-x" type="number" 
              class="input input-sm input-bordered w-20">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Y</label>
            <input id="wps-jump-tile-y" type="number" 
              class="input input-sm input-bordered w-20">
          </div>
        </div>
        <div class="flex flex-wrap gap-3 items-center">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Pixel X</label>
            <input id="wps-jump-pixel-x" type="number" min="0" max="999" 
              class="input input-sm input-bordered w-20"
              placeholder="0-999">
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium">Y</label>
            <input id="wps-jump-pixel-y" type="number" min="0" max="999" 
              class="input input-sm input-bordered w-20"
              placeholder="0-999">
          </div>
        </div>
      </div>

      <!-- Jump Button -->
      <button id="wps-jump-btn" class="btn btn-primary">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
          <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q20-22 36-47.5t26.5-53q10.5-27.5 16-56.5t5.5-59q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z"/>
        </svg>
        ${"jump_to_coordinates"}
      </button>

    </div>
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
      const coords = latLngToTilePixel(lat, lng);
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

  console.log("🧑‍🎨 : Coordinate Jumper rendered");
};
