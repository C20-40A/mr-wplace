import { WplaceMap } from "@/inject/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const getMapInstance = async () => {
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
      "canvas.maplibregl-canvas"
    );
    if (!canvas) return;

    canvas.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: canvas.width / 2,
        clientY: canvas.height / 2,
        button: 0,
      })
    );
  };

  for (let i = 0; i < 10; i++) {
    await delay(300);
    if (mapInstance) {
      console.log("🧑‍🎨 Map instance found:", mapInstance);
      break;
    }
    forceTrigger();
  }
};
