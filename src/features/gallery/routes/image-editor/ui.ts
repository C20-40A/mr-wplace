import { ImageDropzone } from "@/components/image-dropzone";
import {
  ColorFlattenMode,
  DitheringMethod,
  QuantizationMethod,
} from "./canvas-processor";
import type { UIElements } from "./components/types";
import { createDropzone } from "./components/create-dropzone";
import { createImageDisplayArea } from "./components/create-image-display-area";
import { injectImageEditorStyles } from "./components/inject-styles";
import { TransparencyDialog } from "./components/transparency-dialog";
import { isDesktopViewport } from "@/constants/breakpoints";
import { isImportableEditorFile } from "./import-file";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onReplaceImage: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onOutlineToggle: (enabled: boolean) => void;
  onOutlineThresholdChange: (value: number) => void;
  onOutlineWidthChange: (value: number) => void;
  onOutlineUseFixedColorChange: (enabled: boolean) => void;
  onOutlineFixedColorChange: (value: string) => void;
  onDitheringChange: (enabled: boolean) => void;
  onDitheringThresholdChange: (threshold: number) => void;
  onDitheringMethodChange: (method: DitheringMethod) => void;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
  onColorFlattenModeChange: (mode: ColorFlattenMode) => void;
  onGpuToggle: (enabled: boolean) => void;
  onTransparentColorsChange: (colors: Set<string>) => void;
  onOpenTransparencyTool: () => HTMLImageElement | HTMLCanvasElement | null;
  onOpenAdjustTool: () => void;
  onTransparencyCanvasClick: (x: number, y: number) => void;
  onTransparencyThresholdChange: (value: number) => void;
  onTransparencyApply: () => void;
  onTransparencyReset: () => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}

export class ImageEditorUI {
  private container: HTMLElement;
  private callbacks: ImageEditorCallbacks | null = null;
  private imageDropzone: ImageDropzone | null = null;
  private controller: any = null;
  private elements: UIElements = {};
  private transparencyDialog: TransparencyDialog | null = null;
  private isCurrentExpanded = false;
  private replaceDragDepth = 0;

  constructor() {
    this.container = this._createElement("div", {
      id: "wps-image-editor-container",
    });
    injectImageEditorStyles(this._createElement.bind(this));
  }

  createAndGetContainer(): HTMLElement {
    return this.container;
  }

  getContainer(): HTMLElement {
    return this.container;
  }

  setupUI(callbacks: ImageEditorCallbacks): void {
    this.callbacks = callbacks;
    this.createUI();
    this.setupImageDropzone();
    this._setupEventListeners();
    this.setupResponsive();
  }

