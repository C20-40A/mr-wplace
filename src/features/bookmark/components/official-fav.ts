import { FavoriteLocation } from "../types";
import { t } from "@/i18n/manager";
import { attachCardScrollPassthrough } from "@/components/card";
import { latLngToTilePixel } from "@/utils/coordinate";
import { getAllFavThumbnails } from "../fav-metadata-db";

export type OfficialFavoriteLocationsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; locations: FavoriteLocation[] };

const CAMERA_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:14px;height:14px;pointer-events:none;"><path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM120-120q-33 0-56.5-23.5T40-200v-480q0-33 23.5-56.5T120-760h126l74-80h320l74 80h126q33 0 56.5 23.5T920-680v480q0 33-23.5 56.5T840-120H120Z"/></svg>`;

const renderFavCard = (
  loc: FavoriteLocation,
  thumbnailUrl: string | null,
): string => {
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(loc.latitude, loc.longitude);
  const coordLabel = `${TLX}-${TLY}-${PxX}-${PxY}`;
  const title = loc.name || coordLabel;
  const subtitle = loc.name ? coordLabel : "";

  const thumbHtml = thumbnailUrl
    ? `<div class="wps-fav-thumb" style="width:100%;aspect-ratio:1;overflow:hidden;border-radius:6px 6px 0 0;margin-bottom:6px;">
        <img src="${thumbnailUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />
       </div>`
    : "";

  return `
    <div
      class="wps-card bg-base-200"
      data-id="fav-${loc.id}"
      data-lat="${loc.latitude}"
      data-lng="${loc.longitude}"
      data-zoom="14"
      style="
        position:relative;
        cursor:pointer;
        border-radius:10px;
        box-shadow:0 1px 3px rgba(0,0,0,0.08);
        padding:0;
        transition:all 0.25s ease;
        transform:translateY(0);
        overflow:hidden;
        -webkit-tap-highlight-color:transparent;
      "
      onmouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 4px 10px rgba(0,0,0,0.12)';"
      onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';"
      onmousedown="this.style.transform='translateY(1px) scale(0.98)';"
      onmouseup="this.style.transform='translateY(-3px) scale(1)';"
    >
      ${thumbHtml}
      <div style="padding:8px 10px 10px;">
        <div style="font-size:0.8rem;font-weight:600;line-height:1.3;word-break:break-all;padding-right:24px;">${title}</div>
        ${subtitle ? `<div style="font-size:0.7rem;opacity:0.5;margin-top:2px;">${subtitle}</div>` : ""}
      </div>
      <!-- 📷 capture button -->
      <button
        class="wps-fav-capture-btn"
        data-fav-id="${loc.id}"
        style="
          position:absolute;
          right:6px;
          top:6px;
          background:oklch(var(--b1)/0.85);
          border:none;
          border-radius:6px;
          width:26px;
          height:26px;
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          opacity:0.75;
          transition:opacity 0.2s;
          z-index:10;
        "
        onmouseover="this.style.opacity='1';"
        onmouseout="this.style.opacity='0.75';"
        title="マップ画像を保存"
      >
        ${CAMERA_ICON_SVG}
      </button>
    </div>
  `;
};

export const renderFavoriteLocations = async (
  state: OfficialFavoriteLocationsState,
): Promise<void> => {
  const grid = document.getElementById("wps-official-fav-grid") as HTMLElement;
  const emptyState = document.getElementById("wps-official-fav-empty") as HTMLElement;

  if (!grid || !emptyState) return;

  if (state.status === "loading") {
    grid.style.display = "none";
    emptyState.style.display = "flex";
    emptyState.innerHTML = `<p style="color: oklch(var(--bc) / 0.5);">${t`${"loading"}`}</p>`;
    return;
  }

  if (state.status === "error") {
    grid.style.display = "none";
    emptyState.style.display = "flex";
    emptyState.innerHTML = `<p style="color: oklch(var(--bc) / 0.5);">${t`${"official_favorites_unavailable"}`}</p>`;
    return;
  }

  if (state.locations.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "flex";
    emptyState.innerHTML = `<p style="color: oklch(var(--bc) / 0.5);">${t`${"empty_official_favorites"}`}</p>`;
    return;
  }

  emptyState.style.display = "none";
  grid.style.display = "grid";

  const thumbnails = await getAllFavThumbnails().catch(() => new Map<number, string>());

  grid.innerHTML = state.locations
    .map((loc) => renderFavCard(loc, thumbnails.get(loc.id) ?? null))
    .join("");

  attachCardScrollPassthrough(grid);
};
