import { runtime, storage } from "@/utils/browser-api";
import { PARTY_RESULT_TITLES } from "@/constants/party-mode";
import { showPaintNotice } from "@/components/paint-notice";
import { t } from "@/i18n";

/** 演出強化モード（パーティーモード）トグル。描画は inject/features/party-mode が担当 */

const BUTTON_ID = "mr-wplace-party-mode-btn";
const STORAGE_KEY = "party-mode-enabled";

/** 16x16 ピクセルアートのクラッカー（他ボタンのピクセル調に合わせる） */
const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="20" height="20" shape-rendering="crispEdges"><rect x="0" y="13" width="1" height="1" fill="#000"/><rect x="0" y="14" width="1" height="1" fill="#000"/><rect x="1" y="11" width="1" height="1" fill="#000"/><rect x="1" y="12" width="1" height="1" fill="#000"/><rect x="1" y="13" width="1" height="1" fill="#ffcc00"/><rect x="1" y="14" width="1" height="1" fill="#ffcc00"/><rect x="1" y="15" width="1" height="1" fill="#000"/><rect x="2" y="9" width="1" height="1" fill="#000"/><rect x="2" y="10" width="1" height="1" fill="#000"/><rect x="2" y="11" width="1" height="1" fill="#ffcc00"/><rect x="2" y="12" width="1" height="1" fill="#ff8a00"/><rect x="2" y="13" width="1" height="1" fill="#ff8a00"/><rect x="2" y="14" width="1" height="1" fill="#ffcc00"/><rect x="2" y="15" width="1" height="1" fill="#000"/><rect x="3" y="6" width="1" height="1" fill="#000"/><rect x="3" y="7" width="1" height="1" fill="#000"/><rect x="3" y="8" width="1" height="1" fill="#000"/><rect x="3" y="9" width="1" height="1" fill="#ff8a00"/><rect x="3" y="10" width="1" height="1" fill="#ff8a00"/><rect x="3" y="11" width="1" height="1" fill="#ffcc00"/><rect x="3" y="12" width="1" height="1" fill="#ffcc00"/><rect x="3" y="13" width="1" height="1" fill="#ff8a00"/><rect x="3" y="14" width="1" height="1" fill="#000"/><rect x="4" y="4" width="1" height="1" fill="#000"/><rect x="4" y="5" width="1" height="1" fill="#000"/><rect x="4" y="6" width="1" height="1" fill="#ff8a00"/><rect x="4" y="7" width="1" height="1" fill="#ff8a00"/><rect x="4" y="8" width="1" height="1" fill="#ffcc00"/><rect x="4" y="9" width="1" height="1" fill="#ffcc00"/><rect x="4" y="10" width="1" height="1" fill="#ff8a00"/><rect x="4" y="11" width="1" height="1" fill="#ff8a00"/><rect x="4" y="12" width="1" height="1" fill="#ffcc00"/><rect x="4" y="13" width="1" height="1" fill="#ffcc00"/><rect x="4" y="14" width="1" height="1" fill="#000"/><rect x="5" y="4" width="1" height="1" fill="#ff8a00"/><rect x="5" y="5" width="1" height="1" fill="#ffcc00"/><rect x="5" y="6" width="1" height="1" fill="#ffcc00"/><rect x="5" y="7" width="1" height="1" fill="#ff8a00"/><rect x="5" y="8" width="1" height="1" fill="#ff8a00"/><rect x="5" y="9" width="1" height="1" fill="#ffcc00"/><rect x="5" y="10" width="1" height="1" fill="#ffcc00"/><rect x="5" y="11" width="1" height="1" fill="#ff8a00"/><rect x="5" y="12" width="1" height="1" fill="#ff8a00"/><rect x="5" y="13" width="1" height="1" fill="#000"/><rect x="6" y="5" width="1" height="1" fill="#ff8a00"/><rect x="6" y="6" width="1" height="1" fill="#ffcc00"/><rect x="6" y="7" width="1" height="1" fill="#ffcc00"/><rect x="6" y="8" width="1" height="1" fill="#ff8a00"/><rect x="6" y="9" width="1" height="1" fill="#ff8a00"/><rect x="6" y="10" width="1" height="1" fill="#ffcc00"/><rect x="6" y="11" width="1" height="1" fill="#ffcc00"/><rect x="6" y="12" width="1" height="1" fill="#ff8a00"/><rect x="6" y="13" width="1" height="1" fill="#000"/><rect x="7" y="6" width="1" height="1" fill="#ff8a00"/><rect x="7" y="7" width="1" height="1" fill="#ffcc00"/><rect x="7" y="8" width="1" height="1" fill="#ffcc00"/><rect x="7" y="9" width="1" height="1" fill="#ff8a00"/><rect x="7" y="10" width="1" height="1" fill="#ff8a00"/><rect x="7" y="11" width="1" height="1" fill="#ffcc00"/><rect x="7" y="12" width="1" height="1" fill="#000"/><rect x="8" y="3" width="1" height="1" fill="#ffe600"/><rect x="8" y="7" width="1" height="1" fill="#ff8a00"/><rect x="8" y="8" width="1" height="1" fill="#ffcc00"/><rect x="8" y="9" width="1" height="1" fill="#ffcc00"/><rect x="8" y="10" width="1" height="1" fill="#ff8a00"/><rect x="8" y="11" width="1" height="1" fill="#ff8a00"/><rect x="8" y="12" width="1" height="1" fill="#000"/><rect x="9" y="0" width="1" height="1" fill="#7dff4a"/><rect x="9" y="8" width="1" height="1" fill="#ff8a00"/><rect x="9" y="9" width="1" height="1" fill="#ffcc00"/><rect x="9" y="10" width="1" height="1" fill="#ffcc00"/><rect x="9" y="11" width="1" height="1" fill="#ff8a00"/><rect x="9" y="12" width="1" height="1" fill="#000"/><rect x="10" y="2" width="1" height="1" fill="#33d6ff"/><rect x="10" y="9" width="1" height="1" fill="#ff8a00"/><rect x="10" y="10" width="1" height="1" fill="#ffcc00"/><rect x="10" y="11" width="1" height="1" fill="#000"/><rect x="11" y="5" width="1" height="1" fill="#fff"/><rect x="11" y="10" width="1" height="1" fill="#ff8a00"/><rect x="11" y="11" width="1" height="1" fill="#000"/><rect x="12" y="1" width="1" height="1" fill="#ffe600"/><rect x="13" y="4" width="1" height="1" fill="#7dff4a"/><rect x="13" y="9" width="1" height="1" fill="#ffe600"/><rect x="14" y="7" width="1" height="1" fill="#33d6ff"/><rect x="15" y="3" width="1" height="1" fill="#ffe600"/><rect x="15" y="10" width="1" height="1" fill="#7dff4a"/></svg>`;

/** デフォルト OFF。既存ユーザーには feature hint で存在を知らせる */
let enabled = false;

const notifyInject = () =>
  window.postMessage({
    source: "mr-wplace-party-mode-update",
    enabled,
    resultAssetUrls: enabled ? Object.fromEntries(
      Object.keys(PARTY_RESULT_TITLES).map((key) => [key, runtime.getURL(`assets/party-mode/result-${key}.webp`)]),
    ) : undefined,
  }, "*");

/** OFF: 白黒 + 半透明 / ON: カラー + 発光。ひと目で状態が分かるように差を大きく */
const updateButtonStyle = (btn: HTMLButtonElement) => {
  btn.style.opacity = enabled ? "1" : "0.55";
  btn.style.transform = enabled ? "scale(1.1)" : "scale(1)";
  btn.style.filter = enabled
    ? "drop-shadow(0 0 6px var(--color-primary))"
    : "grayscale(1)";
  btn.setAttribute("aria-pressed", String(enabled));
};

export const createPartyModeButton = (): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.title = "Party Mode";
  btn.className = "btn btn-sm btn-circle";
  btn.innerHTML = ICON_SVG;
  btn.style.cssText = `
    position: relative;
    z-index: 10;
    transition: opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease;
  `;
  updateButtonStyle(btn);

  btn.addEventListener("click", () => {
    enabled = !enabled;
    updateButtonStyle(btn);
    notifyInject();
    storage.set({ [STORAGE_KEY]: enabled });
    showPaintNotice(t(enabled ? "notice_party_mode_on" : "notice_party_mode_off"));
    console.log(`🧑‍🎨 : Party mode ${enabled ? "on" : "off"}`);
  });

  storage.get(STORAGE_KEY).then((result) => {
    if (result[STORAGE_KEY] !== true) return;
    enabled = true;
    updateButtonStyle(btn);
    notifyInject();
  });

  return btn;
};
