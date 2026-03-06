import { t } from "@/i18n/manager";
import { ColorPalette } from "@/components/color-palette";
import type {
  ColorFlattenMode,
  DitheringMethod,
  QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";

// --- Constants ---

export const PROCESSING_DEBOUNCE_MS = 200;
export const PREVIEW_UPDATE_MS = 160;

const OVERLAY_Z_INDEX = 2001;

// --- Types ---

export type PanelType = "palette" | "adjust";

export type ProcessingState = {
  brightness: number;
  contrast: number;
  saturation: number;
  ditheringEnabled: boolean;
  ditheringThreshold: number;
  ditheringMethod: DitheringMethod;
  quantizationMethod: QuantizationMethod;
  colorFlattenMode: ColorFlattenMode;
  outlineEnabled: boolean;
  outlineThreshold: number;
  outlineWidth: number;
  outlineUseFixedColor: boolean;
  outlineFixedColor: string;
  selectedColorIds: number[];
};

// --- Styles ---

const STYLES = {
  toolButtonBar: `
    position: fixed;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    pointer-events: auto;
    z-index: ${OVERLAY_Z_INDEX + 2};
  `,
  toolButton: `
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  toolButtonActive: `
    border-radius: 999px;
    background: rgba(37, 99, 235, 0.9);
    color: #fff;
    font-size: 13px;
    line-height: 1;
    padding: 0.3rem 0.55rem;
    border: none;
    cursor: pointer;
    pointer-events: auto;
    transition: background 0.15s;
  `,
  floatingPanel: `
    position: fixed;
    background: var(--color-base-100, #fff);
    border-radius: 0.75rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    padding: 0.75rem;
    pointer-events: auto;
    z-index: ${OVERLAY_Z_INDEX + 3};
    max-height: 70vh;
    overflow-y: auto;
    min-width: 280px;
    max-width: 340px;
  `,
} as const;

// --- CSS injection ---

export const injectPanelStyles = (): void => {
  const styleId = "mr-wplace-adjust-tool-styles";
  if (document.getElementById(styleId)) return;
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    .iat-panel-section { margin-bottom: 0.5rem; }
    .iat-panel-section:last-child { margin-bottom: 0; }
    .iat-slider-row {
      display: flex; align-items: center; gap: 0.4rem;
    }
    .iat-slider-row input[type="range"] { flex: 1; min-width: 0; }
    .iat-slider-label {
      font-size: 0.75rem; font-weight: 500; margin-bottom: 0.2rem;
      display: flex; justify-content: space-between; align-items: center;
    }
    .iat-slider-value { font-size: 0.7rem; color: #9ca3af; }
    .iat-hint { font-size: 0.65rem; color: #9ca3af; }
    .iat-checkbox-row {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.75rem; cursor: pointer;
    }
    .iat-select { font-size: 0.72rem; padding: 0.2rem 0.4rem; border-radius: 0.25rem; border: 1px solid #d1d5db; }
    .iat-select-row { display: flex; gap: 0.35rem; align-items: center; }
    .iat-select-row select { flex: 1; min-width: 0; }
    .iat-outline-params {
      display: flex; align-items: center; gap: 0.35rem; margin-top: 0.25rem;
    }
    .iat-outline-params .iat-slider-row { flex: 1; }
  `;
  document.head.appendChild(style);
};

// --- Panel manager ---

export class PanelManager {
  private activePanel: PanelType | null = null;
  private floatingPanel: HTMLDivElement | null = null;
  private colorPalette: ColorPalette | null = null;

  constructor(
    private readonly overlay: HTMLDivElement,
    private readonly toolButtonBar: HTMLDivElement,
    private readonly paletteButton: HTMLButtonElement,
    private readonly adjustButton: HTMLButtonElement,
    private readonly state: ProcessingState,
    private readonly onStateChange: () => void,
  ) {}

  toggle(panel: PanelType): void {
    if (this.activePanel === panel) {
      this.close();
      return;
    }
    this.open(panel);
  }

  close(): void {
    this.colorPalette?.destroy();
    this.colorPalette = null;
    this.floatingPanel?.remove();
    this.floatingPanel = null;
    this.activePanel = null;
    this.paletteButton.style.cssText = STYLES.toolButton;
    this.adjustButton.style.cssText = STYLES.toolButton;
  }

  destroy(): void {
    this.close();
  }

  private open(panel: PanelType): void {
    this.close();
    this.activePanel = panel;

    const floatingPanel = document.createElement("div");
    floatingPanel.style.cssText = STYLES.floatingPanel;
    floatingPanel.id = "iat-floating-panel";

    if (panel === "palette") {
      this.buildPalettePanel(floatingPanel);
      this.paletteButton.style.cssText = STYLES.toolButtonActive;
    } else {
      this.buildAdjustPanel(floatingPanel);
      this.adjustButton.style.cssText = STYLES.toolButtonActive;
    }

    this.overlay.appendChild(floatingPanel);
    this.floatingPanel = floatingPanel;
    this.positionPanel();
  }

  private positionPanel(): void {
    if (!this.floatingPanel) return;
    const barRect = this.toolButtonBar.getBoundingClientRect();
    this.floatingPanel.style.left = `${barRect.left}px`;
    this.floatingPanel.style.top = `${barRect.top - 8}px`;
    this.floatingPanel.style.transform = "translateY(-100%)";
  }

  private buildPalettePanel(container: HTMLDivElement): void {
    const paletteContainer = document.createElement("div");
    paletteContainer.style.cssText = "min-height: 100px;";
    container.appendChild(paletteContainer);

    this.colorPalette = new ColorPalette(paletteContainer, {
      selectedColorIds: this.state.selectedColorIds,
      onChange: (colorIds) => {
        this.state.selectedColorIds = colorIds;
        this.onStateChange();
      },
      hasExtraColorsBitmap: true,
      showDisableUnusedButton: true,
      controlSize: "xs",
      sortOrder: "least-remaining",
    });
  }

  private buildAdjustPanel(container: HTMLDivElement): void {
    container.appendChild(
      createSliderSection(t("brightness"), this.state.brightness, -100, 100, 1, (v) => {
        this.state.brightness = v;
        this.onStateChange();
      }),
    );
    container.appendChild(
      createSliderSection(t("contrast"), this.state.contrast, -100, 100, 1, (v) => {
        this.state.contrast = v;
        this.onStateChange();
      }),
    );
    container.appendChild(
      createSliderSection(t("saturation"), this.state.saturation, -100, 100, 1, (v) => {
        this.state.saturation = v;
        this.onStateChange();
      }),
    );

    // Quantization + color flatten
    const selectSection = document.createElement("div");
    selectSection.className = "iat-panel-section";
    const selectRow = document.createElement("div");
    selectRow.className = "iat-select-row";
    const qSelect = createSelect(
      [
        { value: "rgb-euclidean", label: t("quantization_rgb_euclidean") },
        { value: "weighted-rgb", label: t("quantization_weighted_rgb") },
        { value: "lab", label: t("quantization_lab") },
        { value: "oklab", label: t("quantization_oklab") },
      ],
      this.state.quantizationMethod,
      (v) => {
        this.state.quantizationMethod = v as QuantizationMethod;
        this.onStateChange();
      },
    );
    const cfSelect = createSelect(
      [
        { value: "none", label: t("color_flatten_none") },
        { value: "light", label: t("color_flatten_light") },
        { value: "medium", label: t("color_flatten_medium") },
      ],
      this.state.colorFlattenMode,
      (v) => {
        this.state.colorFlattenMode = v as ColorFlattenMode;
        this.onStateChange();
      },
    );
    selectRow.append(qSelect, cfSelect);
    selectSection.appendChild(selectRow);
    container.appendChild(selectSection);

    // Dithering
    const ditherSection = document.createElement("div");
    ditherSection.className = "iat-panel-section";
    const ditherRow = document.createElement("div");
    ditherRow.className = "iat-checkbox-row";
    const ditherCb = document.createElement("input");
    ditherCb.type = "checkbox";
    ditherCb.className = "checkbox checkbox-sm";
    ditherCb.checked = this.state.ditheringEnabled;

    const ditherMethodSelect = createSelect(
      [
        { value: "ordered", label: "Ordered" },
        { value: "floyd-steinberg", label: "Floyd" },
      ],
      this.state.ditheringMethod,
      (v) => {
        this.state.ditheringMethod = v as DitheringMethod;
        this.onStateChange();
      },
    );
    ditherMethodSelect.disabled = !this.state.ditheringEnabled;
    ditherMethodSelect.style.width = "5rem";

    const ditherThresholdSlider = createRangeInput(
      this.state.ditheringThreshold,
      0,
      1500,
      50,
      !this.state.ditheringEnabled,
      (v) => {
        this.state.ditheringThreshold = v;
        this.onStateChange();
      },
    );

    ditherCb.addEventListener("change", () => {
      this.state.ditheringEnabled = ditherCb.checked;
      ditherMethodSelect.disabled = !ditherCb.checked;
      ditherThresholdSlider.disabled = !ditherCb.checked;
      this.onStateChange();
    });

    ditherRow.append(ditherCb, document.createTextNode(t("dithering")), ditherMethodSelect);
    ditherSection.appendChild(ditherRow);

    const ditherSliderRow = document.createElement("div");
    ditherSliderRow.className = "iat-slider-row";
    const ditherHintL = document.createElement("span");
    ditherHintL.className = "iat-hint";
    ditherHintL.textContent = "0";
    const ditherHintR = document.createElement("span");
    ditherHintR.className = "iat-hint";
    ditherHintR.textContent = "1500";
    ditherSliderRow.append(ditherHintL, ditherThresholdSlider, ditherHintR);
    ditherSection.appendChild(ditherSliderRow);
    container.appendChild(ditherSection);

    // Outline
    const outlineSection = document.createElement("div");
    outlineSection.className = "iat-panel-section";
    const outlineRow = document.createElement("div");
    outlineRow.className = "iat-checkbox-row";
    const outlineCb = document.createElement("input");
    outlineCb.type = "checkbox";
    outlineCb.className = "checkbox checkbox-sm";
    outlineCb.checked = this.state.outlineEnabled;

    const outlineColorCb = document.createElement("input");
    outlineColorCb.type = "checkbox";
    outlineColorCb.className = "checkbox checkbox-sm";
    outlineColorCb.checked = this.state.outlineUseFixedColor;
    outlineColorCb.disabled = !this.state.outlineEnabled;

    const outlineColorInput = document.createElement("input");
    outlineColorInput.type = "color";
    outlineColorInput.value = this.state.outlineFixedColor;
    outlineColorInput.style.cssText = "width: 1.5rem; height: 1.2rem; padding: 0; border: none;";
    outlineColorInput.disabled = !this.state.outlineEnabled || !this.state.outlineUseFixedColor;

    const thresholdSlider = createRangeInput(
      this.state.outlineThreshold,
      0,
      200,
      1,
      !this.state.outlineEnabled,
      (v) => {
        this.state.outlineThreshold = v;
        this.onStateChange();
      },
    );
    const widthSlider = createRangeInput(
      this.state.outlineWidth,
      1,
      4,
      1,
      !this.state.outlineEnabled,
      (v) => {
        this.state.outlineWidth = v;
        this.onStateChange();
      },
    );

    outlineCb.addEventListener("change", () => {
      this.state.outlineEnabled = outlineCb.checked;
      thresholdSlider.disabled = !outlineCb.checked;
      widthSlider.disabled = !outlineCb.checked;
      outlineColorCb.disabled = !outlineCb.checked;
      outlineColorInput.disabled = !outlineCb.checked || !outlineColorCb.checked;
      this.onStateChange();
    });

    outlineColorCb.addEventListener("change", () => {
      this.state.outlineUseFixedColor = outlineColorCb.checked;
      outlineColorInput.disabled = !outlineColorCb.checked;
      this.onStateChange();
    });

    outlineColorInput.addEventListener("change", () => {
      if (!/^#[0-9a-f]{6}$/i.test(outlineColorInput.value)) return;
      this.state.outlineFixedColor = outlineColorInput.value;
      this.onStateChange();
    });

    outlineRow.append(
      outlineCb,
      document.createTextNode(t("outline_preserve")),
      outlineColorCb,
      outlineColorInput,
    );
    outlineSection.appendChild(outlineRow);

    const outlineParams = document.createElement("div");
    outlineParams.className = "iat-outline-params";
    const sensRow = document.createElement("div");
    sensRow.className = "iat-slider-row";
    const sensLabel = document.createElement("span");
    sensLabel.className = "iat-hint";
    sensLabel.textContent = t("outline_sensitivity");
    sensRow.append(sensLabel, thresholdSlider);
    const wRow = document.createElement("div");
    wRow.className = "iat-slider-row";
    const wLabel = document.createElement("span");
    wLabel.className = "iat-hint";
    wLabel.textContent = t("outline_width");
    wRow.append(wLabel, widthSlider);
    outlineParams.append(sensRow, wRow);
    outlineSection.appendChild(outlineParams);
    container.appendChild(outlineSection);
  }
}

// --- Tool button bar ---

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

// --- UI helpers (panel-local) ---

const createSliderSection = (
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

const createRangeInput = (
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

const createSelect = (
  options: { value: string; label: string }[],
  currentValue: string,
  onChange: (v: string) => void,
): HTMLSelectElement => {
  const select = document.createElement("select");
  select.className = "iat-select";
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
