/**
 * ギャラリー画像を公式 overlay へ登録する
 *
 * 公式の永続化フォーマットだけに依存する (公式 JS の chunk/内部 API には触らない):
 * - 画像: IndexedDB `wplace-templates` > `images` (key=id, value=File)
 * - メタ: localStorage `template-overlays`
 *
 * 公式 store は pagehide で自分の内容を localStorage へ書き戻すため、
 * メタの追記は「後から登録した」pagehide リスナーで行う (反映はリロード後)。
 */

import type { GalleryItem } from "@/states/galleryStorage";
import { storage } from "@/utils/browser-api";
import { getImageDataUrl } from "@/utils/indexed-db-bridge";
import { saveGalleryItem } from "@/core/bridge/gallery-storage-bridge";
import { getOverlayBounds, sanitizeFilename } from "./common-actions";
import { parseImageMetadataFromFileName, readFileAsDataUrl } from "./routes/image-editor/file-handler";
import { parseWplaceJson, requantizeWplaceDataUrl, type WplaceOverlayFile } from "./routes/image-editor/import-file";

const OVERLAYS_KEY = "template-overlays";
const LINKS_KEY = "mr-wplace-official-links";
const SNAPS_KEY = "mr-wplace-official-snapshots";
const AUTO_SYNC_KEY = "official-auto-sync";
const AUTO_SYNC_MAX_PER_RUN = 20;
const DB_NAME = "wplace-templates";
const IMAGE_STORE = "images";

export type OfficialOverlay = { id: string; order?: number } & Record<string, unknown>;

const pending: OfficialOverlay[] = [];
const patches = new Map<string, Record<string, unknown>>();
let listening = false;

const readJson = <T>(key: string, fallback: T): T | null => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(fallback));
  } catch {
    return null;
  }
};

const readOverlays = (): OfficialOverlay[] | null => {
  const list = readJson<OfficialOverlay[]>(OVERLAYS_KEY, []);
  return Array.isArray(list) ? list : null;
};

const readLinks = (): Record<string, string> => readJson(LINKS_KEY, {}) ?? {};

// 公式の書き戻し後に、未反映の登録分/更新分を反映する (id で重複排除)
const flushPending = () => {
  const list = readOverlays();
  if (!list) return;

  let dirty = false;
  for (const e of list) {
    const patch = patches.get(e?.id);
    if (patch) {
      Object.assign(e, patch);
      dirty = true;
    }
  }
  const ids = new Set(list.map((t) => t?.id));
  const added = pending.filter((e) => !ids.has(e.id));
  if (added.length) {
    list.push(...added);
    dirty = true;
  }
  if (!dirty) return;

  try {
    localStorage.setItem(OVERLAYS_KEY, JSON.stringify(list));
  } catch (err) {
    console.error("🧑‍🎨 : Failed to write official overlays", err);
  }
};

// 即時にも書く (タブが pagehide なしで終了しても取りこぼさない)。公式 store が後で書き戻した分は
// pagehide の flush で再度反映する。flush は公式の書き戻しより後に走る必要があるため、最初の登録/更新時に初めて登録する
const ensureFlushListener = () => {
  if (listening) return;
  listening = true;
  window.addEventListener("pagehide", flushPending);
};

/** 更新分を反映キューに積む (同セッションで登録済みでまだ未反映なら pending 側へ直接反映) */
const queuePatch = (id: string, patch: Record<string, unknown>) => {
  const target = pending.find((e) => e.id === id);
  if (target) Object.assign(target, patch);
  else patches.set(id, { ...patches.get(id), ...patch });
  ensureFlushListener();
  flushPending();
};

// 公式 DB が未作成なら新規作成せず失敗させる (空 DB を作ると公式の初期化を壊すため)
const openOfficialDb = async (): Promise<IDBDatabase> => {
  const dbs = await indexedDB.databases();
  if (!dbs.some((d) => d.name === DB_NAME))
    throw new Error("Official overlay storage not found");

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if (!db.objectStoreNames.contains(IMAGE_STORE)) {
    db.close();
    throw new Error("Official overlay image store not found");
  }
  return db;
};

