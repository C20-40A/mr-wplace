import { t } from "@/i18n/manager";
import { GalleryStorage } from "@/states/galleryStorage";
import { Toast } from "@/components/toast";
import {
  executeOfficialSync,
  getOfficialImageUrl,
  isAutoSyncEnabled,
  setAutoSyncEnabled,
  planOfficialSync,
  type SyncRow,
} from "./official-overlay";

const GRID = "display: grid; grid-template-columns: minmax(0, 1fr) 1.25rem minmax(0, 1fr); gap: 0.5rem;";
const ARROW: Record<SyncRow["state"], string> = {
  new: "→",
  changed: "→",
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

// 行ごとのプレビュー画像の取得関数 (公式側は IndexedDB から遅延読み込み)
const previewLoaders = new WeakMap<HTMLElement, () => Promise<string | null>>();

const officialName = (row: SyncRow): string =>
  typeof row.official?.name === "string" ? row.official.name : "";

const buildRow = (row: SyncRow, selected: Set<string>, onToggle: () => void): HTMLElement => {
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
      const { thumbnail } = row.item;
      previewLoaders.set(el, async () => thumbnail);
    }
    left.append(text(row.item.title || "image"));
  } else if (row.official) {
    const { id } = row.official;
    previewLoaders.set(el, () => getOfficialImageUrl(id));
    // 公式のみ: チェックでギャラリーへ取り込む
    const label = document.createElement("label");
    label.className = "flex items-center gap-2 cursor-pointer min-w-0";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.className = "checkbox checkbox-xs";
    box.dataset.rowCheck = "";
    box.addEventListener("change", () => {
      if (box.checked) selected.add(id);
      else selected.delete(id);
      onToggle();
    });
    label.append(box, text(t("import"), "opacity-80"));
    left.append(label);
  }

  const right =
    row.state === "new"
      ? text(t("official_sync_new"), "badge badge-primary badge-sm")
      : row.state === "changed"
        ? text(t("official_sync_changed"), "badge badge-secondary badge-sm")
        : row.state === "removed"
        ? text(t("official_sync_removed"), "text-warning text-xs")
        : text(officialName(row), "opacity-80");

  el.append(left, text(ARROW[row.state], `text-center ${row.state === "removed" ? "text-warning" : "opacity-60"}`), right);
  return el;
};

// 取り込み対象の行を一括でチェック/解除する
const buildSelectAll = (body: HTMLElement): HTMLElement => {
  const label = document.createElement("label");
  label.className = "flex items-center gap-2 cursor-pointer py-1 px-1 text-xs opacity-80";
  const all = document.createElement("input");
  all.type = "checkbox";
  all.className = "checkbox checkbox-xs";
  all.addEventListener("change", () => {
    body.querySelectorAll<HTMLInputElement>("input[data-row-check]").forEach((box) => {
      if (box.checked === all.checked) return;
      box.checked = all.checked;
      box.dispatchEvent(new Event("change"));
    });
  });
  label.append(all, text(t("select_all")));
  return label;
};

