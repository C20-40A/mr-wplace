import { t } from "@/i18n/manager";
import { findOfficialFavoriteDialog } from "@/constants/selectors";
import { IMG_ICON_BOOKMARK } from "@/assets/iconImages";
import { gotoPosition } from "@/utils/position";
import { getMapThumbnail } from "@/utils/inject-bridge";
import { BookmarkStorage } from "./storage";
import { getAllFavThumbnails, saveFavThumbnail } from "./fav-metadata-db";
import type { Bookmark, FavoriteLocation } from "./types";

/**
 * 公式 Favorite places dialog への統合
 * - 公式行: 📷ボタン追加 + 撮影済みサムネを星アイコン位置に表示 (公式DOMは class/構造を変えず CSS変数のみ)
 * - 末尾: 旧 Mr.Wplace ブックマークを折りたたみセクションで表示 (公式フィルタ入力にも追従)
 */

const STYLE_ID = "mr-wplace-fav-dialog-style";
const SECTION_ID = "mr-wplace-legacy-bookmarks";
const CAPTURE_CLASS = "mrw-fav-capture";
const THUMB_VAR = "--mrw-fav-thumb";

const ICON = (path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="width:18px;height:18px;pointer-events:none;"><path d="${path}"/></svg>`;
const CAMERA_ICON = ICON(
  "M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM120-120q-33 0-56.5-23.5T40-200v-480q0-33 23.5-56.5T120-760h126l74-80h320l74 80h126q33 0 56.5 23.5T920-680v480q0 33-23.5 56.5T840-120H120Z",
);
const TRASH_ICON = ICON(
  "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm80-160h80v-360h-80v360Zm160 0h80v-360h-80v360Z",
);
const MANAGE_ICON = ICON(
  "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z",
);

let locationByCoord = new Map<string, FavoriteLocation>();
let thumbnails = new Map<number, string>();
let legacyBookmarks: Bookmark[] = [];
let legacyOpen = false;
let wasDialogOpen = false;
let checkScheduled = false;
let openLegacyModal: () => void = () => {};
const appliedThumbs = new WeakMap<HTMLElement, string>();
const boundInputs = new WeakSet<HTMLInputElement>();

const coordKey = (lat: number, lng: number) =>
  `${lat.toFixed(4)},${lng.toFixed(4)}`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const requestOfficialFavoritesRecovery = (): void => {
  window.postMessage(
    { source: "mr-wplace-request-user-data", reason: "official-favorites" },
    "*",
  );
};

const ensureStyles = (): void => {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .favorite-row[data-mrw-thumb] .favorite-place > span:first-child > span {
      background: var(${THUMB_VAR}) center / cover no-repeat !important;
    }
    .favorite-row[data-mrw-thumb] .favorite-place > span:first-child > span > svg { visibility: hidden; }
    .${CAPTURE_CLASS}:disabled { opacity: 0.4; }
    #${SECTION_ID} > summary { list-style: none; }
    #${SECTION_ID} > summary::-webkit-details-marker { display: none; }
    #${SECTION_ID} .mrw-chevron { transition: transform 0.15s; }
    #${SECTION_ID}[open] .mrw-chevron { transform: rotate(180deg); }
  `;
  document.head.appendChild(style);
};

// ---------- 公式行: サムネ + 📷 ----------

const applyThumb = (row: HTMLElement, url: string | undefined): void => {
  if (appliedThumbs.get(row) === url) return;
  if (url) {
    appliedThumbs.set(row, url);
    row.style.setProperty(THUMB_VAR, `url("${url}")`);
    row.setAttribute("data-mrw-thumb", "");
    return;
  }
  appliedThumbs.delete(row);
  row.style.removeProperty(THUMB_VAR);
  row.removeAttribute("data-mrw-thumb");
};

const captureThumbnail = async (
  row: HTMLElement,
  btn: HTMLButtonElement,
): Promise<void> => {
  const id = Number(row.dataset.mrwFavId);
  if (!id) {
    requestOfficialFavoritesRecovery();
    return;
  }
  btn.disabled = true;
  try {
    const url = await getMapThumbnail();
    if (!url) return;
    await saveFavThumbnail(id, url);
    thumbnails.set(id, url);
    applyThumb(row, url);
  } catch (err) {
    console.error("🧑‍🎨 : Failed to capture fav thumbnail:", err);
  } finally {
    btn.disabled = false;
  }
};

