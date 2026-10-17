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
import { getImageDataUrl } from "@/utils/indexed-db-bridge";
import { saveGalleryItem } from "@/core/bridge/gallery-storage-bridge";
import { getOverlayBounds, sanitizeFilename } from "./common-actions";
import { parseImageMetadataFromFileName, readFileAsDataUrl } from "./routes/image-editor/file-handler";
import { parseWplaceJson, requantizeWplaceDataUrl, type WplaceOverlayFile } from "./routes/image-editor/import-file";

const OVERLAYS_KEY = "template-overlays";
const LINKS_KEY = "mr-wplace-official-links";
const DB_NAME = "wplace-templates";
const IMAGE_STORE = "images";

type OfficialOverlay = { id: string; order?: number } & Record<string, unknown>;

const pending: OfficialOverlay[] = [];
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

// 公式の書き戻し後に、未反映の登録分を追記する (id で重複排除)
const flushPending = () => {
  const list = readOverlays();
  if (!list) return;
  const ids = new Set(list.map((t) => t?.id));
  const added = pending.filter((e) => !ids.has(e.id));
  if (!added.length) return;
  try {
    localStorage.setItem(OVERLAYS_KEY, JSON.stringify([...list, ...added]));
  } catch (err) {
    console.error("🧑‍🎨 : Failed to write official overlays", err);
  }
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

const saveLinks = (add: Record<string, string>) => {
  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify({ ...readLinks(), ...add }));
  } catch {}
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

  if (listening) return;
  listening = true;
  window.addEventListener("pagehide", flushPending);
};

export type SyncRow = {
  state: "new" | "synced" | "removed" | "officialOnly";
  item?: GalleryItem;
  /** 紐づく/同一配置の公式 overlay の名前 */
  officialName?: string;
  /** officialOnly のとき、取り込み対象の公式 overlay id */
  officialId?: string;
};

export type OfficialSyncPlan = {
  /** 表示用の一覧 (警告→登録予定→同期済み→公式のみ) */
  rows: SyncRow[];
  /** 同一配置の公式 overlay が既にある (リンクだけ記録する) */
  adopt: Record<string, string>;
};

const NEAR = 1e-6; // 1px ≒ 1.7e-4° なので別配置とは混ざらない

const isSamePlacement = (item: GalleryItem, t: OfficialOverlay): boolean => {
  const b = t.bounds as Record<string, number> | undefined;
  if (!b || t.originalWidth !== item.width || t.originalHeight !== item.height) return false;
  const want = getOverlayBounds(item);
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
  const plan: OfficialSyncPlan = { rows: [], adopt: {} };
  const matched = new Set<string>();
  const name = (o?: OfficialOverlay) => (typeof o?.name === "string" ? o.name : undefined);

  for (const item of items) {
    if (!item.drawPosition || !item.width || !item.height) continue;

    const linked = links[item.key];
    if (linked) {
      const o = byId.get(linked);
      if (o) {
        matched.add(linked);
        plan.rows.push({ state: "synced", item, officialName: name(o) });
      } else {
        plan.rows.push({ state: "removed", item });
      }
      continue;
    }

    const same = official.find((t) => isSamePlacement(item, t));
    if (same) {
      matched.add(same.id);
      plan.adopt[item.key] = same.id;
      plan.rows.push({ state: "synced", item, officialName: name(same) });
      continue;
    }
    plan.rows.push({ state: "new", item });
  }

  for (const o of official)
    if (o?.id && !matched.has(o.id))
      plan.rows.push({ state: "officialOnly", officialName: name(o), officialId: o.id });

  const order = { removed: 0, new: 1, synced: 2, officialOnly: 3 };
  plan.rows.sort((a, b) => order[a.state] - order[b.state]);
  return plan;
};

/** 公式に対応する overlay が残っているか (削除ダイアログの案内用) */
export const isInOfficialOverlay = (key: string): boolean => {
  const id = readLinks()[key];
  return !!id && [...(readOverlays() ?? []), ...pending].some((o) => o?.id === id);
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
  await saveGalleryItem(key, dataUrl, {
    title: parseImageMetadataFromFileName(imported.fileName ?? "").title ?? imported.fileName?.replace(/\.[^.]+$/, ""),
    coords: imported.drawPosition ?? undefined,
    visible: false,
    zIndex: 0,
    timestamp: Date.now(),
    colorMetric: imported.colorMetric,
    dithering: imported.dithering || undefined,
  });
  saveLinks({ [key]: o.id });
};

/**
 * 計画を実行する。個別の失敗は残りを止めない。
 * importIds: ギャラリーへ取り込む公式 overlay の id (officialOnly の行から選択)
 */
export const executeOfficialSync = async (
  plan: OfficialSyncPlan,
  importIds: ReadonlySet<string> = new Set(),
): Promise<{ registered: number; imported: number; failed: number }> => {
  saveLinks(plan.adopt);

  let registered = 0;
  let imported = 0;
  let failed = 0;
  for (const row of plan.rows) {
    try {
      if (row.state === "new" && row.item) {
        await registerItem(row.item);
        registered++;
      } else if (row.state === "officialOnly" && row.officialId && importIds.has(row.officialId)) {
        const o = [...(readOverlays() ?? []), ...pending].find((x) => x?.id === row.officialId);
        if (!o) throw new Error("Official overlay not found");
        await importOfficialOverlay(o);
        imported++;
      }
    } catch (err) {
      failed++;
      console.error("🧑‍🎨 : Official sync item failed", row.item?.key ?? row.officialId, err);
    }
  }
  return { registered, imported, failed };
};
