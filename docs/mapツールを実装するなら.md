● 実装アーキテクチャの提案

既存のアーキテクチャを活かした実装方法を提案します：

📁 ファイル構成

src/
├── features/map-tools/ # 新機能 (content context)
│ ├── index.ts # 初期化・DI 登録
│ ├── ui/
│ │ ├── toolbar.ts # ツールバー UI
│ │ └── result-panel.ts # 測定結果表示
│ ├── distance-measure.ts # 距離測定コントロール
│ ├── area-measure.ts # 面積測定コントロール
│ └── user-paint-filter.ts # ユーザー塗り場所フィルター
│
├── inject/map-tools/ # レイヤー管理 (page context)
│ ├── handlers/
│ │ ├── distance-handler.ts # 距離測定イベント処理
│ │ ├── area-handler.ts # 面積測定イベント処理
│ │ └── filter-handler.ts # フィルターレイヤー管理
│ ├── layers/
│ │ ├── distance-layer.ts # LineString レイヤー
│ │ ├── area-layer.ts # Polygon レイヤー
│ │ └── dimming-layer.ts # 暗転レイヤー
│ └── utils/
│ ├── distance-calc.ts # Haversine 公式
│ └── area-calc.ts # Shoelace 公式 (平面近似)
│
└── utils/inject-bridge.ts # 通信関数追加

🔧 実装の詳細

1. 距離測定ツール

// inject/map-tools/handlers/distance-handler.ts
export class DistanceMeasureHandler {
private points: [number, number][] = [];
private map: WplaceMap;

    onClick(lngLat: { lng: number; lat: number }) {
      this.points.push([lngLat.lng, lngLat.lat]);

      if (this.points.length === 2) {
        const distance = calculateDistance(
          this.points[0][1], this.points[0][0],
          this.points[1][1], this.points[1][0]
        );

        // LineString レイヤー追加
        this.map.addSource('distance-line', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: this.points
            }
          }
        });

        // 結果を content に送信
        window.postMessage({
          source: 'mr-wplace-distance-result',
          distance,
          points: this.points
        }, '*');
      }
    }

}

// utils/distance-calc.ts (Haversine 公式)
export const calculateDistance = (
lat1: number, lng1: number,
lat2: number, lng2: number
): number => {
const R = 6371e3; // 地球の半径 (メートル)
const φ1 = lat1 _ Math.PI / 180;
const φ2 = lat2 _ Math.PI / 180;
const Δφ = (lat2 - lat1) _ Math.PI / 180;
const Δλ = (lng2 - lng1) _ Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // メートル単位

};

2. 面積測定ツール

// inject/map-tools/handlers/area-handler.ts
export class AreaMeasureHandler {
private points: [number, number][] = [];

    onClick(lngLat: { lng: number; lat: number }) {
      this.points.push([lngLat.lng, lngLat.lat]);

      // 3点以上でポリゴン描画
      if (this.points.length >= 3) {
        const area = calculatePolygonArea(this.points);

        // Polygon レイヤー追加
        this.map.addSource('area-polygon', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[...this.points, this.points[0]]]
            }
          }
        });

        window.postMessage({
          source: 'mr-wplace-area-result',
          area,
          points: this.points
        }, '*');
      }
    }

}

// utils/area-calc.ts (Shoelace 公式)
export const calculatePolygonArea = (
coords: [number, number][]
): number => {
// 緯度経度を平面座標に変換（簡易版）
const R = 6371e3; // 地球の半径
const centerLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;

    const points = coords.map(([lng, lat]) => {
      const x = lng * Math.PI / 180 * R * Math.cos(centerLat * Math.PI / 180);
      const y = lat * Math.PI / 180 * R;
      return [x, y];
    });

    // Shoelace 公式
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i][0] * points[j][1];
      area -= points[j][0] * points[i][1];
    }

    return Math.abs(area) / 2; // 平方メートル

};

3. ユーザー塗り場所フィルター

// inject/map-tools/handlers/filter-handler.ts
export class UserPaintFilterHandler {
private map: WplaceMap;

    async enable() {
      // Option 1: WPlace API から取得
      const userData = await this.fetchUserPaintData();

      // Option 2: ローカルストレージから取得
      // const userData = await this.getUserPaintDataFromStorage();

      // 暗転レイヤーを追加（ユーザーの塗った部分を除く）
      this.createDimmingLayer(userData.paintedPixels);
    }

    private async fetchUserPaintData() {
      // /me から取得したデータを使用
      // または新しい API エンドポイントを呼ぶ
    }

    private createDimmingLayer(paintedPixels: [number, number][]) {
      // Canvas を使って、塗っていない部分を暗くするマスクを作成
      // 既存の tile-draw の仕組みを活用
    }

}

📊 UI イメージ

┌─────────────────────────────────────┐
│ Map Tools [×] │
├─────────────────────────────────────┤
│ 🔧 ツール選択: │
│ ○ 距離測定 │
│ ○ 面積測定 │
│ ○ ユーザーフィルター │
│ │
│ 📏 測定結果: │
│ 距離: 1,234.5 m (1.23 km) │
│ 面積: 15,678 m² (0.016 km²) │
│ │
│ [クリア] [保存] │
└─────────────────────────────────────┘

⚠️ 注意点と制限事項

1. ユーザー塗り場所フィルター:


    - WPlace API でユーザーの塗った座標一覧が取得できるか確認が必要
    - API がない場合は、ローカルでトラッキングする必要がある（新しく塗る分のみ）

2. 距離・面積計算の精度:


    - 地球は球体なので、大きな面積の場合は誤差が出る
    - より正確にするには Turf.js などのライブラリを使用する選択肢もある

3. パフォーマンス:


    - 多数のポイントやポリゴンを描画すると重くなる可能性
    - 適切なレイヤー管理とクリーンアップが必要
