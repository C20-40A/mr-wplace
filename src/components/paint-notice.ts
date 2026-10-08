import { getPaintToolbarContainer } from "@/features/paint-toolbar";
import { ensureStyle } from "@/utils/style";

const NOTICE_ID = "mr-wplace-paint-notice";
const STYLE_ID = "mr-wplace-paint-notice-style";
const DURATION_MS = 2000;
const FADE_MS = 160;

/** paint panel 上の hint pill と同じ見た目。paint panel(z-50)より前面に出す */
const ensureStyles = (): void => {
  ensureStyle(STYLE_ID, `
    #${NOTICE_ID}{position:fixed;left:50%;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:6px;width:max-content;max-width:calc(100vw - 24px);padding:6px 14px;border-radius:9999px;border:2px solid color-mix(in srgb, var(--color-base-content,#222) 20%, transparent);background:color-mix(in srgb, var(--color-base-100,#fff) 60%, transparent);color:var(--color-base-content,#222);backdrop-filter:blur(6px);font-size:13px;line-height:1.4;font-weight:500;text-align:center;pointer-events:none;user-select:none;opacity:0;transition:opacity ${FADE_MS}ms ease;}
    #${NOTICE_ID}.show{opacity:1;}
  `);
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;
let removeTimer: ReturnType<typeof setTimeout> | null = null;

/** wplace の "Click or hold SPACE to paint." hint と同じ位置 (panel の -60px 上) */
const HINT_SLOT_OFFSET_PX = 26;

const positionNotice = (notice: HTMLDivElement): void => {
  // hint はクリックで消えるので、hint 自体ではなく panel を基準にして同じ枠を占有する
  const panel =
    document.querySelector<HTMLElement>(".paint-toolbar") ??
    (getPaintToolbarContainer()?.parentElement !== document.body
      ? getPaintToolbarContainer()
      : null);

  notice.style.top = "auto";
  notice.style.bottom = panel
    ? `${window.innerHeight - panel.getBoundingClientRect().top + HINT_SLOT_OFFSET_PX}px`
    : "24px";
};

/** 2秒だけ表示される通知。連続呼び出しは最新のメッセージで上書きする */
export const showPaintNotice = (message: string): void => {
  ensureStyles();

  let notice = document.getElementById(NOTICE_ID) as HTMLDivElement | null;
  if (!notice) {
    notice = document.createElement("div");
    notice.id = NOTICE_ID;
    document.body.appendChild(notice);
  }
  notice.textContent = message;
  positionNotice(notice);

  if (hideTimer) clearTimeout(hideTimer);
  if (removeTimer) clearTimeout(removeTimer);

  requestAnimationFrame(() => notice.classList.add("show"));

  hideTimer = setTimeout(() => {
    notice.classList.remove("show");
    removeTimer = setTimeout(() => notice.remove(), FADE_MS);
  }, DURATION_MS);
};
