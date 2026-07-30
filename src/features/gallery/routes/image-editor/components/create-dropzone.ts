import type { CreateElementFn, UIElements } from "./types";

export const createDropzone = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.dropzoneContainer = createElement("div", {
    id: "wps-dropzone-container",
    tabIndex: 0,
    style: {
      border: "2px dashed #d1d5db",
      borderRadius: "0.5rem",
      height: "20rem",
    },
  });

  return elements.dropzoneContainer as HTMLElement;
};
