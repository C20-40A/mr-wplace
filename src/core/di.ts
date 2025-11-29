/**
 * WPlace Studio Dependency Injection Container
 *
 * 循環参照を回避し、feature間の依存を管理する軽量DIコンテナ
 *
 * 使い方:
 * 1. 各featureのAPI型を定義
 * 2. di.register()で登録
 * 3. di.get()で取得
 */

// ========================================
// Feature API型定義
// ========================================
import type { GalleryItem } from "@/states/galleryStorage";

export interface GalleryAPI {
  initGallery: () => void;
  showGallery: () => void;
  showSelectionMode: (onSelect: (item: any) => void) => void;
  setDrawToggleCallback: (callback: (key: string) => Promise<boolean>) => void;
}

export interface TileOverlayAPI {
  initTileOverlay: () => void;
  drawImageAt: (
    lat: number,
    lng: number,
    galleryItem: GalleryItem
  ) => Promise<void>;
  toggleImageDrawState: (imageKey: string) => Promise<boolean>;
  restoreImagesOnTile: (tileX: number, tileY: number) => Promise<void>;
  drawPixelOnTile: (
    tileBlob: Blob,
    tileX: number,
    tileY: number
  ) => Promise<Blob>;
}

export interface DrawingAPI {
  initDrawing: () => void;
  // 必要に応じて追加
}

export interface TimeTravelAPI {
  initTimeTravel: () => void;
  show: () => void;
  showCurrentPosition: () => void;
  navigateToDetail: (fullKey: string) => void;
  closeModal: () => void;
}

export interface BookmarkAPI {
  initBookmark: () => void;
  // 必要に応じて追加
}

export interface TextDrawAPI {
  initTextDraw: () => Promise<void>;
}

export interface DrawingLoaderAPI {
  initDrawingLoader: () => void;
  show: (message?: string) => void;
  hide: () => void;
}

export interface FriendsBookAPI {
  initFriendsBook: () => void;
}

// ========================================
// DIコンテナ型定義
// ========================================

export interface FeatureRegistry {
  gallery: GalleryAPI;
  tileOverlay: TileOverlayAPI;
  drawing: DrawingAPI;
  timeTravel: TimeTravelAPI;
  bookmark: BookmarkAPI;
  textDraw: TextDrawAPI;
  drawingLoader: DrawingLoaderAPI;
  friendsBook: FriendsBookAPI;
}

// ========================================
// DIコンテナ実装
// ========================================

class DIContainer {
  private features = new Map<keyof FeatureRegistry, any>();

  /**
   * Featureを登録
   */
  register<K extends keyof FeatureRegistry>(
    name: K,
    api: FeatureRegistry[K]
  ): void {
    if (this.features.has(name)) {
      console.warn(`🧑‍🎨 : Feature "${name}" already registered, overwriting`);
    }
    this.features.set(name, api);
    console.log(`🧑‍🎨 : Feature "${name}" registered`);
  }

  /**
   * Featureを取得
   */
  get<K extends keyof FeatureRegistry>(name: K): FeatureRegistry[K] {
    const api = this.features.get(name);
    if (!api) {
      throw new Error(
        `🧑‍🎨 : Feature "${name}" not found. Did you forget to register it?`
      );
    }
    return api;
  }

  /**
   * Featureが登録済みかチェック
   */
  has(name: keyof FeatureRegistry): boolean {
    return this.features.has(name);
  }

  /**
   * 全Feature一覧（デバッグ用）
   */
  list(): string[] {
    return Array.from(this.features.keys());
  }
}

// ========================================
// シングルトンインスタンス
// ========================================

export const di = new DIContainer();
