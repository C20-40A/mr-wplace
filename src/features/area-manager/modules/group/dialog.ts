import { t } from "@/i18n/manager";
import type { AreaRegion } from "@/types/area-region";

interface GroupComposeDialogDeps {
  candidates: AreaRegion[];
  onCreate: (selectedIds: string[], groupName: string) => Promise<void>;
}

export const showGroupComposeDialog = async (
  deps: GroupComposeDialogDeps,
): Promise<void> => {
  if (deps.candidates.length < 2) {
    alert("合体可能なエリアが不足しています");
    return;
  }

  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem; display: flex; flex-direction: column; gap: 0.7rem;">
      <h3 class="font-bold text-lg">エリア合体</h3>
      <input id="area-group-name-input" class="input input-sm input-bordered" placeholder="グループ名 (任意)" />
      <div id="area-group-candidates" style="max-height: 260px; overflow-y: auto; -webkit-overflow-scrolling: touch; overscroll-behavior: contain;"></div>
      <div class="modal-action" style="margin-top: 0.25rem;">
        <button id="area-group-create-btn" class="btn btn-primary btn-sm" disabled>合体する</button>
        <button id="area-group-cancel-btn" class="btn btn-outline btn-sm">${t`${"cancel"}`}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  const list = modal.querySelector("#area-group-candidates");
  const createBtn = modal.querySelector(
    "#area-group-create-btn",
  ) as HTMLButtonElement | null;
  const nameInput = modal.querySelector(
    "#area-group-name-input",
  ) as HTMLInputElement | null;

  if (list) {
    for (const region of deps.candidates) {
      const row = document.createElement("label");
      row.className =
        "flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-base-200";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.className = "checkbox checkbox-sm area-group-candidate";
      checkbox.dataset.regionId = region.id;

      const swatch = document.createElement("div");
      swatch.style.cssText = `
        width: 18px;
        height: 18px;
        border-radius: 4px;
        background: ${region.color};
        flex-shrink: 0;
      `;

      const text = document.createElement("span");
      text.style.flex = "1";
      text.textContent = region.name;

      row.appendChild(checkbox);
      row.appendChild(swatch);
      row.appendChild(text);
      list.appendChild(row);
    }
  }

  const updateCreateButton = () => {
    const selectedCount = modal.querySelectorAll(".area-group-candidate:checked").length;
    if (createBtn) createBtn.disabled = selectedCount < 2;
  };

  modal.querySelectorAll(".area-group-candidate").forEach((element) => {
    element.addEventListener("change", updateCreateButton);
  });

  createBtn?.addEventListener("click", async () => {
    const selectedIds: string[] = [];
    modal.querySelectorAll(".area-group-candidate:checked").forEach((element) => {
      const input = element as HTMLInputElement;
      const id = input.dataset.regionId;
      if (id) selectedIds.push(id);
    });

    await deps.onCreate(Array.from(new Set(selectedIds)), nameInput?.value.trim() ?? "");
    modal.close();
  });

  modal.querySelector("#area-group-cancel-btn")?.addEventListener("click", () => {
    modal.close();
  });

  modal.addEventListener("close", () => {
    modal.remove();
  });

  document.body.appendChild(modal);
  modal.showModal();
};
