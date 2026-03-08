import { t } from "@/i18n/manager";
import { ColorPalette } from "@/components/color-palette";
import type {
  ColorFlattenMode,
  DitheringMethod,
  QuantizationMethod,
} from "@/features/gallery/routes/image-editor/canvas-processor";
import { STYLES, PANEL_VIEWPORT_MARGIN_PX } from "./styles";
import { createSliderSection, createRangeInput, createSelect } from "./ui-helpers";

export { injectPanelStyles } from "./styles";
export { createToolButtonBar } from "./ui-helpers";

// --- Constants ---

export const PROCESSING_DEBOUNCE_MS = 200;
export const PREVIEW_UPDATE_MS = 160;

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

// --- Panel manager ---

export class PanelManager {
  private activePanel: PanelType | null = null;
  private floatingPanel: HTMLDivElement | null = null;
  private colorPalette: ColorPalette | null = null;
  private panelPosition: { left: number; top: number } | null = null;
  private draggingPointerId: number | null = null;
  private dragOffset = { x: 0, y: 0 };
  private cachedColorStats: Record<string, { matched: number; total: number }> | null = null;

  constructor(
    private readonly overlay: HTMLDivElement,
    private readonly toolButtonBar: HTMLDivElement,
    private readonly paletteButton: HTMLButtonElement,
    private readonly adjustButton: HTMLButtonElement,
    private readonly state: ProcessingState,
    private readonly onStateChange: () => void,
  ) {
    window.addEventListener("resize", this.onWindowResize, { passive: true });
  }

  toggle(panel: PanelType): void {
    if (this.activePanel === panel) {
      this.close();
      return;
    }
    this.open(panel);
  }

  close(): void {
    if (this.floatingPanel) {
      this.floatingPanel.removeEventListener("pointermove", this.onPanelPointerMove);
      this.floatingPanel.removeEventListener("pointerup", this.onPanelPointerUp);
      this.floatingPanel.removeEventListener("pointercancel", this.onPanelPointerUp);
    }
    this.draggingPointerId = null;
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
    window.removeEventListener("resize", this.onWindowResize);
  }

  updateColorStats(colorStats: Record<string, { matched: number; total: number }>): void {
    this.cachedColorStats = colorStats;
    this.colorPalette?.updateColorStats(colorStats);
  }

  private open(panel: PanelType): void {
    this.close();
    this.activePanel = panel;

    const floatingPanel = document.createElement("div");
    floatingPanel.style.cssText = STYLES.floatingPanel;
    floatingPanel.id = "iat-floating-panel";
    const panelBody = document.createElement("div");
    panelBody.className = "iat-floating-panel-body";
    this.attachPanelHeader(
      floatingPanel,
      panel === "palette" ? "Color Palette" : `${t("contrast")} / ${t("brightness")}`,
    );

    if (panel === "palette") {
      this.buildPalettePanel(panelBody);
      this.paletteButton.style.cssText = STYLES.toolButtonActive;
    } else {
      this.buildAdjustPanel(panelBody);
      this.adjustButton.style.cssText = STYLES.toolButtonActive;
    }

    floatingPanel.appendChild(panelBody);
    this.overlay.appendChild(floatingPanel);
    this.floatingPanel = floatingPanel;
    this.positionPanel();
  }

  private positionPanel(): void {
    if (!this.floatingPanel) return;
    const nextPosition = this.panelPosition ?? this.getDefaultPanelPosition();
    this.applyPanelPosition(nextPosition.left, nextPosition.top);
  }

  private attachPanelHeader(container: HTMLDivElement, title: string): void {
    const header = document.createElement("div");
    header.className = "iat-floating-panel-header";

    const titleEl = document.createElement("div");
    titleEl.className = "iat-floating-panel-title";
    titleEl.textContent = title;

    const closeButton = document.createElement("button");
    closeButton.className = "iat-floating-panel-close";
    closeButton.type = "button";
    closeButton.title = t("close");
    closeButton.textContent = "✕";
    closeButton.addEventListener("click", () => this.close());

    header.append(titleEl, closeButton);
    header.addEventListener("pointerdown", this.onHeaderPointerDown);
    container.appendChild(header);
  }

  private getDefaultPanelPosition(): { left: number; top: number } {
    const barRect = this.toolButtonBar.getBoundingClientRect();
    const panelRect = this.floatingPanel?.getBoundingClientRect();
    const panelHeight = panelRect?.height ?? 0;
    return {
      left: barRect.left,
      top: barRect.top - panelHeight - 8,
    };
  }

  private clampPanelPosition(left: number, top: number): { left: number; top: number } {
    const panelRect = this.floatingPanel?.getBoundingClientRect();
    const panelWidth = panelRect?.width ?? 0;
    const panelHeight = panelRect?.height ?? 0;
    const m = PANEL_VIEWPORT_MARGIN_PX;
    const maxLeft = Math.max(m, window.innerWidth - panelWidth - m);
    const maxTop = Math.max(m, window.innerHeight - panelHeight - m);
    return {
      left: Math.min(Math.max(m, left), maxLeft),
      top: Math.min(Math.max(m, top), maxTop),
    };
  }

  private applyPanelPosition(left: number, top: number): void {
    if (!this.floatingPanel) return;
    const next = this.clampPanelPosition(left, top);
    this.panelPosition = next;
    this.floatingPanel.style.left = `${next.left}px`;
    this.floatingPanel.style.top = `${next.top}px`;
  }

