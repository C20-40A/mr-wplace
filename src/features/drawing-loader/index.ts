import { DrawingLoaderUI } from "./ui";

let ui: DrawingLoaderUI;
let isLoading = false;
let loadingStartTime = 0;

export const initDrawingLoader = (): void => {
  ui = new DrawingLoaderUI();

  window.addEventListener("message", (event) => {
    if (event.data.source === "wplace-studio-drawing-start") {
      startLoading();
    }
    if (event.data.source === "wplace-studio-drawing-complete") {
      finishLoading();
    }
  });
};

const startLoading = (): void => {
  if (isLoading) return;
  isLoading = true;
  loadingStartTime = Date.now();
  ui.showDrawing();
  console.log("🧑‍🎨 : Drawing loader started");
};

const finishLoading = (): void => {
  if (!isLoading) return;
  const duration = Date.now() - loadingStartTime;
  console.log(`🧑‍🎨 : Drawing loader finished (${duration}ms)`);
  isLoading = false;
  ui.hide();
};

export const show = (message?: string): void => {
  ui.show(message);
};

export const hide = (): void => {
  ui.hide();
};

export const drawingLoaderAPI = {
  initDrawingLoader,
  show,
  hide,
};
