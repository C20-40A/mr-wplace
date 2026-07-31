# Inject Context (AI quick map)

inject は page context。DOM/window/fetch/indexedDB 可。Chrome API 不可。重い描画は inject、設定保存は content。

## 最短把握ルート

1. `src/inject/index.ts`
2. `src/inject/fetch-interceptor.ts`
3. `src/inject/bridge.ts`
4. `src/inject/handlers/*`
5. `src/inject/features/tile-draw/*`
6. `src/inject/features/map-instance/*`
7. `src/inject/db/*` + `src/inject/cache-storage.ts`
8. `src/inject/security/message-auth.ts`

## 起動と責務境界

- `index.ts`
  - 同期初期化: `setupFetchInterceptor()` を最速実行、paint capture listener 接続、`window.mrWplace*` 初期値設定、startup zoom 強制。
  - 非同期初期化: `requestPersistentStorage`、`tileCacheDB.init`、`initGalleryRepository`、`initSnapshotRepository`、`setupMessageHandler`、`resolveMapInstanceAsync`。
  - map 捕捉後: front-tile-layer / grid / scale / area を map styledata に接続。`mr-wplace-map-instance-captured` 送信。
- `bridge.ts`
  - `window.message` の入口。state更新、overlay同期、stats要求、dev機能、gallery/snapshot bridge を分配。
- `fetch-interceptor.ts`
  - fetch 入口。/me、pixel API、tile png、front custom protocol を分岐。

## fetch ルート

- dedicated overlay URL: `https://backend.wplace.live/mr-wplace/front-tile/{z}/{x}/{y}.png` -> front layer 描画 (`front-tile-layer/fetch-handler.ts`)。
- sentry 系 URL は 200 空レスポンスで遮断。
- `/me` を clone して `handleUserStatusUpdate`。
- `GET /pixel/...?...x=...&y=...` で paintedBy を `mr-wplace-painted-by-user` 送信。
- `POST /pixel/<tileX>/<tileY>` で `invalidateTile` + `invalidateTileCache`。
- tile png (`/tile/` or `/tiles/`) は `handleTileRequest`。
  - DataSaver cache: memory + `mr-wplace-cache` IndexedDB。
  - `checkStateChanged()` で overlay/filter/showUnplaced 変化検知。
  - Last-Modified cache (memory LRU 24) ヒット時は再描画スキップ。
  - 原本タイル Blob + last-modified は常に保持（背景比較用）。
  - snapshot 保存通知 `wplace-studio-snapshot` は維持。
  - front layer ON 時は背景返却のみ、合成は front layer 側。

## メッセージ入口 (content -> inject)

- 一般 state: `mr-wplace-theme-update`, `mr-wplace-color-filter`, `mr-wplace-show-unplaced-only`, `mr-wplace-compute-device`, `mr-wplace-front-tile-layer-update`, map表示/3d関連。
- 注意: `mr-wplace-area-display-update` は現在 `scale-display` トグルに接続。
- overlay 同期: `mr-wplace-gallery-images-v2`, `mr-wplace-snapshots`, `mr-wplace-text-layers`。
- 下書き: `mr-wplace-draft-mode-update`, `mr-wplace-draft-erase-update`, `mr-wplace-draft-clear`, `mr-wplace-request-draft-seed`, `mr-wplace-request-draft-export`。
- stats 要求: `mr-wplace-request-stats`, `...pixel-color`, `...tile-stats`, `...image-stats`, `...map-center`, `mr-wplace-compute-total-stats`。
- dev: auto-click / auto-color-spoit / area-fill start stop estimate。
- gallery/snapshot bridge: `mr-wplace-gallery-v2-*`, `mr-wplace-snapshot-*`。
- 危険操作前提: `mr-wplace-auth-init`。

## メッセージ出口 (inject -> content)

- 描画/統計: `mr-wplace-stats-updated`, `mr-wplace-response-*`, `mr-wplace-total-stats-computed`, `wplace-studio-drawing-complete`。
- API派生: `mr-wplace-painted-by-user`, `mr-wplace-open-user-modal`。
- bridge応答: `mr-wplace-gallery-v2-*-response`, `mr-wplace-snapshot-*-response`, import/export/reset response。
- dev進捗: `mr-wplace-area-fill-progress`, `mr-wplace-area-fill-finished`。

## ディレクトリ別マップ

- `handlers/overlay-handlers.ts`
  - gallery/snapshot/text の描画対象を `tile-draw/states.overlayLayers` に反映。更新後 `refreshFrontTileLayer()`。
