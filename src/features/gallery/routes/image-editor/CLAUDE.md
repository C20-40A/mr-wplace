# Gallery Image Editor - AI 向けナレッジ

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

- **index.ts**: GalleryImageEditor（UI+Controller 統合）
- **ui.ts**: ImageEditorUI（DOM 生成+callbacks interface）
- **controller.ts**: EditorController（状態管理・DOM 参照・統合処理）
- **file-handler.ts**: ファイル IO 純粋関数群
- **canvas-processor.ts**: Canvas 処理純粋関数群

## file-handler.ts - ファイル IO 純粋関数

```typescript
readFileAsDataUrl(file): Promise<string>
resizeImageIfNeeded(dataUrl): Promise<string>  // 500px超確認→リサイズ
createBlobFromCanvas(canvas): Promise<Blob>
blobToDataUrl(blob): Promise<string>
downloadBlob(blob, filename): void
parseDrawPositionFromFileName(fileName): DrawPosition | null
```

## canvas-processor.ts - Canvas 処理純粋関数

```typescript
interface ImageAdjustments {
  brightness: number;  // -100~100
  contrast: number;    // -100~100
  saturation: number;  // -100~100
  sharpness: number;   // 0~100
}

applyImageAdjustments(imageData, adjustments): void        // 破壊的変更
applySharpness(imageData, amount): void                     // 3x3畳み込みシャープネス
quantizeToColorPalette(imageData, selectedColorIds): void  // 破壊的変更
createProcessedCanvas(img, scale, adjustments, selectedColorIds): HTMLCanvasElement
```

### 処理フロー

```
createProcessedCanvas()
  1. リサイズ描画
  2. applyImageAdjustments() 明るさ・コントラスト・彩度・シャープネス
  3. quantizeToColorPalette() パレット量子化
  4. 完成canvas返却

GPU処理フロー (gpu-image-processor.ts)
  Phase1: brightness/contrast/saturation → intermediateTex
  Phase1.5: sharpness (3x3畳み込み) → sharpnessTex
  Phase2: palette quantization → finalTex
  readPixels → 出力
```

### シャープネス処理 (2025-11-10 追加)

**目的**: アンチエイリアス除去でドット絵風に

- **デフォルトOFF**: パフォーマンスのためトグルで有効化
- **UI**: チェックボックス + スライダー（ディザリングと同様）
- **8方向3x3畳み込みカーネル**: エッジ強調＋中間色削除
- **強度調整**: 0-100 → 正規化 (0-1)
- **カーネル重み**:
  ```
  -s  -s  -s
  -s  1+8s -s
  -s  -s  -s
  ```
  合計 = 1（正規化済み）
- **GPU/CPU両対応**: 同一アルゴリズム実装
- **GPUスキップ最適化**: `sharpness == 0.0` のときPhase1.5をスキップ
- **境界処理**: 画像の端1ピクセルはスキップ
- **アルファチャンネル**: 処理対象外（RGB のみ）
- **適用順序**: パレット量子化の前に適用（中間色を除去してから量子化）

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
sharpnessEnabled: boolean       // デフォルトfalse
sharpness: number               // 0-100
ditheringEnabled: boolean
ditheringThreshold: number
useGpu: boolean
imageInspector: ImageInspector | null
colorPalette: ColorPalette | null
currentFileName: string | null
drawPosition: DrawPosition | null
```

### 公開メソッド

```typescript
handleFile(file); // 初期読込: 調整パラメータリセット
replaceImage(file); // 画像置換: 調整パラメータ保持（2025-11-07追加）
onScaleChange(scale); // canvas-processor使用
onBrightnessChange(value);
onContrastChange(value);
onSaturationChange(value);
onSharpnessToggle(enabled); // 2025-11-10追加
onSharpnessChange(value);   // 2025-11-10追加
onDitheringChange(enabled);
onDitheringThresholdChange(threshold);
onGpuToggle(enabled);
onColorSelectionChange(colorIds);
clearImage();
saveToGallery(); // file-handler使用
downloadImage(); // file-handler使用
initColorPalette(container);
updateColorPaletteContainer(isMobile);
loadExistingImage(item); // ギャラリーからの編集
```

### 内部メソッド

```typescript
displayImage(imageSrc); // 初期表示: ImageInspector初期化、パラメータリセット
replaceImageDisplay(imageSrc); // 画像置換: パラメータ保持、再描画のみ（2025-11-07追加）
updateOriginalImageDisplay(); // 小画像拡大表示制御
updateScaledImage(); // canvas-processor統合処理呼出
saveCanvasToGallery(blob); // GalleryStorage保存+座標付与
updateCoordinateInputs(); // 座標UI自動入力
updateSaveButtonLabel(); // 保存/更新ボタンラベル切替
```

### 処理フロー

```
handleFile()  // 初期読込
  → readFileAsDataUrl()
  → resizeImageIfNeeded()
  → displayImage()
    → updateOriginalImageDisplay()
    → ImageInspector初期化
    → initColorPalette()
    → updateScaledImage()
      → createProcessedCanvas()  // canvas-processor

