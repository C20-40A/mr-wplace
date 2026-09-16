import { storage } from "@/utils/browser-api";

const STORAGE_KEY = "paint-guide-enabled";
const KINDS_STORAGE_KEY = "paint-guide-kinds";

export type PaintGuideKind = "mismatch" | "overflow" | "already";
export type PaintGuideKinds = Record<PaintGuideKind, boolean>;

export const PAINT_GUIDE_KINDS: PaintGuideKind[] = [
  "mismatch",
  "overflow",
  "already",
];

const allKinds = (enabled: boolean): PaintGuideKinds => ({
  mismatch: enabled,
  overflow: enabled,
  already: enabled,
});

let kinds: PaintGuideKinds = allKinds(true);

export const loadPaintGuideFromStorage = async (): Promise<void> => {
  const result = await storage.get([STORAGE_KEY, KINDS_STORAGE_KEY]);
  const saved = result[KINDS_STORAGE_KEY] as Partial<PaintGuideKinds> | undefined;
  // 旧 boolean 設定からの移行: 種別設定が無ければ全種別に反映する
  kinds = { ...allKinds(result[STORAGE_KEY] !== false), ...saved };
};

/** 1種別でも ON ならガイド有効 */
export const getPaintGuide = (): boolean =>
  PAINT_GUIDE_KINDS.some((kind) => kinds[kind]);

export const getPaintGuideKinds = (): PaintGuideKinds => ({ ...kinds });

const persist = async (): Promise<void> => {
  await storage.set({
    [KINDS_STORAGE_KEY]: kinds,
    [STORAGE_KEY]: getPaintGuide(),
  });
};

/** 全種別をまとめて切り替える (拡張popupのマスタートグル用) */
export const setPaintGuide = async (enabled: boolean): Promise<void> => {
  kinds = allKinds(enabled);
  await persist();
};

export const setPaintGuideKind = async (
  kind: PaintGuideKind,
  enabled: boolean,
): Promise<void> => {
  kinds = { ...kinds, [kind]: enabled };
  await persist();
};
