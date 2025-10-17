# WPlace Studio DI Container

## Architecture

```
di.register() → FeatureRegistry → di.get() → 循環参照回避
```

## 基本パターン

### Feature 実装

```typescript
// src/features/gallery/index.ts
import { di, type GalleryAPI } from "../../core/di";

export function initGallery() {
  /* UI初期化 */
}
export async function selectImage() {
  /* ... */
}

// API export
export const galleryAPI: GalleryAPI = {
  initGallery,
  selectImage,
  toggleImageDraw,
};
```

### content.ts 初期化

```typescript
import { di } from "./core/di";
import { galleryAPI } from "./features/gallery";
import { tileOverlayAPI } from "./features/tile-overlay";

// 1. 登録
di.register("gallery", galleryAPI);
di.register("tileOverlay", tileOverlayAPI);

// 2. 初期化
galleryAPI.initGallery();
tileOverlayAPI.initTileOverlay();
```

### Feature 間やり取り

```typescript
// src/features/drawing/index.ts
import { di } from "../../core/di";

export async function drawWithGalleryImage() {
  const gallery = di.get("gallery");
  const tileOverlay = di.get("tileOverlay");

  const image = await gallery.selectImage();
  await tileOverlay.drawImageAt(lat, lng, image);
}
```

## API 型追加

```typescript
// src/core/di.ts
export interface NewFeatureAPI {
  initNewFeature: () => void;
  doSomething: () => Promise<void>;
}

export interface FeatureRegistry {
  gallery: GalleryAPI;
  newFeature: NewFeatureAPI; // 追加
}
```

## ルール

- コンストラクタ内で di.get()禁止（未登録）
- init 関数内で di.get()は OK
- API 型に従って export 必須
- 登録 → 初期化の順序厳守

## メリット

- 循環参照完全回避
- 型安全（TypeScript 推論効く）
- 依存明確（di.get()で可視化）
- テスト容易（mock 差し替え）
