import { t } from "@/i18n/manager";
import type { CreateElementFn, UIElements } from "./types";

export const createControlsArea = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  const controlsContainer = createElement(
    "div",
    { id: "wps-controls-container" },
    [
      createSizeControl(createElement, elements),
      createContrastQuantizationControl(createElement, elements),
      createBrightnessSaturationControl(createElement, elements),
      createDitheringOutlineControl(createElement, elements),
      createCoordinateInput(createElement, elements),
      createActionButtons(createElement, elements),
    ],
  );

  return createElement("div", { id: "wps-controls-area" }, [controlsContainer]);
};

const createSizeControl = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.scaleSlider = createElement("input", {
    id: "wps-scale-slider",
    type: "range",
    min: 0.1,
    max: 1,
    step: 0.01,
    value: 1,
    className: "range",
  }) as HTMLInputElement;
  elements.widthInput = createElement("input", {
    id: "wps-width-input",
    type: "number",
    min: 1,
    step: 1,
  }) as HTMLInputElement;
  elements.heightInput = createElement("input", {
    id: "wps-height-input",
    type: "number",
    min: 1,
    step: 1,
  }) as HTMLInputElement;

  elements.sizeReductionLabel = createElement("span", {
    id: "wps-size-reduction-label",
  });
  elements.sizeReductionLabel.textContent = t("size_reduction");

  return createElement("div", {}, [
    createElement("label", { className: "control-label space-between" }, [
      createElement("span", { className: "label-hint" }, ["0.1x"]),
      elements.sizeReductionLabel as HTMLElement,
      createElement("span", { className: "label-hint" }, ["1.0x"]),
    ]),
    createElement("div", { className: "flex-group" }, [
      elements.scaleSlider as HTMLInputElement,
      createElement("div", { className: "flex-group" }, [
        elements.widthInput as HTMLInputElement,
        createElement("span", { className: "label-hint" }, ["×"]),
        elements.heightInput as HTMLInputElement,
      ]),
    ]),
  ]);
};

const createContrastQuantizationControl = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.contrastValue = createElement("span", { id: "wps-contrast-value" }, [
    "0",
  ]);
  elements.contrastSlider = createElement("input", {
    id: "wps-contrast-slider",
    type: "range",
    min: -100,
    max: 100,
    step: 1,
    value: 0,
    className: "range",
  }) as HTMLInputElement;
  elements.quantizationMethod = createElement(
    "select",
    { id: "wps-quantization-method", className: "select select-sm w-full" },
    [
      createElement("option", { value: "rgb-euclidean" }, [
        t("quantization_rgb_euclidean"),
      ]),
      createElement("option", { value: "weighted-rgb" }, [
        t("quantization_weighted_rgb"),
      ]),
      createElement("option", { value: "lab" }, [t("quantization_lab")]),
      createElement("option", { value: "oklab" }, [t("quantization_oklab")]),
      createElement("option", { value: "delta-e-2000" }, [t("quantization_delta_e_2000")]),
    ],
  ) as HTMLSelectElement;

  return createElement(
    "div",
    { id: "wps-contrast-quantization-container", className: "control-group" },
    [
      createElement("div", { className: "control-item" }, [
        createElement("label", { className: "control-label space-between" }, [
          createElement("span", { className: "label-hint" }, ["-100"]),
          createElement("span", {}, [
            `${t("contrast")}: `,
            elements.contrastValue as HTMLElement,
          ]),
          createElement("span", { className: "label-hint" }, ["100"]),
        ]),
        elements.contrastSlider as HTMLInputElement,
      ]),
      createElement("div", { className: "control-item" }, [
        createElement("label", { className: "control-label centered" }, [
          t("quantization_method"),
        ]),
        elements.quantizationMethod as HTMLSelectElement,
      ]),
    ],
  );
};

