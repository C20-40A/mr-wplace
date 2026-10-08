import { t } from "@/i18n/manager";
import { storage } from "@/utils/browser-api";
import { findOfficialFavoriteDialog } from "@/constants/selectors";
import { IMG_ICON_BOOKMARK } from "@/assets/iconImages";
import { gotoPosition } from "@/utils/position";
import { createOfficialFavorite, getMapThumbnail } from "@/utils/inject-bridge";
import { renderCoordinateJumper } from "./routes/coordinate-jumper";
import { BookmarkStorage } from "./storage";
import { getAllFavThumbnails, saveFavThumbnail } from "./fav-metadata-db";
import type { Bookmark, FavoriteLocation } from "./types";
import { ensureStyle } from "@/utils/style";

/**
 * 公式 Favorite places dialog への統合
 * - 公式行: 📷ボタン追加 + 撮影済みサムネ表示 (公式DOMは class/構造を変えず data属性/CSS変数のみ)
 *   desktop: 星アイコン位置にサムネ / mobile: 行の背景にサムネ (2行折返し防止)
 * - 下部タブ: 公式 ⇔ 旧 Mr.Wplace ブックマーク を切替 (公式フィルタ入力にも追従)
 */

type Tab = "official-fav" | "bookmark";

const TAB_KEY = "wplace-studio-bookmark-tab";
/** 旧modal と共用 ("created" 以外は最近使った順として扱う) */
const SORT_KEY = "wplace-studio-bookmark-sort";
const STYLE_ID = "mr-wplace-fav-dialog-style";
const TABBAR_ID = "mr-wplace-fav-tabs";
const PANEL_ID = "mr-wplace-legacy-bookmarks";
const CAPTURE_CLASS = "mrw-fav-capture";
const THUMB_VAR = "--mrw-fav-thumb";
const DEFAULT_ZOOM = 15;

