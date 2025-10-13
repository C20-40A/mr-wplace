# Gallery Image Editor - AI向けナレッジ

## アーキテクチャ

```
GalleryImageEditor → {ImageEditorUI, EditorController}
         ↓                ↓              ↓
    render()        DOM生成+event    状態管理+統合
         ↓                              ↓
   Callbacks連携                file-handler.ts
                                canvas-processor.ts
```

## ファイル構成

- **index.ts**: GalleryImageEditor（UI+Controller統合）
- **ui.ts**: ImageEditorUI（DOM生成+callbacks interface）
- **controller.ts**: EditorController（状態管理・DOM参照・統合処理）
- **file-handler.ts**: ファイルIO純粋関数群
- **canvas-processor.ts**: Canvas処理純粋関数群

## file-handler.ts - ファイルIO純粋関数

```typescript
readFileAsDataUrl(file): Promise<string>
resizeImageIfNeeded(dataUrl): Promise<string>  // 500px超確認→リサイズ
createBlobFromCanvas(canvas): Promise<Blob>
blobToDataUrl(blob): Promise<string>
downloadBlob(blob, filename): void
parseDrawPositionFromFileName(fileName): DrawPosition | null
```

## canvas-processor.ts - Canvas処理純粋関数

```typescript
interface ImageAdjustments {
  brightness: number;  // -100~100
  contrast: number;    // -100~100
  saturation: number;  // -100~100
}

applyImageAdjustments(imageData, adjustments): void        // 破壊的変更
quantizeToColorPalette(imageData, selectedColorIds): void  // 破壊的変更
createProcessedCanvas(img, scale, adjustments, selectedColorIds): HTMLCanvasElement
```

### 処理フロー

```
createProcessedCanvas()
  1. リサイズ描画
  2. applyImageAdjustments() 明るさ・コントラスト・彩度
  3. quantizeToColorPalette() パレット量子化
  4. 完成canvas返却
```

### 色変換アルゴリズム

```typescript
// RGB Euclidean距離（√省略版）
colorDist2(r1,g1,b1, r2,g2,b2) = (r1-r2)² + (g1-g2)² + (b1-b2)²
```

## EditorController (controller.ts)

### 状態管理

```typescript
originalImage: HTMLImageElement | null
scaledCanvas: HTMLCanvasElement | null
imageScale: number              // 0.1-1.0
selectedColorIds: number[]
brightness/contrast/saturation: number
imageInspector: ImageInspector | null
colorPalette: ColorPalette | null
currentFileName: string | null
drawPosition: DrawPosition | null
```

### 公開メソッド

```typescript
handleFile(file)              // file-handler使用
onScaleChange(scale)          // canvas-processor使用
onBrightnessChange(value)
onContrastChange(value)
onSaturationChange(value)
onColorSelectionChange(colorIds)
clearImage()
saveToGallery()               // file-handler使用
downloadImage()               // file-handler使用
initColorPalette(container)
updateColorPaletteContainer(isMobile)
```

### 内部メソッド

```typescript
displayImage(imageSrc)           // ImageInspector初期化
updateOriginalImageDisplay()     // 小画像拡大表示制御
updateScaledImage()              // canvas-processor統合処理呼出
saveCanvasToGallery(blob)        // GalleryStorage保存+座標付与
```

### 処理フロー

```
handleFile()
  → readFileAsDataUrl()
  → resizeImageIfNeeded()
  → displayImage()
    → updateOriginalImageDisplay()
    → ImageInspector初期化
    → initColorPalette()
    → updateScaledImage()
      → createProcessedCanvas()  // canvas-processor
```

## ImageEditorUI (ui.ts)

### Callbacks Interface

```typescript
interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}
```

### UI構造（レスポンシブ）

```
[PC] 2x2グリッド
├─ 左上: 元画像（#wps-original-area）
├─ 右上: 処理後画像（#wps-current-area + ImageInspector）
├─ 左下: ColorPalette（常時表示）
└─ 右下: 調整スライダー+ボタン

[Mobile] 縦1カラム
├─ 元画像
├─ 処理後画像
├─ ColorPalette（アコーディオン）
└─ 調整スライダー+ボタン
```

### コンポーネント統合

- **ImageDropzone**: autoHide=true
- **ImageInspector**: canvas zoom/pan自動付与

## GalleryImageEditor (index.ts)

### 初期化フロー

```typescript
render(container)
  → ui.createAndGetContainer()
  → new EditorController(uiContainer)
  → ui.setupUI(callbacks)  // controller methods bind
```

## 技術仕様

### Canvas処理

- **imageSmoothingEnabled: false** → ピクセルアート保持
- **image-rendering: pixelated** → CSS側でもピクセル保持

### 色変換

- **colorpalette依存**: constants/colors.ts
- **ImageData破壊的変更**: applyAdjustments/quantize直接変更
- **距離計算**: √省略版（二乗和のみ）

### 座標情報

- **ファイル名形式**: `${TLX}-${TLY}-${PxX}-${PxY}.png`
- **parseDrawPositionFromFileName()**: 正規表現抽出
- **保存時付与**: drawPosition + drawEnabled=true

### リサイズ確認

- **閾値**: 500px
- **confirm dialog**: t`${"large_image_resize_confirm"}`
- **高品質**: imageSmoothingQuality="high"

## 設計パターン

### 純粋関数分離

- **file-handler.ts**: 副作用（File読込/保存/DL）抽出
- **canvas-processor.ts**: Canvas計算ロジック純粋化
- **controller.ts**: 状態管理・DOM参照・統合のみ

### 責任分離

```
UI層（ui.ts）
  ↓ callbacks
Controller層（controller.ts）
  ↓ 関数呼出
Utils層（file-handler, canvas-processor）
```

### 型安全

- **ImageAdjustments**: 調整パラメータ型定義
- **DrawPosition**: 座標情報型（storage.ts）
- **Callbacks**: UI-Controller間インターフェース

## パフォーマンス

- **ImageData直接変更**: getImageData 1回→処理→putImageData 1回
- **Canvas再利用**: updateScaledImage内で同canvas更新
- **setTimeout(50ms)**: パレット変更debounce

## 制約

- **zoom固定**: 11（coordinate.ts依存）
- **colorpalette依存**: 色変換完全依存
- **Chrome Extension**: window.mrWplace global依存
- **canvas最大表示**: 300px（小画像拡大）

**Core**: UI/Controller/Utils 3層分離、純粋関数抽出、状態管理集約、Canvas処理統合
