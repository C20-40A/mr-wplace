import { FavoriteLocation } from "../types";
import { t } from "@/i18n/manager";
import { latLngToTilePixel } from "@/utils/coordinate";
import { isMobileViewport } from "@/constants/breakpoints";
import { getAllFavThumbnails, getAllFavMetadata } from "../fav-metadata-db";

export type OfficialFavoriteLocationsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; locations: FavoriteLocation[] };

const CAMERA_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" style="width:14px;height:14px;pointer-events:none;"><path d="M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM120-120q-33 0-56.5-23.5T40-200v-480q0-33 23.5-56.5T120-760h126l74-80h320l74 80h126q33 0 56.5 23.5T920-680v480q0 33-23.5 56.5T840-120H120Z"/></svg>`;

const renderFavCard = (
  loc: FavoriteLocation,
  thumbnailUrl: string | null,
): string => {
  const isMobile = isMobileViewport();
  const { TLX, TLY, PxX, PxY } = latLngToTilePixel(loc.latitude, loc.longitude);
  const coordLabel = `${TLX}-${TLY}-${PxX}-${PxY}`;
  const title = loc.name || coordLabel;
  const subtitle = loc.name ? coordLabel : "";
  const isCoordOnlyTitle = !loc.name;

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
        overflow:hidden;
        -webkit-tap-highlight-color:transparent;
        touch-action:pan-y;
      "
    >
      ${thumbHtml}
      <div style="padding:8px 10px 8px;display:flex;align-items:center;gap:6px;">
        <div style="flex:1;">
          <div style="font-size:${isCoordOnlyTitle && isMobile ? "0.6rem" : "0.8rem"};font-weight:${isCoordOnlyTitle ? "400" : "600"};line-height:1.3;word-break:break-all;">${title}</div>
          ${subtitle ? `<div style="font-size:${isMobile ? "0.6rem" : "0.7rem"};font-weight:400;opacity:0.5;margin-top:2px;word-break:break-all;">${subtitle}</div>` : ""}
        </div>
          <button
            class="wps-fav-capture-btn"
            data-fav-id="${loc.id}"
            style="
              flex:0 0 auto;
              background:oklch(var(--b1)/0.85);
              border:1px solid oklch(var(--bc)/0.14);
              border-radius:6px;
              width:26px;
              height:26px;
              display:flex;
              align-items:center;
              justify-content:center;
              cursor:pointer;
              opacity:0.75;
              transition:opacity 0.2s;
            "
            onmouseover="this.style.opacity='1';"
            onmouseout="this.style.opacity='0.75';"
            title="マップ画像を保存"
          >
            ${CAMERA_ICON_SVG}
          </button>
      </div>
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

  const [thumbnails, metadata] = await Promise.all([
    getAllFavThumbnails().catch(() => new Map<number, string>()),
    getAllFavMetadata().catch(() => new Map()),
  ]);

  const sorted = [...state.locations].sort((a, b) => {
    const aDate = metadata.get(a.id)?.lastAccessedDate;
    const bDate = metadata.get(b.id)?.lastAccessedDate;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  grid.innerHTML = sorted
    .map((loc) => renderFavCard(loc, thumbnails.get(loc.id) ?? null))
    .join("");
};