const ICON = (path: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="width:18px;height:18px;flex-shrink:0;pointer-events:none;"><path d="${path}"/></svg>`;
const CAMERA_ICON = ICON(
  "M480-260q75 0 127.5-52.5T660-440q0-75-52.5-127.5T480-620q-75 0-127.5 52.5T300-440q0 75 52.5 127.5T480-260Zm0-80q-42 0-71-29t-29-71q0-42 29-71t71-29q42 0 71 29t29 71q0 42-29 71t-71 29ZM120-120q-33 0-56.5-23.5T40-200v-480q0-33 23.5-56.5T120-760h126l74-80h320l74 80h126q33 0 56.5 23.5T920-680v480q0 33-23.5 56.5T840-120H120Z",
);
const TRASH_ICON = ICON(
  "M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm80-160h80v-360h-80v360Zm160 0h80v-360h-80v360Z",
);
const MANAGE_ICON = ICON(
  "M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z",
);
const SORT_ICON = ICON(
  "M320-440v-287L217-624l-57-56 200-200 200 200-57 56-103-103v287h-80ZM600-80 400-280l57-56 103 103v-287h80v287l103-103 57 56L600-80Z",
);
const JUMP_ICON = ICON(
  "M516-120 402-402 120-516v-56l720-268-268 720h-56Zm26-148 162-436-436 162 196 78 78 196Zm-78-196Z",
);
const IMPORT_EXPORT_ICON = ICON(
  "M280-160 80-360l200-200 56 57-103 103h287v80H233l103 103-56 57Zm400-240-56-57 103-103H440v-80h287L624-743l56-57 200 200-200 200Z",
);
const MIGRATE_ICON = ICON(
  "M440-320v-326L336-542l-56-58 200-200 200 200-56 58-104-104v326h-80ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z",
);
const STAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style="width:16px;height:16px;flex-shrink:0;"><path d="M13 3h2v4h8v4h-2v2h-2v3h2v6h-5v-2h-2v-2h-4v2H8v2H3v-6h2v-3H3v-2H1V7h8V3h2V1h2v2Z"/></svg>`;
const BOOKMARK_IMG = `<img src="${IMG_ICON_BOOKMARK}" alt="" style="width:18px;height:18px;flex-shrink:0;image-rendering:pixelated;" />`;

let locationByCoord = new Map<string, FavoriteLocation>();
let thumbnails = new Map<number, string>();
let legacyBookmarks: Bookmark[] = [];
let activeTab: Tab = "official-fav";
let wasDialogOpen = false;
let checkScheduled = false;
let sortByCreated = false;
let openLegacyModal: () => void = () => {};
let openImportExport: (onImported: () => void) => void = () => {};
const appliedThumbs = new WeakMap<HTMLElement, string>();
const boundInputs = new WeakSet<HTMLInputElement>();

const coordKey = (lat: number, lng: number) =>
  `${lat.toFixed(4)},${lng.toFixed(4)}`;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const requestOfficialFavoritesRecovery = (): void => {
  window.postMessage(
    { source: "mr-wplace-request-user-data", reason: "official-favorites" },
    "*",
  );
};

const ensureStyles = (): void => {
  const fade = (pct: number) =>
    `color-mix(in oklab, var(--color-base-100) ${pct}%, transparent)`;
  ensureStyle(STYLE_ID, `
    /* 公式 icon はユーザー変更可能なので残し、サムネは行の背景に敷く (mobile/desktop 共通) */
    .favorite-row[data-mrw-thumb] {
      background-image: linear-gradient(90deg, ${fade(92)}, ${fade(78)} 60%, ${fade(66)}), var(${THUMB_VAR});
      background-size: cover;
      background-position: center;
    }
    @media (max-width: 639px) {
      .favorite-row:not([data-mrw-thumb]) .favorite-place > span:first-child > span { width: 2.25rem; height: 2.25rem; padding: 0.375rem; }
    }
    .${CAPTURE_CLASS}:disabled { opacity: 0.4; cursor: progress; }

    .modal-box:not([data-mrw-tab="bookmark"]) #${PANEL_ID} { display: none; }
    .modal-box[data-mrw-tab="bookmark"] > .overflow-y-auto > :not(#${PANEL_ID}):not(:has(input[type="search"])) { display: none !important; }

    #${TABBAR_ID} {
      display: flex; gap: 4px; flex-shrink: 0; padding: 6px 12px;
      border-top: 1px solid color-mix(in oklab, var(--color-base-content) 10%, transparent);
    }
    #${TABBAR_ID} button {
      flex: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 36px; padding: 0 10px; border-radius: 9999px; font-size: 13px; font-weight: 600;
      color: color-mix(in oklab, var(--color-base-content) 60%, transparent);
      background: transparent; cursor: pointer; white-space: nowrap;
    }
    #${TABBAR_ID} button:hover { background: color-mix(in oklab, var(--color-base-200) 60%, transparent); }
    #${TABBAR_ID} button[aria-pressed="true"] { color: var(--color-base-content); background: var(--color-base-200); }
    #${TABBAR_ID} button > span { overflow: hidden; text-overflow: ellipsis; }
  `);
};

// ---------- 公式行: サムネ + 📷 ----------

type Place = { lat: number; lng: number; zoom: number };

/** 行表示 "35.4553, 139.9358" + "z15.0" から地点を取得 */
const parseRowPlace = (row: HTMLElement): Place | null => {
  const mono = row.querySelector(".favorite-place .font-mono");
  const [lat, lng] = (mono?.firstElementChild?.textContent ?? "")
    .split(",")
    .map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const zoom = Number(mono?.textContent?.match(/z(\d+(?:\.\d+)?)/)?.[1]);
  return { lat, lng, zoom: Number.isFinite(zoom) ? zoom : DEFAULT_ZOOM };
};

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
  const place = parseRowPlace(row);
  if (!id || !place) {
    requestOfficialFavoritesRecovery();
    return;
  }
  btn.disabled = true;
  try {
    // 現在の表示から離れていれば inject 側で jump → idle 待ちしてから撮影
    const url = await getMapThumbnail(place);
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
    const place = parseRowPlace(row);
    const loc = place && locationByCoord.get(coordKey(place.lat, place.lng));
    const id = loc ? String(loc.id) : "";
    if (row.dataset.mrwFavId !== id) row.dataset.mrwFavId = id;
    applyThumb(row, loc ? thumbnails.get(loc.id) : undefined);
    ensureCaptureButton(row);
  });
};

// ---------- 下部タブ ----------

const setActiveTab = (tab: Tab): void => {
  activeTab = tab;
  storage.set({ [TAB_KEY]: tab });
  scheduleCheck();
};

