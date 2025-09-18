import { Bookmark } from "./types";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "../../utils/modal";

export const createSaveBookmarkButton = (
  container: Element
): HTMLButtonElement => {
  const button = document.createElement("button");
  button.className = "btn btn-neutral btn-soft mx-3";
  button.style = "margin: 0.5rem;";
  button.setAttribute("data-wplace-save", "true");
  button.innerHTML = t`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4.5">
        <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z"/>
      </svg>
      ${"bookmark"}
    `;

  // 既存の子要素の前に挿入（先頭に表示）
  const firstChild = container.firstElementChild;
  if (firstChild) {
    container.insertBefore(button, firstChild);
  } else {
    container.appendChild(button);
  }
  return button;
};

export const createBookmarkButton = (container: Element): HTMLButtonElement => {
  const button = document.createElement("button");
  button.id = "bookmarks-btn"; // 重複チェック用ID設定
  button.className =
    "btn btn-lg sm:btn-xl btn-square shadow-md text-base-content/80 z-30";
  button.title = t`${"bookmarks"}`;
  button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-5">
        <path d="M200-120v-640q0-33 23.5-56.5T280-840h400q33 0 56.5 23.5T760-760v640L480-240 200-120Zm80-122 200-86 200 86v-518H280v518Zm0-518h400-400Z"/>
      </svg>
    `;
  const parentNode = container.parentNode;
  // Add flex layout classes to parentNode
  if (parentNode) {
    parentNode.className += " flex flex-col-reverse gap-1";
    parentNode.appendChild(button);
  }
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
  modalElements.container.innerHTML = t`
    <div class="flex gap-2 mb-4">
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
    </div>

    <div id="wps-favorites-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
    </div>

    <div id="wps-favorites-count" class="text-center text-sm text-base-content/80 mt-4">
    </div>
  `;

  return modalElements;
};

export const renderBookmarks = (favorites: Bookmark[]): void => {
  const grid = document.getElementById("wps-favorites-grid") as HTMLElement;
  const count = document.getElementById("wps-favorites-count") as HTMLElement;

  if (!grid || !count) return;

  count.textContent = t`${"saved_count"}: ${favorites.length} ${"items_unit"}`;

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

  favorites.sort((a, b) => b.id - a.id);

  grid.innerHTML = favorites
    .map(
      (fav) => `
          <div class="wps-favorite-card card bg-base-200 shadow-sm hover:shadow-md cursor-pointer transition-all relative"
          style="hover:transform: translateY(-2px);"
               data-lat="${fav.lat}" data-lng="${fav.lng}" data-zoom="${
        fav.zoom
      }">
            <button class="wps-delete-btn btn btn-ghost btn-xs btn-circle absolute right-1 top-1 z-10"
                    data-id="${fav.id}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-3">
                <path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/>
              </svg>
            </button>
            <div class="card-body p-3">
              <h4 class="card-title text-sm line-clamp-2">${fav.name}</h4>
              <div class="text-xs text-base-content/70 space-y-1">
                <div>📍 ${fav.lat?.toFixed(3) || 'N/A'}, ${fav.lng?.toFixed(3) || 'N/A'}</div>
                <div>📅 ${fav.date}</div>
              </div>
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
