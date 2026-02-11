# Front Tile Layer - 実装ドキュメント

## 概要

Front Tile Layer は、MapLibreGL の独立ラスターレイヤーとしてオーバーレイを描画する新方式。従来の fetch interceptor による背景タイルへの合成方式とは異なり、独立したレイヤーとして overlay を表示する。

### 従来方式 vs 新方式

**従来方式（fetch interceptor composite）:**
```
WPlace tile fetch → intercept → 背景タイル + overlay 合成 → 返却
```

**新方式（Front Layer）:**
```
WPlace tile fetch → そのまま返却（背景用）
Custom protocol (mr-wplace-overlay://{z}/{x}/{y}.png) → intercept → 透明背景 + overlay 合成 → 独立レイヤーとして表示
```

### メリット

- fetch intercept 回数削減によるパフォーマンス向上
- 背景タイルとオーバーレイの分離（z-index 制御が容易）
- overlay のみの動的更新が可能

---

## 実装状況（2026-02-11 更新）

### ✅ 完了した実装

1. **基本レイヤー/ソース管理**
   - カスタムソース追加（`FRONT_SOURCE_ID`: `"mr-wplace-overlay-source"`）
   - カスタムプロトコル（`mr-wplace-overlay://{z}/{x}/{y}.png`）
   - Fetch interceptor 統合（`isFrontLayerTileRequest`, `handleFrontLayerTileRequest`）
   - 透明背景上に `drawOverlayLayersOnTile` でオーバーレイ描画

2. **Config toggle + default OFF**
   - `window.mrWplaceFrontTileLayerEnabled` flag（default: false）
   - メッセージ経由での有効化/無効化（`"mr-wplace-front-tile-layer-update"`）

3. **動的更新（状態変化時のタイル再読み込み）**
   - Color filter、gallery images、snapshots、text layers、show unplaced 変更時に自動更新
   - `refreshFrontTileLayer()` で source/layer remove → re-add して MapLibreGL にタイル再取得させる

4. **既存方式との排他制御**
   - Front tile layer ON 時は fetch interceptor が overlay 合成をスキップ
   - 背景タイルをそのまま返却し、overlay は front layer で描画

### ⚙️ 調整が必要な箇所

- **Refresh パフォーマンス**: source remove/re-add は確実だが、やや重い。代替案検討中（後述）
- **Content 側 UI**: developer menu での toggle は未実装

---

## ファイル構成

```
src/inject/features/map-instance/front-tile-layer/
├── index.ts              # レイヤー/ソース管理、refresh 処理
├── fetch-handler.ts      # カスタムプロトコル処理（mr-wplace-overlay://）
├── front-tile-layer.ts   # Re-export barrel
├── front-layerの実装.md  # 元の作業ログ（アーカイブ）
└── CLAUDE.md             # このファイル
```

**関連ファイル:**
- `src/inject/types.ts` — Window 型に `mrWplaceFrontTileLayerEnabled` 追加
- `src/inject/handlers/state-handlers.ts` — 状態変化ハンドラ + refresh 呼び出し
- `src/inject/handlers/overlay-handlers.ts` — overlay 変化ハンドラ + refresh 呼び出し
- `src/inject/bridge.ts` — メッセージルート `"mr-wplace-front-tile-layer-update"`
- `src/inject/fetch-interceptor.ts` — 排他制御（front layer ON 時 overlay スキップ）
- `src/inject/index.ts` — 初期化（`window.mrWplaceFrontTileLayerEnabled = false`）

---

## 重要なコード・関数

### 1. front-tile-layer/index.ts

#### 定数
```typescript
const FRONT_LAYER_ID = "pixel-art-layer-overlay";
const FRONT_SOURCE_ID = "mr-wplace-overlay-source";
const FAKE_TILE_PROTOCOL = "mr-wplace-overlay";
```

#### レイヤー sandwich 構造
```
pixel-art-layer (背景タイル)
  ↓
pixel-hover (ホバー表示)
  ↓
pixel-art-layer-overlay (front tile layer、overlay 専用)
```