const ensureTabBar = (box: HTMLElement): void => {
  if (box.dataset.mrwTab !== activeTab) box.dataset.mrwTab = activeTab;

  let bar = document.getElementById(TABBAR_ID);
  if (bar?.parentElement !== box) {
    bar?.remove();
    bar = document.createElement("div");
    bar.id = TABBAR_ID;
    bar.innerHTML = `
      <button type="button" data-tab="official-fav">${STAR_ICON}<span>${t`${"official_favorites"}`}</span></button>
      <button type="button" data-tab="bookmark">${BOOKMARK_IMG}<span>${t`${"bookmark"}`}</span><span class="mrw-count font-mono" style="opacity:0.6;font-size:12px;"></span></button>`;
    bar.addEventListener("click", (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]")
        ?.dataset.tab as Tab | undefined;
      if (tab && tab !== activeTab) setActiveTab(tab);
    });
    box.appendChild(bar);
  }

  bar.querySelectorAll<HTMLElement>("[data-tab]").forEach((btn) => {
    const pressed = String(btn.dataset.tab === activeTab);
    if (btn.getAttribute("aria-pressed") !== pressed)
      btn.setAttribute("aria-pressed", pressed);
  });
  const count = bar.querySelector(".mrw-count")!;
  const countText = String(legacyBookmarks.length);
  if (count.textContent !== countText) count.textContent = countText;
};