const ensureCaptureButton = (row: HTMLElement): void => {
  const actions = row.querySelector(".favorite-row-actions");
  if (!actions || actions.querySelector(`.${CAPTURE_CLASS}`)) return;

  const btn = document.createElement("button");
  btn.type = "button";
  // 公式アクションボタンの class (svelte scope 含む) を流用して見た目を揃える
  btn.className = `${actions.querySelector("button")?.className ?? "game-button game-button-ghost"} ${CAPTURE_CLASS}`;
  btn.title = t`${"fav_capture_thumbnail"}`;
  btn.setAttribute("aria-label", btn.title);
  btn.innerHTML = CAMERA_ICON;
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    captureThumbnail(row, btn);
  });
  actions.prepend(btn);
};

const decorateOfficialRows = (dialog: HTMLDialogElement): void => {
  dialog.querySelectorAll<HTMLElement>("li.favorite-row").forEach((row) => {
    const [lat, lng] = (
      row.querySelector(".favorite-place .font-mono > span")?.textContent ?? ""
    )
      .split(",")
      .map(Number);
    const loc =
      Number.isFinite(lat) && Number.isFinite(lng)
        ? locationByCoord.get(coordKey(lat, lng))
        : undefined;
    const id = loc ? String(loc.id) : "";
    if (row.dataset.mrwFavId !== id) row.dataset.mrwFavId = id;
    applyThumb(row, loc && thumbnails.get(loc.id));
    ensureCaptureButton(row);
  });
};

// ---------- 旧ブックマーク セクション ----------

const getFilterInput = (dialog: HTMLDialogElement) =>
  dialog.querySelector<HTMLInputElement>('input[type="search"]');

const renderLegacyRow = (b: Bookmark, actionClass: string): string => `
  <li class="flex min-w-0 items-center gap-2 px-4 sm:px-6" style="padding-block:4px" data-id="${b.id}" data-search="${escapeHtml(b.name.toLowerCase())}">
    <button type="button" class="mrw-legacy-go hover:bg-base-200 flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left" style="padding:6px 8px">
      <span class="shrink-0" style="width:10px;height:10px;border-radius:9999px;background:${b.tag ? escapeHtml(b.tag.color) : "transparent"};"></span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-bold">${escapeHtml(b.name)}</span>
        <span class="text-base-content/60 block truncate font-mono text-xs">${b.lat.toFixed(4)}, ${b.lng.toFixed(4)} · z${b.zoom}</span>
      </span>
    </button>
    <button type="button" class="${actionClass} mrw-legacy-delete" aria-label="${t`${"delete"}`}" title="${t`${"delete"}`}">${TRASH_ICON}</button>
  </li>`;

const sortByRecent = (list: Bookmark[]): Bookmark[] =>
  [...list].sort(
    (a, b) =>
      (b.lastAccessedDate ?? "").localeCompare(a.lastAccessedDate ?? "") ||
      b.id - a.id,
  );

const applyLegacyFilter = (dialog: HTMLDialogElement): void => {
  const section = document.getElementById(SECTION_ID) as HTMLDetailsElement | null;
  if (!section) return;
  const q = getFilterInput(dialog)?.value.trim().toLowerCase() ?? "";
  let visible = 0;
  section.querySelectorAll<HTMLElement>("li[data-id]").forEach((li) => {
    li.hidden = !!q && !li.dataset.search!.includes(q);
    if (!li.hidden) visible++;
  });
  section.hidden = !!q && visible === 0;
  if (q && visible > 0) section.open = true;
};

const handleLegacyClick = async (
  e: MouseEvent,
  dialog: HTMLDialogElement,
): Promise<void> => {
  const target = e.target as HTMLElement;

  if (target.closest(".mrw-legacy-manage")) {
    e.preventDefault(); // summary の開閉を抑止
    dialog.close();
    openLegacyModal();
    return;
  }

  const id = Number(target.closest<HTMLElement>("li[data-id]")?.dataset.id);
  const bookmark = legacyBookmarks.find((b) => b.id === id);
  if (!bookmark) return;

  if (target.closest(".mrw-legacy-delete")) {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await BookmarkStorage.removeBookmark(id);
    legacyBookmarks = legacyBookmarks.filter((b) => b.id !== id);
    document.getElementById(SECTION_ID)?.remove();
    scheduleCheck();
    return;
  }

  if (target.closest(".mrw-legacy-go")) {
    bookmark.lastAccessedDate = new Date().toISOString();
    BookmarkStorage.updateBookmark(bookmark);
    dialog.close();
    await gotoPosition(bookmark);
  }
};

