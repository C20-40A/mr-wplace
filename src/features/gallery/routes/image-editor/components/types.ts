export type UIElements = {
  [key: string]:
    | HTMLElement
    | HTMLInputElement
    | HTMLSelectElement
    | HTMLCanvasElement
    | HTMLImageElement;
};

export type CreateElementFn = (
  tagName: keyof HTMLElementTagNameMap,
  options?: Record<string, any>,
  children?: (Node | string)[],
) => HTMLElement;
