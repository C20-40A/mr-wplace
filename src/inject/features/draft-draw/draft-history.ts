import type { DraftPixel } from "./draft-store";

/**
 * Draft undo / redo history
 *
 * 単位は **1 操作 = 1 エントリ**。dot 1つ、ドラッグ 1ストローク、
 * バケツ 1回がそれぞれ 1 回の undo で戻る (pixel 単位で戻ると使い物にならない)。
 *
 * 記録は差分だけ: 触った pixel の before/after を持つ。
 * store 側が変更のたびに `recordPixelChange` を呼ぶので、呼び出し側は
 * 「操作の開始と終了」だけ宣言すればよい (`beginHistoryEntry`/`commitHistoryEntry`)。
 *
 * NOTE: undo/redo の適用中は記録しない (`applying`)。
 * これをしないと undo が自分自身を履歴に積んで無限に往復する。
 */

export interface PixelChange {
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  /** 変更前の色。無かった場合 null */
  before: { r: number; g: number; b: number } | null;
  /** 変更後の色。消した場合 null */
  after: { r: number; g: number; b: number } | null;
}

/** 履歴の上限。1エントリが数万 pixel になりうるので深すぎると重い */
const MAX_HISTORY = 50;

const undoStack: PixelChange[][] = [];
const redoStack: PixelChange[][] = [];

/** 記録中のエントリ。null = 操作外 (記録しない) */
let pending: PixelChange[] | null = null;
/** 同一操作内で同じ pixel を複数回触った時に before を保つための索引 */
let pendingIndex: Map<string, PixelChange> | null = null;
/** undo/redo の適用中フラグ。適用による変更は記録しない */
let applying = false;

let onChange: (() => void) | null = null;

export const setDraftHistoryChangeListener = (
  listener: (() => void) | null,
): void => {
  onChange = listener;
};

export const canUndoDraft = (): boolean => undoStack.length > 0;
export const canRedoDraft = (): boolean => redoStack.length > 0;

/** 操作の開始。既に開始済みなら何もしない (ネストは無視) */
export const beginHistoryEntry = (): void => {
  if (pending) return;
  pending = [];
  pendingIndex = new Map();
};

/**
 * 操作の終了。1 pixel も変わっていなければエントリを積まない
 * (空 undo を押しても何も起きない、という無駄な状態を作らないため)。
 */
export const commitHistoryEntry = (): void => {
  const entry = pending;
  pending = null;
  pendingIndex = null;
  if (!entry?.length) return;

  undoStack.push(entry);
  if (undoStack.length > MAX_HISTORY) undoStack.shift();
  // 新しい操作をしたら redo は無効になる (分岐は保持しない)
  redoStack.length = 0;
  onChange?.();
};

/** store から呼ばれる。操作外 / 適用中は無視する */
export const recordPixelChange = (change: PixelChange): void => {
  if (applying || !pending || !pendingIndex) return;

  const key = `${change.tileX},${change.tileY},${change.pixelX},${change.pixelY}`;
  const existing = pendingIndex.get(key);
  // 同一操作内の2回目以降は after だけ更新する (before は最初の値が正しい)
  if (existing) {
    existing.after = change.after;
    return;
  }

  pendingIndex.set(key, change);
  pending.push(change);
};

type ApplyPixel = (
  tileX: number,
  tileY: number,
  pixelX: number,
  pixelY: number,
  color: { r: number; g: number; b: number } | null,
) => void;

const applyChanges = (
  changes: PixelChange[],
  pick: (change: PixelChange) => PixelChange["before"],
  apply: ApplyPixel,
): void => {
  applying = true;
  try {
    for (const change of changes)
      apply(
        change.tileX,
        change.tileY,
        change.pixelX,
        change.pixelY,
        pick(change),
      );
  } finally {
    applying = false;
  }
};

/** 直前の操作を取り消す。適用は呼び出し側 (store) の関数に委ねる */
export const undoDraft = (apply: ApplyPixel): boolean => {
  const entry = undoStack.pop();
  if (!entry) return false;

  // 逆順に戻す (同じ pixel を複数回触っていても最初の before に着地する)
  applyChanges([...entry].reverse(), (c) => c.before, apply);
  redoStack.push(entry);
  onChange?.();
  return true;
};

export const redoDraft = (apply: ApplyPixel): boolean => {
  const entry = redoStack.pop();
  if (!entry) return false;

  applyChanges(entry, (c) => c.after, apply);
  undoStack.push(entry);
  onChange?.();
  return true;
};

/** 下書き破棄時に履歴も捨てる */
export const clearDraftHistory = (): void => {
  undoStack.length = 0;
  redoStack.length = 0;
  pending = null;
  pendingIndex = null;
  applying = false;
  onChange?.();
};

/** seed など「履歴に載せたくない」一括変更を包む */
export const withoutHistory = <T>(fn: () => T): T => {
  const previous = applying;
  applying = true;
  try {
    return fn();
  } finally {
    applying = previous;
  }
};

export type { DraftPixel };
