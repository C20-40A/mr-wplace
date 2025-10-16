import { Bookmark } from "./types";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "../../utils/modal";
import { IMG_ICON_BOOKMARK } from "../../assets/iconImages";
import { createResponsiveButton } from "../../components/responsive-button";
import { createCoordinateJumper } from "./components/coordinate-jumper";

export const createSaveBookmarkButton = (): HTMLButtonElement => {
  return createResponsiveButton({
    iconSrc: IMG_ICON_BOOKMARK,
    text: t`${"bookmark"}`,
    dataAttribute: "save",
    altText: t`${"bookmark"}`,
  });
};

export const createBookmarkButton = (): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "bookmarks-btn"; // 重複チェック用ID設定
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"bookmarks"}`;
  button.innerHTML = `
    <img src="${IMG_ICON_BOOKMARK}" alt="${t`${"bookmarks"}`}" style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">
  `;
  return button;
};

export const createBookmarkModal = (): ModalElements => {
  const modalElements = createModal({
    id: "wplace-studio-favorite-modal",
    title: t`${"bookmark_list"}`,
    maxWidth: "64rem", // 4xl equivalent
    containerStyle: "min-height: 35rem;",
  });

  // Add bookmark-specific content to container
  modalElements.container.style.display = "flex";
  modalElements.container.style.flexDirection = "column";
  modalElements.container.style.height = "40rem";

  modalElements.container.innerHTML = t`
    <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 0.7rem;">
      <button id="wps-export-btn" class="btn btn-outline btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
          <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
        </svg>
        ${"export"}
      </button>
      <button id="wps-import-btn" class="btn btn-outline btn-sm">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
          <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
        </svg>
        ${"import"}
      </button>
      <input type="file" id="wps-import-file" accept=".json" style="display: none;">
      <div class="flex items-center gap-2">
        <label style="font-size: 0.875rem; white-space: nowrap;">${"sort_by"}</label>
        <select id="wps-bookmark-sort" class="select select-sm select-bordered">
          <option value="created">${"sort_created"}</option>
          <option value="accessed">${"sort_accessed"}</option>
        </select>
      </div>
    </div>

    <div style="flex: 1; overflow-y: auto; min-height: 0;">
      <div id="wps-favorites-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
      </div>
    </div>
  `;

  // Add coordinate jumper
  modalElements.container.appendChild(createCoordinateJumper());

  return modalElements;
};

export type BookmarkSortType = "created" | "accessed";

export const renderBookmarks = (
  favorites: Bookmark[],
  sortType: BookmarkSortType = "created"
): void => {
  const grid = document.getElementById("wps-favorites-grid") as HTMLElement;

  if (!grid) return;

  if (favorites.length === 0) {
    grid.innerHTML = t`
        <div class="text-center" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-12 mx-auto mb-4 text-base-content/50">
            <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z"/>
          </svg>
          <p class="text-base-content/80">${"no_bookmarks"}</p>
          <p class="text-sm text-base-content/60">${"add_bookmark_instruction"}</p>
        </div>
      `;
    return;
  }

  if (sortType === "created") {
    favorites.sort((a, b) => b.id - a.id);
  } else {
    favorites.sort((a, b) => {
      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  }

  grid.innerHTML = favorites
    .map(
      (fav) => `
  <div
    class="wps-favorite-card"
    data-id="${fav.id}"
    data-lat="${fav.lat}"
    data-lng="${fav.lng}"
    data-zoom="${fav.zoom}"
    style="
      position: relative;
      cursor: pointer;
      background: linear-gradient(180deg, #fafafb 0%, #f3f3f6 100%);
      border-radius: 10px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      padding: 11px 14px 20px 10px;
      transition: all 0.25s ease;
      transform: translateY(0);
      overflow: hidden;
    "
    onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 4px 10px rgba(0,0,0,0.12)';"
    onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 1px 3px rgba(0,0,0,0.08)';"
    onmousedown="this.style.transform='translateY(1px) scale(0.98)';"
    onmouseup="this.style.transform='translateY(-3px) scale(1)';"
    onTouchStart="this.style.transform='scale(0.9)';"
    onTouchEnd="this.style.transform='scale(1)';"
  >
    <!-- 削除ボタン -->
    <button
      class="wps-delete-btn"
      data-id="${fav.id}"
      style="
        position: absolute;
        right: 6px;
        top: 6px;
        background: transparent;
        border: none;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.2s ease;
        transform: scale(1);
      "
      onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)';"
      onmouseout="this.style.opacity='0.6'; this.style.transform='scale(1)';"
    >
      <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 -960 960 960' fill='currentColor' style='width:12px; height:12px;'>
        <path d='m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z'/>
      </svg>
    </button>

    <!-- 本文 -->
    <h4 style="
      font-size: 13px;
      font-weight: 500;
      line-height: 1.4;
      color: #222;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      margin-bottom: 0.3rem;
    ">
      ${fav.name}
    </h4>

    <!-- 座標（左下に控えめに） -->
    <div style="
      position: absolute;
      left: 8px;
      bottom: 6px;
      font-size: 11px;
      color: rgba(0,0,0,0.4);
      pointer-events: none;
    ">
      📍${fav.lat?.toFixed(3) || "N/A"}, ${fav.lng?.toFixed(3) || "N/A"}
    </div>
  </div>
        `
    )
    .join("");
};

// Legacy accessor for modal element
export const getBookmarkModalElement = (
  modalElements: ModalElements
): HTMLDialogElement => {
  return modalElements.modal;
};
