/**
 * EnhancedConfig各モードのビジュアルヒント定義
 * 3x3グリッドのピクセルパターンをSVGで表現
 *
 * 色定義:
 * - オーバーレイ色(黒): #000000
 * - 明るいグレー: #9ca3af
 * - 暗いグレー: #374151
 * - 透過(白): #ffffff
 * - 赤: #ef4444
 * - シアン: #06b6d4
 * - 黄色: #eab308
 * - 青(黄色の補色): #3b82f6
 */

// 色定数
const COLORS = {
  BLACK: "#000000", // 黒(基本オーバーレイ)
  LIGHT_GRAY: "#9ca3af", // 明るいグレー
  DARK_GRAY: "#374151", // 暗いグレー
  TRANSPARENT: "#ffffff", // 透過(白)
  RED: "#ef4444", // 赤
  CYAN: "#06b6d4", // シアン
  YELLOW: "#eab308", // 黄色
  BLUE: "#3b82f6", // 青(黄色の補色)
} as const;

/**
 * 3x3または5x5などのグリッドパターンからSVG文字列を生成
 * @param pattern NxMの色配列 ('transparent'は描画スキップ)
 */
const createGridSVG = (pattern: string[][]): string => {
  const cellSize = 3;

  // 行の数（高さ）と列の数（幅）を取得
  const numRows = pattern.length;
  const numCols = pattern.length > 0 ? pattern[0].length : 0;

  // SVG全体のサイズを動的に計算 (セルの数 * セルサイズ)
  const totalWidth = numCols * cellSize;
  const totalHeight = numRows * cellSize;

  const rects = pattern
    .flatMap((row, y) =>
      row.map((color, x) =>
        color !== "transparent"
          ? `<rect x="${x * cellSize}" y="${
              y * cellSize
            }" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
          : ""
      )
    )
    .filter((r) => r)
    .join("");

  // width, height, viewBox を動的に計算したサイズに設定
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">${rects}</svg>`;
};

/**
 * SVGをdata URI形式に変換
 */
const toDataURI = (svg: string): string => {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// ... (以下、パターン定義は変更なし) ...

// dot: 中央1ドットのみ
// □□□
// □■□
// □□□
const DOT_PATTERN = [
  ["transparent", "transparent", "transparent"],
  ["transparent", COLORS.BLACK, "transparent"],
  ["transparent", "transparent", "transparent"],
];

// cross: 同色十字
// □■□
// ■■■
// □■□
const CROSS_PATTERN = [
  ["transparent", COLORS.BLACK, "transparent"],
  [COLORS.BLACK, COLORS.BLACK, COLORS.BLACK],
  ["transparent", COLORS.BLACK, "transparent"],
];

// fill: 全塗りつぶし
// ■■■
// ■■■
// ■■■
const FILL_PATTERN = [
  [COLORS.BLACK, COLORS.BLACK, COLORS.BLACK],
  [COLORS.BLACK, COLORS.BLACK, COLORS.BLACK],
  [COLORS.BLACK, COLORS.BLACK, COLORS.BLACK],
];

// red-cross: 中央黒+上下左右赤
// □赤□
// 赤■赤
// □赤□
const RED_CROSS_PATTERN = [
  ["transparent", COLORS.RED, "transparent"],
  [COLORS.RED, COLORS.BLACK, COLORS.RED],
  ["transparent", COLORS.RED, "transparent"],
];

// cyan-cross: 中央黒+上下左右シアン
// □シ□
// シ■シ
// □シ□
const CYAN_CROSS_PATTERN = [
  ["transparent", COLORS.CYAN, "transparent"],
  [COLORS.CYAN, COLORS.BLACK, COLORS.CYAN],
  ["transparent", COLORS.CYAN, "transparent"],
];

// dark-cross: 中央明るいグレー+上下左右暗いグレー
// □暗□
// 暗明暗
// □暗□
const DARK_CROSS_PATTERN = [
  ["transparent", COLORS.DARK_GRAY, "transparent"],
  [COLORS.DARK_GRAY, COLORS.LIGHT_GRAY, COLORS.DARK_GRAY],
  ["transparent", COLORS.DARK_GRAY, "transparent"],
];

// complement-cross: 中央青(黄色の補色)+上下左右黄色
// □黄□
// 黄青黄
// □黄□
const COMPLEMENT_CROSS_PATTERN = [
  ["transparent", COLORS.YELLOW, "transparent"],
  [COLORS.YELLOW, COLORS.BLUE, COLORS.YELLOW],
  ["transparent", COLORS.YELLOW, "transparent"],
];

// red-border: 中央黒+周囲8ドット赤
// 赤赤赤
// 赤■赤
// 赤赤赤
const RED_BORDER_PATTERN = [
  [COLORS.RED, COLORS.RED, COLORS.RED],
  [COLORS.RED, COLORS.BLACK, COLORS.RED],
  [COLORS.RED, COLORS.RED, COLORS.RED],
];

// huge-red-cross: 巨大赤十字（細い線）
// 描画: 水平垂直の1px線
// アイコン: 十字形状（上下左右が赤、四隅は透明）
// □□赤□□
// □□赤□□
// 赤赤■赤赤
// □□赤□□
// □□赤□□
const HUGE_RED_CROSS_PATTERN = [
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
  [COLORS.RED, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.RED],
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
];

// huge-red-cross-bold: 巨大赤十字（極太3px幅）
// 描画: 3px幅の太い十字
// アイコン: 5x5で太い十字を表現
// □□赤赤赤□□
// □□赤赤赤□□
// 赤赤赤赤赤赤赤
// 赤赤赤■赤赤赤
// 赤赤赤赤赤赤赤
// □□赤赤赤□□
// □□赤赤赤□□
const HUGE_RED_CROSS_BOLD_PATTERN = [
  [
    "transparent",
    "transparent",
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    "transparent",
    "transparent",
  ],
  [
    "transparent",
    "transparent",
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    "transparent",
    "transparent",
  ],
  [
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
  ],
  [
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.BLACK,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
  ],
  [
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
  ],
  [
    "transparent",
    "transparent",
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    "transparent",
    "transparent",
  ],
  [
    "transparent",
    "transparent",
    COLORS.RED,
    COLORS.RED,
    COLORS.RED,
    "transparent",
    "transparent",
  ],
];

// huge-red-diamond:  巨大赤ダイヤ（マンハッタン距離）
// 描画: ダイヤ形状のグラデーション
// アイコン: ダイヤ形状（四隅が赤、上下左右は透明）
// □□赤□□
// □赤赤赤□
// 赤赤■赤赤
// □赤赤赤□
// □□赤□□
const HUGE_RED_DIAMOND_PATTERN = [
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
  ["transparent", COLORS.RED, COLORS.RED, COLORS.RED, "transparent"],
  [COLORS.RED, COLORS.RED, COLORS.BLACK, COLORS.RED, COLORS.RED],
  ["transparent", COLORS.RED, COLORS.RED, COLORS.RED, "transparent"],
  ["transparent", "transparent", COLORS.RED, "transparent", "transparent"],
];

// huge-red-ring: 巨大赤リング（円形）
// 描画: 円形リング（内側空洞）
// アイコン: 5x5でリング形状を表現
// □赤赤赤□
// 赤□□□赤
// 赤□■□赤
// 赤□□□赤
// □赤赤赤□
const HUGE_RED_RING_PATTERN = [
  ["transparent", COLORS.RED, COLORS.RED, COLORS.RED, "transparent"],
  [COLORS.RED, "transparent", "transparent", "transparent", COLORS.RED],
  [COLORS.RED, "transparent", COLORS.BLACK, "transparent", COLORS.RED],
  [COLORS.RED, "transparent", "transparent", "transparent", COLORS.RED],
  ["transparent", COLORS.RED, COLORS.RED, COLORS.RED, "transparent"],
];

// データURI形式でエクスポート
export const ENHANCED_MODE_ICONS = {
  dot: toDataURI(createGridSVG(DOT_PATTERN)),
  cross: toDataURI(createGridSVG(CROSS_PATTERN)),
  fill: toDataURI(createGridSVG(FILL_PATTERN)),
  "red-cross": toDataURI(createGridSVG(RED_CROSS_PATTERN)),
  "cyan-cross": toDataURI(createGridSVG(CYAN_CROSS_PATTERN)),
  "dark-cross": toDataURI(createGridSVG(DARK_CROSS_PATTERN)),
  "complement-cross": toDataURI(createGridSVG(COMPLEMENT_CROSS_PATTERN)),
  "red-border": toDataURI(createGridSVG(RED_BORDER_PATTERN)),
  "huge-red-cross": toDataURI(createGridSVG(HUGE_RED_CROSS_PATTERN)),
  "huge-red-cross-bold": toDataURI(createGridSVG(HUGE_RED_CROSS_BOLD_PATTERN)),
  "huge-red-diamond": toDataURI(createGridSVG(HUGE_RED_DIAMOND_PATTERN)),
  "huge-red-ring": toDataURI(createGridSVG(HUGE_RED_RING_PATTERN)),
} as const;

export type EnhancedModeType = keyof typeof ENHANCED_MODE_ICONS;

export const SHOW_UNPLACED_ONLY_ICON_SVG = `
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <!-- グリッド背景 -->
  <rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
  
  <!-- 配置済みピクセル（塗りつぶし） -->
  <rect x="6" y="6" width="3" height="3" fill="currentColor" opacity="0.3"/>
  <rect x="11" y="6" width="3" height="3" fill="currentColor" opacity="0.3"/>
  <rect x="6" y="11" width="3" height="3" fill="currentColor" opacity="0.3"/>
  
  <!-- 未配置ピクセル（枠のみ、強調） -->
  <rect x="16" y="6" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="11" y="11" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="16" y="11" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="6" y="16" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <rect x="16" y="16" width="3" height="3" fill="none" stroke="currentColor" stroke-width="1.5"/>
</svg>`;
