# Migration Architecture - 実装状況

## ✅ 完了した実装（Phase 1-3）

### Phase 1: Worker Infrastructure
- ✅ `migration.worker.ts` - Web Worker の実装
- ✅ `messaging.ts` - 型安全な通信ヘルパー
- ⚠️ **Worker の統合は Phase 4 に延期**（inject context で `chrome.runtime.getURL` が使えないため）

### Phase 2: Repository & Data Layer
- ✅ `schema.ts` - IndexedDB スキーマ
- ✅ `layer-repository.ts` - Repository Pattern 実装
- ✅ メモリキャッシュ（LRU, 最大100枚）
- ✅ 高速パス/フォールバックの自動切り替え

### Phase 3: Integration
- ✅ inject/index.ts への統合
- ✅ レイヤー保存ハンドラー
- ✅ メッセージルーティング
- ✅ グローバル変数への登録

## 🎯 Phase 4 実装状況 (2025-11-27)

### ✅ 完了した機能

**Gallery と IndexedDB の統合:**
- Gallery 保存時に Chrome Storage + IndexedDB (legacy_blobs) に保存
- content.ts に `saveLayerToIndexedDB()` 追加
- inject 側の `handleLayerSave()` で Repository 経由で保存

### ✅ 動作する機能

1. **IndexedDB の初期化**
   - データベース作成
   - Object Stores 作成
   - Indexes 作成

2. **LayerRepository**
   - レイヤー保存（legacy_blobs に保存）
   - レイヤー取得（legacy_blobs から切り出し）
   - レイヤー削除
   - レイヤー無効化
   - メモリキャッシュ

3. **inject context での動作**
   - Repository の自動初期化
   - メッセージハンドラー
   - グローバル変数への登録

### ⚠️ 一時的に無効化されている機能

1. **Web Worker**
   - 理由: inject context で `chrome.runtime.getURL` が使えない
   - 影響: 自動最適化（タイル分割）ができない
   - 現在の動作: **フォールバックパス**のみ（legacy_blobs から直接切り出し）
   - 解決策: Phase 4 で content script 経由で Worker を初期化

2. **自動タイル最適化**
   - Worker が無効なため未実装
   - 手動での最適化も未実装

## 📊 パフォーマンス

### 現在の動作（Worker なし）

**レイヤー保存:**
- legacy_blobs に Blob として保存
- タイル分割なし
- メモリ効率: 画像サイズに依存

**タイル取得:**
- legacy_blobs から OffscreenCanvas で切り出し
- 1回目: ~50ms（切り出し処理）
- 2回目以降: ~1ms（キャッシュヒット）

### Phase 4 完了後の目標（Worker あり）

**レイヤー保存:**
- legacy_blobs + optimized_tiles に保存
- Worker でバックグラウンド分割

**タイル取得:**
- optimized_tiles から直接取得
- 1回目: ~16ms（IndexedDB 読み込み）
- 2回目以降: ~1ms（キャッシュヒット）

## 🚧 Phase 4 で実装する内容

### 1. Worker の統合

**課題:** inject context で `chrome.runtime.getURL` が使えない

**解決策:**
```typescript
// content.ts で Worker を作成
const workerUrl = chrome.runtime.getURL('dist/migration.worker.js');

// inject に Worker URL を送信
window.postMessage({
  source: 'mr-wplace-worker-url',
  workerUrl: workerUrl
}, '*');

// inject で Worker を作成
const worker = new Worker(workerUrl);
```

### 2. Migration Manager

**content.ts に実装:**
- Chrome Storage → IndexedDB への移行
- 移行ステータス管理
- 中断時の再開機能

### 3. Gallery の統合

**Gallery 保存時:**
1. IndexedDB に保存（Repository 経由）
2. inject に通知
3. Worker が自動的に最適化

### 4. fetch-interceptor の統合

**タイル取得時:**
1. Repository.getTile() を呼び出し
2. isOptimized=true なら optimized_tiles から取得（高速パス）
3. isOptimized=false なら legacy_blobs から切り出し（フォールバック）
4. Worker に最適化をリクエスト

## 📝 動作確認方法

詳細は `MIGRATION_VERIFICATION.md` を参照。

### クイックチェック

```javascript
// IndexedDB が作成されているか確認
// DevTools → Application → IndexedDB → mr-wplace-v2

// Repository が初期化されているか確認
console.log(window.mrWplace?.layerRepository);
// → LayerRepository インスタンス

// Worker の状態を確認
console.log(window.mrWplace?.workerMessenger);
// → undefined (Phase 4 で統合予定)

// テスト用レイヤーを保存
const canvas = document.createElement('canvas');
canvas.width = 100;
canvas.height = 100;
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#ff0000';
ctx.fillRect(0, 0, 100, 100);

window.postMessage({
  source: 'mr-wplace-layer-save',
  layer: {
    id: 'test_001',
    type: 'gallery',
    visible: true,
    zIndex: 0,
    opacity: 1,
    coords: { TLX: 0, TLY: 0, PxX: 0, PxY: 0 },
    bounds: { top: 0, left: 0, right: 0, bottom: 0 },
    isOptimized: false,
    timestamp: Date.now()
  },
  dataUrl: canvas.toDataURL()
}, '*');

// レイヤーを取得
const tile = await window.mrWplace?.layerRepository?.getTile('test_001', '0000,0000,000,000');
console.log(tile);
// → ImageBitmap

// クリーンアップ
tile?.close();
```

## 🎯 次のステップ

1. **動作確認** - 現在の実装が正しく動作するか確認
2. **Phase 4 の計画** - Worker 統合の詳細設計
3. **Migration Manager の実装** - Chrome Storage からの移行処理
4. **Gallery の統合** - 既存の Gallery を新システムに統合
5. **テスト作成** - Unit Test / Integration Test

## 📖 関連ドキュメント

- `MIGRATION_VERIFICATION.md` - 動作確認方法
- `migration_plan.md` - 全体計画
- `docs/migration/implementation-design.md` - 実装設計
- `docs/migration/concerns-and-mitigation.md` - 懸念点と対策
- `docs/migration/testing-strategy.md` - テスト戦略

---

**更新日:** 2025-11-27
**現在のフェーズ:** Phase 3 完了、Phase 4 準備中
**動作状況:** Repository のみ動作（Worker は Phase 4 で統合）
