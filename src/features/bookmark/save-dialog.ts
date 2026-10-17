import { t } from "@/i18n/manager";
import { createDialogLikeModal } from "@/components/modal";

export type SaveDest = "official" | "legacy";

/**
 * 地点保存ダイアログ (スクショ + タイトル + 保存先)
 * - thumbPromise の完了後にスクショを表示する
 * - キャンセル(×/背景/Esc)は null
 */
export const showSaveLocationDialog = (options: {
  placeholder: string;
  dest: SaveDest;
  thumbPromise: Promise<string | null>;
}): Promise<{ name: string; dest: SaveDest } | null> =>
  new Promise((resolve) => {
    const { placeholder, dest, thumbPromise } = options;
    const modal = createDialogLikeModal();
    const opt = (v: SaveDest, label: string) =>
      `<option value="${v}"${v === dest ? " selected" : ""}>${label}</option>`;
    modal.innerHTML = `
      <div class="modal-box" style="position:relative;">
        <button type="button" class="mrw-close btn btn-sm btn-circle btn-ghost" style="position:absolute;right:0.5rem;top:0.5rem;" aria-label="${t`${"close"}`}">✕</button>
        <div class="mrw-thumb bg-base-200" style="width:100%;max-width:16rem;aspect-ratio:1;margin:1rem auto;border-radius:0.75rem;background-size:cover;background-position:center;"></div>
        <label class="mb-3 block">
          <span class="mb-1 block text-sm font-semibold">${t`${"title"}`}</span>
          <input type="text" class="mrw-name input input-bordered w-full" placeholder="${placeholder}" />
        </label>
        <label class="mb-4 block">
          <span class="mb-1 block text-sm font-semibold">${t`${"save_destination"}`}</span>
          <select class="mrw-dest select select-bordered w-full">
            ${opt("official", t`${"official_favorites"}`)}${opt("legacy", t`${"bookmark"}`)}
          </select>
        </label>
        <div class="flex justify-center">
          <button type="button" class="mrw-save btn btn-primary btn-lg" style="width:100%;max-width:20rem;">${t`${"save"}`}</button>
        </div>
      </div>
      <div class="modal-backdrop">
        <button type="button" class="mrw-backdrop" aria-label="${t`${"close"}`}"></button>
      </div>`;
    document.body.appendChild(modal);

    const q = <T extends HTMLElement>(sel: string) => modal.querySelector<T>(sel)!;
    const nameInput = q<HTMLInputElement>(".mrw-name");
    const destSelect = q<HTMLSelectElement>(".mrw-dest");
    let resolved = false;

    const finish = (result: { name: string; dest: SaveDest } | null) => {
      if (resolved) return;
      resolved = true;
      modal.close();
      resolve(result);
    };
    const save = () =>
      finish({ name: nameInput.value.trim(), dest: destSelect.value as SaveDest });

    q(".mrw-save").addEventListener("click", save);
    q(".mrw-close").addEventListener("click", () => finish(null));
    q(".mrw-backdrop").addEventListener("click", () => finish(null));
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") save();
    });
    modal.addEventListener("close", () => {
      modal.remove();
      finish(null);
    });

    thumbPromise.then((url) => {
      if (url) q(".mrw-thumb").style.backgroundImage = `url("${url}")`;
    });

    modal.showModal();
    nameInput.focus();
  });
