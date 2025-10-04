/**
 * EnhancedConfig各モードのビジュアルヒント定義
 * 3x3グリッドのピクセルパターンをSVGで表現
 * 
 * 色定義:
 * - オーバーレイ色(緑): #22c55e
 * - 透過(白): #ffffff
 * - 赤: #ef4444
 * - シアン: #06b6d4
 * - 暗色: #374151
 * - 補色(マゼンタ): #ec4899
 */

// 色定数
const COLORS = {
  OVERLAY: '#22c55e',    // オーバーレイ色(緑)
  TRANSPARENT: '#ffffff', // 透過(白)
  RED: '#ef4444',        // 赤
  CYAN: '#06b6d4',       // シアン
  DARK: '#374151',       // 暗色
  COMPLEMENT: '#ec4899', // 補色(マゼンタ)
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
  ['transparent', COLORS.OVERLAY, 'transparent'],
  ['transparent', 'transparent', 'transparent'],
];

// cross: 同色十字
// □■□
// ■■■
// □■□
const CROSS_PATTERN = [
  ['transparent', COLORS.OVERLAY, 'transparent'],
  [COLORS.OVERLAY, COLORS.OVERLAY, COLORS.OVERLAY],
  ['transparent', COLORS.OVERLAY, 'transparent'],
];

// fill: 全塗りつぶし
// ■■■
// ■■■
// ■■■
const FILL_PATTERN = [
  [COLORS.OVERLAY, COLORS.OVERLAY, COLORS.OVERLAY],
  [COLORS.OVERLAY, COLORS.OVERLAY, COLORS.OVERLAY],
  [COLORS.OVERLAY, COLORS.OVERLAY, COLORS.OVERLAY],
];

// red-cross: 中央緑+上下左右赤
// □赤□
// 赤■赤
// □赤□
const RED_CROSS_PATTERN = [
  ['transparent', COLORS.RED, 'transparent'],
  [COLORS.RED, COLORS.OVERLAY, COLORS.RED],
  ['transparent', COLORS.RED, 'transparent'],
];

// cyan-cross: 中央緑+上下左右シアン
// □シ□
// シ■シ
// □シ□
const CYAN_CROSS_PATTERN = [
  ['transparent', COLORS.CYAN, 'transparent'],
  [COLORS.CYAN, COLORS.OVERLAY, COLORS.CYAN],
  ['transparent', COLORS.CYAN, 'transparent'],
];

// dark-cross: 中央緑+上下左右暗色
// □暗□
// 暗■暗
// □暗□
const DARK_CROSS_PATTERN = [
  ['transparent', COLORS.DARK, 'transparent'],
  [COLORS.DARK, COLORS.OVERLAY, COLORS.DARK],
  ['transparent', COLORS.DARK, 'transparent'],
];

// complement-cross: 中央緑+上下左右補色
// □補□
// 補■補
// □補□
const COMPLEMENT_CROSS_PATTERN = [
  ['transparent', COLORS.COMPLEMENT, 'transparent'],
  [COLORS.COMPLEMENT, COLORS.OVERLAY, COLORS.COMPLEMENT],
  ['transparent', COLORS.COMPLEMENT, 'transparent'],
];

// red-border: 中央緑+周囲8ドット赤
// 赤赤赤
// 赤■赤
// 赤赤赤
const RED_BORDER_PATTERN = [
  [COLORS.RED, COLORS.RED, COLORS.RED],
  [COLORS.RED, COLORS.OVERLAY, COLORS.RED],
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
