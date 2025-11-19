# Inject Context メモリ最適化 TODO

## 問題

Android/Edge環境で起動時にアプリが強制終了する。
- UI挿入は完了するが、modal開いても何も表示されない
- おそらくメモリを食い尽くしている（特定端末で発生）

## 調査結果（2025-11-20）

### 起動時の重い処理（メモリ消費量推定）

#### 🔴 **最も怪しい処理**

**1. sendGalleryImagesToInject() → handleGalleryImages()**
- **場所**: `content.ts:446` → `inject/handlers/overlay-handlers.ts:10-76`
- **処理**: 全画像のdataUrl + 統計データを一括送信 → inject側でImageBitmapに変換 → タイル分割
- **メモリ消費**:
  - 画像10枚 × 1MB (Base64) = 30MB（postMessage送信時）
  - タイル分割後のImageBitmap: 500MB（画像5000x5000px × 5枚 × 25タイル/枚の場合）
  - **合計: 530MB**

**2. splitImageOnTiles() でのタイル分割**
- **場所**: `inject/tile-draw/image-processing/split-tiles.ts:7-71`
- **処理**: 各画像を1000x1000pxタイルに分割 → すべてImageBitmapとして `overlayLayers` に保持
- **問題**: 起動時にすべてのタイルを分割・メモリに展開
- **メモリ消費**: 1タイル = 4MB → 125タイル = 500MB

**3. sendSnapshotsToInject() → handleSnapshotsUpdate()**
- **場所**: `utils/inject-bridge.ts:192-235` → `inject/handlers/overlay-handlers.ts:82-132`
- **処理**: Uint8Array → Blob → DataURL → ImageBitmap
- **メモリ消費**: スナップショット10個 × 6MB (変換過程で3倍) = 60MB

**4. 統計データの送信と復元**
- **場所**: `content.ts:56` → `inject/handlers/overlay-handlers.ts:48-61`
- **処理**: perTileColorStats (Object) → Map 変換
- **メモリ消費**: 100タイル × 10KB/タイル × 10画像 = 10MB

#### 🟡 **その他**
- Feature初期化: 10〜20MB

### **合計メモリ使用量（ワーストケース）**
- ギャラリー画像 + タイル分割: 530MB
- スナップショット: 60MB
- 統計データ: 10MB
- Feature初期化: 20MB
- **合計: 620MB**

**Android環境のメモリ制限**: 256〜512MB → **超過してクラッシュ**

---

## 対策案（優先度順）

### 🔥 **優先度: 高（即効性あり）**

#### **1. タイル分割の遅延実行** ✅ 最優先
- **現在**: 起動時にすべてのタイルを分割・保持
- **改善**: タイルレンダリング時に必要な部分のみ分割
- **実装**:
  - `addImageToOverlayLayers()` ではタイル分割を行わず、元画像のImageBitmapのみ保持
  - `drawOverlayLayersOnTile()` で描画時に必要なタイルのみ分割・キャッシュ
  - LRUキャッシュで古いタイルを破棄
- **メモリ削減**: 500MB → 50MB（10タイルキャッシュの場合）

#### **2. 画像送信の分割・遅延ロード**
- **現在**: 起動時に全画像を一括送信
- **改善**: 描画enabled画像のみ送信、または1枚ずつ送信
- **実装**:
  - `sendGalleryImagesToInject()` で `drawEnabled: true` の画像のみ送信
  - または、画像を1枚ずつpostMessageで送信（await可能）
- **メモリ削減**: 30MB → 10MB程度

#### **3. 統計データの遅延送信**
- **現在**: 起動時にすべての統計データを送信
- **改善**: 統計表示時に要求があったときのみ送信
- **実装**:
  - `sendGalleryImagesToInject()` で `perTileColorStats` を含めない
  - 統計表示時に `requestPerTileStats(imageKey)` で要求
- **メモリ削減**: 10MB

### 🟡 **優先度: 中**

