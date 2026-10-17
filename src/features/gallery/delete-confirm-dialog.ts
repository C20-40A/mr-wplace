import { t } from "@/i18n/manager";
import { isInOfficialOverlay } from "./official-overlay";

/**
 * 画像削除の確認ダイアログ。
 * 公式 overlay に対応するコピーが残る場合は、その旨を案内する (公式側は消さない)。
 */
export const confirmDelete = (message: string, key: string): Promise<boolean> =>
  new Promise((resolve) => {
    const modal = document.createElement("dialog");
    modal.className = "modal modal-open";
    modal.innerHTML = `
      <div class="modal-box" style="max-width: 24rem;">
        <h3 class="font-bold text-lg mb-2">🗑️ ${t("delete")}</h3>
        <p class="mb-3">${message}</p>
        ${
          isInOfficialOverlay(key)
            ? `<div role="alert" class="alert alert-info text-sm mb-3" style="display: flex; gap: 0.5rem;">
                <span>ℹ️</span><span>${t("official_overlay_remains")}</span>
              </div>`
            : ""
        }
        <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button id="delete-confirm-cancel" class="btn btn-ghost">${t("cancel")}</button>
          <button id="delete-confirm-ok" class="btn btn-error">${t("delete")}</button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button aria-label="${t("close")}">${t("close")}</button>
      </form>
    `;
    document.body.appendChild(modal);

    let result = false;
    modal.querySelector("#delete-confirm-ok")?.addEventListener("click", () => {
      result = true;
      modal.close();
    });
    modal.querySelector("#delete-confirm-cancel")?.addEventListener("click", () => modal.close());
    modal.addEventListener("close", () => {
      modal.remove();
      resolve(result);
    });
    modal.showModal();
  });
