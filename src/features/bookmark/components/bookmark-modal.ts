import { t } from "@/i18n/manager";
import { createModal, ModalElements } from "@/components/modal";
import { isMobileViewport } from "@/constants/breakpoints";

export const createBookmarkModal = (): ModalElements => {
  const isMobile = isMobileViewport();
  const controlButtonClass = `btn btn-outline ${isMobile ? "btn-xs" : "btn-sm"}`;
  const selectClass = `select ${isMobile ? "select-xs" : "select-sm"} select-bordered`;
  const mobileHiddenClass = isMobile ? "hidden" : "";

  const modalElements = createModal({
    id: "wplace-studio-favorite-modal",
    title: t`${"bookmark_list"}`,
    maxWidth: "64rem", // 4xl equivalent
  });

  // Add bookmark-specific content to container
  modalElements.container.style.display = "flex";
  modalElements.container.style.flexDirection = "column";
  modalElements.container.style.minHeight = "0";
  modalElements.container.style.height = "40rem";
  modalElements.container.style.overflow = "hidden";

  modalElements.container.innerHTML = t`
    <!-- Tab Content Wrapper -->
    <div id="wps-tab-content" style="flex: 1; min-height: 0; display: flex; flex-direction: column;">
      <!-- Bookmark Tab Content -->
      <div id="wps-bookmark-tab-content" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
        <!-- List Screen -->
        <div id="wps-bookmark-list-screen" style="display: flex; flex-direction: column; flex: 1; min-height: 0;">
          <!-- Fixed Header: Buttons -->
          <div class="flex gap-2" style="flex-wrap: wrap; margin-bottom: 0.7rem; flex-shrink: 0;">
            <button id="wps-location-search-btn" class="${controlButtonClass}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                <path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/>
              </svg>
            </button>
            <button id="wps-coordinate-jumper-btn" class="${controlButtonClass}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm-40-82v-78q-33 0-56.5-23.5T360-320v-40L168-552q-3 18-5.5 36t-2.5 36q0 121 79.5 212T440-162Zm276-102q20-22 36-47.5t26.5-53q10.5-27.5 16-56.5t5.5-59q0-98-54.5-179T600-776v16q0 33-23.5 56.5T520-680h-80v80q0 17-11.5 28.5T400-560h-80v80h240q17 0 28.5 11.5T600-440v120h40q26 0 47 15.5t29 40.5Z"/>
              </svg>
              <span class="${mobileHiddenClass}">${"coordinate_jumper"}</span>
            </button>
            <button id="wps-import-export-btn" class="${controlButtonClass}">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
                <path d="M440-367v-465l-64 64-56-57 160-160 160 160-56 57-64-64v465h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
              </svg>
              <span class="${mobileHiddenClass}">${"import_export"}</span>
            </button>
            <input type="file" id="wps-import-file" accept=".json" style="display: none;">
            <div class="flex items-center gap-2">
              <select id="wps-bookmark-sort" class="${selectClass}">
                <option value="created">${"sort_created"}</option>
                <option value="accessed">${"sort_accessed"}</option>
                <option value="tag">${"sort_tag"}</option>
              </select>
            </div>
          </div>

          <!-- Tag Filter -->
          <div id="wps-tag-filter-container" style="margin-bottom: 0.7rem; flex-shrink: 0; display: none;">
            <div style="overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; white-space: nowrap; padding-bottom: 0.25rem;">
              <div id="wps-tag-filter-buttons" style="display: inline-flex; gap: 0.5rem;"></div>
            </div>
          </div>

          <!-- Scrollable Content: Bookmarks Grid -->
          <div id="wps-bookmark-list-scroll-area" style="flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
            <div id="wps-favorites-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
            </div>
            <div id="wps-favorites-empty" style="display: none; min-height: 100%;">
            </div>
          </div>
        </div>

        <!-- Coordinate Jumper Screen -->
        <div id="wps-coordinate-jumper-screen" style="display: none; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
        </div>

        <!-- Location Search Screen -->
        <div id="wps-location-search-screen" style="display: none; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
        </div>

        <!-- Edit Screen -->
        <div id="wps-bookmark-edit-screen" style="display: none; flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;">
          <div style="padding: 1rem;">
            <!-- Name Section -->
            <div style="margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"bookmark_name"}</label>
              <input id="wps-edit-name" type="text" class="input input-bordered" style="width: 100%;" />
            </div>

            <!-- Step 1: Tag Selection -->
            <div id="wps-edit-tag-selection" style="display: block; margin-bottom: 1rem;">
              <label style="display: block; font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem;">${"existing_tags"}</label>
              <div id="wps-existing-tags-container" class="border-base-300" style="max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; margin-bottom: 0.5rem; border: 1px solid; border-radius: 8px; padding: 0.5rem;"></div>
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
      </div>

      <!-- Official Favorites Tab Content -->
      <div id="wps-official-fav-tab-content" style="display: none; flex-direction: column; flex: 1; min-height: 0;">
        <div id="wps-official-fav-scroll-area" style="flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; min-height: 0;">
          <div id="wps-official-fav-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2">
          </div>
          <div id="wps-official-fav-empty" style="display: none; min-height: 100%; display: flex; align-items: center; justify-content: center;">
            <p style="color: oklch(var(--bc) / 0.5);">${"empty_official_favorites"}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Tabs -->
    <div id="wps-bottom-tabs" style="flex-shrink: 0; display: flex; gap: 0.375rem; border-top: 1px solid color-mix(in oklab, var(--color-base-content) 10%, transparent); margin-top: 0.5rem; padding-top: 0.625rem; background: var(--color-base-100);">
      <button
        id="wps-tab-bookmark"
        class="btn btn-ghost flex-1"
        aria-pressed="true"
        style="border-radius: 0.9rem; border: 1px solid var(--color-primary); background: transparent; font-weight: 700; min-height: 3rem; padding: 0.75rem 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="none" stroke="currentColor" stroke-width="72" stroke-linecap="round" stroke-linejoin="round" class="size-4">
          <path d="M280-760h400v639l-200-86-200 86v-639Z"/>
        </svg>
        ${"bookmark"}
      </button>
      <button
        id="wps-tab-official-fav"
        class="btn btn-ghost flex-1"
        aria-pressed="false"
        style="border-radius: 0.9rem; border: 1px solid transparent; background: transparent; font-weight: 500; min-height: 3rem; padding: 0.75rem 0.9rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem;"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
          <path d="m233-120 65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-98 188 113-50-214 165-143-217-19-86-203-86 203-217 19 165 143-50 214 188-113Z"/>
        </svg>
        ${"official_favorites"}
      </button>
    </div>
  `;

  return modalElements;
};

export const getBookmarkModalElement = (
  modalElements: ModalElements,
): HTMLDialogElement => {
  return modalElements.modal;
};
