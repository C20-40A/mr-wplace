import { t } from "@/i18n/manager";
import { ImageDropzone } from "../../../../components/image-dropzone";
import { QuantizationMethod } from "./canvas-processor";

export interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onReplaceImage: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onSharpnessToggle: (enabled: boolean) => void;
  onSharpnessChange: (value: number) => void;
  onDitheringChange: (enabled: boolean) => void;
  onDitheringThresholdChange: (threshold: number) => void;
  onQuantizationMethodChange: (method: QuantizationMethod) => void;
  onGpuToggle: (enabled: boolean) => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}

type UIElements = {
  [key: string]:
    | HTMLElement
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLCanvasElement
    | HTMLImageElement;
};

export class ImageEditorUI {
  private container: HTMLElement;
  private callbacks: ImageEditorCallbacks | null = null;
  private imageDropzone: ImageDropzone | null = null;
  private controller: any = null;
  private elements: UIElements = {};

  constructor() {
    this.container = this._createElement("div", {
      id: "wps-image-editor-container",
    });
    this._injectStyles();
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
    const dropzone = this._createDropzone();
    const imageDisplay = this._createImageDisplayArea();

    this.container.innerHTML = "";
    this.container.append(dropzone, imageDisplay);

    Object.values(this.elements).forEach((element) => {
      if (!element.id) return;
      this.elements[element.id.replace("wps-", "").replace(/-/g, "_")] =
        element;
    });
  }

  private _createDropzone(): HTMLElement {
    this.elements.dropzoneContainer = this._createElement("div", {
      id: "wps-dropzone-container",
      style: {
        border: "2px dashed #d1d5db",
        borderRadius: "0.5rem",
        height: "20rem",
      },
    });
    return this.elements.dropzoneContainer;
  }

  private _createImageDisplayArea(): HTMLElement {
    const originalArea = this._createOriginalArea();
    const currentArea = this._createCurrentArea();
    const paletteArea = this._createPaletteArea();
    const controlsArea = this._createControlsArea();

    this.elements.mainGrid = this._createElement(
      "div",
      { id: "wps-main-grid" },
      [originalArea, currentArea, paletteArea, controlsArea],
    );

    this.elements.imageDisplay = this._createElement(
      "div",
      { id: "wps-image-display", style: { display: "none" } },
      [this.elements.mainGrid],
    );
    return this.elements.imageDisplay;
  }

  private _createOriginalArea(): HTMLElement {
    this.elements.originalImage = this._createElement("img", {
      id: "wps-original-image",
      alt: "Original",
    }) as HTMLImageElement;
    this.elements.replaceOverlay = this._createElement(
      "div",
      { id: "wps-replace-overlay" },
      [`📁 ${t("click_or_drop_to_change")}`],
    );
    this.elements.replaceFileInput = this._createElement("input", {
      id: "wps-replace-file-input",
      type: "file",
      accept: "image/*,.json",
      style: { display: "none" },
    }) as HTMLInputElement;

    this.elements.replaceZone = this._createElement(
      "div",
      { id: "wps-image-replace-zone" },
      [this.elements.replaceOverlay, this.elements.replaceFileInput],
    );

    const imageLayer = this._createElement(
      "div",
      { id: "wps-original-image-layer" },
      [
        this.elements.originalImage,
        this._createElement(
          "div",
          {
            style: {
              position: "absolute",
              top: "0.25rem",
              left: "0.25rem",
              fontSize: "0.75rem",
              fontWeight: "500",
            },
          },
          [t("original_image")],
        ),
      ],
    );

    return this._createElement("div", { id: "wps-original-area" }, [
      imageLayer,
      this.elements.replaceZone,
    ]);
  }

