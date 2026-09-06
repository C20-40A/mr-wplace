import {
  loadCompactBottomSheetFromStorage,
  getCompactBottomSheet,
} from "@/states/compact-bottom-sheet";

/**
 * Compact Bottom Sheet (実験的機能 / default: off)
 *
 * ペイントパネルを省スペース化する:
 * - "Paint pixel" タイトルを非表示
 * - モバイルで2行になるツールボタン群をヘッダー1行にまとめる
 * - パレット周りの余白を削り、パレットの表示領域を広げる
 *
 * DOMは触らず、html要素のクラス切り替え + CSSのみで実現する
 * (wplace側の再描画で剥がれないため)
 */

const STYLE_ID = "mr-wplace-compact-bottom-sheet-style";
const ROOT_CLASS = "mr-wplace-compact-sheet";

/** ペイントパネル(bottom sheet)のルート */
const SHEET = `.${ROOT_CLASS} .rounded-t-box.pb-safe-3`;
/** ヘッダー行 (h2 を直下に持つ行) */
const HEADER = `${SHEET} div:has(> h2)`;

const CSS = `
/* --- sheet 全体の余白を圧縮 --- */
${SHEET} { padding-top: 0.25rem !important; }
${SHEET} > .relative.px-3 { padding-inline: 0.375rem !important; }

/* --- ヘッダーを1行に --- */
${HEADER} {
  display: flex !important;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.125rem;
}
${HEADER} > h2 { flex: 0 0 auto; }
/* "Paint pixel" タイトルは非表示 (charge canvas は残す) */
${HEADER} > h2 > span.truncate { display: none; }
/* ツールボタン群(2行目)をヘッダー行に展開 */
${HEADER} > div { display: contents; }
/* collapse / close は右寄せ */
${HEADER} > button:first-of-type { margin-left: auto; }
${HEADER} .btn-circle {
  width: 2.25rem !important;
  height: 2.25rem !important;
  min-height: 0 !important;
}

/* --- パレット領域を広く --- */
${HEADER} + div { margin: 0 !important; }
${HEADER} + div > div {
  /* padding:0 だと選択色の ring がはみ出して横スクロールが出るため 2px 残す */
  padding: 2px !important;
  overflow-x: hidden !important;
  max-height: 46dvh !important;
}

/* --- カラーボタンを少し平たく --- */
${HEADER} + div [id^="color-"] { aspect-ratio: 1.4 !important; }
@media (max-width: 639px) {
  ${HEADER} + div [id^="color-"],
  ${HEADER} + div .tooltip {
    height: 1.5rem !important;
    min-height: 0 !important;
  }
}
`;

const ensureStyle = (): void => {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
};

/** 有効/無効を即時反映 (popupからの変更通知でも利用) */
export const applyCompactBottomSheet = (enabled: boolean): void => {
  ensureStyle();
  document.documentElement.classList.toggle(ROOT_CLASS, enabled);
};

export class CompactBottomSheet {
  constructor() {
    void this.init();
  }

  private async init(): Promise<void> {
    await loadCompactBottomSheetFromStorage();
    applyCompactBottomSheet(getCompactBottomSheet());
  }
}
