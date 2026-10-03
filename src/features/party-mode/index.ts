import { runtime, storage } from "@/utils/browser-api";
import { PARTY_RESULT_TITLES } from "@/features/party-mode/assets";

/** 演出強化モード（パーティーモード）トグル。描画は inject/features/party-mode が担当 */

const BUTTON_ID = "mr-wplace-party-mode-btn";
const STORAGE_KEY = "party-mode-enabled";

let enabled = false;

const notifyInject = () =>
  window.postMessage({
    source: "mr-wplace-party-mode-update",
    enabled,
    resultAssetUrls: enabled ? Object.fromEntries(
      Object.keys(PARTY_RESULT_TITLES).map((key) => [key, runtime.getURL(`assets/party-mode/result-${key}.webp`)]),
    ) : undefined,
  }, "*");

const updateButtonStyle = (btn: HTMLButtonElement) => {
  btn.style.opacity = enabled ? "1" : "0.6";
  btn.style.transform = enabled ? "scale(1.1)" : "scale(1)";
  btn.style.filter = enabled ? "drop-shadow(0 0 6px oklch(var(--p)))" : "";
};

export const createPartyModeButton = (): HTMLButtonElement => {
  const btn = document.createElement("button");
  btn.id = BUTTON_ID;
  btn.type = "button";
  btn.title = "Party Mode";
  btn.className = "btn btn-sm btn-circle";
  btn.textContent = "🎉";
  btn.style.cssText = `
    position: relative;
    z-index: 10;
    font-size: 16px;
    transition: opacity 0.2s ease, transform 0.2s ease, filter 0.2s ease;
  `;
  updateButtonStyle(btn);

  btn.addEventListener("click", () => {
    enabled = !enabled;
    updateButtonStyle(btn);
    notifyInject();
    storage.set({ [STORAGE_KEY]: enabled });
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
