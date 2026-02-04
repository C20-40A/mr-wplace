import { t } from "@/i18n/manager";

export interface TransparencyDialogCallbacks {
  onCanvasClick: (x: number, y: number) => void;
  onThresholdChange: (value: number) => void;
  onApply: () => void;
  onReset: () => void;
  onClose: () => void;
}

export class TransparencyDialog {
  private overlay: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private thresholdSlider: HTMLInputElement | null = null;
  private thresholdValue: HTMLElement | null = null;
  private callbacks: TransparencyDialogCallbacks;
  private sourceImage: HTMLImageElement | HTMLCanvasElement | null = null;
  private mountRoot: HTMLElement = document.body;

  constructor(callbacks: TransparencyDialogCallbacks) {
    this.callbacks = callbacks;
  }

  open(
    image: HTMLImageElement | HTMLCanvasElement | null,
    mountRoot: HTMLElement = document.body,
  ): void {
    if (this.overlay) return;
    this.sourceImage = image;
    this.mountRoot = mountRoot;
    this.createDialog();
    if (image) this.drawPreview(image);
  }

  close(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    this.canvas = null;
    this.ctx = null;
    this.thresholdSlider = null;
    this.thresholdValue = null;
    this.sourceImage = null;
  }

  updatePreview(image: HTMLImageElement | HTMLCanvasElement): void {
    this.sourceImage = image;
    if (this.canvas && this.ctx) this.drawPreview(image);
  }

  private createDialog(): void {
    const overlay = document.createElement("div");
    overlay.id = "wps-transparency-overlay";
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        this.close();
        this.callbacks.onClose();
      }
    });

    const dialog = document.createElement("div");
    dialog.id = "wps-transparency-dialog";

    // Header
    const header = document.createElement("div");
    header.className = "wps-td-header";

    const title = document.createElement("div");
    title.className = "wps-td-title";
    title.textContent = t("transparency_tool");

    const closeBtn = document.createElement("button");
    closeBtn.className = "wps-td-close";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", () => {
      this.close();
      this.callbacks.onClose();
    });

    header.append(title, closeBtn);

    // Mode label
    const modeLabel = document.createElement("div");
    modeLabel.className = "wps-td-mode-label";
    modeLabel.textContent = t("transparency_flood_fill");

    const modeDesc = document.createElement("div");
    modeDesc.className = "wps-td-mode-desc";
    modeDesc.textContent = t("transparency_flood_fill_desc");

    // Canvas preview area
    const canvasWrap = document.createElement("div");
    canvasWrap.id = "wps-td-canvas-wrap";

    if (this.sourceImage) {
      const canvas = document.createElement("canvas");
      canvas.id = "wps-td-canvas";
      canvas.style.cssText = "image-rendering: pixelated; cursor: crosshair;";
      canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d", { willReadFrequently: true });
      canvasWrap.appendChild(canvas);
    } else {
      const noImage = document.createElement("div");
      noImage.className = "wps-td-no-image";
      noImage.textContent = t("transparency_no_image");
      canvasWrap.appendChild(noImage);
    }

    // Threshold control
    const thresholdGroup = document.createElement("div");
    thresholdGroup.className = "wps-td-control-group";

    const thresholdLabel = document.createElement("label");
    thresholdLabel.className = "wps-td-label";
    thresholdLabel.textContent = t("transparency_threshold");

    const thresholdRow = document.createElement("div");
    thresholdRow.className = "wps-td-slider-row";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.id = "wps-td-threshold";
    slider.min = "-20";
    slider.max = "20";
    slider.value = "0";
    slider.className = "range range-xs";
    slider.addEventListener("input", () => {
      if (this.thresholdValue) {
        const numeric = parseInt(slider.value);
        this.thresholdValue.textContent = numeric > 0 ? `+${numeric}` : `${numeric}`;
      }
    });
    slider.addEventListener("change", () => {
      this.callbacks.onThresholdChange(parseInt(slider.value));
    });
    this.thresholdSlider = slider;

    const valSpan = document.createElement("span");
    valSpan.className = "wps-td-value";
    valSpan.textContent = "0";
    this.thresholdValue = valSpan;

    thresholdRow.append(slider, valSpan);
    thresholdGroup.append(thresholdLabel, thresholdRow);

    // Action buttons
    const actions = document.createElement("div");
    actions.className = "wps-td-actions";

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn btn-sm";
    resetBtn.textContent = t("transparency_reset");
    resetBtn.addEventListener("click", () => this.callbacks.onReset());

    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-sm btn-primary";
    applyBtn.textContent = t("transparency_apply");
    applyBtn.addEventListener("click", () => this.callbacks.onApply());

    actions.append(resetBtn, applyBtn);

    dialog.append(header, modeLabel, modeDesc, canvasWrap, thresholdGroup, actions);
    overlay.appendChild(dialog);
    this.mountRoot.appendChild(overlay);
    this.overlay = overlay;
  }

  private drawPreview(image: HTMLImageElement | HTMLCanvasElement): void {
    if (!this.canvas || !this.ctx) return;

    const w = image instanceof HTMLCanvasElement ? image.width : image.naturalWidth;
    const h = image instanceof HTMLCanvasElement ? image.height : image.naturalHeight;
    if (!w || !h) return;

    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(image, 0, 0);
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x >= 0 && y >= 0 && x < this.canvas.width && y < this.canvas.height) {
      this.callbacks.onCanvasClick(x, y);
    }
  }
}
