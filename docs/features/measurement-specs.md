# 測定機能 技術仕様書

## 概要

地図上で 2 点間の距離測定と、複数点で囲まれた領域の面積測定を行う機能。

## コア技術要件

### 1. 座標計算

#### 距離計算（Haversine 公式）

```typescript
// 球面上の2点間距離（メートル）
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number;
```

**仕様:**

- 地球半径: 6371000m
- 入力: 緯度経度（度数法）
- 出力: メートル単位の距離
- 精度: 小数点以下 2 桁（cm 単位）

#### 面積計算（球面ポリゴン）

```typescript
// 球面ポリゴンの面積（平方メートル）
function calculatePolygonArea(
  points: Array<{ lat: number; lng: number }>
): number;
```

**仕様:**

- アルゴリズム: 球面過剰法（Spherical Excess）
- 最小点数: 3 点
- 入力: 緯度経度配列（閉じていなくても自動で閉じる）
- 出力: 平方メートル単位の面積

### 2. MapLibre GL JS 統合

#### マップインスタンス取得

```javascript
// DOM取得のナレッジより
const mapInstance = document.querySelector("div.absolute.bottom-3.right-3.z-30")
  .childNodes[0].__click[3].v;
```

#### クリックイベント取得

```javascript
mapInstance.on("click", (e) => {
  const { lng, lat } = e.lngLat;
  // 点を追加
});
```

#### レイヤー描画

```typescript
// GeoJSON LineString（距離測定用）
mapInstance.addSource('measurement-line', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: [[lng, lat], ...]
    }
  }
});

// GeoJSON Polygon（面積測定用）
mapInstance.addSource('measurement-polygon', {
  type: 'geojson',
  data: {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [[[lng, lat], ...]]
    }
  }
});
```

### 3. データ構造

#### 測定点

```typescript
interface MeasurementPoint {
  lat: number;
  lng: number;
  timestamp: number;
}
```

#### 測定セッション

```typescript
interface MeasurementSession {
  id: string;
  type: "distance" | "area";
  points: MeasurementPoint[];
  result: number; // メートルまたは平方メートル
  timestamp: number;
  title?: string;
}
```

#### 測定履歴 Storage

```typescript
interface MeasurementHistoryItem extends BaseImageItem {
  key: string;
  timestamp: number;
  type: "distance" | "area";
  points: MeasurementPoint[];
  result: number;
  title?: string;
}
```

## UI 設計の検討ポイ �� ト

### 決定すべき仕様

#### 1. 単位表示

**距離:**

- [ ] 自動切替: 1000m 未満は m、1000m 以上は km
- [ ] 固定: 常に m
- [ ] 固定: 常に km
- [ ] ユーザー選択可能

**面積:**

- [ ] 自動切替: 10000m² 未満は m²、以上は km² または ha
- [ ] 固定: 常に m²
- [ ] 固定: 常に km²
- [ ] ユーザー選択可能

**推奨:** 自動切替（読みやすさ優先）

#### 2. 表示精度

- 距離: 小数点以下 2 桁（例: 1234.56m）
- 面積: 小数点以下 2 桁（例: 5678.90m²）

#### 3. 測定の終了方法

**距離測定:**

- [ ] ダブルクリックで終了
- [ ] Enter キーで終了
- [ ] 「完了」ボタンクリック
- [ ] 右クリックメニュー

**面積測定:**

- [ ] ダブルクリックで閉じて終了
- [ ] Enter キーで閉じて終了
- [ ] 「完了」ボタンクリック
- [ ] 最初の点をクリックで自動的に閉じる

**推奨:** 「完了」ボタン + Enter キーショートカット

#### 4. 測定中の操作

- [ ] 最後の点を削除（Backspace/Delete）
- [ ] 測定キャンセル（Escape）
- [ ] 途中で点を挿入（実装コスト高）

**推奨:** Backspace 削除 + Escape キャンセル

#### 5. 測定履歴

- [ ] 履歴保存する（Storage 使用）
- [ ] 履歴保存しない（一時的な測定のみ）

**推奨:** 保存する（後から参照可能）

#### 6. 既存機能との共存

- [ ] Drawing 機能と同時使用不可（排他制御）
- [ ] Drawing 機能と独立（測定中でも描画可能）

**推奨:** 排他制御（混乱防止）

## UI 案

### 案 1: ツールバーボタン方式

```
┌─────────────────────────────────┐
│ [Gallery] [TimeTravel] [測定▼] │ ← 新規追加
└─────────────────────────────────┘
              │
              ├─ 距離測定
              └─ 面積測定

測定中:
┌─────────────────────────────────┐
│ 距離測定中: 1234.56m            │
│ [完了] [キャンセル]             │
└─────────────────────────────────┘
```

**メリット:**

- 既存 UI に自然に統合
- createModal()不要
- シンプルで直感的

**デメリット:**

- ツールバー項目が増える
- 測定結果パネルの配置が難しい

### 案 2: 独立モーダル方式

```
[測定ツール]ボタン → createModal()
┌───────────────────┐
│ ← 測定ツール      │
├───────────────────┤
│ ○ 距離測定        │
│ ○ 面積測定        │
├───────────────────┤
│ 測定履歴:         │
│ - 距離1: 123m     │
│ - 面積1: 456m²    │
└───────────────────┘
```

**メリット:**

- 既存パターン（createModal）活用
- 履歴表示も統合可能
- ツールバー圧迫しない

**デメリット:**

- モーダル開いたまま測定は不自然？
- 操作ステップが増える

### 案 3: フローティングパネル方式

```
地図右上に固定配置
┌─────────────┐
│ 測定 [_][×] │
├─────────────┤
│[距離][面積] │
├─────────────┤
│ 結果表示     │
└─────────────┘
```

**メリット:**

- 測定中も常に見える
- 最小化で邪魔にならない

**デメリット:**

- 新しい UI 要素
- 実装コスト高い

## 推奨実装案

### フェーズ 1: コア機能

1. `src/utils/measurement.ts` - 距離/面積計算
2. `src/features/measurement/manager.ts` - 測定状態管理
3. `src/features/measurement/map-integration.ts` - MapLibre 連携

### フェーズ 2: UI 実装

- **案 1 を採用** (ツールバーボタン方式)
- 測定中は画面下部に固定パネル表示
- 完了後は Toast 通知で結果表示

### フェーズ 3: 拡張機能

- 測定履歴保存（MeasurementStorage）
- 履歴モーダル表示
- エクスポート機能

## 技術制約

### MapLibre GL JS の扱い

- inject.js で mapInstance 取得済み
- content.ts への直接渡しは不可
- postMessage 経由で連携が必要

### 実装パターン

```typescript
// content.ts → inject.js
window.postMessage(
  {
    source: "mr-wplace-measurement",
    action: "start",
    type: "distance",
  },
  "*"
);

// inject.js → content.ts
window.postMessage(
  {
    source: "mr-wplace-measurement-result",
    point: { lat, lng },
  },
  "*"
);
```

## 次のステップ

以下を決定してから実装開始:

1. ✅ 単位表示方式
2. ✅ 測定終了方法
3. ✅ UI 案の選択
4. ✅ 履歴保存の有無
5. ✅ 既存機能との共存方式
