/**
 * Settings Bridge - Content ↔ Inject communication for extension settings
 */

/**
 * Send compute device setting to inject side
 */
export const sendComputeDeviceToInject = async () => {
  const { ColorPaletteStorage } = await import(
    "@/components/color-palette/storage"
  );
  const device = await ColorPaletteStorage.getComputeDevice();

  window.postMessage(
    {
      source: "mr-wplace-compute-device",
      device,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent compute device to inject side: ${device}`);
};

/**
 * Send cache size setting to inject side
 */
export const sendCacheSizeToInject = async () => {
  const { DataSaverStorage } = await import("@/features/data-saver/storage");
  const maxCacheSize = await DataSaverStorage.getMaxCacheSize();

  window.postMessage(
    {
      source: "mr-wplace-cache-size-update",
      maxCacheSize,
    },
    "*"
  );

  console.log(`🧑‍🎨 : Sent cache size to inject side: ${maxCacheSize}`);
};
