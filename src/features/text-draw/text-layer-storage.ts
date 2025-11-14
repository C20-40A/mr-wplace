import { storage } from "@/utils/browser-api";

export interface TextLayerItem {
  key: string;
  text: string;
  font: string;
  coords: {
    TLX: number;
    TLY: number;
    PxX: number;
    PxY: number;
  };
  dataUrl: string;
  timestamp: number;
}

const STORAGE_KEY = "text_layers";

export class TextLayerStorage {
  async get(key: string): Promise<TextLayerItem | undefined> {
    const result = await storage.get([STORAGE_KEY]);
    const items: TextLayerItem[] = result[STORAGE_KEY] || [];
    return items.find((item) => item.key === key);
  }

  async getAll(): Promise<TextLayerItem[]> {
    const result = await storage.get([STORAGE_KEY]);
    return result[STORAGE_KEY] || [];
  }

  async save(item: TextLayerItem): Promise<void> {
    const items = await this.getAll();
    const index = items.findIndex((i) => i.key === item.key);

    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }

    await storage.set({ [STORAGE_KEY]: items });
  }

  async delete(key: string): Promise<void> {
    const items = await this.getAll();
    const filtered = items.filter((i) => i.key !== key);
    await storage.set({ [STORAGE_KEY]: filtered });
  }
}