const buildSection = (
  title: string,
  rows: SyncRow[],
  accordion: boolean,
  selected: Set<string>,
  onToggle: () => void,
  selectAll = false,
): HTMLElement | null => {
  if (!rows.length) return null;
  const body = document.createElement("div");
  body.append(...rows.map((r) => buildRow(r, selected, onToggle)));
  if (selectAll) body.prepend(buildSelectAll(body));

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
// 戻り値: 作成した object URL を解放する関数
const attachPreview = (modal: HTMLElement, rows: HTMLElement): (() => void) => {
  const preview = document.createElement("img");
  preview.style.cssText =
    "position: fixed; display: none; width: 160px; height: 160px; object-fit: contain; image-rendering: pixelated; pointer-events: none; z-index: 100; background: var(--color-base-100, #fff); border: 1px solid currentColor; border-radius: 0.5rem; padding: 4px;";
  modal.append(preview);

  const cache = new Map<HTMLElement, Promise<string | null>>();
  let hovered: HTMLElement | null = null;

  const hide = () => {
    hovered = null;
    preview.style.display = "none";
  };

  rows.addEventListener("mousemove", async (e) => {
    const row = (e.target as HTMLElement).closest<HTMLElement>("[data-row]");
    const load = row && previewLoaders.get(row);
    if (!row || !load) return hide();

    const size = 176;
    preview.style.left = `${Math.max(0, e.clientX + 16 + size > window.innerWidth ? e.clientX - 16 - size : e.clientX + 16)}px`;
    preview.style.top = `${Math.max(0, Math.min(e.clientY + 16, window.innerHeight - size))}px`;
    if (hovered === row) return;

    hovered = row;
    if (!cache.has(row)) cache.set(row, load());
    const src = await cache.get(row);
    if (hovered !== row || !src) return; // 読み込み中に別の行へ移った
    preview.src = src;
    preview.style.display = "block";
  });
  rows.addEventListener("mouseleave", hide);

  return () => {
    cache.forEach(async (p) => {
      const src = await p;
      if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
    });
  };
};

/**
 * 「公式と同期」確認ダイアログ。
 * Mr. Wplace と公式 overlay の対応を表で見せ、確認後に未登録分だけ登録する (登録後は自動で再読み込み)。
 * ギャラリー・公式 overlay の削除や上書きは行わない (公式で消えたものは警告のみ)。
 */
export const showOfficialSyncDialog = async (): Promise<void> => {
  const items = await new GalleryStorage().getAll();
  const plan = planOfficialSync(items);
  const autoSync = await isAutoSyncEnabled();
  const by = (state: SyncRow["state"]) => plan.rows.filter((r) => r.state === state);
  const selected = new Set<string>();

  const modal = document.createElement("dialog");
  modal.className = "modal modal-open";
  modal.innerHTML = `
    <div class="modal-box" style="max-width: 32rem;">
      <h3 class="font-bold text-lg mb-2">${t("official_sync")}</h3>
      <div class="text-xs font-bold opacity-60 pb-1" style="${GRID} border-bottom: 1px solid currentColor;">
        <span>Mr. Wplace</span><span></span><span>${t("official_sync_official")}</span>
      </div>
      <div id="official-sync-rows" class="text-sm" style="max-height: 50vh; overflow-y: auto;"></div>
      <label class="mt-3 flex items-center gap-2 cursor-pointer text-sm">
        <input id="official-sync-auto" type="checkbox" class="toggle toggle-sm toggle-primary" ${autoSync ? "checked" : ""} />
        <span>${t("official_auto_sync")}</span>
      </label>
      <div class="mt-3" style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button id="official-sync-cancel" class="btn btn-ghost">${t("cancel")}</button>
        <button id="official-sync-run" class="btn btn-primary">${t("official_sync")}</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label="${t("close")}">${t("close")}</button>
    </form>
  `;
  const rows = modal.querySelector<HTMLElement>("#official-sync-rows")!;
  const runBtn = modal.querySelector<HTMLButtonElement>("#official-sync-run")!;
  const hasWork = () => by("new").length > 0 || by("changed").length > 0 || Object.keys(plan.adopt).length > 0 || selected.size > 0;
  const onToggle = () => (runBtn.disabled = !hasWork());
  rows.append(
    ...[
      buildSection(t("official_sync_removed"), by("removed"), false, selected, onToggle),
      buildSection(t("official_sync_new"), by("new"), false, selected, onToggle),
      buildSection(t("official_sync_changed"), by("changed"), false, selected, onToggle),
      buildSection(t("official_sync_done"), by("synced"), true, selected, onToggle),
      buildSection(t("official_sync_official_only"), by("officialOnly"), true, selected, onToggle, true),
    ].filter((el): el is HTMLElement => !!el),
  );
  document.body.appendChild(modal);
  const releasePreview = attachPreview(modal, rows);

  onToggle();
  modal.querySelector<HTMLInputElement>("#official-sync-auto")?.addEventListener("change", (e) => {
    void setAutoSyncEnabled((e.target as HTMLInputElement).checked);
  });
  modal.querySelector("#official-sync-cancel")?.addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => {
    releasePreview();
    modal.remove();
  });

  runBtn.addEventListener("click", async () => {
    runBtn.disabled = true;
    try {
      const { registered, updated, imported, failed } = await executeOfficialSync(plan, selected);
      if (failed) Toast.error(`${t("error")}: ${failed}`);
      // 登録分は公式の pagehide 書き戻し後に反映されるため、再読み込みで確定させる (取り込み分の一覧更新も兼ねる)
      if (registered || updated || imported) setTimeout(() => location.reload(), failed ? 1500 : 0);
    } catch (err) {
      console.error("🧑‍🎨 : Official sync failed", err);
      Toast.error(String(err));
    }
    modal.close();
  });

  modal.showModal();
};
