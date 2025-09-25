# Gallery Image Editor - AI 向けナレッジ

## アーキテクチャ

```
GalleryImageEditor → {ImageEditorUI, ImageProcessor}
         ↓                ↓              ↓
    render()        DOM生成+event    画像処理ロジック
```

## ファイル構成

- **index.ts**: GalleryImageEditor（UI+Processor 統合）
- **ui.ts**: ImageEditorUI（DOM+callbacks interface）
- **editor.ts**: ImageProcessor（画像処理コア）

## ImageProcessor (editor.ts)

### 状態管理

```typescript
originalImage: HTMLImageElement; // 元画像
colorConvertedCanvas: HTMLCanvasElement; // パレット変換後
scaledCanvas: HTMLCanvasElement; // 縮小処理後
imageScale: number; // 縮小率(0.1-1.0)
isColorConverted: boolean; // 色変換状態
includePaidColors: boolean; // paid色含む
imageInspector: ImageInspector; // canvas zoom/pan
```

### 処理フロー

```
File読込 → displayImage() → convertToPalette() → updateScaledImage()
              ↓                    ↓                   ↓
        原画canvas化         色変換処理          scale適用+表示
```

### 色変換アルゴリズム

```typescript
// RGB Euclidean距離で最近色探索
findNearestColor(rgb: [r,g,b]) {
  for (colorEntry of colorpalette) {
    if (!includePaidColors && colorEntry.premium) continue;
    distance = √((r-r')² + (g-g')² + (b-b')²);
    if (distance < minDistance) nearestColor = color;
  }
}
```

### 保存処理

- **Gallery 保存**: canvas.toBlob() → base64 → GalleryStorage.save()
- **Download**: canvas.toBlob() → URL.createObjectURL() → a.download

### 画像表示制御

```typescript
// 小画像: 300px内に拡大表示
if ((w, h <= 300)) scale = min(300 / w, 300 / h);
// 大画像: auto（縮小表示）
```

## ImageEditorUI (ui.ts)

### Callbacks Interface

```typescript
interface ImageEditorCallbacks {
  onFileHandle: (file: File) => void;
  onScaleChange: (scale: number) => void;
  onClear: () => void;
  onPaidToggle: (includePaid: boolean) => void;
  onSaveToGallery: () => void;
  onDownload: () => void;
}
```

### UI 構造

```html
<div id="wps-image-editor-container">
  <a href="color_converter" target="_blank">🎨</a>  <!-- 外部ツールリンク -->
  <div id="wps-image-area">
    <div id="wps-dropzone-container"></div>        <!-- ImageDropzone -->
    <div id="wps-image-display" class="hidden">
      <button id="wps-clear-btn"></button>         <!-- 画像削除 -->
      <div class="grid grid-cols-2">
        <img id="wps-original-image">              <!-- 元画像 -->
        <canvas id="wps-scaled-canvas">            <!-- 処理後canvas -->
      </div>
    </div>
  </div>
  <div id="wps-controls" class="hidden">
    <span id="wps-original-size"></span>           <!-- サイズ表示 -->
    <span id="wps-current-size"></span>
    <input type="range" id="wps-scale-slider">     <!-- 縮小率 -->
    <input type="checkbox" id="wps-paid-toggle">   <!-- paid色トグル -->
    <button id="wps-add-to-gallery"></button>      <!-- Gallery保存 -->
    <button id="wps-download"></button>            <!-- Download -->
  </div>
</div>
```

### コンポーネント統合

- **ImageDropzone**: autoHide=true、File 選択後非表示
- **ImageInspector**: canvas zoom/pan 機能自動付与

## GalleryImageEditor (index.ts)

### 初期化フロー

```typescript
constructor() → render(container) → {
  ui.createAndGetContainer()
  new ImageProcessor(uiContainer)
  ui.setupUI(callbacks) → processor methods bind
}
```

### Callbacks 配線

```typescript
callbacks = {
  onFileHandle: processor.handleFile,
  onScaleChange: processor.onScaleChange,
  // ... 全メソッドbind
};
```

## 技術仕様

### Canvas 処理

- **imageSmoothingEnabled: false** → ピクセルアート保持
- **image-rendering: pixelated** → CSS 側でもピクセル保持
- scale 処理: `ctx.drawImage(src, 0,0,w,h, 0,0,newW,newH)`

### 色変換制約

- **colorpalette 依存**: constants/colors.ts
- **premium filter**: colorEntry.premium 判定
- **全ピクセル処理**: getImageData → 逐次変換 → putImageData

### ImageInspector 連携

```typescript
originalImage.onload = () => {
  updateOriginalImageDisplay();
  imageInspector = new ImageInspector(canvas); // 自動zoom/pan
  convertToPalette();
};
```

### Global access

```typescript
window.mrWplace.imageEditor.closeModal(); // モーダル閉じる
window.mrWplace.gallery.show(); // Gallery表示
```

## UI/UX

- **2 カラムレイアウト**: オリジナル（左）+ 処理後（右）
- **リアルタイム更新**: scale/paid toggle 変更即反映
- **画像クリア**: confirm 確認後 clearImage()
- **外部ツール**: 🎨 リンクで color converter 別タブ表示

## 制約

- **zoom 固定**: 11 固定（coordinate.ts 依存）
- **colorpalette 依存**: 色変換完全依存
- **Chrome Extension**: window.mrWplace global 依存
- **canvas size**: 大画像は自動縮小表示（max-width: 300px）

## 処理フロー詳細

```
1. File drop → FileReader.readAsDataURL()
2. displayImage() → img.src設定 → onload
3. convertToPalette() → 全pixel色変換
4. updateScaledImage() → scale適用
5. ImageInspector初期化 → zoom/pan有効化
6. User操作 → callbacks → processor methods
7. 保存: toBlob() → {Gallery storage | Download}
```

**Core**: UI/Logic 完全分離、callbacks interface 結合、ImageInspector 統合、colorpalette 色変換、canvas scale 処理

## レイアウト

[上部] 画像エリア
├─ PC: 2 カラム横並び (lg:grid-cols-2)
├─ Mobile: 縦並び
└─ 各画像: 枠囲み + 下部にサイズ表示

[下部] 設定エリア  
├─ PC: 左(ColorPalette 常時表示) | 右(スライダー+ボタン)
└─ Mobile: アコーディオンパレット(デフォルト閉) + スライダー+ボタン
