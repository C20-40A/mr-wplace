import { Bookmark, Tag } from "./types";
import { t } from "../../i18n/manager";
import { createModal, ModalElements } from "../../utils/modal";
import { IMG_ICON_BOOKMARK } from "../../assets/iconImages";
import { createResponsiveButton } from "../../components/responsive-button";
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
    <div id="wps-bookmark-list-screen" style="display: flex; flex-direction: column; height: 100%;">
      <!-- Fixed Header: Buttons -->
      <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 0.7rem; flex-shrink: 0;">
        <button id="wps-location-search-btn" class="btn btn-outline btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
          </svg>
        </button>
        <button id="wps-coordinate-jumper-btn" class="btn btn-outline btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q20-22 36-47.5t26.5-53q10.5-27.5 16-56.5t5.5-59q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z"/>
          </svg>
          ${"coordinate_jumper"}
        </button>
        <button id="wps-import-export-btn" class="btn btn-outline btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
          ${"import_export"}
        </button>
        <input type="file" id="wps-import-file" accept=".json" style="display: none;">
        <div class="flex items-center gap-2">
          <select id="wps-bookmark-sort" class="select select-sm select-bordered">
            <option value="created">${"sort_created"}</option>
            <option value="accessed">${"sort_accessed"}</option>
            <option value="tag">${"sort_tag"}</option>
          </select>
        </div>
      </div>

      <!-- Tag Filter -->
      <div id="wps-tag-filter-container" style="margin-bottom: 0.7rem; flex-shrink: 0; display: none;">
        <div style="overflow-x: auto; overflow-y: hidden; white-space: nowrap; padding-bottom: 0.25rem;">
          <div id="wps-tag-filter-buttons" style="display: inline-flex; gap: 0.5rem;"></div>
        </div>
      </div>

      <!-- Scrollable Content: Bookmarks Grid -->
      <div style="flex: 1; overflow-y: auto; min-height: 0;">
        <div id="wps-favorites-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
        </div>
      </div>
    </div>

    <!-- Coordinate Jumper Screen -->
    <div id="wps-coordinate-jumper-screen" style="display: none;">
    </div>

    <!-- Location Search Screen -->
    <div id="wps-location-search-screen" style="display: none;">
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
          <div id="wps-existing-tags-container" class="border-base-300" style="max-height: 200px; overflow-y: auto; margin-bottom: 0.5rem; border: 1px solid; border-radius: 8px; padding: 0.5rem;"></div>
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

