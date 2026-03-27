import { Tag } from "../types";
import { t } from "@/i18n/manager";
import { BookmarkStorage } from "../storage";

export const showImportExportDialog = async (
  onImport: () => void,
  onExport: () => void,
  onExportByTag: (tags: Tag[]) => void,
): Promise<void> => {
  const allBookmarks = await BookmarkStorage.getBookmarks();
  const existingTags = await BookmarkStorage.getExistingTags();

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = t`
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-4">${"import_export"}</h3>

      <!-- Import Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${"import"}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${"import_description"}</p>
        <button id="wps-dialog-import-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t123-78q25-92 100-149t170-57q117 0 198.5 81.5T760-520q69 8 114.5 59.5T920-340q0 75-52.5 127.5T740-160H520q-33 0-56.5-23.5T440-240v-206l-64 62-56-56 160-160 160 160-56 56-64-62v206h220q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-83-58.5-141.5T480-720q-83 0-141.5 58.5T280-520h-20q-58 0-99 41t-41 99q0 58 41 99t99 41h100v80H260Z"/>
          </svg>
          ${`${"import"}`}
        </button>
      </div>

      <!-- Export Section -->
      <div style="margin-bottom: 1.5rem; padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${`${"export"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`${"export_all_description"}`}</p>
        <button id="wps-dialog-export-all-btn" class="btn btn-primary btn-sm w-full">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
            <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/>
          </svg>
          ${`${"export_all"}`} (${allBookmarks.length})
        </button>
      </div>

      <!-- Export by Tag Section -->
      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${"export_by_tag"}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${`${"export_by_tag_description"}`}</p>
        ${
          existingTags.length === 0
            ? t`<p style="text-align: center; color: oklch(var(--bc) / 0.4); padding: 1rem;">${`${"no_tags_available"}`}</p>`
            : t`
              <div id="wps-export-tag-list" style="max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; margin-bottom: 0.75rem;">
                ${existingTags
                  .map((tag) => {
                    const count = allBookmarks.filter(
                      (b) =>
                        b.tag &&
                        b.tag.color === tag.color &&
                        (b.tag.name || "") === (tag.name || ""),
                    ).length;
                    return t`
                      <label class="flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200" style="margin-bottom: 0.25rem;">
                        <input type="checkbox" class="checkbox checkbox-sm wps-tag-checkbox" data-color="${
                          tag.color
                        }" data-name="${tag.name || ""}" />
                        <div style="width: 20px; height: 20px; border-radius: 4px; background: ${
                          tag.color
                        }; flex-shrink: 0;"></div>
                        <span style="flex: 1;">${
                          tag.name || `${"no_name"}`
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
                ${"export_selected_tags"}
              </button>
            `
        }
      </div>

      <!-- Close Button -->
      <div class="modal-action">
        <button id="wps-dialog-close-btn" class="btn btn-outline btn-sm">${"close"}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  modal.querySelector("#wps-dialog-import-btn")?.addEventListener("click", () => {
    modal.close();
    modal.remove();
    onImport();
  });

  modal.querySelector("#wps-dialog-export-all-btn")?.addEventListener("click", () => {
    modal.close();
    modal.remove();
    onExport();
  });

  const updateExportTagButton = () => {
    const checkboxes = modal.querySelectorAll(".wps-tag-checkbox:checked");
    const exportTagBtn = modal.querySelector("#wps-dialog-export-tag-btn") as HTMLButtonElement;
    if (exportTagBtn) exportTagBtn.disabled = checkboxes.length === 0;
  };

  modal.querySelectorAll(".wps-tag-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", updateExportTagButton);
  });

  modal.querySelector("#wps-dialog-export-tag-btn")?.addEventListener("click", () => {
    const selectedTags: Tag[] = [];
    modal.querySelectorAll(".wps-tag-checkbox:checked").forEach((checkbox) => {
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

  modal.querySelector("#wps-dialog-close-btn")?.addEventListener("click", () => {
    modal.close();
    modal.remove();
  });

  modal.addEventListener("close", () => {
    modal.remove();
  });
};
