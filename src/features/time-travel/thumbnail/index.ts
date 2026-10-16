/**
 * Snapshot thumbnails (content side)
 *
 * 独立性の高い「装飾レイヤー」。タイル一覧のカードに、画面内に入った分だけ
 * 小さなサムネイルを後付けする。失敗しても・無効化しても、カードは通常どおり動く。
 *
 * - IntersectionObserver で可視領域のみ対象
 * - 取得は同時 N 本までに制限
 * - content 側で小さな LRU キャッシュ
 * - サムネが無い（既存データ等）ID は記録して再取得しない
 */

import { getThumbnailDataUrl } from "@/utils/inject-bridge";

/** 機能スイッチ。false にすると即座にテキストのみ表示へ戻る */
export const ENABLE_SNAPSHOT_THUMBNAILS = true;

const FETCH_CONCURRENCY = 4;
const CACHE_LIMIT = 150;
const MISSING_LIMIT = 2000;

export interface SnapshotThumbnailHandle {
  disconnect(): void;
}

const NOOP_HANDLE: SnapshotThumbnailHandle = { disconnect: () => {} };

const cache = new Map<string, string>();
const missing = new Set<string>();
const queue: HTMLElement[] = [];
let active = 0;

const rememberThumbnail = (id: string, dataUrl: string): void => {
  cache.delete(id);
  cache.set(id, dataUrl);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
};

const resolveThumbnail = async (id: string): Promise<string | null> => {
  if (missing.has(id)) return null;

  const cached = cache.get(id);
  if (cached) {
    rememberThumbnail(id, cached);
    return cached;
  }

  const dataUrl = await getThumbnailDataUrl(id);
  if (!dataUrl) {
    if (missing.size >= MISSING_LIMIT) missing.clear();
    missing.add(id);
    return null;
  }

  rememberThumbnail(id, dataUrl);
  return dataUrl;
};

const applyThumbnail = (el: HTMLElement, dataUrl: string): void => {
  if (el.dataset.thumbLoaded === "1") return;
  el.dataset.thumbLoaded = "1";

  const opacity = el.dataset.thumbOpacity || "1";

  const img = document.createElement("img");
  img.src = dataUrl;
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.style.cssText = `width:100%;height:100%;object-fit:cover;display:block;opacity:${opacity};`;
  el.replaceChildren(img);
};

const loadElement = async (el: HTMLElement): Promise<void> => {
  const id = el.dataset.thumbId;
  if (!id || el.dataset.thumbLoaded === "1" || !el.isConnected) return;

  try {
    const dataUrl = await resolveThumbnail(id);
    if (dataUrl && el.isConnected) applyThumbnail(el, dataUrl);
  } catch (error) {
    console.warn("🧑‍🎨 : Snapshot thumbnail load failed:", error);
  }
};

const drainQueue = (): void => {
  while (active < FETCH_CONCURRENCY && queue.length > 0) {
    const el = queue.shift();
    if (!el) break;
    if (!el.isConnected) continue;

    active++;
    void loadElement(el).finally(() => {
      active--;
      queueMicrotask(drainQueue);
    });
  }
};

/**
 * カード内の `[data-thumb-id]` にサムネイルを遅延適用する。
 * scrollRoot には一覧のスクロールコンテナを渡す（可視判定の基準）。
 */
export const attachSnapshotThumbnails = (
  root: HTMLElement,
  scrollRoot?: HTMLElement | null,
): SnapshotThumbnailHandle => {
  if (!ENABLE_SNAPSHOT_THUMBNAILS) return NOOP_HANDLE;

  try {
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>("[data-thumb-id]"),
    );
    if (targets.length === 0) return NOOP_HANDLE;

    // IntersectionObserver が無い環境では全件ロード（それでも数 KB のみ）
    if (typeof IntersectionObserver !== "function") {
      targets.forEach((el) => queue.push(el));
      drainQueue();
      return NOOP_HANDLE;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          queue.push(entry.target as HTMLElement);
        }
        drainQueue();
      },
      { root: scrollRoot ?? null, rootMargin: "200px 0px", threshold: 0 },
    );

    targets.forEach((el) => observer.observe(el));

    return {
      disconnect() {
        observer.disconnect();
      },
    };
  } catch (error) {
    console.warn("🧑‍🎨 : Snapshot thumbnail setup failed:", error);
    return NOOP_HANDLE;
  }
};
