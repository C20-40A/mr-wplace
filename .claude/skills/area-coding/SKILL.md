---
name: area-coding
description: area-manager,area-displayなどの、エリアに関する機能のcodingをするためのスキル.このskillにknowledgeがある.これを読んでからareaに関するcodingをすること.
---

# Area Feature Knowledge

## Overview

エリア機能は、マップ上にユーザ定義のポリゴン領域を描画・管理する機能。
content側の `AreaManager` クラスがストレージ・状態管理・UIダイアログを担当し、
inject側の `area-display.ts` がマップ上のSVGオーバーレイ描画・頂点編集を担当する。

!!!codeの内容を変更/構造を変えた場合、このドキュメントも更新すること!!!

## Architecture

### Context Boundary

| 役割                              | Context | ファイル                                                       |
| --------------------------------- | ------- | -------------------------------------------------------------- |
| 状態管理・永続化・UIダイアログ    | content | `src/features/area-manager/area-manager.ts`                    |
| 表示設定ダイアログ                | content | `src/features/area-manager/modules/display-settings/dialog.ts` |
| グループ合体ダイアログ            | content | `src/features/area-manager/modules/group/dialog.ts`            |
| インポート/エクスポートダイアログ | content | `src/features/area-manager/modules/import-export/dialog.ts`    |
| インポート/エクスポート処理       | content | `src/features/area-manager/modules/import-export/usecase.ts`   |
| GeoJSON変換ユーティリティ         | content | `src/features/area-manager/modules/import-export/utils.ts`     |
| Areaメッセージ定数               | shared  | `src/constants/area-message.ts`                                |
| Area共通ユーティリティ            | shared  | `src/utils/area-region.ts`                                     |
| マップ上SVG描画・頂点編集         | inject  | `src/inject/features/area-display.ts`                          |
| メッセージルーティング            | inject  | `src/inject/bridge.ts`                                         |

### Types

- `src/types/area-region.ts` — 共有型定義
  - `AreaRegion`: id, name, color, vertices, visible, createdAt, updatedAt
  - `AreaRegionVertex`: { lng, lat }
  - `AreaRegionBounds`: { west, south, east, north }
  - `AreaRegionEditSnapshot`: { regionId, name, vertices }
  - `AreaNameDisplayMode`: "always" | "off" | "hide-on-zoom-out"
  - `AreaDisplayOptions`: { fillOpacityPercent, nameClickToGoto, nameDisplayMode }
- `src/features/area-manager/types.ts` — content側専用
  - `AreaRegionGroup`: { id, name, regionIds, createdAt, updatedAt }

## Content↔Inject Messaging Protocol

すべて `window.postMessage` による通信。`source` フィールドで識別。

### Content → Inject (一方向)

| source                                  | 用途               | payload                                                       |
| --------------------------------------- | ------------------ | ------------------------------------------------------------- |
| `mr-wplace-area-measure-update`         | エリア表示ON/OFF   | `{ visible: boolean }`                                        |
| `mr-wplace-area-regions-sync`           | 全リージョンの同期 | `{ regions: AreaRegion[] }`                                   |
| `mr-wplace-area-display-options-update` | 表示オプション変更 | `{ options: AreaDisplayOptions }`                             |
| `mr-wplace-area-region-edit-start`      | 編集モード開始     | `{ regionId, name, color, vertices, saveLabel, cancelLabel }` |
| `mr-wplace-area-region-edit-stop`       | 編集モード終了     | (なし)                                                        |
| `mr-wplace-area-region-goto`            | エリアへ移動       | `{ regionId, lng, lat, bounds? }`                             |

### Content → Inject (リクエスト/レスポンス)

| source (req)                         | source (res)                          | 用途                         |
| ------------------------------------ | ------------------------------------- | ---------------------------- |
| `mr-wplace-area-region-edit-request` | `mr-wplace-area-region-edit-response` | 編集中のスナップショット取得 |

### Inject → Content (一方向)

| source                               | 用途                 | トリガ                          |
| ------------------------------------ | -------------------- | ------------------------------- |
| `mr-wplace-area-region-save-click`   | 保存ボタン押下       | SVGオーバーレイ上のSaveボタン   |
| `mr-wplace-area-region-cancel-click` | キャンセルボタン押下 | SVGオーバーレイ上のCancelボタン |

## Storage Keys (chrome.storage)

