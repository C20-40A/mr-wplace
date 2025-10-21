import { Bookmark, Tag } from "./types";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "../../utils/modal";
import { IMG_ICON_BOOKMARK } from "../../assets/iconImages";
import { createResponsiveButton } from "../../components/responsive-button";
import { createCoordinateJumper } from "./components/coordinate-jumper";
import { createCard, CardConfig } from "../../components/card";
import { BookmarkStorage } from "./storage";

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
    <!-- List Screen -->
    <div id="wps-bookmark-list-screen">
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
            <option value="tag">${"sort_tag"}</option>
          </select>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; min-height: 0;">
        <div id="wps-favorites-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
        </div>
      </div>
    </div>

    <!-- Edit Screen -->
    <div id="wps-bookmark-edit-screen" style="display: none;">
      <div style="padding: 1rem;">
        <!-- Name Section -->
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"bookmark_name"}</label>
          <input id="wps-edit-name" type="text" class="input input-bordered" style="width: 100%;" />
        </div>

        <!-- Step 1: Tag Selection -->
        <div id="wps-edit-tag-selection" style="display: block; margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"existing_tags"}</label>
          <div id="wps-existing-tags-container" style="max-height: 200px; overflow-y: auto; margin-bottom: 0.5rem; border: 1px solid #e5e5e5; border-radius: 8px; padding: 0.5rem;"></div>
          <div style="display: flex; gap: 0.5rem;">
            <button id="wps-new-tag-btn" class="btn btn-outline btn-sm">${"new_tag"}</button>
            <button id="wps-no-tag-btn" class="btn btn-outline btn-sm">${"remove_tag"}</button>
          </div>
        </div>

        <!-- Step 2: Tag Creation -->
        <div id="wps-edit-tag-creation" style="display: none; margin-bottom: 1rem;">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"tag_name"} (${"optional"})</label>
            <input id="wps-edit-tag-name" type="text" class="input input-bordered" style="width: 100%;" />
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"tag_color"}</label>
            <div id="wps-color-picker" style="display: flex; gap: 0.5rem; flex-wrap: wrap;"></div>
          </div>
          <button id="wps-tag-back" class="btn btn-outline btn-sm">${"back"}</button>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button id="wps-edit-cancel" class="btn btn-outline btn-sm">${"cancel"}</button>
          <button id="wps-edit-save" class="btn btn-primary btn-sm">${"save"}</button>
        </div>
      </div>
    </div>
  `;

  // Add coordinate jumper to list screen
  const listScreen = modalElements.container.querySelector("#wps-bookmark-list-screen");
  listScreen?.appendChild(createCoordinateJumper());

  return modalElements;
};

export type BookmarkSortType = "created" | "accessed" | "tag";

export const PREDEFINED_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Orange", value: "#f97316" },
  { name: "Gray", value: "#6b7280" },
];

const renderExistingTags = (tags: Tag[], currentTag?: Tag): void => {
  const container = document.getElementById("wps-existing-tags-container");
  if (!container) return;

  if (tags.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #999; padding: 1rem;">${t`${"no_items"}`}</p>`;
    return;
  }

  container.innerHTML = tags
    .map(
      (tag) => `
    <div class="wps-existing-tag-item" 
         data-color="${tag.color}"
         data-name="${tag.name || ""}"
         style="
           display: flex;
           align-items: center;
           gap: 8px;
           padding: 8px;
           border: 2px solid ${
             tag.color === currentTag?.color &&
             (tag.name || "") === (currentTag?.name || "")
               ? "#000"
               : "transparent"
           };
           border-radius: 8px;
           cursor: pointer;
           margin-bottom: 4px;
         "
         onmouseover="this.style.background='#f5f5f5';"
         onmouseout="this.style.background='transparent';">
      <div style="
        width: 24px;
        height: 24px;
        border-radius: 4px;
        background: ${tag.color};
        flex-shrink: 0;
      "></div>
      <span>${tag.name || t`("${tag_name}")`}</span>
    </div>
  `
    )
    .join("");
};

export const showTagSelection = (): void => {
  const selectionDiv = document.getElementById("wps-edit-tag-selection");
  const creationDiv = document.getElementById("wps-edit-tag-creation");
  if (selectionDiv) selectionDiv.style.display = "block";
  if (creationDiv) creationDiv.style.display = "none";
};

export const showTagCreation = (): void => {
  const selectionDiv = document.getElementById("wps-edit-tag-selection");
  const creationDiv = document.getElementById("wps-edit-tag-creation");
  if (selectionDiv) selectionDiv.style.display = "none";
  if (creationDiv) creationDiv.style.display = "block";

  // Render color picker
  const colorPicker = document.getElementById("wps-color-picker");
  if (!colorPicker) return;

  colorPicker.innerHTML = PREDEFINED_COLORS.map(
    (color) => `
      <button
        class="wps-color-btn"
        data-color="${color.value}"
        style="
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: ${color.value};
          border: 3px solid transparent;
          cursor: pointer;
          transition: all 0.2s;
        "
        onmouseover="this.style.transform='scale(1.1)';"
        onmouseout="this.style.transform='scale(1)';"
      ></button>
    `
  ).join("");
};

export const showEditScreen = async (bookmark: Bookmark): Promise<void> => {
  const listScreen = document.getElementById("wps-bookmark-list-screen");
  const editScreen = document.getElementById("wps-bookmark-edit-screen");
  const nameInput = document.getElementById("wps-edit-name") as HTMLInputElement;

  if (!listScreen || !editScreen || !nameInput) return;

  // Set bookmark name
  nameInput.value = bookmark.name;

  // Get existing tags and render
  const existingTags = await BookmarkStorage.getExistingTags();
  renderExistingTags(existingTags, bookmark.tag);

  // Show step 1 (tag selection)
  showTagSelection();

  // Store bookmark data
  editScreen.dataset.bookmarkId = bookmark.id.toString();
  editScreen.dataset.currentTagColor = bookmark.tag?.color || "";
  editScreen.dataset.currentTagName = bookmark.tag?.name || "";

  // Toggle screens
  listScreen.style.display = "none";
  editScreen.style.display = "block";

  console.log("🧑‍🎨 : Edit screen shown for bookmark", bookmark.id);
};

export const hideEditScreen = (): void => {
  const listScreen = document.getElementById("wps-bookmark-list-screen");
  const editScreen = document.getElementById("wps-bookmark-edit-screen");

  if (!listScreen || !editScreen) return;

  listScreen.style.display = "block";
  editScreen.style.display = "none";
};

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

  // Sort bookmarks
  if (sortType === "created") {
    favorites.sort((a, b) => b.id - a.id);
  } else if (sortType === "accessed") {
    favorites.sort((a, b) => {
      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  } else if (sortType === "tag") {
    favorites.sort((a, b) => {
      // タグなしは最後
      if (!a.tag && !b.tag) return b.id - a.id;
      if (!a.tag) return 1;
      if (!b.tag) return -1;
      // タグ名で昇順ソート
      const tagNameA = a.tag.name || "";
      const tagNameB = b.tag.name || "";
      return tagNameA.localeCompare(tagNameB);
    });
  }

  grid.innerHTML = favorites
    .map((fav) => {
      const cardConfig: CardConfig = {
        id: fav.id.toString(),
        title: fav.name,
        subtitle: `📍${fav.lat?.toFixed(3) || "N/A"}, ${fav.lng?.toFixed(3) || "N/A"}`,
        onDelete: true,
        onEdit: true,
        onClick: true,
        tagColor: fav.tag?.color,
        tagName: fav.tag?.name,
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
