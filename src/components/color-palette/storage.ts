import { STORAGE_KEYS } from "../../constants/storage-keys";

export type ComputeDevice = "gpu" | "cpu";

const COMPUTE_DEVICE_KEY = `${STORAGE_KEYS.prefix}compute_device`;

export class ColorPaletteStorage {
  static async getComputeDevice(): Promise<ComputeDevice> {
    const result = await chrome.storage.local.get([COMPUTE_DEVICE_KEY]);
    return result[COMPUTE_DEVICE_KEY] ?? "gpu";
  }

  static async setComputeDevice(device: ComputeDevice): Promise<void> {
    await chrome.storage.local.set({ [COMPUTE_DEVICE_KEY]: device });
    console.log("🧑‍🎨 : Compute device saved:", device);
  }
}
