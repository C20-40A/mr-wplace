# Inject Context メモリ最適化 TODO

## 問題

Android/Edge環境で起動時にアプリが強制終了する。
- UI挿入は完了するが、modal開いても何も表示されない
- おそらくメモリを食い尽くしている（特定端末で発生）

## 調査結果（2025-11-20）

### 実測データ

**ケース1: 小さな画像（35枚、ほとんど400px以下）**
- Content script: 54.73MB → 80.66MB (**+25.93MB**)
- Inject script: 60.74MB → 63.36MB (**+2.62MB**)
- データサイズ: 0.37MB (35枚)
- スナップショット: 0.96MB (5個)
- **合計タイル数: 38タイル**
- **結論: 問題なし**

**ケース2: 大きな画像含む（37枚）**
- Content script: 121.48MB → 195.71MB (**+74.23MB**)
- データサイズ: **2.94MB** (37枚)
- **2.94MB のデータ送信 → +74.23MB のメモリ消費（25倍に膨張）**
- **結論: 大きな画像を含むとメモリ消費が激増**

### 本質的な問題

#### **問題1: 起動時に全画像を一括送信・処理**

```
起動時 (content.ts:446)
  ↓
sendGalleryImagesToInject()
  - 全画像のdataUrl（Base64）を取得
  - 統計データも含めて一括送信（2.94MB）
  ↓
inject側で受信 (handleGalleryImages)
  ↓
各画像を順次処理:
  1. Base64 → ImageBitmap 変換（メモリ膨張）
  2. タイル分割処理（全タイルを事前生成）
  3. 統計データの復元
  ↓
結果: +74.23MB のメモリ消費
```

**主な原因**:
- Base64 → ImageBitmap 変換で **25倍にメモリ膨張**
- 表示していない画像も含めて **全画像を事前処理**
- タイル分割で **全タイルを事前生成** (例: 5000x5000px → 25タイル)

#### **問題2: 統計データの送信**

- 起動時に全画像の `perTileColorStats` を送信
- メモリ消費: 約10MB
- **実際には統計表示時にしか使わない**

#### **問題3: スナップショットの送信**

- 起動時に全スナップショットを送信
- メモリ消費: 約1MB
- **time-travelモーダルを開いたときにしか使わない**

---

## シンプルで本質的な対策案

### ✅ **優先度1: 起動時の画像送信を停止**（最もシンプル・効果大）

**現状**:
```typescript
// content.ts:446
await Promise.all([
  sendGalleryImagesToInject(),  // ← 起動時に全画像送信
  sendSnapshotsToInject(),
  // ...
]);
```

**改善案**:
```typescript
// 起動時は送信しない（コメントアウトまたは削除）
await Promise.all([
  // sendGalleryImagesToInject(),  // ← 削除
  // sendSnapshotsToInject(),       // ← 削除
  sendComputeDeviceToInject(),
  sendTileBoundariesToInject(),
  sendCacheSizeToInject(),
]);

// ユーザーが実際に画像を表示させたとき（ギャラリーで描画ONにしたとき）に送信
// gallery/common-actions.ts などで個別に送信
```

**期待効果**:
- 起動時メモリ: **+74MB → 0MB** (完全に削減)
- 既存の仕組みを変更しない（送信タイミングを変えるだけ）
- 複雑なロジック不要

**実装箇所**:
- `src/content.ts:446` - 起動時の送信を削除
- `src/features/gallery/common-actions.ts` - 描画ON時に送信

---

### ✅ **優先度2: 統計データを起動時に送信しない**

**現状**:
```typescript
// content.ts:56
perTileColorStats: img.perTileColorStats,  // ← 統計データも送信
```

**改善案**:
```typescript
// 起動時は統計データを含めない
// perTileColorStats: img.perTileColorStats,  // ← コメントアウト

// 統計表示時（paint-stats modal など）に別途要求
```

**期待効果**:
- 起動時メモリ: **-10MB**

---

### ✅ **優先度3: スナップショットの遅延ロード**

**現状**:
```typescript
// content.ts:447
sendSnapshotsToInject(),  // ← 起動時に送信
```

**改善案**:
```typescript
// 起動時は送信しない
// time-travel feature の初期化時、またはモーダルを開いたときに送信
```

**期待効果**:
- 起動時メモリ: **-1MB**

---

## 実装計画（シンプル版）

### Phase 1: 起動時の画像送信を停止（最優先）

**作業内容**:
1. `src/content.ts:446` - `sendGalleryImagesToInject()` を削除
2. `src/features/gallery/common-actions.ts` - 描画ON時に `sendGalleryImagesToInject()` を呼ぶ
3. 動作確認

**期待結果**:
- 起動時のメモリ消費が **0MB** になる
- ユーザーが実際に描画ONにした画像のみメモリに展開

---

### Phase 2: 統計データの遅延送信

**作業内容**:
1. `src/content.ts:56` - `perTileColorStats` を送信しない
2. 統計表示時に別途要求する仕組みを追加

**期待結果**:
- 起動時のメモリ消費が **さらに10MB削減**

---

### Phase 3: スナップショットの遅延ロード

**作業内容**:
1. `src/content.ts:447` - `sendSnapshotsToInject()` を削除
2. time-travel feature の初期化時に送信

**期待結果**:
- 起動時のメモリ消費が **さらに1MB削減**

---

## 🐛 修正済みのバグ（2025-11-20）

### ✅ Text Layerの統計保存エラー

**問題**:
- text layerのタイル描画時に統計が計算され、`handleStatsComputed()` に送信される
- しかし `GalleryStorage` には text layer が存在しないため、エラーが発生
- 大量のエラーログが発生し、Sentryのレート制限に引っかかる

**修正内容** (`src/content.ts:165-168`):
```typescript
// Skip text layers
if (imageKey.startsWith("text_")) return;
```

**理由**:
- text layerは統計を永続化する必要がない（一時的なオーバーレイのため）
- gallery画像のみ統計を保存すればよい

---

## 実装の原則

1. **シンプルであること** - 複雑なロジックは避ける
2. **本質的であること** - 対処療法ではなく、根本的な解決
3. **既存の仕組みを壊さない** - タイミングを変えるだけ
4. **段階的に実装** - Phase 1で効果を確認してから Phase 2 へ

---

## 次のアクション

**Phase 1 の実装**:
1. `sendGalleryImagesToInject()` の起動時呼び出しを削除
2. 描画ON時に個別送信する仕組みを追加
3. 動作確認・メモリ測定
