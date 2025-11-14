/** Enhanced描画モード */
export type EnhancedMode =
  | "dot"
  | "cross"
  | "red-cross"
  | "cyan-cross"
  | "dark-cross"
  | "complement-cross"
  | "fill"
  | "red-border";

/** 色統計のデータ */
export interface ColorStats {
  matched: Map<string, number>;
  total: Map<string, number>;
}