  private _createCurrentArea(): HTMLElement {
    this.elements.scaledCanvas = this._createElement("canvas", {
      id: "wps-scaled-canvas",
    }) as HTMLCanvasElement;
    const canvasContainer = this._createElement(
      "div",
      { id: "wps-canvas-container" },
      [this.elements.scaledCanvas],
    );

    this.elements.scaledImage = this._createElement("img", {
      id: "wps-scaled-image",
      alt: "Current",
    }) as HTMLImageElement;
    const imageContainer = this._createElement(
      "div",
      { id: "wps-image-container" },
      [this.elements.scaledImage],
    );

    this.elements.gpuToggle = this._createElement("input", {
      type: "checkbox",
      id: "wps-gpu-toggle",
      className: "checkbox checkbox-xs",
      checked: true,
    }) as HTMLInputElement;
    const gpuLabel = this._createElement(
      "label",
      { className: "gpu-toggle-label" },
      [this.elements.gpuToggle, this._createElement("span", {}, ["⚡GPU"])],
    );

    const flexContainer = this._createElement("div", { className: "flex" }, [
      canvasContainer,
      imageContainer,
      gpuLabel,
      this._createElement(
        "div",
        {
          style: {
            position: "absolute",
            top: "0.25rem",
            left: "0.25rem",
            fontSize: "0.75rem",
            fontWeight: "500",
          },
        },
        [t("current_image")],
      ),
    ]);

    return this._createElement("div", { id: "wps-current-area" }, [
      flexContainer,
    ]);
  }

  private _createPaletteArea(): HTMLElement {
    this.elements.colorPaletteContainerMobile = this._createElement("div", {
      id: "wps-color-palette-container-mobile",
    });
    const summary = this._createElement("summary", {}, [
      "Color Palette",
      this._createElement("span", { style: { float: "right" } }, ["▼"]),
    ]);
    const accordion = this._createElement(
      "details",
      { id: "wps-palette-accordion" },
      [summary, this.elements.colorPaletteContainerMobile],
    );

    this.elements.colorPaletteContainer = this._createElement("div", {
      id: "wps-color-palette-container",
    });
    const desktopPalette = this._createElement(
      "div",
      { id: "wps-palette-desktop" },
      [this.elements.colorPaletteContainer],
    );

    return this._createElement("div", { id: "wps-palette-area" }, [
      accordion,
      desktopPalette,
    ]);
  }

  private _createControlsArea(): HTMLElement {
    const controlsContainer = this._createElement(
      "div",
      { id: "wps-controls-container" },
      [
        this._createSizeControl(),
        this._createContrastQuantizationControl(),
        this._createBrightnessSaturationControl(),
        this._createDitheringSharpnessControl(),
        this._createCoordinateInput(),
        this._createActionButtons(),
      ],
    );
    return this._createElement("div", { id: "wps-controls-area" }, [
      controlsContainer,
    ]);
  }

