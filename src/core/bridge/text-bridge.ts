/**
 * Text Bridge - Content ↔ Inject communication for text layers and tile boundaries
 */

/**
 * Send text layers to inject side for overlay rendering
 */
export const sendTextLayersToInject = async () => {
  const { TextLayerStorage } = await import(
    "@/features/text-draw/text-layer-storage"
  );
  const textLayerStorage = new TextLayerStorage();
  const textLayers = await textLayerStorage.getAll();

  window.postMessage(
    {
      source: "mr-wplace-text-layers",
      textLayers,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent ${textLayers.length} text layers to inject side`);
};

/**
 * Send tile boundaries visibility to inject side
 */
export const sendTileBoundariesToInject = async () => {
  const { loadTileBoundariesFromStorage, getTileBoundaries } = await import(
    "@/states/tile-boundaries"
  );
  await loadTileBoundariesFromStorage();
  const visible = getTileBoundaries();

  window.postMessage(
    {
      source: "mr-wplace-tile-boundaries-update",
      visible,
    },
    "*"
  );

  console.log(
    `🧑‍🎨 : Sent tile boundaries visibility to inject side: ${visible}`
  );
};