export const renderExistingTags = (tags: Tag[], currentTag?: Tag): void => {
  const container = document.getElementById("wps-existing-tags-container");
  if (!container) return;

  if (tags.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: #999; padding: 1rem;">${t`${"no_items"}`}</p>`;
    return;
  }

  const isSelected = (tag: Tag): boolean => {
    return (
      tag.color === currentTag?.color &&
      (tag.name || "") === (currentTag?.name || "")
    );
  };

  container.innerHTML = tags
    .map(
      (tag) => {
        const selected = isSelected(tag);
        return `
    <div class="wps-existing-tag-item"
         data-color="${tag.color}"
         data-name="${tag.name || ""}"
         style="
           display: flex;
           align-items: center;
           gap: 8px;
           padding: 8px;
           border: ${selected ? "3px" : "2px"} solid ${
          selected ? "oklch(var(--p))" : "oklch(var(--bc) / 0.1)"
        };
           background: ${selected ? "oklch(var(--p) / 0.1)" : "transparent"};
           border-radius: 8px;
           margin-bottom: 6px;
           transition: all 0.2s ease;
         ">
      <div class="wps-tag-item-clickable" style="
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
      "
      onmouseover="if (!${selected}) this.style.background='oklch(var(--b2))';"
      onmouseout="this.style.background='transparent';">
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: ${tag.color};
          flex-shrink: 0;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${
            selected
              ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="white" style="width: 16px; height: 16px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
            <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/>
          </svg>`
              : ""
          }
        </div>
        <span style="flex: 1; font-weight: ${
          selected ? "600" : "400"
        };">${tag.name || `(${t`${"tag_name"}`})`}</span>
      </div>
      <button
        class="wps-tag-edit-btn btn btn-ghost btn-xs"
        data-color="${tag.color}"
        data-name="${tag.name || ""}"
        type="button"
        style="flex-shrink: 0; z-index: 10;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4" style="pointer-events: none;">
          <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/>
        </svg>
      </button>
    </div>
  `;
      }
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
  const nameInput = document.getElementById(
    "wps-edit-name"
  ) as HTMLInputElement;

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

export const showTagEditModal = (
  tag: Tag,
  onSave: (oldTag: Tag, newTag: Tag) => void,
  onDelete: (tag: Tag) => void
): void => {
  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-4">${t`${"tag_edit_title"}`}</h3>
      <p class="text-sm text-base-content/60 mb-4">${t`${"tag_edit_description"}`}</p>

      <!-- Tag Name -->
      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${t`${"tag_name"}`} (${t`${"optional"}`})</label>
        <input id="wps-tag-edit-name" type="text" class="input input-bordered w-full" value="${
          tag.name || ""
        }" />
      </div>

      <!-- Tag Color -->
      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${t`${"tag_color"}`}</label>
        <div id="wps-tag-edit-color-picker" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          ${PREDEFINED_COLORS.map(
            (color) => `
            <button
              class="wps-tag-edit-color-btn"
              data-color="${color.value}"
              type="button"
              style="
                width: 40px;
                height: 40px;
                border-radius: 8px;
                background: ${color.value};
                border: 3px solid ${
                  color.value === tag.color ? "#000" : "transparent"
                };
                cursor: pointer;
                transition: all 0.2s;
              "
              onmouseover="this.style.transform='scale(1.1)';"
              onmouseout="this.style.transform='scale(1)';"
            ></button>
          `
          ).join("")}
        </div>
      </div>

      <!-- Actions -->
      <div class="modal-action" style="justify-content: space-between;">
        <button id="wps-tag-delete-btn" type="button" class="btn btn-error btn-sm">${t`${"delete"}`}</button>
        <div style="display: flex; gap: 0.5rem;">
          <button id="wps-tag-edit-cancel-btn" type="button" class="btn btn-outline btn-sm">${t`${"cancel"}`}</button>
          <button id="wps-tag-edit-save-btn" type="button" class="btn btn-primary btn-sm">${t`${"save"}`}</button>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  // Store original tag data
  const originalTag: Tag = { color: tag.color, name: tag.name };

  // Color picker handler
  modal
    .querySelector("#wps-tag-edit-color-picker")!
    .addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      const colorBtn = target.closest(
        ".wps-tag-edit-color-btn"
      ) as HTMLElement | null;

      if (!colorBtn) return;

      modal.querySelectorAll(".wps-tag-edit-color-btn").forEach((btn) => {
        (btn as HTMLElement).style.border = "3px solid transparent";
      });

      colorBtn.style.border = "3px solid #000";
    });

  // Save button
  modal
    .querySelector("#wps-tag-edit-save-btn")!
    .addEventListener("click", () => {
      console.log("🧑‍🎨 : Save button clicked in modal");

      const nameInput = modal.querySelector(
        "#wps-tag-edit-name"
      ) as HTMLInputElement;

      // Find selected color button by checking all buttons
      let selectedColor: string | null = null;
      modal.querySelectorAll(".wps-tag-edit-color-btn").forEach((btn) => {
        const style = (btn as HTMLElement).style.border;
        console.log(
          "🧑‍🎨 : Button border style:",
          style,
          "data-color:",
          (btn as HTMLElement).dataset.color
        );
        if (
          style.includes("rgb(0, 0, 0)") ||
          style.includes("#000") ||
          style.includes("black")
        ) {
          selectedColor = (btn as HTMLElement).dataset.color || null;
        }
      });

      const newName = nameInput.value.trim();

      console.log("🧑‍🎨 : newName:", newName, "selectedColor:", selectedColor);

      if (!selectedColor) {
        console.error("🧑‍🎨 : No color selected!");
        alert("色を選択してください");
        return;
      }

      const newTag: Tag = {
        color: selectedColor,
        name: newName || undefined,
      };

      console.log("🧑‍🎨 : Calling onSave with:", originalTag, "->", newTag);
      onSave(originalTag, newTag);
      modal.close();
      modal.remove();
    });

  // Delete button
  modal.querySelector("#wps-tag-delete-btn")!.addEventListener("click", () => {
    onDelete(originalTag);
    modal.close();
    modal.remove();
  });

  // Cancel button
  modal
    .querySelector("#wps-tag-edit-cancel-btn")!
    .addEventListener("click", () => {
      modal.close();
      modal.remove();
    });

  // Close on backdrop click
  modal.addEventListener("close", () => {
    modal.remove();
  });
};

export const renderTagFilters = (
  tags: Tag[],
  bookmarks: Bookmark[],
  selectedTagFilters: Set<string>,
  onTagFilterChange: (tagKey: string) => void
): void => {
  const container = document.getElementById("wps-tag-filter-container");
  const buttonsContainer = document.getElementById("wps-tag-filter-buttons");

  if (!container || !buttonsContainer) return;

  // Hide container if no tags
  if (tags.length === 0) {
    container.style.display = "none";
    return;
  }

  // タグごとの最新アクセス日時を計算
  const tagLatestAccess = new Map<string, number>();

  bookmarks.forEach((bookmark) => {
    if (!bookmark.tag) return;
    const tagKey = `${bookmark.tag.color}:${bookmark.tag.name || ""}`;
    const accessTime = bookmark.lastAccessedDate
      ? new Date(bookmark.lastAccessedDate).getTime()
      : 0;
    const current = tagLatestAccess.get(tagKey) || 0;
    if (accessTime > current) {
      tagLatestAccess.set(tagKey, accessTime);
    }
  });

  // タグを最新アクセス順にソート
  const sortedTags = [...tags].sort((a, b) => {
    const tagKeyA = `${a.color}:${a.name || ""}`;
    const tagKeyB = `${b.color}:${b.name || ""}`;
    const accessTimeA = tagLatestAccess.get(tagKeyA) || 0;
    const accessTimeB = tagLatestAccess.get(tagKeyB) || 0;

    if (accessTimeA !== accessTimeB) {
      return accessTimeB - accessTimeA; // 新しい順
    }

    // アクセス日時が同じ場合はタグ名でソート
    const tagNameA = a.name || "";
    const tagNameB = b.name || "";
    return tagNameA.localeCompare(tagNameB);
  });

  container.style.display = "block";
  buttonsContainer.innerHTML = sortedTags
    .map((tag) => {
      const tagKey = `${tag.color}:${tag.name || ""}`;
      const isSelected = selectedTagFilters.has(tagKey);
      return `
        <button
          class="wps-tag-filter-btn btn btn-sm ${isSelected ? "btn-primary" : "btn-outline"}"
          data-tag-key="${tagKey}"
          style="flex-shrink: 0; display: inline-flex; align-items: center; gap: 0.5rem;">
          <div style="width: 16px; height: 16px; border-radius: 4px; background: ${tag.color};"></div>
          <span>${tag.name || t`${"no_name"}`}</span>
        </button>
      `;
    })
    .join("");

  // Add click handlers
  buttonsContainer.querySelectorAll(".wps-tag-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tagKey = (btn as HTMLElement).dataset.tagKey!;
      onTagFilterChange(tagKey);
    });
  });
};

export const renderBookmarks = (
  favorites: Bookmark[],
  sortType: BookmarkSortType = "created",
  selectedTagFilters: Set<string> = new Set()
): void => {
  const grid = document.getElementById("wps-favorites-grid") as HTMLElement;

  if (!grid) return;

  // Filter bookmarks by selected tags
  let filteredFavorites = favorites;
  if (selectedTagFilters.size > 0) {
    filteredFavorites = favorites.filter((fav) => {
      if (!fav.tag) return false;
      const tagKey = `${fav.tag.color}:${fav.tag.name || ""}`;
      return selectedTagFilters.has(tagKey);
    });
  }

  if (filteredFavorites.length === 0) {
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
    filteredFavorites.sort((a, b) => b.id - a.id);
  } else if (sortType === "accessed") {
    filteredFavorites.sort((a, b) => {
      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  } else if (sortType === "tag") {
    // タグごとの最新アクセス日時を計算
    const tagLatestAccess = new Map<string, number>();

    filteredFavorites.forEach((fav) => {
      if (!fav.tag) return;
      const tagKey = `${fav.tag.color}:${fav.tag.name || ""}`;
      const accessTime = fav.lastAccessedDate
        ? new Date(fav.lastAccessedDate).getTime()
        : 0;
      const current = tagLatestAccess.get(tagKey) || 0;
      if (accessTime > current) {
        tagLatestAccess.set(tagKey, accessTime);
      }
    });

    filteredFavorites.sort((a, b) => {
      // タグなしは最後
      if (!a.tag && !b.tag) return b.id - a.id;
      if (!a.tag) return 1;
      if (!b.tag) return -1;

      // 最近アクセスしたタグ順にソート
      const tagKeyA = `${a.tag.color}:${a.tag.name || ""}`;
      const tagKeyB = `${b.tag.color}:${b.tag.name || ""}`;
      const accessTimeA = tagLatestAccess.get(tagKeyA) || 0;
      const accessTimeB = tagLatestAccess.get(tagKeyB) || 0;

      if (accessTimeA !== accessTimeB) {
        return accessTimeB - accessTimeA; // 新しい順
      }

      // アクセス日時が同じ場合はタグ名でソート
      const tagNameA = a.tag.name || "";
      const tagNameB = b.tag.name || "";
      if (tagNameA !== tagNameB) {
        return tagNameA.localeCompare(tagNameB);
      }

      // 同じタグ内ではアクセス順
      if (!a.lastAccessedDate && !b.lastAccessedDate) return b.id - a.id;
      if (!a.lastAccessedDate) return 1;
      if (!b.lastAccessedDate) return -1;
      return (
        new Date(b.lastAccessedDate).getTime() -
        new Date(a.lastAccessedDate).getTime()
      );
    });
  }

  grid.innerHTML = filteredFavorites
    .map((fav) => {
      const cardConfig: CardConfig = {
        id: fav.id.toString(),
        title: fav.name,
        subtitle: `📍${fav.lat?.toFixed(3) || "N/A"}, ${
          fav.lng?.toFixed(3) || "N/A"
        }`,
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

export const showImportExportDialog = async (
  onImport: () => void,
  onExport: () => void,
  onExportByTag: (tags: Tag[]) => void
): Promise<void> => {
  const allBookmarks = await BookmarkStorage.getBookmarks();
  const existingTags = await BookmarkStorage.getExistingTags();

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-4">${t`${"import_export"}`}</h3>

      <!-- Import Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"import"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"import_description"}`}</p>
        <button id="wps-dialog-import-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
          </svg>
          ${t`${"import"}`}
        </button>
      </div>

      <!-- Export Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"export"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"export_all_description"}`}</p>
        <button id="wps-dialog-export-all-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
          ${t`${"export_all"}`} (${allBookmarks.length})
        </button>
      </div>

      <!-- Export by Tag Section -->
      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"export_by_tag"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"export_by_tag_description"}`}</p>
        ${
          existingTags.length === 0
            ? `<p style="text-align: center; color: oklch(var(--bc) / 0.4); padding: 1rem;">${t`${"no_tags_available"}`}</p>`
            : `
              <div id="wps-export-tag-list" style="max-height: 200px; overflow-y: auto; margin-bottom: 0.75rem;">
                ${existingTags
                  .map((tag) => {
                    const count = allBookmarks.filter(
                      (b) =>
                        b.tag &&
                        b.tag.color === tag.color &&
                        (b.tag.name || "") === (tag.name || "")
                    ).length;
                    return `
                      <label class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200" style="margin-bottom: 0.25rem;">
                        <input type="checkbox" class="checkbox checkbox-sm wps-tag-checkbox" data-color="${
                          tag.color
                        }" data-name="${tag.name || ""}" />
                        <div style="width: 20px; height: 20px; border-radius: 4px; background: ${
                          tag.color
                        }; flex-shrink: 0;"></div>
                        <span style="flex: 1;">${
                          tag.name || t`${"no_name"}`
                        }</span>
                        <span style="font-size: 0.75rem; color: oklch(var(--bc) / 0.6);">(${count})</span>
                      </label>
                    `;
                  })
                  .join("")}
              </div>
              <button id="wps-dialog-export-tag-btn" class="btn btn-primary btn-sm w-full" disabled>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                  <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
                </svg>
                ${t`${"export_selected_tags"}`}
              </button>
            `
        }
      </div>

      <!-- Close Button -->
      <div class="modal-action">
        <button id="wps-dialog-close-btn" class="btn btn-outline btn-sm">${t`${"close"}`}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  // Import button
  modal
    .querySelector("#wps-dialog-import-btn")
    ?.addEventListener("click", () => {
      modal.close();
      modal.remove();
      onImport();
    });

  // Export all button
  modal
    .querySelector("#wps-dialog-export-all-btn")
    ?.addEventListener("click", () => {
      modal.close();
      modal.remove();
      onExport();
    });

  // Tag checkbox handler
  const updateExportTagButton = () => {
    const checkboxes = modal.querySelectorAll(".wps-tag-checkbox:checked");
    const exportTagBtn = modal.querySelector(
      "#wps-dialog-export-tag-btn"
    ) as HTMLButtonElement;
    if (exportTagBtn) {
      exportTagBtn.disabled = checkboxes.length === 0;
    }
  };

  modal.querySelectorAll(".wps-tag-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", updateExportTagButton);
  });

  // Export by tag button
  modal
    .querySelector("#wps-dialog-export-tag-btn")
    ?.addEventListener("click", () => {
      const selectedTags: Tag[] = [];
      modal
        .querySelectorAll(".wps-tag-checkbox:checked")
        .forEach((checkbox) => {
          const el = checkbox as HTMLInputElement;
          selectedTags.push({
            color: el.dataset.color!,
            name: el.dataset.name || undefined,
          });
        });
      modal.close();
      modal.remove();
      onExportByTag(selectedTags);
    });

  // Close button
  modal
    .querySelector("#wps-dialog-close-btn")
    ?.addEventListener("click", () => {
      modal.close();
      modal.remove();
    });

  // Close on backdrop click
  modal.addEventListener("close", () => {
    modal.remove();
  });
};