// ---------- 旧ブックマーク パネル ----------

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
    <button type="button" class="${actionClass} mrw-legacy-migrate" aria-label="${t`${"bookmark_migrate_official"}`}" title="${t`${"bookmark_migrate_official"}`}">${MIGRATE_ICON}</button>
    <button type="button" class="${actionClass} mrw-legacy-delete" aria-label="${t`${"delete"}`}" title="${t`${"delete"}`}">${TRASH_ICON}</button>
  </li>`;

const sortLegacy = (list: Bookmark[]): Bookmark[] =>
  [...list].sort(
    (a, b) =>
      (sortByCreated
        ? 0
        : (b.lastAccessedDate ?? "").localeCompare(a.lastAccessedDate ?? "")) ||
      b.id - a.id,
  );

/** 旧ブックマークを読み直してパネルを作り直す */
const reloadLegacy = async (): Promise<void> => {
  legacyBookmarks = await BookmarkStorage.getBookmarks();
  document.getElementById(PANEL_ID)?.remove();
  scheduleCheck();
};

const applyLegacyFilter = (dialog: HTMLDialogElement): void => {
  const panel = document.getElementById(PANEL_ID);
  if (!panel) return;
  const q = getFilterInput(dialog)?.value.trim().toLowerCase() ?? "";
  panel.querySelectorAll<HTMLElement>("li[data-id]").forEach((li) => {
    li.hidden = !!q && !li.dataset.search!.includes(q);
  });
};

const handleLegacyClick = async (
  e: MouseEvent,
  dialog: HTMLDialogElement,
): Promise<void> => {
  const target = e.target as HTMLElement;

  if (target.closest(".mrw-legacy-manage")) {
    dialog.close();
    openLegacyModal();
    return;
  }

  if (target.closest(".mrw-legacy-sort")) {
    sortByCreated = !sortByCreated;
    storage.set({ [SORT_KEY]: sortByCreated ? "created" : "accessed" });
    document.getElementById(PANEL_ID)?.remove();
    scheduleCheck();
    return;
  }

  if (target.closest(".mrw-legacy-import-export")) {
    openImportExport(() => void reloadLegacy());
    return;
  }

  if (target.closest(".mrw-legacy-jump-toggle")) {
    const area = document.querySelector<HTMLElement>(`#${PANEL_ID} .mrw-legacy-jump`);
    if (!area) return;
    if (!area.hasChildNodes()) renderCoordinateJumper(area);
    area.hidden = !area.hidden;
    return;
  }

  // 座標ジャンプ実行後は地図を見せるため dialog を閉じる
  if (target.closest("#wps-jump-btn")) {
    dialog.close();
    return;
  }

  const id = Number(target.closest<HTMLElement>("li[data-id]")?.dataset.id);
  const bookmark = legacyBookmarks.find((b) => b.id === id);
  if (!bookmark) return;

  if (target.closest(".mrw-legacy-migrate")) {
    const btn = target.closest<HTMLButtonElement>(".mrw-legacy-migrate")!;
    btn.disabled = true;
    const result = await createOfficialFavorite({
      lat: bookmark.lat,
      lng: bookmark.lng,
      zoom: bookmark.zoom,
      name: bookmark.name,
    });
    if (!result.ok) {
      btn.disabled = false;
      alert(t`${"bookmark_migrate_failed"}`);
      return;
    }
    // 公式一覧/拡張側 favorites は inject 側の /me 再取得で同期済み
    await BookmarkStorage.removeBookmark(id);
    await reloadLegacy();
    return;
  }

  if (target.closest(".mrw-legacy-delete")) {
    if (!confirm(t`${"delete_confirm"}`)) return;
    await BookmarkStorage.removeBookmark(id);
    legacyBookmarks = legacyBookmarks.filter((b) => b.id !== id);
    document.getElementById(PANEL_ID)?.remove();
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

const ensureLegacyPanel = (dialog: HTMLDialogElement, body: Element): void => {
  const existing = document.getElementById(PANEL_ID);
  if (existing?.parentElement === body) return;
  existing?.remove();

  const actionClass =
    dialog.querySelector(`.favorite-row-actions button:not(.${CAPTURE_CLASS})`)
      ?.className ?? "game-button game-button-ghost";

  const sortLabel = sortByCreated ? t`${"sort_created"}` : t`${"sort_accessed"}`;
  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.className = "min-w-0";
  panel.innerHTML = `
    <div class="border-base-content/5 flex min-w-0 items-center gap-2 border-b px-4 sm:px-6" style="padding-block:6px">
      ${BOOKMARK_IMG}
      <h4 class="min-w-0 truncate text-sm font-semibold">${t`${"bookmark"}`} <span class="text-base-content/50">(Mr. Wplace)</span></h4>
      <span class="text-base-content/50 font-mono text-xs">${legacyBookmarks.length}</span>
      <span class="flex-1"></span>
      <button type="button" class="${actionClass} mrw-legacy-sort" title="${sortLabel}" aria-label="${sortLabel}">${SORT_ICON}</button>
      <button type="button" class="${actionClass} mrw-legacy-jump-toggle" title="${t`${"jump_to_coordinates"}`}" aria-label="${t`${"jump_to_coordinates"}`}">${JUMP_ICON}</button>
      <button type="button" class="${actionClass} mrw-legacy-import-export" title="${t`${"import_export"}`}" aria-label="${t`${"import_export"}`}">${IMPORT_EXPORT_ICON}</button>
      <button type="button" class="${actionClass} mrw-legacy-manage" title="${t`${"bookmark_list"}`}" aria-label="${t`${"bookmark_list"}`}">${MANAGE_ICON}</button>
    </div>
    <div class="mrw-legacy-jump border-base-content/5 border-b" hidden></div>
    ${
      legacyBookmarks.length
        ? `<ul class="divide-base-content/5 divide-y">${sortLegacy(legacyBookmarks)
            .map((b) => renderLegacyRow(b, actionClass))
            .join("")}</ul>`
        : `<p class="text-base-content/60 px-4 pt-5 pb-6 text-sm sm:px-6">${t`${"no_bookmarks"}`}</p>`
    }`;
  panel.addEventListener("click", (e) => handleLegacyClick(e, dialog));
  body.appendChild(panel);
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
  document.getElementById(PANEL_ID)?.remove();
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
  const box = dialog.querySelector<HTMLElement>(".modal-box");
  const body = box?.querySelector(":scope > .overflow-y-auto");
  if (!box || !body) return;

  ensureStyles();
  decorateOfficialRows(dialog);
  ensureTabBar(box);
  ensureLegacyPanel(dialog, body);
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

export const initOfficialFavoriteDialog = async (options: {
  openLegacyModal: () => void;
  openImportExport: (onImported: () => void) => void;
}): Promise<void> => {
  ({ openLegacyModal, openImportExport } = options);

  // /me 応答から公式お気に入りの id を取得 (サムネ保存キー)
  window.addEventListener("message", (e) => {
    if (e.data?.source !== "mr-wplace-favorite-locations") return;
    const locations: FavoriteLocation[] = e.data.favoriteLocations || [];
    locationByCoord = new Map(
      locations.map((loc) => [coordKey(loc.latitude, loc.longitude), loc]),
    );
    console.log("🧑‍🎨 : Favorite locations received:", locations.length);
    scheduleCheck();
  });

  new MutationObserver(scheduleCheck).observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["open"],
  });

  const saved = await storage.get([TAB_KEY, SORT_KEY]);
  if (saved[TAB_KEY] === "bookmark") activeTab = "bookmark";
  sortByCreated = saved[SORT_KEY] === "created";
  scheduleCheck();
};
