import { t } from "@/i18n/manager";
import type { CreateElementFn, UIElements } from "./types";
import { createPaletteArea } from "./create-palette-area";
import { createControlsArea } from "./create-controls-area";

export const createImageDisplayArea = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  const originalArea = createOriginalArea(createElement, elements);
  const currentArea = createCurrentArea(createElement, elements);
  const paletteArea = createPaletteArea(createElement, elements);
  const controlsArea = createControlsArea(createElement, elements);

  elements.mainGrid = createElement("div", { id: "wps-main-grid" }, [
    originalArea,
    currentArea,
    paletteArea,
    controlsArea,
  ]);

  elements.imageDisplay = createElement(
    "div",
    { id: "wps-image-display", style: { display: "none" } },
    [elements.mainGrid as HTMLElement],
  );

  return elements.imageDisplay as HTMLElement;
};

const createOriginalArea = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.originalImage = createElement("img", {
    id: "wps-original-image",
    alt: "Original",
  }) as HTMLImageElement;
  elements.replaceOverlay = createElement("div", { id: "wps-replace-overlay" }, [
    `📁 ${t("click_or_drop_to_change")}`,
  ]);
  elements.replaceFileInput = createElement("input", {
    id: "wps-replace-file-input",
    type: "file",
    accept: "image/*,.json",
    style: { display: "none" },
  }) as HTMLInputElement;

  elements.replaceZone = createElement("div", { id: "wps-image-replace-zone" }, [
    elements.replaceOverlay as HTMLElement,
    elements.replaceFileInput as HTMLInputElement,
  ]);

  const imageLayer = createElement("div", { id: "wps-original-image-layer" }, [
    elements.originalImage as HTMLImageElement,
    createElement(
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
  ]);

  return createElement("div", { id: "wps-original-area" }, [
    imageLayer,
    elements.replaceZone as HTMLElement,
  ]);
};

const createCurrentArea = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.scaledCanvas = createElement("canvas", {
    id: "wps-scaled-canvas",
  }) as HTMLCanvasElement;
  const canvasContainer = createElement("div", { id: "wps-canvas-container" }, [
    elements.scaledCanvas as HTMLCanvasElement,
  ]);

  elements.scaledImage = createElement("img", {
    id: "wps-scaled-image",
    alt: "Current",
  }) as HTMLImageElement;
  const imageContainer = createElement("div", { id: "wps-image-container" }, [
    elements.scaledImage as HTMLImageElement,
  ]);

  elements.gpuToggle = createElement("input", {
    type: "checkbox",
    id: "wps-gpu-toggle",
    className: "checkbox checkbox-xs",
    checked: true,
  }) as HTMLInputElement;
  const gpuLabel = createElement("label", { className: "gpu-toggle-label" }, [
    elements.gpuToggle as HTMLInputElement,
    createElement("span", {}, ["⚡GPU"]),
  ]);

  const flexContainer = createElement("div", { className: "flex" }, [
    canvasContainer,
    imageContainer,
    gpuLabel,
    createElement(
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

  return createElement("div", { id: "wps-current-area" }, [flexContainer]);
};