const createBrightnessSaturationControl = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.brightnessValue = createElement(
    "span",
    { id: "wps-brightness-value" },
    ["0"],
  );
  elements.brightnessSlider = createElement("input", {
    id: "wps-brightness-slider",
    type: "range",
    min: -100,
    max: 100,
    step: 1,
    value: 0,
    className: "range",
  }) as HTMLInputElement;
  elements.saturationValue = createElement(
    "span",
    { id: "wps-saturation-value" },
    ["0"],
  );
  elements.saturationSlider = createElement("input", {
    id: "wps-saturation-slider",
    type: "range",
    min: -100,
    max: 100,
    step: 1,
    value: 0,
    className: "range",
  }) as HTMLInputElement;

  return createElement(
    "div",
    { id: "wps-brightness-saturation-container", className: "control-group" },
    [
      createElement("div", { className: "control-item" }, [
        createElement("label", { className: "control-label space-between" }, [
          createElement("span", { className: "label-hint" }, ["-100"]),
          createElement("span", {}, [
            `${t("brightness")}: `,
            elements.brightnessValue as HTMLElement,
          ]),
          createElement("span", { className: "label-hint" }, ["100"]),
        ]),
        elements.brightnessSlider as HTMLInputElement,
      ]),
      createElement("div", { className: "control-item" }, [
        createElement("label", { className: "control-label space-between" }, [
          createElement("span", { className: "label-hint" }, ["-100"]),
          createElement("span", {}, [
            `${t("saturation")}: `,
            elements.saturationValue as HTMLElement,
          ]),
          createElement("span", { className: "label-hint" }, ["100"]),
        ]),
        elements.saturationSlider as HTMLInputElement,
      ]),
    ],
  );
};

const createDitheringOutlineControl = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.ditheringCheckbox = createElement("input", {
    id: "wps-dithering-checkbox",
    type: "checkbox",
    className: "checkbox checkbox-sm",
  }) as HTMLInputElement;
  elements.ditheringThresholdValue = createElement(
    "span",
    { id: "wps-dithering-threshold-value" },
    ["500"],
  );
  elements.ditheringThresholdSlider = createElement("input", {
    id: "wps-dithering-threshold-slider",
    type: "range",
    min: 0,
    max: 1500,
    step: 50,
    value: 500,
    className: "range",
    disabled: true,
  }) as HTMLInputElement;
  elements.ditheringMethod = createElement(
    "select",
    {
      id: "wps-dithering-method",
      className: "select select-xs",
      disabled: true,
      title: "Dithering method",
    },
    [
      createElement(
        "option",
        { value: "ordered", title: "Ordered dithering" },
        ["ordered"],
      ),
      createElement(
        "option",
        { value: "floyd-steinberg", title: "Floyd-Steinberg dithering" },
        ["Floyd"],
      ),
    ],
  ) as HTMLSelectElement;

  elements.outlineCheckbox = createElement("input", {
    id: "wps-outline-checkbox",
    type: "checkbox",
    className: "checkbox checkbox-sm",
  }) as HTMLInputElement;
  elements.outlineThresholdValue = createElement(
    "span",
    { id: "wps-outline-threshold-value" },
    ["55"],
  );
  elements.outlineThresholdSlider = createElement("input", {
    id: "wps-outline-threshold-slider",
    type: "range",
    min: 0,
    max: 200,
    step: 1,
    value: 55,
    className: "range",
    disabled: true,
  }) as HTMLInputElement;

  elements.outlineWidthValue = createElement(
    "span",
    { id: "wps-outline-width-value" },
    ["1"],
  );
  elements.outlineWidthSlider = createElement("input", {
    id: "wps-outline-width-slider",
    type: "range",
    min: 1,
    max: 4,
    step: 1,
    value: 1,
    className: "range",
    disabled: true,
  }) as HTMLInputElement;
  elements.outlineColorCheckbox = createElement("input", {
    id: "wps-outline-color-checkbox",
    type: "checkbox",
    className: "checkbox checkbox-sm",
    disabled: true,
  }) as HTMLInputElement;
  elements.outlineColorInput = createElement("input", {
    id: "wps-outline-color-input",
    type: "color",
    value: "#000000",
    disabled: true,
    style: { width: "2rem", height: "1.5rem", padding: "0", border: "none" },
  }) as HTMLInputElement;

  return createElement(
    "div",
    { id: "wps-dithering-outline-container", className: "control-group" },
    [
      createElement(
        "div",
        { id: "wps-dithering-compact-row", className: "control-item" },
        [
          createElement("div", { id: "wps-dithering-line1" }, [
            createElement(
              "label",
              {
                className: "control-label centered cursor-pointer",
                style: { margin: "0" },
              },
              [
                elements.ditheringCheckbox as HTMLInputElement,
                createElement("span", {}, [
                  `${t("dithering")}: `,
                  elements.ditheringThresholdValue as HTMLElement,
                ]),
              ],
            ),
            elements.ditheringMethod as HTMLSelectElement,
          ]),
          createElement(
            "div",
            { id: "wps-dithering-line2", className: "flex-group" },
            [
              createElement("span", { className: "label-hint-sm" }, ["0"]),
              elements.ditheringThresholdSlider as HTMLInputElement,
              createElement("span", { className: "label-hint-sm" }, ["1500"]),
            ],
          ),
        ],
      ),
      createElement(
        "div",
        { id: "wps-outline-compact-row", className: "control-item" },
        [
          createElement("div", { id: "wps-outline-line1" }, [
            createElement(
              "label",
              {
                className: "control-label centered cursor-pointer",
                style: { margin: "0" },
              },
              [
                elements.outlineCheckbox as HTMLInputElement,
                createElement("span", {}, [t("outline_preserve")]),
              ],
            ),
            createElement(
              "label",
              {
                className: "control-label centered cursor-pointer",
                style: { margin: "0" },
              },
              [
                elements.outlineColorCheckbox as HTMLInputElement,
                createElement("span", { className: "label-hint-sm" }, [
                  t("outline_color"),
                ]),
                elements.outlineColorInput as HTMLInputElement,
              ],
            ),
          ]),
          createElement("div", { id: "wps-outline-line2" }, [
            createElement("div", { className: "wps-outline-sensitivity" }, [
              createElement("span", { className: "label-hint-sm" }, [
                `${t("outline_sensitivity")}: `,
                elements.outlineThresholdValue as HTMLElement,
              ]),
              elements.outlineThresholdSlider as HTMLInputElement,
            ]),
            createElement("div", { className: "wps-outline-width" }, [
              createElement("span", { className: "label-hint-sm" }, [
                `${t("outline_width")}: `,
                elements.outlineWidthValue as HTMLElement,
              ]),
              elements.outlineWidthSlider as HTMLInputElement,
            ]),
          ]),
        ],
      ),
    ],
  );
};

