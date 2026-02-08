/** Enhanced描画モード */
export type EnhancedMode =
  | "dot"
  | "cross"
  | "red-cross"
  | "border-only"
  | "dark-cross"
  | "complement-cross"
  | "fill"
  | "red-border"
  | "huge-red-cross"
  | "huge-red-cross-bold"
  | "huge-red-diamond"
  | "huge-red-ring";

/** 色統計のデータ */
export interface ColorStats {
  matched: Map<string, number>;
  total: Map<string, number>;
}