- `handlers/state-handlers.ts`
  - theme/data-saver/compute/filter/front-layer の反映。color filter は debounce refresh。
- `handlers/request-handlers.ts`
  - stats/pixel/map-center 取得 API。必要時に IndexedDB metadata の `perTileStats` も参照。
- `features/tile-draw/`
  - `tile-overlay-renderer.ts`: 合成本体。GPU/CPU filter、背景比較、matched/total 統計、overlay pixel color。
  - `states.ts`: `overlayLayers`、`perTileColorStats`。
  - `last-modified-cache.ts`: processed/original blob cache、state version 比較。
  - `stats/*`: 集計 API、`compute-total.ts` は位置非依存 total 計算。
- `features/paint-stats-updater.ts`
  - paintイベント中の optimistic matched 更新。front layer paint-guide 連携。
- `features/map-instance/`
  - `get-map-instance.ts`: maplibre instance を hook で捕捉。
  - `map-control.ts`: flyTo/area goto/background color/3d/tile boundary。
  - `painted-coordinates-capture.ts`: paint session/pixel delete/clear listener。
  - `front-tile-layer/`
    - `index.ts`: source/layer lifecycle、soft refresh(`v=`更新)、pending comparison、paint guide。
    - `fetch-handler.ts`: z9-11受理。z11はbase描画、z10/z9は縮小合成経路。front render cache LRU 40、token=`stateVersion|lastModified`。
    - `state-version.ts`: refresh 用 version counter。
