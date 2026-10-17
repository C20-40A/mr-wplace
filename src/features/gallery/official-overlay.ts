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
import { getOverlayBounds, sanitizeFilename } from "./common-actions";

const OVERLAYS_KEY = "template-overlays";
const LINKS_KEY = "mr-wplace-official-links";
const DB_NAME = "wplace-templates";
const IMAGE_STORE = "images";

type OfficialOverlay = { id: string; order?: number } & Record<string, unknown>;

const pending: OfficialOverlay[] = [];
let listening = false;

const readOverlays = (): OfficialOverlay[] | null => {
  try {
    const list = JSON.parse(localStorage.getItem(OVERLAYS_KEY) ?? "[]");
    return Array.isArray(list) ? list : null;
  } catch {
    return null;
  }
};

const readLinks = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(LINKS_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
};

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
const putOfficialImage = async (id: string, file: File): Promise<void> => {
  const dbs = await indexedDB.databases();
  if (!dbs.some((d) => d.name === DB_NAME))
    throw new Error("Official overlay storage not found");

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME);
    req.onupgradeneeded = () => req.transaction?.abort();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  try {
    if (!db.objectStoreNames.contains(IMAGE_STORE))
      throw new Error("Official overlay image store not found");
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, "readwrite");
      tx.objectStore(IMAGE_STORE).put(file, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
};

/**
 * 公式 overlay (非表示) として登録する。登録済みなら何もしない。
 * 削除済み id は公式の tombstone に残るため、再登録は常に新しい UUID を使う。
 */
export const registerToOfficialOverlay = async (item: GalleryItem): Promise<void> => {
  const list = readOverlays();
  if (!list) throw new Error("Official overlay data is unreadable");

  const linked = readLinks()[item.key];
  if (linked && [...list, ...pending].some((t) => t?.id === linked)) return;

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
  await putOfficialImage(id, new File([blob], name, { type: blob.type || "image/png" }));

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

  try {
    localStorage.setItem(LINKS_KEY, JSON.stringify({ ...readLinks(), [item.key]: id }));
  } catch {}

  if (listening) return;
  listening = true;
  window.addEventListener("pagehide", flushPending);
};