  private _createElement<K extends keyof HTMLElementTagNameMap>(
    tagName: K,
    options: { [key: string]: any } = {},
    children: (Node | string)[] = [],
  ): HTMLElementTagNameMap[K] {
    const element = document.createElement(tagName);
    Object.entries(options).forEach(([key, value]) => {
      if (key === "style") {
        Object.assign(element.style, value);
      } else if (key === "dataset") {
        Object.assign(element.dataset, value);
      } else if (key === "className") {
        element.className = value;
      } else {
        (element as any)[key] = value;
      }
    });
    children.forEach((child) => {
      if (typeof child === "string") {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    });
    return element;
  }

  private createUI(): void {
    const dropzone = createDropzone(
      this._createElement.bind(this),
      this.elements,
    );
    const imageDisplay = createImageDisplayArea(
      this._createElement.bind(this),
      this.elements,
    );

    this.container.innerHTML = "";
    this.container.append(dropzone, imageDisplay);

    Object.values(this.elements).forEach((element) => {
      if (!element.id) return;
      this.elements[element.id.replace("wps-", "").replace(/-/g, "_")] =
        element;
    });
  }

  private setupImageDropzone(): void {
    if (!this.callbacks) return;

    const dropzoneContainer = this.elements.dropzoneContainer as HTMLElement;
    if (!dropzoneContainer) return;

    this.imageDropzone = new ImageDropzone(dropzoneContainer, {
      onFileSelected: (file: File) => this.callbacks?.onFileHandle(file),
      acceptedTypes: "image/*,.json,.wplace",
      autoHide: true,
    });
  }

  private _setupEventListeners(): void {
    this.container.addEventListener("input", this._handleInput.bind(this));
    this.container.addEventListener("change", this._handleChange.bind(this));
    this.container.addEventListener("click", this._handleClick.bind(this));

    const replaceZone = this.elements.replaceZone as HTMLElement;
    if (replaceZone) {
      replaceZone.addEventListener(
        "mouseenter",
        () => {
          if (this.replaceDragDepth > 0) return;
          this.showReplaceOverlay();
        },
      );
      replaceZone.addEventListener(
        "mouseleave",
        () => {
          if (this.replaceDragDepth > 0) return;
          this.hideReplaceOverlay();
        },
      );
      replaceZone.addEventListener("click", () =>
        (this.elements.replaceFileInput as HTMLInputElement).click(),
      );
      replaceZone.addEventListener(
        "dragenter",
        this._handleDragEnter.bind(this),
      );
      replaceZone.addEventListener("dragover", this._handleDragOver.bind(this));
      replaceZone.addEventListener(
        "dragleave",
        this._handleDragLeave.bind(this),
      );
      replaceZone.addEventListener("drop", this._handleDrop.bind(this));
    }
  }

  private _handleInput(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (!target.id) return;
    const value = target.value;

    switch (target.id) {
      case "wps-scale-slider": {
        const scale = parseFloat(value);
        const { widthInput, heightInput } = this.elements as {
          widthInput: HTMLInputElement;
          heightInput: HTMLInputElement;
        };
        const originalWidth = parseInt(widthInput.dataset.originalWidth || "1");
        const originalHeight = parseInt(
          heightInput.dataset.originalHeight || "1",
        );
        widthInput.value = Math.round(originalWidth * scale).toString();
        heightInput.value = Math.round(originalHeight * scale).toString();
        break;
      }
      case "wps-width-input": {
        const width = parseInt(value) || 1;
        const { widthInput, heightInput, scaleSlider } = this.elements as {
          widthInput: HTMLInputElement;
          heightInput: HTMLInputElement;
          scaleSlider: HTMLInputElement;
        };
        const originalWidth = parseInt(widthInput.dataset.originalWidth || "1");
        const originalHeight = parseInt(
          heightInput.dataset.originalHeight || "1",
        );
        const aspectRatio = originalHeight / originalWidth;
        heightInput.value = Math.round(width * aspectRatio).toString();
        const scale = width / originalWidth;
        scaleSlider.value = Math.max(0.1, Math.min(1, scale)).toString();
        break;
      }
      case "wps-height-input": {
        const height = parseInt(value) || 1;
        const { widthInput, heightInput, scaleSlider } = this.elements as {
          widthInput: HTMLInputElement;
          heightInput: HTMLInputElement;
          scaleSlider: HTMLInputElement;
        };
        const originalWidth = parseInt(widthInput.dataset.originalWidth || "1");
        const originalHeight = parseInt(
          heightInput.dataset.originalHeight || "1",
        );
        const aspectRatio = originalWidth / originalHeight;
        widthInput.value = Math.round(height * aspectRatio).toString();
        const scale = height / originalHeight;
        scaleSlider.value = Math.max(0.1, Math.min(1, scale)).toString();
        break;
      }
      case "wps-brightness-slider":
        (this.elements.brightnessValue as HTMLElement).textContent = value;
        break;
      case "wps-contrast-slider":
        (this.elements.contrastValue as HTMLElement).textContent = value;
        break;
      case "wps-saturation-slider":
        (this.elements.saturationValue as HTMLElement).textContent = value;
        break;
      case "wps-outline-threshold-slider":
        (this.elements.outlineThresholdValue as HTMLElement).textContent = value;
        break;
      case "wps-outline-width-slider":
        (this.elements.outlineWidthValue as HTMLElement).textContent = value;
        break;
      case "wps-dithering-threshold-slider":
        (this.elements.ditheringThresholdValue as HTMLElement).textContent =
          value;
        break;
    }
  }

  private _setSectionHidden(id: string, hidden: boolean): void {
    const element = this.container.querySelector(`#${id}`) as HTMLElement | null;
    if (element) element.hidden = hidden;
  }

  private _handleChange(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement;
    if (!target.id || !this.callbacks) return;
    const isInput = (element: typeof target): element is HTMLInputElement =>
      element instanceof HTMLInputElement;
    const isSelect = (element: typeof target): element is HTMLSelectElement =>
      element instanceof HTMLSelectElement;

    switch (target.id) {
      case "wps-scale-slider":
      case "wps-width-input":
      case "wps-height-input": {
        const scale = parseFloat(
          (this.elements.scaleSlider as HTMLInputElement).value,
        );
        this.callbacks.onScaleChange(Math.max(0.01, Math.min(1, scale)));
        break;
      }
      case "wps-brightness-slider":
        if (!isInput(target)) return;
        this.callbacks.onBrightnessChange(parseInt(target.value));
        break;
      case "wps-mobile-brightness-toggle":
        if (!isInput(target)) return;
        this._setSectionHidden("wps-brightness-mobile-slider-section", !target.checked);
        if (target.checked) return;
        (this.elements.brightnessSlider as HTMLInputElement).value = "0";
        (this.elements.brightnessValue as HTMLElement).textContent = "0";
        this.callbacks.onBrightnessChange(0);
        break;
      case "wps-contrast-slider":
        if (!isInput(target)) return;
        this.callbacks.onContrastChange(parseInt(target.value));
        break;
      case "wps-mobile-contrast-toggle":
        if (!isInput(target)) return;
        this._setSectionHidden("wps-contrast-mobile-slider-section", !target.checked);
        if (target.checked) return;
        (this.elements.contrastSlider as HTMLInputElement).value = "0";
        (this.elements.contrastValue as HTMLElement).textContent = "0";
        this.callbacks.onContrastChange(0);
        break;
      case "wps-saturation-slider":
        if (!isInput(target)) return;
        this.callbacks.onSaturationChange(parseInt(target.value));
        break;
      case "wps-mobile-saturation-toggle":
        if (!isInput(target)) return;
        this._setSectionHidden("wps-saturation-mobile-slider-section", !target.checked);
        if (target.checked) return;
        (this.elements.saturationSlider as HTMLInputElement).value = "0";
        (this.elements.saturationValue as HTMLElement).textContent = "0";
        this.callbacks.onSaturationChange(0);
        break;
      case "wps-outline-checkbox":
        if (!isInput(target)) return;
        this._setSectionHidden("wps-outline-mobile-details", !target.checked);
        (this.elements.outlineThresholdSlider as HTMLInputElement).disabled =
          !target.checked;
        (this.elements.outlineWidthSlider as HTMLInputElement).disabled =
          !target.checked;
        (this.elements.outlineColorCheckbox as HTMLInputElement).disabled =
          !target.checked;
        (this.elements.outlineColorInput as HTMLInputElement).disabled =
          !target.checked ||
          !(this.elements.outlineColorCheckbox as HTMLInputElement).checked;
        this.callbacks.onOutlineToggle(target.checked);
        break;
      case "wps-outline-threshold-slider":
        if (!isInput(target)) return;
        this.callbacks.onOutlineThresholdChange(parseInt(target.value));
        break;
      case "wps-outline-width-slider":
        if (!isInput(target)) return;
        this.callbacks.onOutlineWidthChange(parseInt(target.value));
        break;
      case "wps-outline-color-checkbox":
        if (!isInput(target)) return;
        (this.elements.outlineColorInput as HTMLInputElement).disabled =
          !target.checked;
        this.callbacks.onOutlineUseFixedColorChange(target.checked);
        break;
      case "wps-outline-color-input":
        if (!isInput(target)) return;
        this.callbacks.onOutlineFixedColorChange(target.value);
        break;
      case "wps-dithering-checkbox":
        if (!isInput(target)) return;
        this._setSectionHidden("wps-dithering-mobile-details", !target.checked);
        (this.elements.ditheringThresholdSlider as HTMLInputElement).disabled =
          !target.checked;
        (this.elements.ditheringMethod as HTMLSelectElement).disabled =
          !target.checked;
        this.callbacks.onDitheringChange(target.checked);
        break;
      case "wps-dithering-threshold-slider":
        if (!isInput(target)) return;
        this.callbacks.onDitheringThresholdChange(parseInt(target.value));
        break;
      case "wps-dithering-method":
        if (!isSelect(target)) return;
        this.callbacks.onDitheringMethodChange(target.value as DitheringMethod);
        break;
      case "wps-quantization-method":
        if (!isSelect(target)) return;
        this.callbacks.onQuantizationMethodChange(target.value as QuantizationMethod);
        break;
      case "wps-color-flatten-mode":
        if (!isSelect(target)) return;
        this.callbacks.onColorFlattenModeChange(target.value as ColorFlattenMode);
        break;
      case "wps-gpu-toggle":
        if (!isInput(target)) return;
        this.callbacks.onGpuToggle(target.checked);
        break;
      case "wps-replace-file-input": {
        if (!isInput(target)) return;
        const file = target.files?.[0];
        if (file) {
          this.callbacks.onReplaceImage(file);
          target.value = ""; // Reset
        }
        break;
      }
    }
  }

  private _handleClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (!this.callbacks) return;

    // 透過ツールボタン
    if (target.id === "wps-transparency-tool-btn") {
      this.openTransparencyDialog();
      return;
    }
    if (target.id === "wps-adjust-tool-btn") {
      this.callbacks.onOpenAdjustTool();
      return;
    }

    if (!target.id) return;

    switch (target.id) {
      case "wps-current-expand-toggle":
        this.toggleCurrentImageExpand();
        break;
      case "wps-add-to-gallery":
        this.callbacks.onSaveToGallery();
        break;
      case "wps-download":
        this.callbacks.onDownload();
        break;
    }
  }

