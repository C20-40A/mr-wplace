import { Tag, Bookmark } from "../types";
import { t } from "@/i18n/manager";
import { BookmarkStorage } from "../storage";

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

  const isSelected = (tag: Tag): boolean =>
    tag.color === currentTag?.color &&
    (tag.name || "") === (currentTag?.name || "");

  container.innerHTML = tags
    .map((tag) => {
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
        <span style="flex: 1; font-weight: ${selected ? "600" : "400"};">${
          tag.name || `(${t`${"tag_name"}`})`
        }</span>
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
    })
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
    `,
  ).join("");
};

export const showEditScreen = async (bookmark: Bookmark): Promise<void> => {
  const listScreen = document.getElementById("wps-bookmark-list-screen");
  const editScreen = document.getElementById("wps-bookmark-edit-screen");
  const nameInput = document.getElementById("wps-edit-name") as HTMLInputElement;

  if (!listScreen || !editScreen || !nameInput) return;

  nameInput.value = bookmark.name;

  const existingTags = await BookmarkStorage.getExistingTags();
  renderExistingTags(existingTags, bookmark.tag);

  showTagSelection();

  editScreen.dataset.bookmarkId = bookmark.id.toString();
  editScreen.dataset.currentTagColor = bookmark.tag?.color || "";
  editScreen.dataset.currentTagName = bookmark.tag?.name || "";

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
  onDelete: (tag: Tag) => void,
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
          `,
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

  const originalTag: Tag = { color: tag.color, name: tag.name };

  modal
    .querySelector("#wps-tag-edit-color-picker")!
    .addEventListener("click", (e) => {
      const colorBtn = (e.target as HTMLElement).closest(
        ".wps-tag-edit-color-btn",
      ) as HTMLElement | null;
      if (!colorBtn) return;

      modal.querySelectorAll(".wps-tag-edit-color-btn").forEach((btn) => {
        (btn as HTMLElement).style.border = "3px solid transparent";
      });
      colorBtn.style.border = "3px solid #000";
    });

  modal
    .querySelector("#wps-tag-edit-save-btn")!
    .addEventListener("click", () => {
      console.log("🧑‍🎨 : Save button clicked in modal");

      const nameInput = modal.querySelector(
        "#wps-tag-edit-name",
      ) as HTMLInputElement;

      let selectedColor: string | null = null;
      modal.querySelectorAll(".wps-tag-edit-color-btn").forEach((btn) => {
        const style = (btn as HTMLElement).style.border;
        console.log(
          "🧑‍🎨 : Button border style:",
          style,
          "data-color:",
          (btn as HTMLElement).dataset.color,
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

  modal.querySelector("#wps-tag-delete-btn")!.addEventListener("click", () => {
    onDelete(originalTag);
    modal.close();
    modal.remove();
  });

  modal
    .querySelector("#wps-tag-edit-cancel-btn")!
    .addEventListener("click", () => {
      modal.close();
      modal.remove();
    });

  modal.addEventListener("close", () => {
    modal.remove();
  });
};
