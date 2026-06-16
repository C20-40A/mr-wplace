import { FONT_STACK } from "./format";

export type BossHudElements = {
  el: HTMLDivElement;
  nameEl: HTMLSpanElement;
  phasePipsEl: HTMLDivElement;
  barFillEl: HTMLDivElement;
};

/**
 * 東方風ボスHPゲージ（赤）。playエリア外の画面上部に表示する想定。
 * 残フェーズ数を pips で、現フェーズのHPを赤ゲージで表現する。
 */
export const createBossHud = (): BossHudElements => {
  const el = document.createElement("div");
  el.style.cssText = `
    position: fixed;
    z-index: 1004;
    display: none;
    flex-direction: column;
    gap: 4px;
    pointer-events: none;
    font-family: ${FONT_STACK};
  `;

  const topRow = document.createElement("div");
  topRow.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  `;

  const nameEl = document.createElement("span");
  nameEl.style.cssText = `
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 1.2px;
    color: #ffe4ec;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `;

  const phasePipsEl = document.createElement("div");
  phasePipsEl.style.cssText = `
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  `;

  topRow.append(nameEl, phasePipsEl);

  const barTrack = document.createElement("div");
  barTrack.style.cssText = `
    position: relative;
    height: 10px;
    border-radius: 5px;
    border: 1px solid rgba(244,63,94,0.85);
    background: linear-gradient(180deg, rgba(40,8,12,0.92), rgba(12,2,4,0.92));
    box-shadow:
      0 0 12px rgba(244,63,94,0.45),
      inset 0 0 8px rgba(0,0,0,0.6);
    overflow: hidden;
  `;

  const barFillEl = document.createElement("div");
  barFillEl.style.cssText = `
    position: absolute;
    inset: 0;
    transform-origin: left center;
    transform: scaleX(1);
    background:
      linear-gradient(180deg, rgba(254,205,211,0.9) 0%, rgba(244,63,94,0.95) 35%, rgba(190,18,60,0.98) 100%);
    box-shadow: 0 0 10px rgba(244,63,94,0.85);
    transition: transform 0.12s ease-out;
  `;

  barTrack.appendChild(barFillEl);
  el.append(topRow, barTrack);

  return { el, nameEl, phasePipsEl, barFillEl };
};
