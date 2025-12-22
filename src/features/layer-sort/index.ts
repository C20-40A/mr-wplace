import { getLayerSort, loadLayerSortFromStorage } from "@/states/layer-sort";

/**
 * Send layer sort state to inject script
 */
export const sendLayerSortToInject = (enabled: boolean): void => {
  window.postMessage(
    {
      source: "mr-wplace-layer-sort-update",
      enabled,
    },
    "*"
  );
};

/**
 * Initialize layer sort feature
 */
export const initLayerSort = async (): Promise<void> => {
  await loadLayerSortFromStorage();
  const enabled = getLayerSort();
  sendLayerSortToInject(enabled);
  console.log("🧑‍🎨 : Layer sort initialized:", enabled);
};

export const layerSortAPI = {
  initLayerSort,
  sendLayerSortToInject,
};