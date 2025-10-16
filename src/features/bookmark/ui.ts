import { Bookmark } from "./types";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "../../utils/modal";
import { IMG_ICON_BOOKMARK } from "../../assets/iconImages";
import { createResponsiveButton } from "../../components/responsive-button";
import { createCoordinateJumper } from "./components/coordinate-jumper";
import { createCard, CardConfig } from "../../components/card";

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
    .map((fav) => {
      const cardConfig: CardConfig = {
        id: fav.id.toString(),
        title: fav.name,
        subtitle: `📍${fav.lat?.toFixed(3) || "N/A"}, ${fav.lng?.toFixed(3) || "N/A"}`,
        onDelete: true,
        onClick: true,
        data: {
          lat: fav.lat.toString(),
          lng: fav.lng.toString(),
          zoom: fav.zoom.toString(),
        },
      };
      return createCard(cardConfig);
    })
    .join("");
};

// Legacy accessor for modal element
export const getBookmarkModalElement = (
  modalElements: ModalElements
): HTMLDialogElement => {
  return modalElements.modal;
};