const ensureLegacySection = (dialog: HTMLDialogElement): void => {
  const body = dialog.querySelector(".modal-box .overflow-y-auto");
  const existing = document.getElementById(SECTION_ID);
  if (!body || !legacyBookmarks.length) {
    existing?.remove();
    return;
  }
  if (existing?.parentElement === body) return;
  existing?.remove();

  const actionClass =
    dialog.querySelector(".favorite-row-actions button:not(.mrw-fav-capture)")
      ?.className ?? "game-button game-button-ghost";

  const section = document.createElement("details");
  section.id = SECTION_ID;
  section.className = "min-w-0 border-base-content/10 border-t";
  section.open = legacyOpen;
  section.innerHTML = `
    <summary class="hover:bg-base-200 flex min-w-0 cursor-pointer items-center gap-2 px-4 sm:px-6" style="padding-block:8px">
      <img src="${IMG_ICON_BOOKMARK}" alt="" style="width:18px;height:18px;image-rendering:pixelated;" />
      <h4 class="min-w-0 truncate text-sm font-semibold">${t`${"bookmark"}`} <span class="text-base-content/50">(Mr. Wplace)</span></h4>
      <span class="text-base-content/50 font-mono text-xs">${legacyBookmarks.length}</span>
      <span class="flex-1"></span>
      <button type="button" class="${actionClass} mrw-legacy-manage" title="${t`${"bookmark_list"}`}" aria-label="${t`${"bookmark_list"}`}">${MANAGE_ICON}</button>
      <svg class="mrw-chevron shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:18px;height:18px;"><path d="M4 7h2v2h2v2h2v2h4v-2h2V9h2V7h2v4h-2v2h-2v2h-2v2h-4v-2H8v-2H6v-2H4V7Z"/></svg>
    </summary>
    <ul class="divide-base-content/5 divide-y">${sortByRecent(legacyBookmarks)
      .map((b) => renderLegacyRow(b, actionClass))
      .join("")}</ul>`;
  section.addEventListener("toggle", () => (legacyOpen = section.open));
  section.addEventListener("click", (e) => handleLegacyClick(e, dialog));
  body.appendChild(section);
  applyLegacyFilter(dialog);
};

const bindFilterInput = (dialog: HTMLDialogElement): void => {
  const input = getFilterInput(dialog);
  if (!input || boundInputs.has(input)) return;
  boundInputs.add(input);
  input.addEventListener("input", () => applyLegacyFilter(dialog));
};

// ---------- lifecycle ----------

const onDialogOpened = async (): Promise<void> => {
  requestOfficialFavoritesRecovery();
  [thumbnails, legacyBookmarks] = await Promise.all([
    getAllFavThumbnails().catch(() => new Map<number, string>()),
    BookmarkStorage.getBookmarks(),
  ]);
  document.getElementById(SECTION_ID)?.remove();
  scheduleCheck();
};

const check = (): void => {
  const dialog = findOfficialFavoriteDialog();
  if (!dialog) {
    wasDialogOpen = false;
    return;
  }
  if (!wasDialogOpen) {
    wasDialogOpen = true;
    onDialogOpened();
  }
  ensureStyles();
  decorateOfficialRows(dialog);
  ensureLegacySection(dialog);
  bindFilterInput(dialog);
};

const scheduleCheck = (): void => {
  if (checkScheduled) return;
  checkScheduled = true;
  requestAnimationFrame(() => {
    checkScheduled = false;
    check();
  });
};

export const setOfficialFavoriteLocations = (
  locations: FavoriteLocation[],
): void => {
  locationByCoord = new Map(
    locations.map((loc) => [coordKey(loc.latitude, loc.longitude), loc]),
  );
  scheduleCheck();
};

export const initOfficialFavoriteDialog = (options: {
  openLegacyModal: () => void;
}): void => {
  openLegacyModal = options.openLegacyModal;
  new MutationObserver(scheduleCheck).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });
  scheduleCheck();
};
