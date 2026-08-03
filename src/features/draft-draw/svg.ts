import { IMG_ICON_BLUEPRINT } from "@/assets/iconImages";

/**
 * ツールバーアイコン (lucide)。`stroke="currentColor"` なので
 * theme の文字色に追従する。
 */
export const ICON_ATTRS =
  'width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';

export const ERASER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21"/><path d="m5.082 11.09 8.828 8.828"/></svg>`;
export const BRUSH_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="m16 22-1-4"/><path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1"/><path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z"/><path d="m8 22 1-4"/></svg>`;
/** マップロック。ON = 左ドラッグが pan ではなく描画になる */
export const LOCK_OPEN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`;
export const LOCK_CLOSED_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
export const UNDO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
export const REDO_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
export const BUCKET_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M11 7 6 2"/><path d="M18.992 12H2.041"/><path d="M21.145 18.38A3.34 3.34 0 0 1 20 16.5a3.3 3.3 0 0 1-1.145 1.88c-.575.46-.855 1.02-.855 1.595A2 2 0 0 0 20 22a2 2 0 0 0 2-2.025c0-.58-.285-1.13-.855-1.595"/><path d="m8.5 4.5 2.148-2.148a1.205 1.205 0 0 1 1.704 0l7.296 7.296a1.205 1.205 0 0 1 0 1.704l-7.592 7.592a3.615 3.615 0 0 1-5.112 0l-3.888-3.888a3.615 3.615 0 0 1 0-5.112L5.67 7.33"/></svg>`;
/** User-provided Lucide stamp icon. */
export const STAMP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/><path d="M20 15.5a2.5 2.5 0 0 0-2.5-2.5h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1z"/><path d="M5 22h14"/></svg>`;
export const CLEAR_PATTERN_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="m12 3-1.2 3.8L7 5.5l2.3 3.2L5.5 10l3.8 1.3-2.3 3.2 3.8-1.3L12 17l1.2-3.8 3.8 1.3-2.3-3.2 3.8-1.3-3.8-1.3L17 5.5l-3.8 1.3z"/><path d="m4 20 3-2M20 20l-3-2"/></svg>`;
/** User-provided Lucide spline icon. */
export const LINE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><path d="M5 17A12 12 0 0 1 17 5"/></svg>`;
export const CHECK_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="m20 6-11 11-5-5"/></svg>`;
/** 図形 (矩形) ツール */
export const SHAPE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`;
/** 正方形トグル (Shift 押下と同じ拘束を latch する) */
export const SQUARE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><rect width="14" height="14" x="5" y="5" rx="1"/><path d="M3 9V3h6M21 15v6h-6"/></svg>`;
/** 直線トグル (Shift 押下と同じ拘束を latch する) */
export const STRAIGHT_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3"/></svg>`;
export const X_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" ${ICON_ATTRS}><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

export const ICON_SVG = `<img src="${IMG_ICON_BLUEPRINT}"  style="image-rendering: pixelated; width: calc(var(--spacing)*9); height: calc(var(--spacing)*9);">`;
