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
  BLACK: '#000000',       // 黒(基本オーバーレイ)
  LIGHT_GRAY: '#9ca3af',  // 明るいグレー
  DARK_GRAY: '#374151',   // 暗いグレー
  TRANSPARENT: '#ffffff', // 透過(白)
  RED: '#ef4444',         // 赤
  CYAN: '#06b6d4',        // シアン
  YELLOW: '#eab308',      // 黄色
  BLUE: '#3b82f6',        // 青(黄色の補色)
} as const;

/**
 * 3x3グリッドパターンからSVG文字列を生成
 * @param pattern 3x3の色配列 ('transparent'は描画スキップ)
 */
const createGridSVG = (pattern: string[][]): string => {
  const cellSize = 3;
  const totalSize = 9;
  
  const rects = pattern.flatMap((row, y) =>
    row.map((color, x) =>
      color !== 'transparent'
        ? `<rect x="${x * cellSize}" y="${y * cellSize}" width="${cellSize}" height="${cellSize}" fill="${color}"/>`
        : ''
    )
  ).filter(r => r).join('');
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalSize}" height="${totalSize}" viewBox="0 0 ${totalSize} ${totalSize}">${rects}</svg>`;
};

/**
 * SVGをdata URI形式に変換
 */
const toDataURI = (svg: string): string => {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

// dot: 中央1ドットのみ
// □□□
// □■□
// □□□
const DOT_PATTERN = [
  ['transparent', 'transparent', 'transparent'],
  ['transparent', COLORS.BLACK, 'transparent'],
  ['transparent', 'transparent', 'transparent'],
];

// cross: 同色十字
// □■□
// ■■■
// □■□
const CROSS_PATTERN = [
  ['transparent', COLORS.BLACK, 'transparent'],
  [COLORS.BLACK, COLORS.BLACK, COLORS.BLACK],
  ['transparent', COLORS.BLACK, 'transparent'],
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
  ['transparent', COLORS.RED, 'transparent'],
  [COLORS.RED, COLORS.BLACK, COLORS.RED],
  ['transparent', COLORS.RED, 'transparent'],
];

// cyan-cross: 中央黒+上下左右シアン
// □シ□
// シ■シ
// □シ□
const CYAN_CROSS_PATTERN = [
  ['transparent', COLORS.CYAN, 'transparent'],
  [COLORS.CYAN, COLORS.BLACK, COLORS.CYAN],
  ['transparent', COLORS.CYAN, 'transparent'],
];

// dark-cross: 中央明るいグレー+上下左右暗いグレー
// □暗□
// 暗明暗
// □暗□
const DARK_CROSS_PATTERN = [
  ['transparent', COLORS.DARK_GRAY, 'transparent'],
  [COLORS.DARK_GRAY, COLORS.LIGHT_GRAY, COLORS.DARK_GRAY],
  ['transparent', COLORS.DARK_GRAY, 'transparent'],
];

// complement-cross: 中央青(黄色の補色)+上下左右黄色
// □黄□
// 黄青黄
// □黄□
const COMPLEMENT_CROSS_PATTERN = [
  ['transparent', COLORS.YELLOW, 'transparent'],
  [COLORS.YELLOW, COLORS.BLUE, COLORS.YELLOW],
  ['transparent', COLORS.YELLOW, 'transparent'],
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

// データURI形式でエクスポート
export const ENHANCED_MODE_ICONS = {
  dot: toDataURI(createGridSVG(DOT_PATTERN)),
  cross: toDataURI(createGridSVG(CROSS_PATTERN)),
  fill: toDataURI(createGridSVG(FILL_PATTERN)),
  'red-cross': toDataURI(createGridSVG(RED_CROSS_PATTERN)),
  'cyan-cross': toDataURI(createGridSVG(CYAN_CROSS_PATTERN)),
  'dark-cross': toDataURI(createGridSVG(DARK_CROSS_PATTERN)),
  'complement-cross': toDataURI(createGridSVG(COMPLEMENT_CROSS_PATTERN)),
  'red-border': toDataURI(createGridSVG(RED_BORDER_PATTERN)),
} as const;

export type EnhancedModeType = keyof typeof ENHANCED_MODE_ICONS;