#### addOverlaySource()
カスタム raster source を追加:
```typescript
map.addSource(FRONT_SOURCE_ID, {
  type: "raster",
  tiles: [`${FAKE_TILE_PROTOCOL}://{z}/{x}/{y}.png`],
  tileSize: 1000,
  minzoom: 11,
  maxzoom: 11,
});
```

#### setFrontTileLayerEnabled(enabled: boolean)
Public API。有効化/無効化を切り替え:
- `enabled=true` → `checkAndAddOverlay()` でレイヤー追加
- `enabled=false` → `removeFrontLayer()` でレイヤー/ソース削除

#### refreshFrontTileLayer() ⚠️ 要調整
**重要:** 状態変化時にタイルを動的更新する関数。

現在の実装:
```typescript
// Remove and re-add source to force MapLibreGL to re-fetch all tiles
map.removeLayer(FRONT_LAYER_ID);
map.removeSource(FRONT_SOURCE_ID);
layerAdded = false;
sourceAdded = false;
addOverlaySource(map);
checkAndAddOverlay(map);
```

**Note:** `source.reload()` は動作しないため、source/layer を削除→再追加している。より軽量な方法があれば要検討。

**代替案:**
1. Tile URL に state version をクエリパラメータとして追加（例: `mr-wplace-overlay://{z}/{x}/{y}.png?v={stateVersion}`）→ URL 変更で自動的に再 fetch
2. MapLibreGL の内部 tile cache API を直接操作（undocumented、リスク高）
3. Layer の opacity を 0 → 1 にアニメーション（視覚的な遅延あり）

#### setupFrontTileLayerOnMapReady(mapInstance)
Map 準備完了時の初期化。`styledata` イベントリスナーを登録し、style 変更時に自動でレイヤーを追加。

---

### 2. front-tile-layer/fetch-handler.ts

#### handleFrontLayerTileRequest(url: string): Promise<Response>
カスタムプロトコルのタイルリクエストを処理:

1. URL から z/x/y を抽出（zoom=11 のみサポート）
2. 透明な 1000x1000px の canvas を生成（`createTransparentTileBlob()`）
3. `drawOverlayLayersOnTile(transparentBlob, [x, y], "gpu")` で overlay を描画
4. PNG blob として返却

**重要:** この関数内で `drawOverlayLayersOnTile` が呼ばれるため、**stats 計算も行われる**。