- `features/draft-draw/`
  - 下書きモード。**wplace 本体のペイント機構には一切依存しない独自レイヤー方式**。
    ペイントモードには入らず、実ペイントも charge 消費も一切発生しない。
  - 導線: マップ上の下書きFAB → 下書きモードON → 独自 canvas レイヤーが前面に出る
    → クリック/ドラッグで描画 → 専用ツールバーから保存 / 終了。
    wplace の Paint ボタンも確定ボタンも触らない。
  - map instance 未取得時は FAB / gallery の下書き編集ボタンを disable
    (座標変換ができず描画も保存もできないため)。
  - **下書きモード中は既存テンプレ overlay を全部非表示にする**
    (`tile-overlay-renderer.drawOverlayLayersOnTile` 冒頭で `isDraftModeEnabled()` を見て早期return、
    `fetch-interceptor.handleTileRequest` も draftActive を `frontOperational` 相当として扱い
    合成済みキャッシュを迂回して生タイルを返す)。
    理由: 編集前のテンプレが編集中の画面に重なって見えると混乱するため (特に下書き編集で顕著)。

  - `draft-canvas.ts`: **インタラクティブな独自描画レイヤー**。
    - map canvas の兄弟として `pointer-events:auto` の HTML canvas を重ねる。
    - **パフォーマンス設計 (最重要)**: 1タイル = 1000x1000 のオフスクリーン canvas
      (wplace のラスタタイルのクローン) を `draft-store` が保持し、表示側は
      **タイルの左上/右下だけを `map.project()` して `drawImage` で1枚貼る**。
      ピクセル単位で `project()` すると 100万回呼ぶことになり成立しないため、
      投影は 1タイルにつき2回に固定する。1px の変更も canvas 上の 1 `fillRect` で済む。
    - 再描画は dirty フラグが立った時だけ (map の move/zoom/resize、store 変更時)。
      rAF は回すが、dirty でなければ即 return する。
    - `imageSmoothingEnabled = false` でピクセルアートを拡大時もにじませない。
    - **pointer は capture 段階で `stopPropagation` + `preventDefault`**。
      canvas 自体は map canvas の兄弟なので伝播経路上は競合しないが、
      maplibre は document/window にも drag ハンドラを張るため、
      ここで止めないと描画中に地図がパン/ズームしてしまう。
      wheel / contextmenu / dblclick も同様に封じる。
    - ドラッグは `pointermove` が飛び飛びに来るため、前回位置から線形補間して塗る
      (`paintLine`)。これが無いとドラッグが点線になる。
    - 画面座標 -> world pixel は `map.unproject` -> `geo-converter.latLonToPixels`。
      自前で WebMercator 式を書かず、プロジェクト既存の座標変換に寄せる。
    - ブラシ色は `localStorage["selected-color"]` (wplace と同じキー) を
      `colorpalette` で RGB に解決する。透明色/未選択なら描かない。

  - `draft-store.ts`: 下書きの唯一の真実。タイルごとに 2 表現を持つ。
    - `pixels`: 保存(export)用の厳密なピクセル集合
    - `canvas`: 表示用の 1000x1000 ラスタ
    両方を常に同期して更新する。`setDraftStoreChangeListener` で変更を通知し、
    再描画 (`markDraftCanvasDirty`) と content への状態通知を走らせる。
    seed は数十万 pixel になりうるので `silent: true` で個別通知を抑え、最後に1回だけ通知する。

  - `draft-export.ts`: 保存時に bounding box で切り出し dataUrl 化 (`mr-wplace-request-draft-export`)。gallery 保存用。
    NOTE: `PxX/PxY` は `Math.floor(minX/TILE_SIZE) * TILE_SIZE` を引いて算出する
    (JS の `%` は負数に対して負の余りを返すため、負のタイル座標をまたぐ下書きで
    `minX % TILE_SIZE` を直接使うと座標がズレるバグがあった)。

  - `index.ts`: mode の ON/OFF、canvas ハンドラ登録、seed/export のメッセージ応答。
    OFF 時は canvas を破棄して下書きも破棄する。

  - 下書き編集: gallery の image-detail に「📌 下書き編集」ボタン (`drawPosition` がある item のみ表示、
    map instance 未準備なら disabled)。
    content 側 `features/draft-draw/index.ts` の `enterDraftEditForItem` が
    `mr-wplace-map-flyto` を直接送って強制 flyTo でマップ移動 (URL nav モードでのリロードを回避) →
    下書きモードON → 既存ピクセルの seed まで行う。
    seed した時点で独自レイヤーに「配置済みの見た目」として現れる (合成クリック等は不要)。
    保存時は同じ gallery key を上書きし、title 等の既存メタデータを引き継ぐ (`seedItem` で保持)。

  - **過去に破棄したアプローチ (再挑戦しないこと)**:
    wplace 本体の `paint-preview-*` ImageSource に相乗りして「配置済みの見た目」を作る方式を試みた。
    そのタイルの `paint-preview` レイヤーは wplace 自身が最初の1pxペイント時にしか生成しないため、
    合成クリックでペイントを1px発火させてレイヤーを作らせる必要があった。
    しかしこの合成クリックは実用に耐えなかった:
    クリック位置がテンプレとずれる / 読み込みタイミングで勝手に発火する /
    クリックの度に UI がそこへズームして画面が動き回る / 発火しないタイルがある。
    charge を1px消費する点も含め、独自レイヤー方式で完全に置き換え済み。
    これに伴い `shouldBlockPaintSubmit` / `notifyDraftSubmitBlocked` (POST 遮断)、
    `clickAtLatLng` / `findPaintPreviewSourceId` / `fillPaintPreviewTile` / `seedPaintedPixel` /
    `ensurePaintedPixelMapCaptured`、`setDraftPaintListener` はすべて削除した。
    新方式は wplace へ pointer を渡さないため、そもそも送信が発生せず遮断ロジック自体が不要。
- `features/grid-display.ts`: zoom>=14 で pixel grid。
- `features/scale-display.ts`: A/B pin 距離 UI。
- `features/area-display.ts`: area region layer、編集 UI、measure。
- `features/developer/*`: auto click / color spoit / area fill。
- `features/user-status/*`: /me 由来 UI と charge/level 表示。

## 永続化

- `db/schema-v2.ts` + `db/gallery-repository.ts`
  - DB: `mr-wplace-gallery-v2` stores: `images`, `splitTiles`, `metadata`, `thumbnails`。
  - key: `id`、split tile は `[layerId, tileKey]` (`tileKey = "tx,ty"`)。
- `db/snapshot-repository.ts`
  - DB: `mr-wplace-snapshots` stores: `snapshots`, `metadata`。
- `cache-storage.ts`
  - DB: `mr-wplace-cache` store: `tiles`。data-saver 用 processed tile LRU。
- `storage-persistence.ts`
  - `navigator.storage.persist()` を要求。

## セキュリティ

- `security/message-auth.ts`
  - 危険操作は token + nonce + ts を検証。clock skew 15s、nonce 再利用拒否。
  - 現在の保護対象: gallery reset, gallery-v2 delete, snapshot delete。

## 補足

- `types.ts` に inject window globals 型を集中。
- `workers/*` は旧DB(`mr-wplace-gallery`)向け migration 基盤。現行フロー未接続。
- `features/map-instance/map-instance.bak.ts` は実行系では未使用。