#### **4. スナップショットの遅延ロード**
- **現在**: 起動時に全スナップショットを送信
- **改善**: タイムトラベルモーダルを開いたときに送信
- **実装**:
  - `content.ts:447` から `sendSnapshotsToInject()` を削除
  - time-travel feature初期化時に送信
- **メモリ削減**: 60MB

#### **5. ImageBitmapのLRUキャッシュ導入**
- **現在**: すべてのタイルを保持
- **改善**: 最近使用したタイルのみ保持（例: 20タイル）
- **実装**:
  - タイルキャッシュに `lastUsed` タイムスタンプを追加
  - キャッシュサイズ超過時に古いタイルを破棄
- **メモリ削減**: 動的に調整可能

### 🟢 **優先度: 低（調査・検証）**

#### **6. postMessageデータサイズの監視**
- 送信前にデータサイズをログ出力
- 巨大なデータを送信している場合はアラート

#### **7. メモリ使用量の監視**
- `performance.memory` でメモリ使用量を監視
- 閾値を超えたら警告を表示

---

## 調査手順

### ✅ Phase 1: ログ追加（完了 2025-11-20）

以下のログを追加して、実際のメモリ消費量を確認できるようにした:

1. ✅ `sendGalleryImagesToInject()`: postMessage前にデータサイズをログ
   - `content.ts:65-69`: JSON.stringify()でデータサイズを計算、MB単位で表示

2. ✅ `sendSnapshotsToInject()`: postMessage前にデータサイズをログ
   - `utils/inject-bridge.ts:231-236`: JSON.stringify()でデータサイズを計算、MB単位で表示

3. ✅ `handleGalleryImages()`: タイル分割後の `overlayLayers` サイズをログ
   - `inject/handlers/overlay-handlers.ts:49-56`: 各画像のタイル数をログ
   - `inject/handlers/overlay-handlers.ts:84`: 合計タイル数をログ
   - `inject/handlers/overlay-handlers.ts:87-91`: 処理後のメモリ使用量をログ

4. ✅ メモリ使用量監視: 起動前後の `performance.memory.usedJSHeapSize` を比較
   - `content.ts:282-285`: content script 起動時のメモリ使用量
   - `content.ts:475-481`: content script 起動完了後のメモリ使用量と増加量
   - `inject/index.ts:38-41`: inject script 起動時のメモリ使用量
   - `inject/index.ts:65-71`: inject script 起動完了後のメモリ使用量と増加量

**次のステップ**:
- Chrome Developer Toolsのコンソールでログを確認
- 実際のメモリ消費量を把握
- ボトルネックを特定してPhase 2の最適化に進む

### Phase 2: 最適化実装（未着手）
1. タイル分割の遅延実行（最優先）
2. 統計データの遅延送信
3. スナップショットの遅延ロード

---

## 実装メモ

### タイル分割の遅延実行案

**現在の流れ**:
```
addImageToOverlayLayers(bitmap, coords, imageKey)
  ↓
splitImageOnTiles(bitmap, coords) ← すべてのタイルを分割
  ↓
overlayLayers.push({ tiles: preparedOverlayImages })
  ↓
drawOverlayLayersOnTile(tileX, tileY) ← 必要なタイルを取得
```

**改善後**:
```
addImageToOverlayLayers(bitmap, coords, imageKey)
  ↓
overlayLayers.push({ sourceBitmap: bitmap, coords }) ← 元画像のみ保持
  ↓
drawOverlayLayersOnTile(tileX, tileY)
  ↓
キャッシュにタイルがあれば使用、なければその場で分割
  ↓
LRUキャッシュに保存（サイズ制限あり）
```

**利点**:
- 起動時のメモリ消費が激減
- 実際に表示するタイルのみメモリに保持
- キャッシュサイズを調整可能

**課題**:
- タイル描画時に分割処理が発生 → 初回表示が遅くなる可能性
- キャッシュ管理の複雑化

**解決策**:
- Web Worker でタイル分割を並列処理（別タスク）
- または、分割処理を最適化（Canvas APIは十分高速）
