import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import { Toast } from "@/components/toast";
import {
  executeOfficialSync,
  planOfficialSync,
  type SyncRow,
} from "./official-overlay";

const ARROW: Record<SyncRow["state"], string> = {
  new: "→",
  synced: "=",
  removed: "⚠",
  officialOnly: "←",
};

const cell = (text: string, extraClass = ""): HTMLElement => {
  const el = document.createElement("span");
  el.className = `truncate ${extraClass}`.trim();
  el.textContent = text;
  el.title = text;
  return el;
};

const buildRow = (row: SyncRow): HTMLElement => {
  const el = document.createElement("div");
  el.className = "items-center gap-2 py-1";
  el.style.cssText =
    "display: grid; grid-template-columns: minmax(0, 1fr) 1.5rem minmax(0, 1fr);";
  const mine = row.item ? row.item.title || "image" : t("official_sync_official_only");
  const theirs =
    row.state === "new"
      ? t("official_sync_new")
      : row.state === "removed"
        ? t("official_sync_removed")
        : (row.officialName ?? "");
  el.append(
    cell(mine, row.item ? "" : "opacity-60"),
    cell(ARROW[row.state], `text-center ${row.state === "removed" ? "text-warning" : ""}`),
    cell(theirs, row.state === "new" ? "text-primary" : row.state === "removed" ? "text-warning" : "opacity-80"),
  );
  return el;
};

/**
 * 「公式と同期」確認ダイアログ。
 * Mr. Wplace と公式 overlay の対応を表で見せ、確認後に未登録分だけ登録する。
 * ギャラリー・公式 overlay の削除や上書きは行わない (公式で消えたものは警告のみ)。
 */
export const showOfficialSyncDialog = async (): Promise<void> => {
  const items = await new GalleryStorage().getAll();
  const plan = planOfficialSync(items);

  const modal = document.createElement("dialog");
  modal.className = "modal modal-open";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-2">${t("official_sync")}</h3>
      <p class="text-sm mb-3 opacity-80">
        ${t("official_sync_new")}: <b>${plan.toRegister.length}</b> ·
        ${t("official_sync_done")}: <b>${plan.synced}</b>${
          plan.removed ? ` · <span class="text-warning">⚠ <b>${plan.removed}</b></span>` : ""
        }
      </p>
      <div class="text-xs font-bold opacity-60 pb-1" style="display: grid; grid-template-columns: minmax(0, 1fr) 1.5rem minmax(0, 1fr); gap: 0.5rem; border-bottom: 1px solid currentColor;">
        <span>Mr. Wplace</span><span></span><span>${t("official_sync_official")}</span>
      </div>
      <div id="official-sync-rows" class="text-sm" style="max-height: 50vh; overflow-y: auto;"></div>
      <div class="mt-4" style="display: flex; gap: 0.75rem; justify-content: flex-end;">
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
  modal.querySelector("#official-sync-rows")!.append(...plan.rows.map(buildRow));
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