replaceImage()  // 画像置換（2025-11-07追加）
  → readFileAsDataUrl()
  → resizeImageIfNeeded()
  → replaceImageDisplay()  // パラメータ保持
    → updateOriginalImageDisplay()
    → updateScaledImage()  // 既存パラメータで再描画
      → createProcessedCanvas()
```

## ImageEditorUI (ui.ts)

### Callbacks Interface

```typescript
interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onReplaceImage: (file: File) => void; // 画像置き換え（調整パラメータ保持）
  onScaleChange: (scale: number) => void;
  onBrightnessChange: (value: number) => void;
  onContrastChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onSharpnessToggle: (enabled: boolean) => void;  // 2025-11-10追加
  onSharpnessChange: (value: number) => void;     // 2025-11-10追加
  onDitheringChange: (enabled: boolean) => void;
  onDitheringThresholdChange: (threshold: number) => void;
  onGpuToggle: (enabled: boolean) => void;
  onClear: () => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}
```

### UI 構造（レスポンシブ）

```
[PC] 2x2グリッド
├─ 左上: 元画像（#wps-original-area）
│   └─ 画像置き換えゾーン（hover時オーバーレイ表示、クリック/D&D対応）
├─ 右上: 処理後画像（#wps-current-area + ImageInspector）
├─ 左下: ColorPalette（常時表示）
└─ 右下: 調整スライダー+ボタン

[Mobile] 縦1カラム
├─ 元画像（画像置き換え対応）
├─ 処理後画像
├─ ColorPalette（アコーディオン）
└─ 調整スライダー+ボタン
```

### 画像置き換え機能（2025-11-07 追加）

- **元画像エリア**にホバー時、オーバーレイ表示
- **クリック**でファイル選択ダイアログ表示
- **ドラッグ&ドロップ**で画像置き換え
- 置き換え時、現在の調整パラメータ（scale/brightness/contrast/saturation/dithering）を保持
- `replaceImage()`メソッドで実装（controller.ts:108-145）

### コンポーネント統合

- **ImageDropzone**: autoHide=true
- **ImageInspector**: canvas zoom/pan 自動付与
- **画像置き換えゾーン**: #wps-image-replace-zone（ui.ts:408-466）

## GalleryImageEditor (index.ts)

### 初期化フロー

```typescript
render(container)
  → ui.createAndGetContainer()
  → new EditorController(uiContainer)
  → ui.setupUI(callbacks)  // controller methods bind
```

## 技術仕様

### Canvas 処理

- **imageSmoothingEnabled: false** → ピクセルアート保持
- **image-rendering: pixelated** → CSS 側でもピクセル保持

### 色変換

- **colorpalette 依存**: constants/colors.ts
- **ImageData 破壊的変更**: applyAdjustments/quantize 直接変更
- **距離計算**: √ 省略版（二乗和のみ）

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

- **file-handler.ts**: 副作用（File 読込/保存/DL）抽出
- **canvas-processor.ts**: Canvas 計算ロジック純粋化
- **controller.ts**: 状態管理・DOM 参照・統合のみ

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
- **Callbacks**: UI-Controller 間インターフェース

## パフォーマンス

- **ImageData 直接変更**: getImageData 1 回 → 処理 →putImageData 1 回
- **Canvas 再利用**: updateScaledImage 内で同 canvas 更新
- **setTimeout(50ms)**: パレット変更 debounce

## 制約

- **colorpalette 依存**: 色変換完全依存
- **Chrome Extension**: window.mrWplace global 依存
- **canvas 最大表示**: 300px（小画像拡大）

**Core**: UI/Controller/Utils 3 層分離、純粋関数抽出、状態管理集約、Canvas 処理統合
