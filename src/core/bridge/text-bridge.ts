/**
 * Text Bridge - Content ↔ Inject communication for text layers
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
