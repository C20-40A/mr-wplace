import { t } from "@/i18n/manager";
import type { CreateElementFn, UIElements } from "./types";

export const createPaletteArea = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  elements.colorPaletteContainerMobile = createElement("div", {
    id: "wps-color-palette-container-mobile",
  });
  const summary = createElement("summary", {}, [
    "Color Palette",
    createElement("span", { style: { float: "right" } }, ["▼"]),
  ]);
  const accordion = createElement(
    "details",
    { id: "wps-palette-accordion" },
    [summary, elements.colorPaletteContainerMobile as HTMLElement],
  );

  elements.colorPaletteContainer = createElement("div", {
    id: "wps-color-palette-container",
  });
  const desktopPalette = createElement(
    "div",
    { id: "wps-palette-desktop" },
    [elements.colorPaletteContainer as HTMLElement],
  );

  const paletteScrollArea = createElement(
    "div",
    { id: "wps-palette-scroll-area" },
    [accordion, desktopPalette],
  );

  const transparentSection = createTransparentSection(createElement, elements);

  return createElement("div", { id: "wps-palette-area" }, [
    paletteScrollArea,
    transparentSection,
  ]);
};

const createTransparentSection = (
  createElement: CreateElementFn,
  elements: UIElements,
): HTMLElement => {
  const divider = createElement("div", {
    className: "wps-transparent-divider",
  });

  const btn = createElement(
    "button",
    {
      id: "wps-transparency-tool-btn",
      className: "btn btn-sm wps-transparency-tool-btn",
    },
    [t("transparency_tool")],
  );
  elements.transparencyToolBtn = btn;

  return createElement("div", { id: "wps-transparent-section" }, [
    divider,
    btn,
  ]);
};