  private readonly onHeaderPointerDown = (event: PointerEvent): void => {
    if (!this.floatingPanel) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("button")) return;
    const rect = this.floatingPanel.getBoundingClientRect();
    this.draggingPointerId = event.pointerId;
    this.dragOffset = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    this.floatingPanel.setPointerCapture(event.pointerId);
    this.floatingPanel.addEventListener("pointermove", this.onPanelPointerMove);
    this.floatingPanel.addEventListener("pointerup", this.onPanelPointerUp);
    this.floatingPanel.addEventListener("pointercancel", this.onPanelPointerUp);
    event.preventDefault();
  };

  private readonly onPanelPointerMove = (event: PointerEvent): void => {
    if (!this.floatingPanel || this.draggingPointerId !== event.pointerId) return;
    this.applyPanelPosition(
      event.clientX - this.dragOffset.x,
      event.clientY - this.dragOffset.y,
    );
  };

  private readonly onPanelPointerUp = (event: PointerEvent): void => {
    if (!this.floatingPanel || this.draggingPointerId !== event.pointerId) return;
    this.draggingPointerId = null;
    this.floatingPanel.releasePointerCapture(event.pointerId);
    this.floatingPanel.removeEventListener("pointermove", this.onPanelPointerMove);
    this.floatingPanel.removeEventListener("pointerup", this.onPanelPointerUp);
    this.floatingPanel.removeEventListener("pointercancel", this.onPanelPointerUp);
  };

  private readonly onWindowResize = (): void => {
    this.positionPanel();
  };

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
      showColorStats: true,
      colorStats: this.cachedColorStats ?? undefined,
      colorStatsTotalOnly: true,
      showDisableUnusedButton: true,
      controlSize: "xs",
      sortOrder: "least-remaining",
    });
  }

  private buildAdjustPanel(container: HTMLDivElement): void {
    const s = this.state;
    const onChange = this.onStateChange;

    container.appendChild(
      createSliderSection(t("brightness"), s.brightness, -100, 100, 1, (v) => { s.brightness = v; onChange(); }),
    );
    container.appendChild(
      createSliderSection(t("contrast"), s.contrast, -100, 100, 1, (v) => { s.contrast = v; onChange(); }),
    );
    container.appendChild(
      createSliderSection(t("saturation"), s.saturation, -100, 100, 1, (v) => { s.saturation = v; onChange(); }),
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
      s.quantizationMethod,
      (v) => { s.quantizationMethod = v as QuantizationMethod; onChange(); },
    );
    const cfSelect = createSelect(
      [
        { value: "none", label: t("color_flatten_none") },
        { value: "light", label: t("color_flatten_light") },
        { value: "medium", label: t("color_flatten_medium") },
      ],
      s.colorFlattenMode,
      (v) => { s.colorFlattenMode = v as ColorFlattenMode; onChange(); },
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
    ditherCb.checked = s.ditheringEnabled;

    const ditherMethodSelect = createSelect(
      [
        { value: "ordered", label: "Ordered" },
        { value: "floyd-steinberg", label: "Floyd" },
      ],
      s.ditheringMethod,
      (v) => { s.ditheringMethod = v as DitheringMethod; onChange(); },
    );
    ditherMethodSelect.disabled = !s.ditheringEnabled;
    ditherMethodSelect.style.width = "5rem";

    const ditherThresholdSlider = createRangeInput(s.ditheringThreshold, 0, 1500, 50, !s.ditheringEnabled, (v) => {
      s.ditheringThreshold = v;
      onChange();
    });

    ditherCb.addEventListener("change", () => {
      s.ditheringEnabled = ditherCb.checked;
      ditherMethodSelect.disabled = !ditherCb.checked;
      ditherThresholdSlider.disabled = !ditherCb.checked;
      onChange();
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
    outlineCb.checked = s.outlineEnabled;

    const outlineColorCb = document.createElement("input");
    outlineColorCb.type = "checkbox";
    outlineColorCb.className = "checkbox checkbox-sm";
    outlineColorCb.checked = s.outlineUseFixedColor;
    outlineColorCb.disabled = !s.outlineEnabled;

    const outlineColorInput = document.createElement("input");
    outlineColorInput.type = "color";
    outlineColorInput.value = s.outlineFixedColor;
    outlineColorInput.style.cssText = "width: 1.5rem; height: 1.2rem; padding: 0; border: none;";
    outlineColorInput.disabled = !s.outlineEnabled || !s.outlineUseFixedColor;

    const thresholdSlider = createRangeInput(s.outlineThreshold, 0, 200, 1, !s.outlineEnabled, (v) => {
      s.outlineThreshold = v;
      onChange();
    });
    const widthSlider = createRangeInput(s.outlineWidth, 1, 4, 1, !s.outlineEnabled, (v) => {
      s.outlineWidth = v;
      onChange();
    });

    outlineCb.addEventListener("change", () => {
      s.outlineEnabled = outlineCb.checked;
      thresholdSlider.disabled = !outlineCb.checked;
      widthSlider.disabled = !outlineCb.checked;
      outlineColorCb.disabled = !outlineCb.checked;
      outlineColorInput.disabled = !outlineCb.checked || !outlineColorCb.checked;
      onChange();
    });

    outlineColorCb.addEventListener("change", () => {
      s.outlineUseFixedColor = outlineColorCb.checked;
      outlineColorInput.disabled = !outlineColorCb.checked;
      onChange();
    });

    outlineColorInput.addEventListener("change", () => {
      if (!/^#[0-9a-f]{6}$/i.test(outlineColorInput.value)) return;
      s.outlineFixedColor = outlineColorInput.value;
      onChange();
    });

    outlineRow.append(outlineCb, document.createTextNode(t("outline_preserve")), outlineColorCb, outlineColorInput);
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
