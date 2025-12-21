// ==UserScript==
// @name         Map Getter
// @match        https://wplace.live/*
// @run-at       document-start
// @description  get wplace map instance
// @version      1.0.0
// ==/UserScript==

(() => {
  const script = document.createElement("script");
  script.textContent = `
    (() => {
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

            document.head.__bmmap = m;
            restore();
            break;
          }
        }

        return iter;
      };
    })();
  `;
  document.documentElement.appendChild(script);
})();

const forceTrigger = () => {
  console.log("clickするで");
  if (document.head.__bmmap) {
    console.log(document.head.__bmmap);
    console.log("あるやん。もうええやろ");
    return;
  }
  const canvas = document.querySelector("canvas.maplibregl-canvas");
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
  console.log("おらっ。たぶん、clickしたで");
};

setTimeout(forceTrigger, 300);
setTimeout(forceTrigger, 600);
setTimeout(forceTrigger, 900);
setTimeout(forceTrigger, 1200);
setTimeout(forceTrigger, 1500);
