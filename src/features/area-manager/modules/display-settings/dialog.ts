import { t } from "@/i18n/manager";
import type { AreaNameDisplayMode } from "@/types/area-region";

interface DisplaySettingsDialogDeps {
  fillOpacityPercent: number;
  areaNameClickToGoto: boolean;
  areaNameDisplayMode: AreaNameDisplayMode;
  normalizeAreaFillOpacityPercent: (value: number) => number;
  normalizeAreaNameDisplayMode: (value: unknown) => AreaNameDisplayMode;
  updateAreaFillOpacityPercent: (value: number, persist: boolean) => Promise<void>;
  setAreaNameClickToGoto: (enabled: boolean) => Promise<void>;
  setAreaNameDisplayMode: (mode: AreaNameDisplayMode) => Promise<void>;
}

export const showDisplaySettingsDialog = (
  deps: DisplaySettingsDialogDeps,
): void => {
  const modal = document.createElement("dialog");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 27rem; display: flex; flex-direction: column; gap: 0.8rem;">
      <h3 class="font-bold text-lg">表示設定</h3>

      <div style="padding: 0.8rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px;">
        <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem;">
          <span style="min-width: 6.5rem;">エリア透明度</span>
          <input id="area-display-opacity-input" type="range" class="range range-xs" min="0" max="100" step="1" style="flex: 1;" />
          <span id="area-display-opacity-value" class="tabular-nums" style="width: 3rem; text-align: right;"></span>
        </label>
      </div>

      <div style="padding: 0.8rem; border: 1px solid oklch(var(--bc) / 0.2); border-radius: 8px; display: flex; flex-direction: column; gap: 0.7rem;">
        <label style="display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; font-size: 0.9rem;">
          <span>マップ上の名前クリックで移動</span>
          <input id="area-display-name-click-toggle" type="checkbox" class="toggle toggle-sm" />
        </label>
        <label style="display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; font-size: 0.9rem;">
          <span>エリア名表示</span>
          <select id="area-display-name-mode-select" class="select select-sm select-bordered" style="min-width: 12rem;">
            <option value="always">表示する</option>
            <option value="off">表示しない</option>
            <option value="hide-on-zoom-out">ズームアウト時に隠す</option>
          </select>
        </label>
      </div>

      <div class="modal-action">
        <button id="area-display-settings-close-btn" class="btn btn-outline btn-sm">${t`${"close"}`}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button>close</button>
    </form>
  `;

  const opacityInput = modal.querySelector(
    "#area-display-opacity-input",
  ) as HTMLInputElement | null;
  const opacityValue = modal.querySelector(
    "#area-display-opacity-value",
  ) as HTMLSpanElement | null;
  const nameClickToggle = modal.querySelector(
    "#area-display-name-click-toggle",
  ) as HTMLInputElement | null;
  const nameModeSelect = modal.querySelector(
    "#area-display-name-mode-select",
  ) as HTMLSelectElement | null;

  if (opacityInput && opacityValue) {
    opacityInput.value = String(deps.fillOpacityPercent);
    opacityValue.textContent = `${deps.fillOpacityPercent}%`;

    opacityInput.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      const next = deps.normalizeAreaFillOpacityPercent(Number(target.value));
      opacityValue.textContent = `${next}%`;
      void deps.updateAreaFillOpacityPercent(next, false);
    });
    opacityInput.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      void deps.updateAreaFillOpacityPercent(Number(target.value), true);
    });
  }

  if (nameClickToggle) {
    nameClickToggle.checked = deps.areaNameClickToGoto;
    nameClickToggle.addEventListener("change", () => {
      void deps.setAreaNameClickToGoto(nameClickToggle.checked);
    });
  }

  if (nameModeSelect) {
    nameModeSelect.value = deps.areaNameDisplayMode;
    nameModeSelect.addEventListener("change", () => {
      const mode = deps.normalizeAreaNameDisplayMode(nameModeSelect.value);
      void deps.setAreaNameDisplayMode(mode);
    });
  }

  modal
    .querySelector("#area-display-settings-close-btn")
    ?.addEventListener("click", () => {
      modal.close();
    });

  modal.addEventListener("close", () => {
    modal.remove();
  });

  document.body.appendChild(modal);
  modal.showModal();
};