  private _createSizeControl(): HTMLElement {
    this.elements.scaleSlider = this._createElement("input", {
      id: "wps-scale-slider",
      type: "range",
      min: 0.1,
      max: 1,
      step: 0.01,
      value: 1,
      className: "range",
    }) as HTMLInputElement;
    this.elements.widthInput = this._createElement("input", {
      id: "wps-width-input",
      type: "number",
      min: 1,
      step: 1,
    }) as HTMLInputElement;
    this.elements.heightInput = this._createElement("input", {
      id: "wps-height-input",
      type: "number",
      min: 1,
      step: 1,
    }) as HTMLInputElement;

    return this._createElement("div", {}, [
      this._createElement(
        "label",
        { className: "control-label space-between" },
        [
          this._createElement("span", { className: "label-hint" }, ["0.1x"]),
          this._createElement("span", {}, [t("size_reduction")]),
          this._createElement("span", { className: "label-hint" }, ["1.0x"]),
        ],
      ),
      this._createElement("div", { className: "flex-group" }, [
        this.elements.scaleSlider,
        this._createElement("div", { className: "flex-group" }, [
          this.elements.widthInput,
          this._createElement("span", { className: "label-hint" }, ["×"]),
          this.elements.heightInput,
        ]),
      ]),
    ]);
  }
  private _createContrastQuantizationControl(): HTMLElement {
    this.elements.contrastValue = this._createElement(
      "span",
      { id: "wps-contrast-value" },
      ["0"],
    );
    this.elements.contrastSlider = this._createElement("input", {
      id: "wps-contrast-slider",
      type: "range",
      min: -100,
      max: 100,
      step: 1,
      value: 0,
      className: "range",
    }) as HTMLInputElement;
    this.elements.quantizationMethod = this._createElement(
      "select",
      { id: "wps-quantization-method", className: "select select-sm w-full" },
      [
        this._createElement("option", { value: "rgb-euclidean" }, [
          t("quantization_rgb_euclidean"),
        ]),
        this._createElement("option", { value: "weighted-rgb" }, [
          t("quantization_weighted_rgb"),
        ]),
        this._createElement("option", { value: "lab" }, [
          t("quantization_lab"),
        ]),
      ],
    ) as HTMLSelectElement;

    return this._createElement(
      "div",
      { id: "wps-contrast-quantization-container", className: "control-group" },
      [
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label space-between" },
            [
              this._createElement("span", { className: "label-hint" }, [
                "-100",
              ]),
              this._createElement("span", {}, [
                `${t("contrast")}: `,
                this.elements.contrastValue,
              ]),
              this._createElement("span", { className: "label-hint" }, ["100"]),
            ],
          ),
          this.elements.contrastSlider,
        ]),
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label centered" },
            [t("quantization_method")],
          ),
          this.elements.quantizationMethod,
        ]),
      ],
    );
  }

  private _createBrightnessSaturationControl(): HTMLElement {
    this.elements.brightnessValue = this._createElement(
      "span",
      { id: "wps-brightness-value" },
      ["0"],
    );
    this.elements.brightnessSlider = this._createElement("input", {
      id: "wps-brightness-slider",
      type: "range",
      min: -100,
      max: 100,
      step: 1,
      value: 0,
      className: "range",
    }) as HTMLInputElement;
    this.elements.saturationValue = this._createElement(
      "span",
      { id: "wps-saturation-value" },
      ["0"],
    );
    this.elements.saturationSlider = this._createElement("input", {
      id: "wps-saturation-slider",
      type: "range",
      min: -100,
      max: 100,
      step: 1,
      value: 0,
      className: "range",
    }) as HTMLInputElement;

    return this._createElement(
      "div",
      { id: "wps-brightness-saturation-container", className: "control-group" },
      [
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label space-between" },
            [
              this._createElement("span", { className: "label-hint" }, [
                "-100",
              ]),
              this._createElement("span", {}, [
                `${t("brightness")}: `,
                this.elements.brightnessValue,
              ]),
              this._createElement("span", { className: "label-hint" }, ["100"]),
            ],
          ),
          this.elements.brightnessSlider,
        ]),
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label space-between" },
            [
              this._createElement("span", { className: "label-hint" }, [
                "-100",
              ]),
              this._createElement("span", {}, [
                `${t("saturation")}: `,
                this.elements.saturationValue,
              ]),
              this._createElement("span", { className: "label-hint" }, ["100"]),
            ],
          ),
          this.elements.saturationSlider,
        ]),
      ],
    );
  }

  private _createDitheringSharpnessControl(): HTMLElement {
    this.elements.ditheringCheckbox = this._createElement("input", {
      id: "wps-dithering-checkbox",
      type: "checkbox",
      className: "checkbox checkbox-sm",
    }) as HTMLInputElement;
    this.elements.ditheringThresholdValue = this._createElement(
      "span",
      { id: "wps-dithering-threshold-value" },
      ["500"],
    );
    this.elements.ditheringThresholdSlider = this._createElement("input", {
      id: "wps-dithering-threshold-slider",
      type: "range",
      min: 0,
      max: 1500,
      step: 50,
      value: 500,
      className: "range",
      disabled: true,
    }) as HTMLInputElement;

    this.elements.sharpnessCheckbox = this._createElement("input", {
      id: "wps-sharpness-checkbox",
      type: "checkbox",
      className: "checkbox checkbox-sm",
    }) as HTMLInputElement;
    this.elements.sharpnessValue = this._createElement(
      "span",
      { id: "wps-sharpness-value" },
      ["0"],
    );
    this.elements.sharpnessSlider = this._createElement("input", {
      id: "wps-sharpness-slider",
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      value: 0,
      className: "range",
      disabled: true,
    }) as HTMLInputElement;

    return this._createElement(
      "div",
      { id: "wps-dithering-sharpness-container", className: "control-group" },
      [
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label centered cursor-pointer" },
            [
              this.elements.ditheringCheckbox,
              this._createElement("span", {}, [
                `${t("dithering")}: `,
                this.elements.ditheringThresholdValue,
              ]),
            ],
          ),
          this._createElement("div", { className: "flex-group" }, [
            this._createElement("span", { className: "label-hint-sm" }, ["0"]),
            this.elements.ditheringThresholdSlider,
            this._createElement("span", { className: "label-hint-sm" }, [
              "1500",
            ]),
          ]),
        ]),
        this._createElement("div", { className: "control-item" }, [
          this._createElement(
            "label",
            { className: "control-label centered cursor-pointer" },
            [
              this.elements.sharpnessCheckbox,
              this._createElement("span", {}, [
                `${t("sharpness")}: `,
                this.elements.sharpnessValue,
              ]),
            ],
          ),
          this._createElement("div", { className: "flex-group" }, [
            this._createElement("span", { className: "label-hint-sm" }, ["0"]),
            this.elements.sharpnessSlider,
            this._createElement("span", { className: "label-hint-sm" }, [
              "100",
            ]),
          ]),
        ]),
      ],
    );
  }

  private _createCoordinateInput(): HTMLElement {
    this.elements.coordTlx = this._createElement("input", {
      id: "wps-coord-tlx",
      type: "number",
      placeholder: "TLX",
      min: 0,
      step: 1,
    }) as HTMLInputElement;
    this.elements.coordTly = this._createElement("input", {
      id: "wps-coord-tly",
      type: "number",
      placeholder: "TLY",
      min: 0,
      step: 1,
    }) as HTMLInputElement;
    this.elements.coordPxx = this._createElement("input", {
      id: "wps-coord-pxx",
      type: "number",
      placeholder: "PxX",
      min: 0,
      max: 999,
      step: 1,
    }) as HTMLInputElement;
    this.elements.coordPxy = this._createElement("input", {
      id: "wps-coord-pxy",
      type: "number",
      placeholder: "PxY",
      min: 0,
      max: 999,
      step: 1,
    }) as HTMLInputElement;

    return this._createElement("div", {}, [
      this._createElement("label", { className: "control-label-sm" }, [
        t("coordinate_input_optional"),
      ]),
      this._createElement("div", { className: "grid-4-col" }, [
        this.elements.coordTlx,
        this.elements.coordTly,
        this.elements.coordPxx,
        this.elements.coordPxy,
      ]),
    ]);
  }

  private _createActionButtons(): HTMLElement {
    this.elements.addToGallery = this._createElement(
      "button",
      { id: "wps-add-to-gallery", className: "btn btn-primary flex-1" },
      [t("add_to_gallery")],
    );
    this.elements.download = this._createElement(
      "button",
      { id: "wps-download", className: "btn btn-ghost" },
      [t("download")],
    );

    return this._createElement("div", { className: "flex" }, [
      this.elements.addToGallery,
      this.elements.download,
    ]);
  }

  private setupImageDropzone(): void {
    if (!this.callbacks) return;

    const dropzoneContainer = this.elements.dropzoneContainer as HTMLElement;
    if (!dropzoneContainer) return;

    this.imageDropzone = new ImageDropzone(dropzoneContainer, {
      onFileSelected: (file: File) => this.callbacks?.onFileHandle(file),
      acceptedTypes: "image/*,.json",
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
        () =>
          ((this.elements.replaceOverlay as HTMLElement).style.display =
            "flex"),
      );
      replaceZone.addEventListener(
        "mouseleave",
        () =>
          ((this.elements.replaceOverlay as HTMLElement).style.display =
            "none"),
      );
      replaceZone.addEventListener("click", () =>
        (this.elements.replaceFileInput as HTMLInputElement).click(),
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
      case "wps-sharpness-slider":
        (this.elements.sharpnessValue as HTMLElement).textContent = value;
        break;
      case "wps-dithering-threshold-slider":
        (this.elements.ditheringThresholdValue as HTMLElement).textContent =
          value;
        break;
    }
  }

  private _handleChange(e: Event): void {
    const target = e.target as HTMLInputElement;
    if (!target.id || !this.callbacks) return;

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
        this.callbacks.onBrightnessChange(parseInt(target.value));
        break;
      case "wps-contrast-slider":
        this.callbacks.onContrastChange(parseInt(target.value));
        break;
      case "wps-saturation-slider":
        this.callbacks.onSaturationChange(parseInt(target.value));
        break;
      case "wps-sharpness-checkbox":
        (this.elements.sharpnessSlider as HTMLInputElement).disabled =
          !target.checked;
        this.callbacks.onSharpnessToggle(target.checked);
        break;
      case "wps-sharpness-slider":
        this.callbacks.onSharpnessChange(parseInt(target.value));
        break;
      case "wps-dithering-checkbox":
        (this.elements.ditheringThresholdSlider as HTMLInputElement).disabled =
          !target.checked;
        this.callbacks.onDitheringChange(target.checked);
        break;
      case "wps-dithering-threshold-slider":
        this.callbacks.onDitheringThresholdChange(parseInt(target.value));
        break;
      case "wps-quantization-method":
        this.callbacks.onQuantizationMethodChange(
          (target as any).value as QuantizationMethod,
        );
        break;
      case "wps-gpu-toggle":
        this.callbacks.onGpuToggle(target.checked);
        break;
      case "wps-replace-file-input": {
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
    if (!target.id || !this.callbacks) return;

    switch (target.id) {
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
    const overlay = this.elements.replaceOverlay as HTMLElement;
    overlay.style.display = "flex";
    overlay.style.background = "rgba(59, 130, 246, 0.8)";
  }

  private _handleDragLeave(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const overlay = this.elements.replaceOverlay as HTMLElement;
    overlay.style.background = "rgba(0,0,0,0.7)";
    overlay.style.display = "none";
  }

  private _handleDrop(e: DragEvent): void {
    e.preventDefault();
    e.stopPropagation();
    const overlay = this.elements.replaceOverlay as HTMLElement;
    overlay.style.display = "none";
    overlay.style.background = "rgba(0,0,0,0.7)";

    const file = e.dataTransfer?.files?.[0];
    if (
      file &&
      (file.type.startsWith("image/") || file.name.endsWith(".json"))
    ) {
      this.callbacks?.onReplaceImage(file);
    }
  }

  setController(controller: any): void {
    this.controller = controller;
  }

  private setupResponsive(): void {
    const updateLayout = () => {
      const isDesktop = window.innerWidth >= 1024;
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
    };

    updateLayout();
    window.addEventListener("resize", updateLayout);
  }

  private _injectStyles(): void {
    const styleId = "wps-image-editor-styles";
    if (document.getElementById(styleId)) return;

    const style = this._createElement("style", { id: styleId }, [
      `
      #wps-image-editor-container.desktop #wps-main-grid {
        display: grid;
        grid-template-columns: 2fr 3fr;
        grid-template-rows: 2fr 3fr;
        height: 80vh;
        overflow: hidden;
        gap: 0.1rem;
      }
      #wps-image-editor-container.mobile #wps-main-grid {
        display: flex;
        flex-direction: column;
        height: auto;
        overflow: visible;
        gap: 0.1rem;
      }
      #wps-original-area, #wps-current-area, #wps-palette-area, #wps-controls-area {
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
        padding: 0.5rem;
        min-height: 0;
      }
      #wps-original-area { position: relative; }
      #wps-image-editor-container.desktop #wps-original-area,
      #wps-image-editor-container.desktop #wps-current-area,
      #wps-image-editor-container.desktop #wps-palette-area,
      #wps-image-editor-container.desktop #wps-controls-area {
        overflow-y: auto;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
      }
      #wps-image-editor-container.desktop #wps-original-area { overflow: hidden; }
      #wps-original-image-layer {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
      }
      #wps-image-replace-zone {
        position: absolute; inset: 0; cursor: pointer; display: flex; justify-content: center; align-items: center;
      }
      #wps-original-image {
        border: 1px solid #e5e7eb; border-radius: 0.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); width: auto; height: auto; max-width: none; max-height: none; object-fit: contain; image-rendering: pixelated; image-rendering: -webkit-optimize-contrast;
      }
      #wps-replace-overlay {
        position: absolute; inset: 0; background: rgba(0,0,0,0.7); border-radius: 0.25rem; display: none; align-items: center; justify-content: center; color: white; font-size: 0.875rem; text-align: center; padding: 1rem;
      }
      #wps-current-area .flex {
        justify-content: center; position: relative; width: 100%; height: 100%; box-sizing: border-box;
      }
      #wps-canvas-container {
        min-width: 100%; min-height: 0; height: 100%; max-width: 100%; max-height: 100%; overflow: hidden; position: relative;
      }
      #wps-image-editor-container.mobile #wps-canvas-container { display: none; }
      #wps-image-editor-container.desktop #wps-canvas-container { display: block; }

      #wps-scaled-canvas {
        position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
      }
      #wps-image-container { display: none; width: 100%; max-width: 100%; }
      #wps-image-editor-container.mobile #wps-image-container { display: block; }
      #wps-image-editor-container.desktop #wps-image-container { display: none; }
      #wps-scaled-image {
        width: 100%; height: auto; image-rendering: pixelated; image-rendering: -webkit-optimize-contrast;
      }
      .gpu-toggle-label {
        position: absolute; bottom: 0.25rem; right: 0.25rem; display: flex; align-items: center; gap: 0.25rem; font-size: 0.7rem; cursor: pointer; background: var(--color-base-300); padding: 0.2rem 0.4rem; border-radius: 0.25rem; opacity: 0.6; transition: opacity 0.2s;
      }
      .gpu-toggle-label:hover { opacity: 1; }

      #wps-palette-accordion { list-style: none; }
      #wps-palette-accordion summary { font-size: 0.875rem; font-weight: 500; cursor: pointer; margin: 0.5rem; }
      #wps-image-editor-container.desktop #wps-palette-accordion { display: none; }
      #wps-image-editor-container.mobile #wps-palette-accordion { display: block; }
      #wps-image-editor-container.desktop #wps-palette-desktop { display: block; }
      #wps-image-editor-container.mobile #wps-palette-desktop { display: none; }

      #wps-controls-container { display: flex; flex-direction: column; gap: 1rem; }
      .control-label { display: flex; align-items: center; font-size: 0.875rem; font-weight: 500; margin-bottom: 0.25rem; }
      .control-label.space-between { justify-content: space-between; }
      .control-label.centered { justify-content: center; }
      .label-hint { font-size: 0.75rem; color: #9ca3af; }
      .label-hint-sm { font-size: 0.65rem; color: #9ca3af; }
      .flex-group { display: flex; gap: 0.5rem; align-items: center; }
      .flex-group .range { flex: 1; min-width: 0; }
      #wps-width-input, #wps-height-input { width: 60px; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center; }
      .control-group { display: flex; gap: 0.75rem; }
      .control-item { flex: 1; min-width: 0; }
      .control-item .range { width: 100%; display: block; }
      .cursor-pointer { cursor: pointer; }

      #wps-image-editor-container.mobile .control-group { flex-direction: column; }
      #wps-image-editor-container.desktop .control-group { flex-direction: row; }

      .control-label-sm { display: block; font-size: 0.75rem; font-weight: 500; margin-bottom: 0.25rem; }
      .grid-4-col { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.25rem; }
      .grid-4-col input { width: 100%; padding: 0.25rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; text-align: center; }
      .flex { display: flex; gap: 0.5rem; }
      .flex-1 { flex: 1; }
    `,
    ]);
    document.head.appendChild(style);
  }
}
