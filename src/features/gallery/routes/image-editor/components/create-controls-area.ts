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
      createDitheringSharpnessControl(createElement, elements),
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

  return createElement("div", {}, [
    createElement(
      "label",
      { className: "control-label space-between" },
      [
        createElement("span", { className: "label-hint" }, ["0.1x"]),
        createElement("span", {}, [t("size_reduction")]),
        createElement("span", { className: "label-hint" }, ["1.0x"]),
      ],
    ),
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
      createElement("option", { value: "lab" }, [
        t("quantization_lab"),
      ]),
    ],
  ) as HTMLSelectElement;

  return createElement(
    "div",
    { id: "wps-contrast-quantization-container", className: "control-group" },
    [
      createElement("div", { className: "control-item" }, [
        createElement(
          "label",
          { className: "control-label space-between" },
          [
            createElement("span", { className: "label-hint" }, ["-100"]),
            createElement("span", {}, [
              `${t("contrast")}: `,
              elements.contrastValue as HTMLElement,
            ]),
            createElement("span", { className: "label-hint" }, ["100"]),
          ],
        ),
        elements.contrastSlider as HTMLInputElement,
      ]),
      createElement("div", { className: "control-item" }, [
        createElement(
          "label",
          { className: "control-label centered" },
          [t("quantization_method")],
        ),
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
        createElement(
          "label",
          { className: "control-label space-between" },
          [
            createElement("span", { className: "label-hint" }, ["-100"]),
            createElement("span", {}, [
              `${t("brightness")}: `,
              elements.brightnessValue as HTMLElement,
            ]),
            createElement("span", { className: "label-hint" }, ["100"]),
          ],
        ),
        elements.brightnessSlider as HTMLInputElement,
      ]),
      createElement("div", { className: "control-item" }, [
        createElement(
          "label",
          { className: "control-label space-between" },
          [
            createElement("span", { className: "label-hint" }, ["-100"]),
            createElement("span", {}, [
              `${t("saturation")}: `,
              elements.saturationValue as HTMLElement,
            ]),
            createElement("span", { className: "label-hint" }, ["100"]),
          ],
        ),
        elements.saturationSlider as HTMLInputElement,
      ]),
    ],
  );
};

const createDitheringSharpnessControl = (
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

  elements.sharpnessCheckbox = createElement("input", {
    id: "wps-sharpness-checkbox",
    type: "checkbox",
    className: "checkbox checkbox-sm",
  }) as HTMLInputElement;
  elements.sharpnessValue = createElement("span", { id: "wps-sharpness-value" }, [
    "0",
  ]);
  elements.sharpnessSlider = createElement("input", {
    id: "wps-sharpness-slider",
    type: "range",
    min: 0,
    max: 100,
    step: 1,
    value: 0,
    className: "range",
    disabled: true,
  }) as HTMLInputElement;

  return createElement(
    "div",
    { id: "wps-dithering-sharpness-container", className: "control-group" },
    [
      createElement("div", { className: "control-item" }, [
        createElement(
          "label",
          { className: "control-label centered cursor-pointer" },
          [
            elements.ditheringCheckbox as HTMLInputElement,
            createElement("span", {}, [
              `${t("dithering")}: `,
              elements.ditheringThresholdValue as HTMLElement,
            ]),
          ],
        ),
        createElement("div", { className: "flex-group" }, [
          createElement("span", { className: "label-hint-sm" }, ["0"]),
          elements.ditheringThresholdSlider as HTMLInputElement,
          createElement("span", { className: "label-hint-sm" }, ["1500"]),
        ]),
      ]),
      createElement("div", { className: "control-item" }, [
        createElement(
          "label",
          { className: "control-label centered cursor-pointer" },
          [
            elements.sharpnessCheckbox as HTMLInputElement,
            createElement("span", {}, [
              `${t("sharpness")}: `,
              elements.sharpnessValue as HTMLElement,
            ]),
          ],
        ),
        createElement("div", { className: "flex-group" }, [
          createElement("span", { className: "label-hint-sm" }, ["0"]),
          elements.sharpnessSlider as HTMLInputElement,
          createElement("span", { className: "label-hint-sm" }, ["100"]),
        ]),
      ]),
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
