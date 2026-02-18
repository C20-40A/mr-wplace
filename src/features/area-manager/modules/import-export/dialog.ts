import { t } from "@/i18n/manager";
import type { AreaRegion } from "@/types/area-region";

type ImportMode = "merge" | "replace";

interface ImportExportDialogDeps {
  areaRegions: AreaRegion[];
  getSavedSyncUrl: () => Promise<string>;
  saveSyncUrl: (url: string) => Promise<void>;
  importFromUrl: (url: string, mode: ImportMode) => Promise<void>;
  importFromText: (text: string, mode: ImportMode) => Promise<void>;
  downloadRegions: (regions: AreaRegion[]) => void;
}

export const showImportExportDialog = async (
  deps: ImportExportDialogDeps,
): Promise<void> => {
  const savedSyncUrl = await deps.getSavedSyncUrl();

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 34rem; display: flex; flex-direction: column; gap: 0.6rem;">
      <h3 class="font-bold text-lg mb-4">${t`${"import_export"}`}</h3>

      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"online_sync"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_online_sync_description"}`}</p>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
          <input id="area-sync-url-input" type="text" placeholder="https://example.com/areas.geojson"
            class="input input-sm input-bordered" style="flex: 1; font-size: 0.75rem;" />
          <button id="area-sync-url-open-btn" class="btn btn-sm btn-ghost btn-square" title="${t`${"open_url"}`}">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" class="size-4">
              <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/>
            </svg>
          </button>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button id="area-sync-merge-btn" class="btn btn-primary btn-sm" style="flex: 1;">
            ${t`${"sync_merge"}`}
          </button>
          <button id="area-sync-replace-btn" class="btn btn-outline btn-sm" style="flex: 1;">
            ${t`${"sync_replace"}`}
          </button>
        </div>
      </div>

      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"import"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_import_description"}`}</p>
        <button id="area-dialog-import-btn" class="btn btn-primary btn-sm w-full">${t`${"map_filter_area_import_file"}`}</button>
        <input id="area-dialog-import-file" type="file" accept=".geojson,.json,application/geo+json,application/json" style="display: none;" />
      </div>

      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"export"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_export_all_description"}`}</p>
        <button id="area-dialog-export-all-btn" class="btn btn-primary btn-sm w-full">${t`${"export_all"}`} (${deps.areaRegions.length})</button>
      </div>

      <div style="padding: 1rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <h4 style="font-weight: 600; margin-bottom: 0.5rem;">${t`${"map_filter_area_export_selected"}`}</h4>
        <p style="font-size: 0.875rem; color: oklch(var(--bc) / 0.6); margin-bottom: 0.75rem;">${t`${"map_filter_area_export_selected_description"}`}</p>
        <div id="area-dialog-export-list" style="max-height: 200px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; margin-bottom: 0.75rem;"></div>
        <button id="area-dialog-export-selected-btn" class="btn btn-primary btn-sm w-full" disabled>${t`${"map_filter_area_export_selected_button"}`}</button>
      </div>

      <div class="modal-action">
        <button id="area-dialog-close-btn" class="btn btn-outline btn-sm">${t`${"close"}`}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  document.body.appendChild(modal);
  modal.showModal();

  const syncUrlInput = modal.querySelector(
    "#area-sync-url-input",
  ) as HTMLInputElement | null;
  const importFileInput = modal.querySelector(
    "#area-dialog-import-file",
  ) as HTMLInputElement | null;
  const exportSelectedButton = modal.querySelector(
    "#area-dialog-export-selected-btn",
  ) as HTMLButtonElement | null;
  const exportList = modal.querySelector("#area-dialog-export-list");

  if (syncUrlInput) syncUrlInput.value = savedSyncUrl;

  if (exportList) {
    if (deps.areaRegions.length === 0) {
      const empty = document.createElement("p");
      empty.style.cssText =
        "text-align: center; color: oklch(var(--bc) / 0.4); padding: 1rem;";
      empty.textContent = t`${"map_filter_area_no_regions_available"}`;
      exportList.appendChild(empty);
    } else {
      for (const region of deps.areaRegions) {
        const row = document.createElement("label");
        row.className =
          "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200";
        row.style.marginBottom = "0.25rem";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "checkbox checkbox-sm area-region-checkbox";
        checkbox.dataset.regionId = region.id;

        const swatch = document.createElement("div");
        swatch.style.cssText = `
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: ${region.color};
          flex-shrink: 0;
        `;

        const name = document.createElement("span");
        name.style.flex = "1";
        name.textContent = region.name;

        const count = document.createElement("span");
        count.style.cssText = "font-size: 0.75rem; color: oklch(var(--bc) / 0.6);";
        count.textContent = `(${region.vertices.length} ${t`${"map_filter_area_points"}`})`;

        row.appendChild(checkbox);
        row.appendChild(swatch);
        row.appendChild(name);
        row.appendChild(count);
        exportList.appendChild(row);
      }
    }
  }

  const updateExportSelectedButton = () => {
    const selectedCount = modal.querySelectorAll(
      ".area-region-checkbox:checked",
    ).length;
    if (exportSelectedButton) exportSelectedButton.disabled = selectedCount === 0;
  };

  modal.querySelectorAll(".area-region-checkbox").forEach((checkbox) => {
    checkbox.addEventListener("change", updateExportSelectedButton);
  });

  syncUrlInput?.addEventListener("blur", async () => {
    await deps.saveSyncUrl(syncUrlInput.value.trim());
  });

  modal
    .querySelector("#area-sync-url-open-btn")
    ?.addEventListener("click", () => {
      const url = syncUrlInput?.value.trim();
      if (!url) return;
      window.open(url, "_blank");
    });

  modal.querySelector("#area-sync-merge-btn")?.addEventListener("click", async () => {
    const url = syncUrlInput?.value.trim();
    if (!url) {
      alert(t`${"please_enter_sync_url"}`);
      return;
    }

    try {
      await deps.saveSyncUrl(url);
      await deps.importFromUrl(url, "merge");
      modal.close();
    } catch (error) {
      console.error("🧑‍🎨 : Area sync merge failed", error);
      alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
    }
  });

  modal
    .querySelector("#area-sync-replace-btn")
    ?.addEventListener("click", async () => {
      const url = syncUrlInput?.value.trim();
      if (!url) {
        alert(t`${"please_enter_sync_url"}`);
        return;
      }

      const confirmed = confirm(t`${"map_filter_area_sync_replace_confirm"}`);
      if (!confirmed) return;

      try {
        await deps.saveSyncUrl(url);
        await deps.importFromUrl(url, "replace");
        modal.close();
      } catch (error) {
        console.error("🧑‍🎨 : Area sync replace failed", error);
        alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
      }
    });

  modal.querySelector("#area-dialog-import-btn")?.addEventListener("click", () => {
    importFileInput?.click();
  });

  importFileInput?.addEventListener("change", async () => {
    const file = importFileInput.files?.[0];
    if (!file) return;

    try {
      await deps.importFromText(await file.text(), "merge");
      modal.close();
    } catch (error) {
      console.error("🧑‍🎨 : Area import failed", error);
      alert(`${t`${"sync_failed"}`}: ${(error as Error).message}`);
    } finally {
      importFileInput.value = "";
    }
  });

  modal.querySelector("#area-dialog-export-all-btn")?.addEventListener("click", () => {
    deps.downloadRegions(deps.areaRegions);
    modal.close();
  });

  exportSelectedButton?.addEventListener("click", () => {
    const selectedIds = new Set<string>();
    modal.querySelectorAll(".area-region-checkbox:checked").forEach((checkbox) => {
      const input = checkbox as HTMLInputElement;
      if (input.dataset.regionId) selectedIds.add(input.dataset.regionId);
    });

    deps.downloadRegions(
      deps.areaRegions.filter((region) => selectedIds.has(region.id)),
    );
    modal.close();
  });

  modal.querySelector("#area-dialog-close-btn")?.addEventListener("click", () => {
    modal.close();
  });

  modal.addEventListener("close", () => {
    modal.remove();
  });
};
