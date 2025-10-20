import { storage } from "@/utils/browser-api";

/**
 * タイル名称専用Storage管理
 * 座標(tileX, tileY) → 名称マッピング
 */
export class TileNameStorage {
  private static getKey(tileX: number, tileY: number): string {
    return `tile_name_${tileX}_${tileY}`;
  }

  static async setTileName(tileX: number, tileY: number, name: string): Promise<void> {
    const key = this.getKey(tileX, tileY);
    if (name.trim()) {
      await storage.set({ [key]: name.trim() });
    } else {
      // 空文字の場合は削除
      await storage.remove(key);
    }
  }

  static async getTileName(tileX: number, tileY: number): Promise<string | null> {
    const key = this.getKey(tileX, tileY);
    const result = await storage.get(key);
    return result[key] || null;
  }

  static async deleteTileName(tileX: number, tileY: number): Promise<void> {
    const key = this.getKey(tileX, tileY);
    await storage.remove(key);
  }

  /**
   * 複数タイルの名称を一括取得（効率化）
   */
  static async getTileNames(tiles: { tileX: number; tileY: number }[]): Promise<Map<string, string>> {
    const keys = tiles.map(t => this.getKey(t.tileX, t.tileY));
    const result = await storage.get(keys);
    
    const nameMap = new Map<string, string>();
    for (const tile of tiles) {
      const key = this.getKey(tile.tileX, tile.tileY);
      const name = result[key];
      if (name) {
        nameMap.set(`${tile.tileX}_${tile.tileY}`, name);
      }
    }
    
    return nameMap;
  }
}