#### isFrontLayerTileRequest(url: string): boolean
カスタムプロトコルかどうかを判定:
```typescript
return url.startsWith(`mr-wplace-overlay://`);
```

#### createTransparentTileBlob(): Promise<Blob>
1000x1000px の透明 PNG を生成:
```typescript
const canvas = new OffscreenCanvas(1000, 1000);
const ctx = canvas.getContext("2d");
ctx.clearRect(0, 0, 1000, 1000);
return await canvas.convertToBlob({ type: "image/png" });
```

---

### 3. fetch-interceptor.ts（排他制御）

`handleTileRequest()` 内で front tile layer 有効時は overlay 合成をスキップ:

```typescript
// When front tile layer is enabled, skip overlay compositing on background tiles.
if (window.mrWplaceFrontTileLayerEnabled) {
  window.postMessage(
    { source: "wplace-studio-drawing-complete", tileX, tileY },
    "*"
  );
  return new Response(originalTileBlob, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
}
```

**重要:** Snapshot 保存（`wplace-studio-snapshot`）、original blob cache（`setOriginalBlob()`）などの副作用は front layer ON 時も維持される。

---

### 4. state-handlers.ts（動的更新トリガー）

以下のハンドラの末尾で `refreshFrontTileLayer()` を呼び出し:

- **handleColorFilterUpdate** — color filter 変更時
- **handleShowUnplacedOnlyUpdate** — show unplaced mode 変更時
- **handleFrontTileLayerUpdate** — front tile layer 自体の ON/OFF

```typescript
export const handleFrontTileLayerUpdate = (data: { enabled: boolean }): void => {
  window.mrWplaceFrontTileLayerEnabled = data.enabled;
  setFrontTileLayerEnabled(data.enabled);
  console.log("🧑‍🎨 : Front tile layer updated:", data.enabled);
};
```

---

### 5. overlay-handlers.ts（動的更新トリガー）

以下のハンドラの末尾で `refreshFrontTileLayer()` を呼び出し:

- **handleGalleryImagesV2** — gallery 画像変更時
- **handleSnapshotsUpdate** — snapshot 変更時
- **handleTextLayersUpdate** — text layer 変更時

---

### 6. bridge.ts（メッセージルート）

```typescript
"mr-wplace-front-tile-layer-update": handleFrontTileLayerUpdate,
```

Content script から inject へのメッセージルート。

---

### 7. inject/index.ts（初期化）

```typescript
// Initialize front tile layer (experimental, default: false)
window.mrWplaceFrontTileLayerEnabled = false;
```

デフォルトで無効化。`setupFrontTileLayerOnMapReady(mapInstance)` は **既にコメント解除済み**（有効）。

---

### 8. types.ts（型定義）

```typescript
interface Window {
  // ...
  mrWplaceFrontTileLayerEnabled?: boolean;
}
```

---

## 有効化方法

### ブラウザコンソールから手動有効化（テスト用）

```javascript
window.postMessage({ source: "mr-wplace-front-tile-layer-update", enabled: true }, "*")
```

### Content script から有効化（将来の UI 実装用）

```typescript
// content.ts または feature module 内
window.postMessage(
  {
    source: "mr-wplace-front-tile-layer-update",
    enabled: true,
  },
  "*"
);
```

**Storage 永続化の例:**
```typescript
import { storage } from "@/utils/browser-api";

// Save
await storage.set({ "front-tile-layer-enabled": true });

// Load
const result = await storage.get("front-tile-layer-enabled");
const enabled = result["front-tile-layer-enabled"] ?? false;

// Send to inject
window.postMessage(
  { source: "mr-wplace-front-tile-layer-update", enabled },
  "*"
);
```

---

## 動作フロー

### 1. 初期化時
1. `inject/index.ts` で `window.mrWplaceFrontTileLayerEnabled = false`（デフォルト無効）
2. `setupFrontTileLayerOnMapReady(mapInstance)` で `styledata` リスナー登録
3. レイヤーは追加されない（flag が false のため）

### 2. 有効化時
1. メッセージ受信 → `handleFrontTileLayerUpdate({ enabled: true })`
2. `window.mrWplaceFrontTileLayerEnabled = true`
3. `setFrontTileLayerEnabled(true)` → `checkAndAddOverlay(map)`
4. カスタムソース + レイヤー追加
5. MapLibreGL が `mr-wplace-overlay://{z}/{x}/{y}.png` をリクエスト
6. Fetch interceptor が `handleFrontLayerTileRequest()` を呼び出し
7. 透明背景 + overlay 合成して返却
8. Front layer に overlay が表示される

### 3. 状態変化時（color filter, gallery 等）
1. 状態変更ハンドラが実行される
2. ハンドラ末尾で `refreshFrontTileLayer()` 呼び出し
3. Layer/source を削除 → 再追加
4. MapLibreGL が全タイルを再リクエスト
5. Fetch interceptor が最新状態で overlay 描画
6. Front layer が動的更新される

### 4. 無効化時
1. メッセージ受信 → `handleFrontTileLayerUpdate({ enabled: false })`
2. `window.mrWplaceFrontTileLayerEnabled = false`
3. `setFrontTileLayerEnabled(false)` → `removeFrontLayer(map)`
4. Layer/source 削除
5. 従来方式（fetch interceptor composite）に戻る

---

## Stats 計算について

Front tile layer ON 時も **stats 計算は正常に動作**する:
- `handleFrontLayerTileRequest()` 内で `drawOverlayLayersOnTile()` を呼ぶ
- `drawOverlayLayersOnTile()` 内部で stats 計算が行われる
- 背景タイルの fetch interceptor 側では overlay 合成をスキップするが、`checkStateChanged()` は引き続き呼ばれる
- LastModified cache のクリアなども正常に動作

---

## 既知の問題・今後の改善点

### 1. ⚠️ Refresh パフォーマンス（要調整）
現在の `refreshFrontTileLayer()` は source/layer を削除→再追加している。これは確実だが、**やや重い**。

**代替案（優先度順）:**

#### 案1: Tile URL に state version を追加（推奨）
```typescript
// getStateVersion() から state version を取得
const stateVersion = getStateVersion();

// Source 追加時に URL に含める
map.addSource(FRONT_SOURCE_ID, {
  type: "raster",
  tiles: [`${FAKE_TILE_PROTOCOL}://{z}/{x}/{y}.png?v=${stateVersion}`],
  tileSize: 1000,
  minzoom: 11,
  maxzoom: 11,
});
```

**メリット:**
- URL が変わるため、MapLibreGL が自動的にタイルを再 fetch
- Source/layer を削除する必要がない（軽量）

**デメリット:**
- `addOverlaySource()` のロジック変更が必要
- State version が変わるたびに source URL も変わるため、source の再追加は結局必要かも

#### 案2: MapLibreGL 内部 tile cache をクリア（undocumented API）
```typescript
const source = map.getSource(FRONT_SOURCE_ID);
if (source && source._tiles) {
  // Clear internal tile cache
  for (const id in source._tiles) {
    source._tiles[id].state = 'errored'; // Force reload
  }
  source.reload();
}
```

**メリット:**
- Source/layer を削除しない（軽量）

**デメリット:**
- Undocumented API（将来のバージョンで動作しなくなる可能性）
- Tile state 操作はリスクが高い

#### 案3: Layer opacity アニメーション
```typescript
map.setPaintProperty(FRONT_LAYER_ID, 'raster-opacity', 0);
setTimeout(() => {
  map.setPaintProperty(FRONT_LAYER_ID, 'raster-opacity', 1);
}, 100);
```

**メリット:**
- 実装が簡単

**デメリット:**
- タイルは再 fetch されない（視覚的にごまかすだけ）
- 本質的な解決にならない

---

### 2. Content 側 UI（未実装）
Developer menu での toggle UI が未実装。

**実装箇所候補:**
- `src/features/developer/index.ts` に toggle ボタン追加
- Storage に状態を永続化（`browser-api.ts` 経由）
- Inject へのメッセージ送信

**実装例:**
```typescript
// src/features/developer/index.ts
const toggleFrontTileLayer = async () => {
  const currentState = await storage.get("front-tile-layer-enabled");
  const enabled = !(currentState["front-tile-layer-enabled"] ?? false);

  await storage.set({ "front-tile-layer-enabled": enabled });
  window.postMessage(
    { source: "mr-wplace-front-tile-layer-update", enabled },
    "*"
  );
};
```

---

### 3. Layer 順序の柔軟性
現在は `pixel-hover` の後に固定で追加している。Z-index を動的に変更できると便利かもしれない（優先度低）。

---

### 4. Zoom level 対応
現在は zoom=11 のみサポート。他の zoom level への対応が必要な場合、`fetch-handler.ts` の条件を修正:

```typescript
// 現在
if (z !== 11) {
  return createEmptyTileResponse();
}