| Key                                | Type                | Default  | 説明               |
| ---------------------------------- | ------------------- | -------- | ------------------ |
| `mapFilter_areaMeasure`            | boolean             | false    | エリア表示ON/OFF   |
| `areaRegions_v1`                   | AreaRegion[]        | []       | 全リージョンデータ |
| `areaRegionGroups_v1`              | AreaRegionGroup[]   | []       | グループデータ     |
| `mapFilter_areaSyncUrl`            | string              | ""       | オンライン同期URL  |
| `mapFilter_areaFillOpacityPercent` | number              | 14       | 塗り透明度(0-100)  |
| `mapFilter_areaNameClickToGoto`    | boolean             | true     | 名前クリックで移動 |
| `mapFilter_areaNameDisplayMode`    | AreaNameDisplayMode | "always" | 名前表示モード     |

## Content側: AreaManager クラス

### 初期化フロー

1. `init()` でストレージから全設定をロード
2. `mapReady` 判定 → ready なら `syncMapDependentState()` で inject に通知
3. `window.addEventListener("message")` で save/cancel クリックと map-ready を監視

### 主要メソッド

- `setAreaMeasureEnabled(enabled)` — ON/OFF切替、ストレージ保存、inject通知
- `openAreaManager()` — モーダルを生成・表示
- `startAreaEditing(regionId, closeModal)` — 編集モード開始、inject に `edit-start` 送信
- `stopAreaEditing(skipRender)` — 編集モード終了、inject に `edit-stop` 送信
- `saveAreaEditing()` — inject に snapshot リクエスト → 応答を受けて保存
- `renderAreaManager()` — モーダル内のリージョン/グループ一覧をDOM生成

### データフロー (保存時の例)

1. Save ボタン click → inject が `mr-wplace-area-region-save-click` を postMessage
2. content の `saveAreaEditing()` が起動
3. `requestAreaEditSnapshot()` で inject に `edit-request` 送信
4. inject が `respondAreaRegionEditRequest()` で `edit-response` 返送
5. content が vertices を受取り、storage に保存、`notifyAreaRegions()` で inject に regions 同期

### グループ機能

- 複数リージョンを1つのグループにまとめる
- グループ内リージョンは同名・同色に統一
- グループ解除は regionIds を解除するだけ (リージョン自体は残る)
- `cleanupAreaRegionGroups()` で不整合なグループを自動除去

### インポート/エクスポート

- GeoJSON (FeatureCollection) 形式で入出力
- `mrWplaceAreaGroups` カスタムフィールドでグループも保存
- merge: 既存とIDベースでマージ / replace: 全置換
- URL同期: fetchしたJSONをインポート

## Inject側: area-display.ts

### 描画構造 (DOM)

```
div#mr-wplace-area-measure (container, pointer-events: none)
├── svg (viewBox=マップサイズ)
│   ├── g (regionsLayer: 確定リージョンポリゴン群)
│   └── polygon (editPolygon: 編集中ポリゴン)
├── div (edgeHitLayer: エッジクリック用透明hit領域)
├── div (regionLabelLayer: 確定リージョン名ラベル群)
├── div (areaLabel: 編集中の面積表示)
└── div (editActionLayer: Save/Cancelボタン)
    ├── button (Save)
    └── button (Cancel)
```

### 描画フロー

1. `addAreaOverlay(map)` — コンテナ生成、マップイベント(move/zoom/rotate/pitch/resize)にバインド
2. `renderAreaOverlay(map)` — 毎フレーム的に呼ばれる中心関数
   - SVG viewBox をマップコンテナサイズに合わせる
   - 確定リージョン: `createRegionPolygon()` でSVGポリゴン生成 + ラベル生成
   - 編集モード: 頂点をスクリーン座標に投影、ドラッグハンドル配置、エッジhit領域配置

### 頂点編集

- 頂点ドラッグ: `startVertexDrag()` → `pointerMove` でリアルタイム更新 → `stopVertexDrag()`
- 頂点追加: エッジ(辺)をクリック → `insertVertexOnEdge()` で中点挿入
- 頂点削除: 頂点をダブルクリック (3頂点以下にはならない)
- ドラッグ中はマップの `dragPan` を無効化

### Export されている関数

- `setAreaMeasureEnabled(enabled)` — オーバーレイの表示/非表示
- `setAreaRegions(regions)` — 確定リージョン一覧を更新、再描画
- `setAreaDisplayOptions(options)` — 透明度・名前表示モード変更、再描画
- `startAreaRegionEdit(payload)` — 編集モード開始
- `stopAreaRegionEdit()` — 編集モード終了
- `respondAreaRegionEditRequest(data)` — 編集スナップショット応答
- `setupAreaMeasureOnMapReady(mapInstance)` — マップ ready 時のセットアップ

