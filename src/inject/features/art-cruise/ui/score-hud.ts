import { FONT_STACK } from "./format";

export type ScoreHudHandle = {
  el: HTMLDivElement;
  scoreValueEl: HTMLSpanElement;
  timeValueEl: HTMLSpanElement;
  hpValueEl: HTMLSpanElement;
  setOrientation: (orientation: "column" | "row") => void;
};

export const createScoreHudPanel = (): ScoreHudHandle => {
  const el = document.createElement("div");
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 8px;
    pointer-events: none;
  `;

  const makePanel = (label: string, initValue: string, valueSize: string) => {
    const panel = document.createElement("div");
    panel.style.cssText = `
      background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.92));
      border: 1px solid rgba(103,232,249,0.82);
      border-bottom-color: rgba(244,114,182,0.36);
      border-radius: 6px;
      box-shadow: 0 0 14px rgba(34,211,238,0.28), inset 0 0 10px rgba(14,165,233,0.14);
      padding: 5px 10px 7px;
      color: #e0faff;
      font-family: ${FONT_STACK};
      line-height: 1;
    `;

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.cssText = `
      display: block;
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 1.2px;
      opacity: 0.72;
      margin-bottom: 3px;
    `;

    const valueEl = document.createElement("span");
    valueEl.textContent = initValue;
    valueEl.style.cssText = `
      display: block;
      font-size: ${valueSize};
      font-weight: 900;
      letter-spacing: 1px;
    `;

    panel.append(labelEl, valueEl);
    return { panel, valueEl };
  };

  const { panel: scorePanel, valueEl: scoreValueEl } = makePanel(
    "SCORE",
    "00000000",
    "20px",
  );
  const { panel: timePanel, valueEl: timeValueEl } = makePanel(
    "TIME",
    "00:00",
    "20px",
  );
  const { panel: hpPanel, valueEl: hpValueEl } = makePanel(
    "LIFE",
    "♥♥♥♥♥",
    "18px",
  );

  el.append(scorePanel, timePanel, hpPanel);

  // 縦長端末ではパネルが画面外へ見切れるため、横並び（上部表示）へ切り替える。
  const setOrientation = (orientation: "column" | "row") => {
    el.style.flexDirection = orientation;
    const compact = orientation === "row";
    scorePanel.style.flex = compact ? "1" : "";
    timePanel.style.flex = compact ? "1" : "";
    hpPanel.style.flex = compact ? "1" : "";
    scoreValueEl.style.fontSize = compact ? "15px" : "20px";
    timeValueEl.style.fontSize = compact ? "15px" : "20px";
    hpValueEl.style.fontSize = compact ? "14px" : "18px";
  };

  return { el, scoreValueEl, timeValueEl, hpValueEl, setOrientation };
};
