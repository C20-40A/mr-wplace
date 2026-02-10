import { storage } from "@/utils/browser-api";
import { getMapInstanceReady } from "@/states/map-instance-ready";
import { t } from "@/i18n/manager";
import { findTopLeftControls } from "@/constants/selectors";

const SCALE_DISPLAY_KEY = "mapFilter_scaleDisplay";

let scaleButton: HTMLButtonElement | null = null;
let scaleDisplay = false;
let mapReady = false;

const updateScaleButton = () => {
  if (!scaleButton) return;
  scaleButton.disabled = !mapReady;
  scaleButton.classList.toggle("btn-active", scaleDisplay);
  scaleButton.classList.toggle("opacity-50", !mapReady);
};

const notifyScaleDisplay = () => {
  window.postMessage(
    { source: "mr-wplace-scale-display-update", visible: scaleDisplay },
    "*",
  );
};

const toggleScaleDisplay = async () => {
  if (!mapReady) return;
  scaleDisplay = !scaleDisplay;
  await storage.set({ [SCALE_DISPLAY_KEY]: scaleDisplay });
  notifyScaleDisplay();
  updateScaleButton();
  console.log("🧑‍🎨 : Filter toggled:", "scaleDisplay");
};

const createScaleButton = () => {
  scaleButton = document.createElement("button");
  scaleButton.className = "btn btn-sm btn-circle";
  scaleButton.innerHTML = "📏";
  scaleButton.title = t`${"map_filter_scaleDisplay"}`;
  scaleButton.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleScaleDisplay();
  });
  updateScaleButton();
  const container = findTopLeftControls();
  if (container) container.appendChild(scaleButton);
  else document.body.appendChild(scaleButton);
};

const init = async () => {
  const stored = await storage.get([SCALE_DISPLAY_KEY]);
  scaleDisplay = stored[SCALE_DISPLAY_KEY] ?? false;

  createScaleButton();

  mapReady = getMapInstanceReady();
  if (mapReady) {
    updateScaleButton();
    notifyScaleDisplay();
  }

  window.addEventListener("message", (event: MessageEvent) => {
    if (
      event.data.source === "mr-wplace-map-instance-captured" &&
      event.data.ready
    ) {
      mapReady = true;
      updateScaleButton();
      notifyScaleDisplay();
    }
  });

  console.log("🧑‍🎨 : Distance measure initialized");
};

export const distanceMeasureAPI = {
  initDistanceMeasure: init,
};
