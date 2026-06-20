import { FONT_STACK } from "./format";

export type ScoreHudHandle = {
  el: HTMLDivElement;
  scoreValueEl: HTMLSpanElement;
  highScoreValueEl: HTMLSpanElement;
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

  const makeRow = (
    label: string,
    initValue: string,
    valueSize: string,
    accent = false,
  ) => {
    const row = document.createElement("div");
    row.style.cssText = `
      display: grid;
      grid-template-columns: 58px minmax(74px, 1fr);
      align-items: baseline;
      gap: 8px;
      line-height: 1;
    `;

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 9px;
      font-weight: 900;
      letter-spacing: 0.7px;
      color: ${accent ? "rgba(148,163,184,0.82)" : "rgba(224,250,255,0.72)"};
      white-space: nowrap;
      text-shadow: 0 0 8px rgba(2,6,23,0.9);
    `;

    const valueEl = document.createElement("span");
    valueEl.textContent = initValue;
    valueEl.style.cssText = `
      display: block;
      min-width: 74px;
      text-align: right;
      font-size: ${valueSize};
      font-weight: 900;
      letter-spacing: 0.7px;
      font-variant-numeric: tabular-nums;
      color: ${accent ? "rgba(148,163,184,0.9)" : "#e0faff"};
      white-space: nowrap;
      text-shadow: 0 0 8px rgba(2,6,23,0.95);
    `;

    row.append(labelEl, valueEl);
    return { row, labelEl, valueEl };
  };

  const makePanel = (rows: HTMLDivElement[]) => {
    const panel = document.createElement("div");
    panel.style.cssText = `
      padding: 0 2px;
      color: #e0faff;
      font-family: ${FONT_STACK};
      display: grid;
      gap: 4px;
    `;

    panel.append(...rows);
    return panel;
  };

  const {
    row: scoreRow,
    labelEl: scoreLabelEl,
    valueEl: scoreValueEl,
  } = makeRow("SCORE", "00000000", "18px");
  const {
    row: highScoreRow,
    labelEl: highScoreLabelEl,
    valueEl: highScoreValueEl,
  } = makeRow("HI SCORE", "00000000", "18px", true);
  const scorePanel = makePanel([scoreRow, highScoreRow]);

  const { row: timeRow, labelEl: timeLabelEl, valueEl: timeValueEl } = makeRow(
    "TIME",
    "00:00",
    "18px",
  );
  const timePanel = makePanel([timeRow]);

  const { row: hpRow, labelEl: hpLabelEl, valueEl: hpValueEl } = makeRow(
    "LIFE",
    "♥♥♥♥♥",
    "16px",
  );
  const hpPanel = makePanel([hpRow]);

  el.append(scorePanel, timePanel, hpPanel);

  // 縦長端末ではパネルが画面外へ見切れるため、横並び（上部表示）へ切り替える。
  const setOrientation = (orientation: "column" | "row") => {
    el.style.flexDirection = orientation;
    const compact = orientation === "row";
    el.style.gap = compact ? "4px" : "6px";
    el.style.marginBottom = compact ? "0" : "8px";
    scorePanel.style.flex = compact ? "1 1 auto" : "";
    timePanel.style.flex = compact ? "0 0 auto" : "";
    hpPanel.style.flex = compact ? "0 0 auto" : "";
    scorePanel.style.gap = compact ? "2px" : "4px";
    timePanel.style.gap = compact ? "2px" : "4px";
    hpPanel.style.gap = compact ? "2px" : "4px";
    const grid = compact
      ? "minmax(30px, auto) minmax(0, auto)"
      : "58px minmax(74px, 1fr)";
    scoreRow.style.gridTemplateColumns = compact
      ? "44px minmax(62px, auto)"
      : grid;
    highScoreRow.style.gridTemplateColumns = compact
      ? "50px minmax(62px, auto)"
      : grid;
    timeRow.style.gridTemplateColumns = grid;
    hpRow.style.gridTemplateColumns = grid;
    for (const row of [scoreRow, highScoreRow, timeRow, hpRow])
      row.style.gap = compact ? "4px" : "8px";
    for (const label of [scoreLabelEl, highScoreLabelEl, timeLabelEl, hpLabelEl])
      label.style.fontSize = compact ? "8px" : "9px";
    scoreValueEl.style.minWidth = compact ? "62px" : "74px";
    highScoreValueEl.style.minWidth = compact ? "62px" : "74px";
    timeValueEl.style.minWidth = compact ? "38px" : "74px";
    hpValueEl.style.minWidth = compact ? "44px" : "74px";
    scoreValueEl.style.fontSize = compact ? "14px" : "18px";
    highScoreValueEl.style.fontSize = compact ? "14px" : "18px";
    timeValueEl.style.fontSize = compact ? "14px" : "18px";
    hpValueEl.style.fontSize = compact ? "13px" : "16px";
  };

  return {
    el,
    scoreValueEl,
    highScoreValueEl,
    timeValueEl,
    hpValueEl,
    setOrientation,
  };
};