  private _handleDragOver(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.showReplaceOverlay(true);
  }

  private _handleDragEnter(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.replaceDragDepth += 1;
    this.showReplaceOverlay(true);
  }

  private _handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.replaceDragDepth = Math.max(0, this.replaceDragDepth - 1);
    if (this.replaceDragDepth > 0) return;
    this.hideReplaceOverlay();
  }

  private _handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    this.replaceDragDepth = 0;
    this.hideReplaceOverlay();

    const file = e.dataTransfer?.files?.[0];
    if (
      file &&
      isImportableEditorFile(file)
    ) {
      this.callbacks?.onReplaceImage(file);
    }
  }

  private showReplaceOverlay(isDragging = false): void {
    const overlay = this.elements.replaceOverlay as HTMLElement;
    if (!overlay) return;
    overlay.style.display = "flex";
    overlay.style.background = isDragging
      ? "rgba(59, 130, 246, 0.8)"
      : "rgba(0,0,0,0.7)";
  }

  private hideReplaceOverlay(): void {
    const overlay = this.elements.replaceOverlay as HTMLElement;
    if (!overlay) return;
    overlay.style.display = "none";
    overlay.style.background = "rgba(0,0,0,0.7)";
  }

  private openTransparencyDialog(): void {
    if (!this.callbacks) return;
    const image = this.callbacks.onOpenTransparencyTool();
    if (this.transparencyDialog) {
      this.transparencyDialog.close();
    }
    const mountRoot =
      (this.container.closest("dialog") as HTMLElement | null) ?? document.body;
    this.transparencyDialog = new TransparencyDialog({
      onCanvasClick: (x, y) => this.callbacks?.onTransparencyCanvasClick(x, y),
      onThresholdChange: (v) => this.callbacks?.onTransparencyThresholdChange(v),
      onApply: () => {
        this.callbacks?.onTransparencyApply();
        this.transparencyDialog?.close();
        this.transparencyDialog = null;
      },
      onReset: () => this.callbacks?.onTransparencyReset(),
      onClose: () => { this.transparencyDialog = null; },
    });
    this.transparencyDialog.open(image, mountRoot);
  }

  setController(controller: any): void {
    this.controller = controller;
  }

  updateTransparencyPreview(image: HTMLImageElement | HTMLCanvasElement): void {
    this.transparencyDialog?.updatePreview(image);
  }

  private setupResponsive(): void {
    const updateRangeSizeClass = (isDesktop: boolean) => {
      const rangeInputs = this.container.querySelectorAll<HTMLInputElement>(
        'input[type="range"].range',
      );
      rangeInputs.forEach((input) => {
        input.classList.toggle("range-xs", !isDesktop);
      });
    };

    const updateLayout = () => {
      const isDesktop = isDesktopViewport();
      if (isDesktop) {
        this.container.classList.add("desktop");
        this.container.classList.remove("mobile");
      } else {
        this.container.classList.add("mobile");
        this.container.classList.remove("desktop");
      }

      if (this.controller) {
        this.controller.updateColorPaletteContainer(!isDesktop);
        this.controller.updateImageDisplayMode(isDesktop);
      }

      updateRangeSizeClass(isDesktop);
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
  }

  private toggleCurrentImageExpand(): void {
    this.isCurrentExpanded = !this.isCurrentExpanded;
    this.container.classList.toggle("current-expanded", this.isCurrentExpanded);

    const expandButton = this.container.querySelector(
      "#wps-current-expand-toggle",
    ) as HTMLButtonElement | null;
    if (!expandButton) return;

    const isExpanded = this.isCurrentExpanded;
    expandButton.textContent = isExpanded ? "⤡" : "⤢";
    const label = isExpanded
      ? "Restore current image area"
      : "Expand current image area";
    expandButton.title = label;
    expandButton.setAttribute("aria-label", label);
  }
}
