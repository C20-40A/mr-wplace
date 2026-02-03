import { t } from "@/i18n/manager";
import { colorpalette } from "@/constants/colors";
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

  const transparentSection = createTransparentColorSection(createElement);

  return createElement("div", { id: "wps-palette-area" }, [
    paletteScrollArea,
    transparentSection,
  ]);
};

const createTransparentColorSection = (
  createElement: CreateElementFn,
): HTMLElement => {
  const divider = createElement("div", {
    className: "wps-transparent-divider",
  });

  const label = createElement(
    "div",
    { className: "wps-transparent-label" },
    [t("transparent_color")],
  );

  const chips: HTMLElement[] = colorpalette.map((c) =>
    createElement("div", {
      className: "wps-transparent-chip",
      dataset: { rgb: c.rgb.join(",") },
      style: {
        backgroundColor: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`,
      },
    }),
  );

  const grid = createElement("div", { id: "wps-transparent-grid" }, chips);

  return createElement("div", { id: "wps-transparent-section" }, [
    divider,
    label,
    grid,
  ]);
};
