import { storage } from "@/utils/browser-api";

export interface AreaFillCorners {
  topLeft: { lat: number; lng: number } | null;
  bottomRight: { lat: number; lng: number } | null;
}

export class AreaFillStorage {
  private static readonly STORAGE_KEY = "mr-wplace-area-fill-corners";
  private static readonly WARNING_SHOWN_KEY =
    "mr-wplace-area-fill-warning-shown";

  static async getCorners(): Promise<AreaFillCorners> {
    const result = await storage.get([this.STORAGE_KEY]);
    return result[this.STORAGE_KEY] ?? { topLeft: null, bottomRight: null };
  }

  static async setCorners(corners: AreaFillCorners): Promise<void> {
    await storage.set({ [this.STORAGE_KEY]: corners });
  }

  static async setTopLeft(lat: number, lng: number): Promise<void> {
    const corners = await this.getCorners();
    corners.topLeft = { lat, lng };
    await this.setCorners(corners);
  }

  static async setBottomRight(lat: number, lng: number): Promise<void> {
    const corners = await this.getCorners();
    corners.bottomRight = { lat, lng };
    await this.setCorners(corners);
  }

  static async clear(): Promise<void> {
    await this.setCorners({ topLeft: null, bottomRight: null });
  }

  static async hasShownWarning(): Promise<boolean> {
    const result = await storage.get([this.WARNING_SHOWN_KEY]);
    return result[this.WARNING_SHOWN_KEY] ?? false;
  }

  static async setWarningShown(): Promise<void> {
    await storage.set({ [this.WARNING_SHOWN_KEY]: true });
  }
}