// 変更案（全 zoom 対応）
// (条件削除)
```

---

## デバッグ方法

### ブラウザコンソール

```javascript
// 状態確認
console.log("Front tile layer enabled:", window.mrWplaceFrontTileLayerEnabled);

// Map instance 取得
const map = window.wplace?.map;

// Source 確認
console.log("Front source:", map.getSource("mr-wplace-overlay-source"));

// Layer 確認
console.log("Front layer:", map.getLayer("pixel-art-layer-overlay"));

// Layer 順序確認
console.log("Layer order:", map.getStyle()?.layers?.map(l => l.id).slice(-5));

// 有効化テスト
window.postMessage({ source: "mr-wplace-front-tile-layer-update", enabled: true }, "*");

// 無効化テスト
window.postMessage({ source: "mr-wplace-front-tile-layer-update", enabled: false }, "*");
```

### ログ出力

実装内では以下のログが出力される:
- `🧑‍🎨 : Front tile source added`
- `🧑‍🎨 : Front tile layer added (sandwich created)`
- `🧑‍🎨 : Layer order: [...]` — Layer 順序確認
- `🧑‍🎨 : Front tile layer refreshed (source removed and re-added)`
- `🧑‍🎨 : Front tile layer updated: {enabled}`
- `🧑‍🎨 : Failed to render front layer tile: {error}` — Tile 描画エラー

---

## 修正ファイル一覧（2026-02-11 実装）

1. `src/inject/types.ts` — Window 型に `mrWplaceFrontTileLayerEnabled` flag 追加
2. `src/inject/features/map-instance/front-tile-layer/index.ts` — `refreshFrontTileLayer()` 追加、window flag 統一
3. `src/inject/features/map-instance/front-tile-layer/front-tile-layer.ts` — `refreshFrontTileLayer` re-export 追加
4. `src/inject/features/map-instance/index.ts` — `refreshFrontTileLayer` export 追加
5. `src/inject/handlers/state-handlers.ts` — `handleFrontTileLayerUpdate` 追加、refresh 呼び出し追加
6. `src/inject/handlers/overlay-handlers.ts` — refresh 呼び出し追加（3 箇所）
7. `src/inject/bridge.ts` — `"mr-wplace-front-tile-layer-update"` ルート追加
8. `src/inject/fetch-interceptor.ts` — 排他制御追加（front layer ON 時 overlay スキップ）
9. `src/inject/index.ts` — `window.mrWplaceFrontTileLayerEnabled = false` 初期化

---

## 参考リンク

- [MapLibreGL Map API](https://maplibre.org/maplibre-gl-js/docs/API/classes/maplibregl.Map/)
- [Raster Source Specification](https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/maplibregl.RasterSourceSpecification/)
- [MapLibreGL Source API](https://maplibre.org/maplibre-gl-js/docs/API/classes/maplibregl.Map/#getsource)

---

## Commit Message（候補）

```
feat(front-tile-layer): add dynamic refresh, mutual exclusion, and config toggle

- Add window.mrWplaceFrontTileLayerEnabled flag (default OFF)
- Implement refreshFrontTileLayer() with source remove/re-add strategy
- Add mutual exclusion with fetch interceptor (skip overlay composite when front layer ON)
- Trigger refresh on state changes (color filter, gallery, snapshots, text layers, unplaced mode)
- Add handleFrontTileLayerUpdate handler and message route
- Export refreshFrontTileLayer from map-instance module
```

---

## 次のステップ（優先度順）

1. ✅ **動作確認** — 既存機能との競合がないか確認（完了）
2. ⚠️ **Refresh パフォーマンス改善** — State version を URL に含める案を検討
3. 🔲 **Content 側 UI 実装** — Developer menu に toggle ボタン追加
4. 🔲 **パフォーマンス測定** — 従来方式との比較（描画速度、メモリ使用量）
5. 🔲 **Storage 永続化** — 設定を保存してページリロード時に復元
