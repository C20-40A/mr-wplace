import { Router } from "../../utils/router";

export type ColorFilterRoute = "color-filter";

export class ColorFilterRouter extends Router<ColorFilterRoute> {
  constructor() {
    const titleMap: Record<ColorFilterRoute, string> = {
      "color-filter": "color_filter",
    };
    super("color-filter", titleMap);
  }
}
