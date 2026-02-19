import { findPositionModal } from "@/constants/selectors";
import { WplaceMap } from "@/inject/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Close position modal if opened by pixel click
 */
const clickPositionModalCloseButton = () => {
  const positionModalElement = findPositionModal();
  if (!positionModalElement) return;

  const closeButton = positionModalElement.querySelector<HTMLButtonElement>(
    'button:has(path[d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"])',
  );
  closeButton?.click();
};

export const resolveMapInstanceAsync = async (): Promise<
  WplaceMap | undefined
> => {
  let mapInstance: WplaceMap | null = null;

  const originalValues = Map.prototype.values;
  const restore = () => {
    Map.prototype.values = originalValues;
  };
  Map.prototype.values = function () {
    const iter = originalValues.call(this);

    for (const v of iter) {
      if (!v?.maps) continue;

      for (const m of v.maps) {
        if (typeof m?.flyTo !== "function") continue;

        mapInstance = m;
        restore();
        break;
      }
    }

    return iter;
  };

  const forceTrigger = () => {
    if (mapInstance) return;
    const canvas: HTMLCanvasElement | null = document.querySelector(
      "canvas.maplibregl-canvas",
    );
    if (!canvas) return;

    canvas.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: canvas.width / 2,
        clientY: canvas.height / 2,
        button: 0,
      }),
    );
  };

  for (let i = 0; i < 5; i++) {
    await delay(300 + i * 200);
    if (mapInstance) {
      console.log("🧑‍🎨 Map instance found:", mapInstance);
      clickPositionModalCloseButton();
      return mapInstance;
    }
    forceTrigger();
  }
  return undefined;
};

export const getMapInstanceFromWplace = (): WplaceMap | null => {
  return window.mrWplace?.wplaceMap || null;
};
