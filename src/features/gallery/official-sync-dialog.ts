import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import { Toast } from "@/components/toast";
import {
  executeOfficialSync,
  planOfficialSync,
  type SyncRow,
} from "./official-overlay";

const GRID = "display: grid; grid-template-columns: minmax(0, 1fr) 1.25rem minmax(0, 1fr); gap: 0.5rem;";
const ARROW: Record<SyncRow["state"], string> = {
  new: "→",
  synced: "⇄",
  removed: "⚠",
  officialOnly: "←",
};

const text = (value: string, className = ""): HTMLElement => {
  const el = document.createElement("span");
  el.className = `truncate ${className}`.trim();
  el.textContent = value;
  el.title = value;
  return el;
};

const thumbnails = new WeakMap<HTMLElement, string>();

const buildRow = (row: SyncRow): HTMLElement => {
  const el = document.createElement("div");
  el.className = "items-center py-1 px-1 rounded hover:bg-base-200";
  el.style.cssText = GRID;
  el.dataset.row = "";

  const left = document.createElement("div");
  left.className = "flex items-center gap-2 min-w-0";
  if (row.item) {
    if (row.item.thumbnail) {
      const img = document.createElement("img");
      img.src = row.item.thumbnail;
      img.style.cssText = "width: 1.5rem; height: 1.5rem; object-fit: contain; image-rendering: pixelated; flex-shrink: 0;";
      left.append(img);
      thumbnails.set(el, row.item.thumbnail);
    }
    left.append(text(row.item.title || "image"));
  } else {
    left.append(text("—", "opacity-40"));
  }

  const right =
    row.state === "new"
      ? text(t("official_sync_new"), "badge badge-primary badge-sm")
      : row.state === "removed"
        ? text(t("official_sync_removed"), "text-warning text-xs")
        : text(row.officialName ?? "", "opacity-80");

  el.append(left, text(ARROW[row.state], `text-center ${row.state === "removed" ? "text-warning" : "opacity-60"}`), right);
  return el;
};

const buildSection = (title: string, rows: SyncRow[], accordion: boolean): HTMLElement | null => {
  if (!rows.length) return null;
  const body = document.createElement("div");
  body.append(...rows.map(buildRow));

  const label = `${title} (${rows.length})`;
  if (!accordion) {
    const section = document.createElement("div");
    const head = text(label, "block text-xs font-bold opacity-70 mt-2 mb-1");
    section.append(head, body);
    return section;
  }
  const details = document.createElement("details");
  details.className = "mt-2";
  const summary = document.createElement("summary");
  summary.className = "cursor-pointer text-xs font-bold opacity-70 mb-1 select-none";
  summary.textContent = label;
  details.append(summary, body);
  return details;
};

// 行ホバーで該当画像をマウス位置に表示する (dialog 内に置き top-layer の下に隠れないようにする)
const attachPreview = (modal: HTMLElement, rows: HTMLElement) => {
  const preview = document.createElement("img");
  preview.style.cssText =
    "position: fixed; display: none; width: 160px; height: 160px; object-fit: contain; image-rendering: pixelated; pointer-events: none; z-index: 100; background: var(--color-base-100, #fff); border: 1px solid currentColor; border-radius: 0.5rem; padding: 4px;";
  modal.append(preview);

  rows.addEventListener("mousemove", (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
    const src = row && thumbnails.get(row);
    if (!src) {
      preview.style.display = "none";
      return;
    }
    if (preview.src !== src) preview.src = src;
    const size = 176;
    const x = e.clientX + 16 + size > window.innerWidth ? e.clientX - 16 - size : e.clientX + 16;
    const y = Math.min(e.clientY + 16, window.innerHeight - size);
    preview.style.display = "block";
    preview.style.left = `${Math.max(0, x)}px`;
    preview.style.top = `${Math.max(0, y)}px`;
  });
  rows.addEventListener("mouseleave", () => (preview.style.display = "none"));
};

/**
 * 「公式と同期」確認ダイアログ。
 * Mr. Wplace と公式 overlay の対応を表で見せ、確認後に未登録分だけ登録する (登録後は自動で再読み込み)。
 * ギャラリー・公式 overlay の削除や上書きは行わない (公式で消えたものは警告のみ)。
 */
export const showOfficialSyncDialog = async (): Promise<void> => {
  const items = await new GalleryStorage().getAll();
  const plan = planOfficialSync(items);
  const by = (state: SyncRow["state"]) => plan.rows.filter((r) => r.state === state);

  const modal = document.createElement("dialog");
  modal.className = "modal modal-open";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-2">${t("official_sync")}</h3>
      <div class="text-xs font-bold opacity-60 pb-1" style="${GRID} border-bottom: 1px solid currentColor;">
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
  const rows = modal.querySelector<HTMLElement>("#official-sync-rows")!;
  rows.append(
    ...[
      buildSection(t("official_sync_removed"), by("removed"), false),
      buildSection(t("official_sync_new"), by("new"), false),
      buildSection(t("official_sync_done"), by("synced"), true),
      buildSection(t("official_sync_official_only"), by("officialOnly"), true),
    ].filter((el): el is HTMLElement => !!el),
  );
  document.body.appendChild(modal);
  attachPreview(modal, rows);

  const runBtn = modal.querySelector<HTMLButtonElement>("#official-sync-run")!;
  modal.querySelector("#official-sync-cancel")?.addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => modal.remove());

  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    try {
      const { registered, failed } = await executeOfficialSync(plan);
      if (failed) Toast.error(`${t("error")}: ${failed}`);
      // メタは公式の pagehide 書き戻し後に反映されるため、再読み込みで確定させる
      if (registered) setTimeout(() => location.reload(), failed ? 1500 : 0);
    } catch (err) {
      console.error("🧑‍🎨 : Official sync failed", err);
      Toast.error(String(err));
    }
    modal.close();
  });

  modal.showModal();
};
