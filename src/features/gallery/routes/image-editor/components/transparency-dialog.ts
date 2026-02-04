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
  private zoom = 1;
  private readonly minZoom = 1;
  private readonly maxZoom = 8;
  private panX = 0;
  private panY = 0;
  private isDragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private dragMoved = false;
  private zoomIndicator: HTMLElement | null = null;
  private resetButton: HTMLButtonElement | null = null;

  constructor(callbacks: TransparencyDialogCallbacks) {
    this.callbacks = callbacks;
  }

  open(
    image: HTMLImageElement | HTMLCanvasElement | null,
    mountRoot: HTMLElement = document.body,
  ): void {
    if (this.overlay) return;
    this.sourceImage = image;
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
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
    this.createCanvasControls(canvasWrap);

    if (this.sourceImage) {
      const canvas = document.createElement("canvas");
      canvas.id = "wps-td-canvas";
      canvas.style.cssText = "image-rendering: pixelated; cursor: crosshair;";
      canvas.addEventListener("click", (e) => this.handleCanvasClick(e));
      canvas.addEventListener("wheel", (e) => this.handleCanvasWheel(e), {
        passive: false,
      });
      canvas.addEventListener("mousedown", (e) => this.handleCanvasMouseDown(e));
      canvas.addEventListener("mouseleave", () => this.handleCanvasMouseLeave());
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
    this.applyCanvasZoom();
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (!this.canvas) return;
    if (this.dragMoved) {
      this.dragMoved = false;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const x = Math.floor((e.clientX - rect.left) * scaleX);
    const y = Math.floor((e.clientY - rect.top) * scaleY);
    if (x >= 0 && y >= 0 && x < this.canvas.width && y < this.canvas.height) {
      this.callbacks.onCanvasClick(x, y);
    }
  }

  private handleCanvasWheel(e: WheelEvent): void {
    if (!this.canvas) return;
    e.preventDefault();

    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    const next = Math.min(this.maxZoom, Math.max(this.minZoom, this.zoom + delta));
    if (next === this.zoom) return;

    this.zoom = next;
    if (this.zoom === 1) {
      this.panX = 0;
      this.panY = 0;
    }
    this.applyCanvasZoom();
  }

  private applyCanvasZoom(): void {
    if (!this.canvas) return;
    this.canvas.style.transformOrigin = "center center";
    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.updateZoomIndicator();
    this.updateCanvasCursor();
  }

  private createCanvasControls(container: HTMLElement): void {
    const controls = document.createElement("div");
    controls.className = "wps-td-controls";

    const resetBtn = document.createElement("button");
    resetBtn.className = "wps-td-control-btn";
    resetBtn.textContent = t`${"reset_viewport"}`;
    resetBtn.addEventListener("click", () => this.resetViewport());
    this.resetButton = resetBtn;

    const indicator = document.createElement("div");
    indicator.className = "wps-td-zoom-indicator";
    this.zoomIndicator = indicator;

    controls.append(resetBtn, indicator);
    container.appendChild(controls);
    this.updateZoomIndicator();
  }

  private updateZoomIndicator(): void {
    if (!this.zoomIndicator || !this.resetButton) return;
    const isActive = this.zoom !== 1 || this.panX !== 0 || this.panY !== 0;
    this.zoomIndicator.textContent = `${Math.round(this.zoom * 100)}%`;
    this.zoomIndicator.style.display = isActive ? "block" : "none";
    this.resetButton.style.display = isActive ? "block" : "none";
  }

  private resetViewport(): void {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyCanvasZoom();
  }

  private handleCanvasMouseDown(e: MouseEvent): void {
    if (!this.canvas) return;
    if (this.zoom <= 1) return;
    this.isDragging = true;
    this.dragMoved = false;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.updateCanvasCursor("grabbing");
    document.addEventListener("mousemove", this.handleCanvasMouseMove);
    document.addEventListener("mouseup", this.handleCanvasMouseUp);
  }

  private handleCanvasMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastMouseX;
    const deltaY = e.clientY - this.lastMouseY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 2) this.dragMoved = true;
    this.panX += deltaX;
    this.panY += deltaY;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.applyCanvasZoom();
  };

  private handleCanvasMouseUp = (): void => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.updateCanvasCursor();
    document.removeEventListener("mousemove", this.handleCanvasMouseMove);
    document.removeEventListener("mouseup", this.handleCanvasMouseUp);
  };

  private handleCanvasMouseLeave(): void {
    if (this.isDragging) {
      this.isDragging = false;
      this.updateCanvasCursor();
      document.removeEventListener("mousemove", this.handleCanvasMouseMove);
      document.removeEventListener("mouseup", this.handleCanvasMouseUp);
    }
  }

  private updateCanvasCursor(forced?: "grab" | "grabbing" | "crosshair"): void {
    if (!this.canvas) return;
    if (forced) {
      this.canvas.style.cursor = forced;
      return;
    }
    if (this.zoom > 1) {
      this.canvas.style.cursor = this.isDragging ? "grabbing" : "grab";
      return;
    }
    this.canvas.style.cursor = "crosshair";
  }
}
