import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import { Toast } from "@/components/toast";
import { executeOfficialSync, planOfficialSync } from "./official-overlay";

/**
 * 「公式と同期」確認ダイアログ。
 * 登録予定/同期済み/公式で削除済み(警告のみ) を表示し、確認後に未登録分だけ登録する。
 * ギャラリー・公式 overlay の削除や上書きは行わない。
 */
export const showOfficialSyncDialog = async (): Promise<void> => {
  const items = await new GalleryStorage().getAll();
  const plan = planOfficialSync(items);

  const modal = document.createElement("dialog");
  modal.className = "modal modal-open";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 28rem;">
      <h3 class="font-bold text-lg mb-3">${t("official_sync")}</h3>
      <ul class="text-sm mb-4" style="display: flex; flex-direction: column; gap: 0.25rem;">
        <li>${t("official_sync_new")}: <b>${plan.toRegister.length}</b></li>
        <li>${t("official_sync_done")}: <b>${plan.synced}</b></li>
        ${
          plan.removed
            ? `<li class="text-warning">⚠ ${t("official_sync_removed")}: <b>${plan.removed}</b></li>`
            : ""
        }
      </ul>
      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button id="official-sync-cancel" class="btn btn-ghost">${t("cancel")}</button>
        <button id="official-sync-run" class="btn btn-primary" ${
          plan.toRegister.length || Object.keys(plan.adopt).length ? "" : "disabled"
        }>${t("official_sync")}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label="${t("close")}">${t("close")}</button>
    </form>
  `;
  document.body.appendChild(modal);

  const runBtn = modal.querySelector<HTMLButtonElement>("#official-sync-run")!;
  modal.querySelector("#official-sync-cancel")?.addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => modal.remove());

  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    try {
      const { registered, failed } = await executeOfficialSync(plan);
      if (registered) Toast.success(t("official_sync_reload"));
      if (failed) Toast.error(`${failed} failed`);
    } catch (err) {
      console.error("🧑‍🎨 : Official sync failed", err);
      Toast.error(String(err));
    }
    modal.close();
  });

  modal.showModal();
};
