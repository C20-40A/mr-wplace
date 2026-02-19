import { t } from "@/i18n/manager";
import type {
  AreaNameDisplayMode,
  AreaNameStyleMode,
} from "@/types/area-region";
import {
  MAX_AREA_NAME_FONT_SIZE_PX,
  MIN_AREA_NAME_FONT_SIZE_PX,
} from "@/utils/area-region";

interface DisplaySettingsDialogDeps {
  fillOpacityPercent: number;
  areaNameDisplayMode: AreaNameDisplayMode;
  areaNameFontSizePx: number;
  areaNameStyleMode: AreaNameStyleMode;
  normalizeAreaFillOpacityPercent: (value: number) => number;
  normalizeAreaNameDisplayMode: (value: unknown) => AreaNameDisplayMode;
  normalizeAreaNameStyleMode: (value: unknown) => AreaNameStyleMode;
  updateAreaFillOpacityPercent: (value: number, persist: boolean) => Promise<void>;
  setAreaNameDisplayMode: (mode: AreaNameDisplayMode) => Promise<void>;
  updateAreaNameFontSizePx: (value: number, persist: boolean) => Promise<void>;
  setAreaNameStyleMode: (mode: AreaNameStyleMode) => Promise<void>;
  onResetAreas?: () => Promise<void>;
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
          <span>エリア名表示</span>
          <select id="area-display-name-mode-select" class="select select-sm select-bordered" style="min-width: 12rem;">
            <option value="always">表示する</option>
            <option value="off">表示しない</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem;">
          <span style="min-width: 6.5rem;">文字サイズ</span>
          <input id="area-display-name-font-size-input" type="range" class="range range-xs" min="${MIN_AREA_NAME_FONT_SIZE_PX}" max="${MAX_AREA_NAME_FONT_SIZE_PX}" step="1" style="flex: 1;" />
          <span id="area-display-name-font-size-value" class="tabular-nums" style="width: 3.5rem; text-align: right;"></span>
        </label>
        <label style="display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; font-size: 0.9rem;">
          <span>文字見え方</span>
          <select id="area-display-name-style-mode-select" class="select select-sm select-bordered" style="min-width: 12rem;">
            <option value="halo">標準</option>
            <option value="color-badge">丸背景バッジ</option>
          </select>
        </label>
      </div>

      ${
        deps.onResetAreas
          ? `
      <div style="padding: 0.8rem; border: 1px solid #dc2626; border-radius: 8px; border-style: dashed;">
        <button id="area-display-settings-reset-btn" class="btn btn-sm w-full" style="background: #dc2626; color: white; border-color: #dc2626;">
          🗑️ ${t`${"reset_areas"}`}
        </button>
      </div>
      `
          : ""
      }

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
  const nameModeSelect = modal.querySelector(
    "#area-display-name-mode-select",
  ) as HTMLSelectElement | null;
  const nameFontSizeInput = modal.querySelector(
    "#area-display-name-font-size-input",
  ) as HTMLInputElement | null;
  const nameFontSizeValue = modal.querySelector(
    "#area-display-name-font-size-value",
  ) as HTMLSpanElement | null;
  const nameStyleModeSelect = modal.querySelector(
    "#area-display-name-style-mode-select",
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

  if (nameModeSelect) {
    nameModeSelect.value = deps.areaNameDisplayMode;
    nameModeSelect.addEventListener("change", () => {
      const mode = deps.normalizeAreaNameDisplayMode(nameModeSelect.value);
      void deps.setAreaNameDisplayMode(mode);
    });
  }

  if (nameFontSizeInput && nameFontSizeValue) {
    nameFontSizeInput.value = String(deps.areaNameFontSizePx);
    nameFontSizeValue.textContent = `${deps.areaNameFontSizePx}px`;

    nameFontSizeInput.addEventListener("input", (event) => {
      const target = event.target as HTMLInputElement;
      const next = Number(target.value);
      nameFontSizeValue.textContent = `${next}px`;
      void deps.updateAreaNameFontSizePx(next, false);
    });
    nameFontSizeInput.addEventListener("change", (event) => {
      const target = event.target as HTMLInputElement;
      void deps.updateAreaNameFontSizePx(Number(target.value), true);
    });
  }

  if (nameStyleModeSelect) {
    nameStyleModeSelect.value = deps.areaNameStyleMode;
    nameStyleModeSelect.addEventListener("change", () => {
      const next = deps.normalizeAreaNameStyleMode(nameStyleModeSelect.value);
      void deps.setAreaNameStyleMode(next);
    });
  }

  modal
    .querySelector("#area-display-settings-close-btn")
    ?.addEventListener("click", () => {
      modal.close();
    });

  if (deps.onResetAreas) {
    modal
      .querySelector("#area-display-settings-reset-btn")
      ?.addEventListener("click", async () => {
        if (confirm(t`${"confirm_reset_areas"}`)) {
          await deps.onResetAreas?.();
          modal.close();
        }
      });
  }

  modal.addEventListener("close", () => {
    modal.remove();
  });

  document.body.appendChild(modal);
  modal.showModal();
};