const withImageStore = async <T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await openOfficialDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, mode);
      const req = run(tx.objectStore(IMAGE_STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

const writeMerged = (key: string, add: Record<string, unknown>) => {
  try {
    localStorage.setItem(key, JSON.stringify({ ...readJson(key, {}), ...add }));
  } catch {}
};

const saveLinks = (add: Record<string, string>) => writeMerged(LINKS_KEY, add);

/** 最後に公式へ反映した時点のギャラリー項目の内容 (変更検知の基準) */
type Snap = { t: number; title: string; pos: number[]; w: number; h: number; m: string; d: boolean };
type SnapSource = Pick<
  GalleryItem,
  "timestamp" | "title" | "drawPosition" | "width" | "height" | "colorMetric" | "dithering"
>;

const toSnap = (i: SnapSource): Snap => {
  const p = i.drawPosition;
  return {
    t: i.timestamp,
    title: i.title ?? "",
    pos: p ? [p.TLX, p.TLY, p.PxX, p.PxY] : [],
    w: i.width ?? 0,
    h: i.height ?? 0,
    m: i.colorMetric ?? "lab",
    d: i.dithering ?? false,
  };
};

const readSnaps = (): Record<string, Snap> => readJson(SNAPS_KEY, {}) ?? {};
const saveSnap = (item: SnapSource & { key: string }) =>
  writeMerged(SNAPS_KEY, { [item.key]: toSnap(item) });

export type ItemChanges = { image: boolean; place: boolean; title: boolean; params: boolean };

const diffSnap = (a: Snap, b: Snap): ItemChanges | null => {
  const size = a.w !== b.w || a.h !== b.h;
  const changes = {
    image: a.t !== b.t || size,
    place: size || a.pos.join() !== b.pos.join(),
    title: a.title !== b.title,
    params: a.m !== b.m || a.d !== b.d,
  };
  return Object.values(changes).some(Boolean) ? changes : null;
};

/**
 * 公式 overlay (非表示) として登録する。
 * 削除済み id は公式の tombstone に残るため、常に新しい UUID を使う。
 */
const registerItem = async (item: GalleryItem): Promise<void> => {
  const list = readOverlays();
  if (!list) throw new Error("Official overlay data is unreadable");

  const bounds = getOverlayBounds(item);
  const dataUrl = await getImageDataUrl(item, {
    showToastOnError: true,
    logContext: "official overlay",
  });
  if (!dataUrl) throw new Error("Failed to load image data");

  const id = crypto.randomUUID();
  const name = `${sanitizeFilename(item.title || "image")}.png`;
  const blob = await (await fetch(dataUrl)).blob();

  // 画像 → メタの順 (逆だと画像のない overlay が残る)
  const file = new File([blob], name, { type: blob.type || "image/png" });
  await withImageStore("readwrite", (store) => store.put(file, id));

  const order = Math.max(-1, ...[...list, ...pending].map((t) => t?.order ?? 0)) + 1;
  pending.push({
    id,
    name,
    bounds,
    originalWidth: item.width,
    originalHeight: item.height,
    opacity: 1,
    visible: false, // 我々の overlay と二重描画しない
    locked: false,
    hasPlaced: true,
    colorMetric: item.colorMetric ?? "lab",
    dithering: item.dithering ?? false,
    useLegacyColors: false,
    order,
    updatedAt: Date.now(),
  });

  saveLinks({ [item.key]: id });
  saveSnap(item);
  ensureFlushListener();
  flushPending();
};

export type SyncRow = {
  state: "new" | "changed" | "synced" | "removed" | "officialOnly";
  item?: GalleryItem;
  /** 紐づく/同一配置の公式 overlay (officialOnly では取り込み対象) */
  official?: OfficialOverlay;
  /** changed のとき、ギャラリー側で変わった内容 */
  changes?: ItemChanges;
};

export type OfficialSyncPlan = {
  /** 表示用の一覧 (警告→登録予定→同期済み→公式のみ) */
  rows: SyncRow[];
  /** 同一配置の公式 overlay が既にある (リンクだけ記録する) */
  adopt: Record<string, string>;
};

const NEAR = 1e-6; // 1px ≒ 1.7e-4° なので別配置とは混ざらない

const isSamePlacement = (
  item: GalleryItem,
  want: ReturnType<typeof getOverlayBounds>,
  t: OfficialOverlay,
): boolean => {
  const b = t.bounds as Record<string, number> | undefined;
  if (!b || t.originalWidth !== item.width || t.originalHeight !== item.height) return false;
  return (["north", "south", "west", "east"] as const).every(
    (k) => Math.abs((b[k] ?? NaN) - want[k]) < NEAR,
  );
};

/**
 * 同期の計画を立てる (何も書き込まない)。
 * 既存の公式 overlay / ギャラリーは変更も削除もしない。
 */
export const planOfficialSync = (items: GalleryItem[]): OfficialSyncPlan => {
  const list = readOverlays();
  if (!list) throw new Error("Official overlay data is unreadable");

  const official = [...list, ...pending];
  const byId = new Map(official.map((t) => [t?.id, t]));
  const links = readLinks();
  const snaps = readSnaps();
  const baseline: Record<string, Snap> = {};
  const plan: OfficialSyncPlan = { rows: [], adopt: {} };
  const matched = new Set<string>();

  for (const item of items) {
    if (!item.drawPosition || !item.width || !item.height) continue;

    const linked = links[item.key];
    if (linked) {
      const o = byId.get(linked);
      if (o) {
        matched.add(linked);
        const prev = snaps[item.key];
        if (!prev) baseline[item.key] = toSnap(item);
        const changes = prev && diffSnap(prev, toSnap(item));
        plan.rows.push(
          changes
            ? { state: "changed", item, official: o, changes }
            : { state: "synced", item, official: o },
        );
      } else {
        plan.rows.push({ state: "removed", item });
      }
      continue;
    }

    const want = getOverlayBounds(item);
    const same = official.find((t) => isSamePlacement(item, want, t));
    if (same) {
      matched.add(same.id);
      plan.adopt[item.key] = same.id;
      plan.rows.push({ state: "synced", item, official: same });
      continue;
    }
    plan.rows.push({ state: "new", item });
  }

  for (const o of official)
    if (o?.id && !matched.has(o.id))
      plan.rows.push({ state: "officialOnly", official: o });

  // 基準が未記録の登録済み項目は、現状を基準として記録する (以降の変更を検知するため)
  if (Object.keys(baseline).length) writeMerged(SNAPS_KEY, baseline);

  const order = { removed: 0, new: 1, changed: 2, synced: 3, officialOnly: 4 };
  plan.rows.sort((a, b) => order[a.state] - order[b.state]);
  return plan;
};

/** 公式に対応する overlay が残っているか (削除ダイアログの案内用) */
export const isInOfficialOverlay = (key: string): boolean => {
  const id = readLinks()[key];
  return !!id && [...(readOverlays() ?? []), ...pending].some((o) => o?.id === id);
};

/** 公式 overlay の画像を表示用 object URL にする (呼び出し側で revoke する) */
export const getOfficialImageUrl = async (id: string): Promise<string | null> => {
  const file = await withImageStore<File | undefined>("readonly", (store) => store.get(id));
  return file ? URL.createObjectURL(file) : null;
};

/**
 * 公式 overlay をギャラリーへ取り込む。`.wplace` の直接取り込みと同じ変換
 * (bounds→座標、リサイズ、量子化) を通す。公式側は変更しない。
 * 二重描画を避けるため、取り込み直後の描画は OFF にする。
 */
const importOfficialOverlay = async (o: OfficialOverlay): Promise<void> => {
  const file = await withImageStore<File | undefined>("readonly", (store) => store.get(o.id));
  if (!file) throw new Error("Official overlay image not found");

  const imported = await parseWplaceJson({
    id: o.id,
    schemaVersion: "1",
    name: typeof o.name === "string" ? o.name : undefined,
    image: {
      dataUrl: await readFileAsDataUrl(file),
      width: Number(o.originalWidth),
      height: Number(o.originalHeight),
    },
    bounds: o.bounds as WplaceOverlayFile["bounds"],
    colorMetric: typeof o.colorMetric === "string" ? o.colorMetric : undefined,
    dithering: typeof o.dithering === "boolean" ? o.dithering : undefined,
  });
  const dataUrl = await requantizeWplaceDataUrl(
    imported.dataUrl,
    imported.colorMetric,
    imported.dithering,
  );

  const key = `gallery_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const meta = await saveGalleryItem(key, dataUrl, {
    title: parseImageMetadataFromFileName(imported.fileName ?? "").title ?? imported.fileName?.replace(/\.[^.]+$/, ""),
    coords: imported.drawPosition ?? undefined,
    visible: false,
    zIndex: 0,
    timestamp: Date.now(),
    colorMetric: imported.colorMetric,
    dithering: imported.dithering || undefined,
  });
  saveLinks({ [key]: o.id });
  saveSnap({ key, ...meta, drawPosition: meta.coords });
};

/**
 * ギャラリーで変わった内容だけを登録済みの公式 overlay に反映する。
 * 公式側で個別に編集された項目 (位置・名前など) は、ギャラリーで変えていない限り触らない。
 */
const updateItem = async (item: GalleryItem, official: OfficialOverlay, changes: ItemChanges) => {
  const patch: Record<string, unknown> = { updatedAt: Date.now() };
  if (changes.place) {
    patch.bounds = getOverlayBounds(item);
    patch.originalWidth = item.width;
    patch.originalHeight = item.height;
  }
  if (changes.title) patch.name = `${sanitizeFilename(item.title || "image")}.png`;
  if (changes.params) {
    patch.colorMetric = item.colorMetric ?? "lab";
    patch.dithering = item.dithering ?? false;
  }

  if (changes.image) {
    const dataUrl = await getImageDataUrl(item, { showToastOnError: true, logContext: "official overlay" });
    if (!dataUrl) throw new Error("Failed to load image data");
    const blob = await (await fetch(dataUrl)).blob();
    const name = String(patch.name ?? official.name ?? "image.png");
    const file = new File([blob], name, { type: blob.type || "image/png" });
    await withImageStore("readwrite", (store) => store.put(file, official.id));
  }

  // 画像 → メタの順 (登録と同じ)
  queuePatch(official.id, patch);
  saveSnap(item);
};

/**
 * 計画を実行する。個別の失敗は残りを止めない。
 * importIds: ギャラリーへ取り込む公式 overlay の id (officialOnly の行から選択)
 */
export const executeOfficialSync = async (
  plan: OfficialSyncPlan,
  importIds: ReadonlySet<string> = new Set(),
): Promise<{ registered: number; updated: number; imported: number; failed: number }> => {
  saveLinks(plan.adopt);
  for (const { item } of plan.rows) if (item && plan.adopt[item.key]) saveSnap(item);

  let registered = 0;
  let updated = 0;
  let imported = 0;
  let failed = 0;
  for (const row of plan.rows) {
    try {
      if (row.state === "new" && row.item) {
        await registerItem(row.item);
        registered++;
      } else if (row.state === "changed" && row.item && row.official && row.changes) {
        await updateItem(row.item, row.official, row.changes);
        updated++;
      } else if (row.state === "officialOnly" && row.official && importIds.has(row.official.id)) {
        await importOfficialOverlay(row.official);
        imported++;
      }
    } catch (err) {
      failed++;
      console.error("🧑‍🎨 : Official sync item failed", row.item?.key ?? row.official?.id, err);
    }
  }
  return { registered, updated, imported, failed };
};

/**
 * 同期で実行すべき件数 (登録予定 + 更新予定)。一覧を開くたびの表示判定用。
 * 読み込み済みの items と localStorage だけで完結し、追加の通信や画像読み込みはしない。
 */
export const countOfficialSyncPending = (items: GalleryItem[]): number => {
  try {
    return planOfficialSync(items).rows.filter((r) => r.state === "new" || r.state === "changed").length;
  } catch {
    return 0;
  }
};

export const isAutoSyncEnabled = async (): Promise<boolean> =>
  (await storage.get(AUTO_SYNC_KEY))[AUTO_SYNC_KEY] === true;

export const setAutoSyncEnabled = (enabled: boolean): Promise<void> =>
  storage.set({ [AUTO_SYNC_KEY]: enabled });

let autoRunning = false;

/**
 * 自動同期: 有効なら登録予定/更新予定だけを反映する (取り込み・削除はしない)。
 * 一覧を開いたときに呼ぶ。再読み込みはせず、反映は次の読み込み時になる。
 * 一度に大量に流さないよう件数を絞り、残りは次回に回す。
 */
export const autoSyncOfficial = async (items: GalleryItem[]): Promise<void> => {
  if (autoRunning || !(await isAutoSyncEnabled())) return;
  autoRunning = true;
  try {
    const plan = planOfficialSync(items);
    const rows = plan.rows
      .filter((r) => r.state === "new" || r.state === "changed")
      .slice(0, AUTO_SYNC_MAX_PER_RUN);
    if (rows.length) await executeOfficialSync({ rows, adopt: plan.adopt });
  } catch (err) {
    console.error("🧑‍🎨 : Auto sync to official overlays failed", err);
  } finally {
    autoRunning = false;
  }
};