const createCoordinateInput = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.coordTlx = createElement("input", {
    id: "wps-coord-tlx",
    type: "number",
    placeholder: "TLX",
    min: 0,
    step: 1,
  }) as HTMLInputElement;
  elements.coordTly = createElement("input", {
    id: "wps-coord-tly",
    type: "number",
    placeholder: "TLY",
    min: 0,
    step: 1,
  }) as HTMLInputElement;
  elements.coordPxx = createElement("input", {
    id: "wps-coord-pxx",
    type: "number",
    placeholder: "PxX",
    min: 0,
    max: 999,
    step: 1,
  }) as HTMLInputElement;
  elements.coordPxy = createElement("input", {
    id: "wps-coord-pxy",
    type: "number",
    placeholder: "PxY",
    min: 0,
    max: 999,
    step: 1,
  }) as HTMLInputElement;

  return createElement("div", {}, [
    createElement("label", { className: "control-label-sm" }, [
      t("coordinate_input_optional"),
    ]),
    createElement("div", { className: "grid-4-col" }, [
      elements.coordTlx as HTMLInputElement,
      elements.coordTly as HTMLInputElement,
      elements.coordPxx as HTMLInputElement,
      elements.coordPxy as HTMLInputElement,
    ]),
  ]);
};

const createActionButtons = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.addToGallery = createElement(
    "button",
    { id: "wps-add-to-gallery", className: "btn btn-primary flex-1" },
    [t("add_to_gallery")],
  );
  elements.download = createElement(
    "button",
    { id: "wps-download", className: "btn btn-ghost" },
    [t("download")],
  );

  return createElement("div", { className: "flex" }, [
    elements.addToGallery as HTMLButtonElement,
    elements.download as HTMLButtonElement,
  ]);
};
