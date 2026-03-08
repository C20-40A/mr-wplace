import { STYLES } from "./styles";

export const createRangeInput = (
  value: number,
  min: number,
  max: number,
  step: number,
  disabled: boolean,
  onChange: (v: number) => void,
): HTMLInputElement => {
  const input = document.createElement("input");
  input.type = "range";
  input.className = "range range-xs";
  input.min = `${min}`;
  input.max = `${max}`;
  input.step = `${step}`;
  input.value = `${value}`;
  input.disabled = disabled;
  input.addEventListener("input", () => onChange(Number(input.value)));
  return input;
};

export const createSliderSection = (
  label: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (v: number) => void,
): HTMLDivElement => {
  const section = document.createElement("div");
  section.className = "iat-panel-section";

  const labelRow = document.createElement("div");
  labelRow.className = "iat-slider-label";
  const labelText = document.createElement("span");
  labelText.textContent = label;
  const valueSpan = document.createElement("span");
  valueSpan.className = "iat-slider-value";
  valueSpan.textContent = `${value}`;
  labelRow.append(labelText, valueSpan);

  const sliderRow = document.createElement("div");
  sliderRow.className = "iat-slider-row";
  const hintL = document.createElement("span");
  hintL.className = "iat-hint";
  hintL.textContent = `${min}`;
  const slider = createRangeInput(value, min, max, step, false, (v) => {
    valueSpan.textContent = `${v}`;
    onChange(v);
  });
  const hintR = document.createElement("span");
  hintR.className = "iat-hint";
  hintR.textContent = `${max}`;
  sliderRow.append(hintL, slider, hintR);

  section.append(labelRow, sliderRow);
  return section;
};

export const createSelect = (
  options: { value: string; label: string }[],
  currentValue: string,
  onChange: (v: string) => void,
): HTMLSelectElement => {
  const select = document.createElement("select");
  select.className = "select select-sm w-full";
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === currentValue) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener("change", () => onChange(select.value));
  return select;
};

export const createToolButtonBar = (options: {
  paletteTitle: string;
  adjustTitle: string;
  onPalette: () => void;
  onAdjust: () => void;
}): { bar: HTMLDivElement; paletteButton: HTMLButtonElement; adjustButton: HTMLButtonElement } => {
  const bar = document.createElement("div");
  bar.style.cssText = STYLES.toolButtonBar;

  const paletteButton = document.createElement("button");
  paletteButton.style.cssText = STYLES.toolButton;
  paletteButton.textContent = "🎨";
  paletteButton.type = "button";
  paletteButton.title = options.paletteTitle;
  paletteButton.addEventListener("click", options.onPalette);

  const adjustButton = document.createElement("button");
  adjustButton.style.cssText = STYLES.toolButton;
  adjustButton.textContent = "⚙️";
  adjustButton.type = "button";
  adjustButton.title = options.adjustTitle;
  adjustButton.addEventListener("click", options.onAdjust);

  bar.append(paletteButton, adjustButton);
  return { bar, paletteButton, adjustButton };
};