### 面積計算

- `calculateGeodesicAreaSquareMeters(vertices)` — 測地線面積 (m²)
- `calculatePixelAreaSquare(vertices)` — ピクセル面積 (px²)
- 両方とも `@/utils/coordinate` からインポート

## Coding Notes

### 新しいエリア設定を追加する場合

1. `src/types/area-region.ts` に型追加 (必要に応じて)
2. `AreaManager` に storage key、デフォルト値、normalize メソッド追加
3. `init()` の `storage.get()` に key 追加
4. `notifyAreaDisplayOptions()` (または個別メッセージ) で inject に通知
5. `area-display.ts` 側で受信・適用・再描画
6. `bridge.ts` のルーティングは既存パターンに従う

### 注意点

- inject 側は `chrome.storage` を使えない → content が storage 管理
- inject 側のモジュール変数 (let) で状態を保持 (クラスではない)
- `renderAreaOverlay()` はマップイベントごとに呼ばれるため軽量に保つ
- 色は `#rrggbb` 6桁hex のみ対応 (`normalizeAreaColor` で検証)
- リージョンは `updatedAt` 降順でソート
- Content↔Inject の area message source は `src/constants/area-message.ts` を使って定義を一元化する

## Mermaid Diagram

```mermaid
graph TB
    subgraph Content["Content Context"]
        AM["AreaManager<br/>(area-manager.ts)"]
        Storage["chrome.storage<br/>areaMeasure, areaRegions_v1,<br/>areaRegionGroups_v1, display options"]
        DSD["DisplaySettings<br/>Dialog"]
        GCD["GroupCompose<br/>Dialog"]
        IED["ImportExport<br/>Dialog"]
        UC["import-export/<br/>usecase.ts"]
        UTIL["import-export/<br/>utils.ts"]

        AM -->|read/write| Storage
        AM -->|open| DSD
        AM -->|open| GCD
        AM -->|open| IED
        IED -->|delegate| UC
        UC -->|GeoJSON| UTIL
    end

    subgraph Inject["Inject Context (page window)"]
        Bridge["bridge.ts<br/>(message router)"]
        AD["area-display.ts<br/>(SVG overlay)"]
        MI["map-instance/<br/>(flyTo, goto)"]
        Map["maplibregl Map"]

        Bridge -->|dispatch| AD
        Bridge -->|dispatch| MI
        AD -->|project/unproject| Map
        AD -->|on move/zoom| Map
        MI -->|flyTo/fitBounds| Map
    end

    subgraph Types["Shared Types"]
        AT["area-region.ts<br/>AreaRegion, AreaRegionVertex,<br/>AreaDisplayOptions, etc."]
        AGT["area-manager/types.ts<br/>AreaRegionGroup"]
    end

    AM -- "postMessage<br/>area-measure-update<br/>area-regions-sync<br/>area-display-options-update<br/>area-region-edit-start/stop<br/>area-region-goto" --> Bridge
    AD -- "postMessage<br/>area-region-save-click<br/>area-region-cancel-click<br/>area-region-edit-response" --> AM

    AM -.->|uses| AT
    AM -.->|uses| AGT
    AD -.->|uses| AT

    style Content fill:#1a1a2e,color:#fff
    style Inject fill:#16213e,color:#fff
    style Types fill:#0f3460,color:#fff
```

```mermaid
sequenceDiagram
    participant User
    participant AM as AreaManager<br/>(content)
    participant Bridge as bridge.ts<br/>(inject)
    participant AD as area-display.ts<br/>(inject)
    participant Map as maplibregl

    Note over AM: init() → storage.get → syncMapDependentState

    User->>AM: Open Area Manager
    AM->>AM: renderAreaManager() (DOM)

    User->>AM: Click "Add" or "Edit"
    AM->>Bridge: postMessage(edit-start, {regionId, vertices, color})
    Bridge->>AD: startAreaRegionEdit(payload)
    AD->>Map: project vertices → screen coords
    AD->>AD: render SVG polygon + vertex handles

    User->>AD: Drag vertex / Click edge
    AD->>Map: unproject → update lngLat
    AD->>AD: renderAreaOverlay()

    User->>AD: Click Save button
    AD->>AM: postMessage(save-click)
    AM->>Bridge: postMessage(edit-request, {requestId})
    Bridge->>AD: respondAreaRegionEditRequest()
    AD->>AM: postMessage(edit-response, {snapshot})
    AM->>AM: persist to storage
    AM->>Bridge: postMessage(regions-sync)
    Bridge->>AD: setAreaRegions() → re-render
```
