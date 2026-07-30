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
- 下書き: `mr-wplace-draft-mode-update`, `mr-wplace-draft-clear`, `mr-wplace-request-draft-seed`。
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
  - 下書きモード。ON 中は `POST /pixel` を fetch-interceptor で遮断し charge を消費させない。
  - 導線: マップ上の下書きFAB → wplace の Paint ボタンを自動クリック → ペイントモード遷移 + 下書きモードON。
    ペイントモードとの相互切替を持たないため「気づかないうちに下書きモード」が起きない。
    Paint ボタンの特定は**ブラシアイコンの SVG path** で行う (`selectors.findBottomCenterPrimaryButton`)。
    ラベルは言語依存 (Paint/Pintar/...) かつラッパー DOM 構造も遷移前後で異なるため、
    class やテキストではなくアイコンを anchor にするのが最も安定。
    注意: エントリボタンと確定ボタンは**同じアイコン**を持ち、遷移後もエントリ側が
    DOM に残ることがある。確定ボタンは `offsetParent !== null` で可視のものだけに絞る
    (`findPaintSubmitButton`)。隠れている方を掴むと生きている UI を壊す。
    注意: 保存ボタンの再生成を MutationObserver から無条件に呼ぶと、
    自身の DOM 変更で再発火し強制リフローが多発する。「消えた時だけ」再生成すること。
  - SAFETY: 遮断判定は `shouldBlockPaintSubmit()` = `mode ON || セッションに下書き混入` の OR (fail-closed)。
    遮断は 403 ではなく `TypeError` を throw し、wplace 側に「送信済み」と誤認させない。
    ペイントセッション終了 (`setPaintSessionListener(false)`) で mode 強制 OFF + 下書き破棄。
    content 側は ON 中 wplace の確定ボタンを隠し「下書きを保存」に差し替える(誤送信導線を消す)。
  - 下書きモード中は wplace 純正 UI のみ。Mr の FAB は `paint-mode-style` が既に隠す。
  - map instance 未取得時は FAB を disable (座標変換ができず保存できないため)。
  - 描画はしない。予約中のピクセルは wplace 本体が既に表示するため overlay 不要。
    よって `overlayLayers` / `tile-overlay-renderer` には一切関与しない
    (統計や enhanced/unplaced 描画に混ざる問題も原理的に発生しない)。
  - `draft-store.ts`: tile 単位の pixel Map。蓄積のみ。`seedDraftFromPixels` で既存画像ピクセルの事前投入も可能 (下書き編集用)。
  - `draft-export.ts`: 保存時に bounding box で切り出し dataUrl 化 (`mr-wplace-request-draft-export`)。gallery 保存用。
  - `index.ts`: `setDraftPaintListener` で捕捉 → store に蓄積するだけ。
    `handleDraftSeedRequest` (`mr-wplace-request-draft-seed`) は gallery item の dataUrl を decode し、
    透明ピクセルを除いて world pixel 座標で `seedDraftFromPixels` へ渡す (下書き編集の起点)。
  - 下書き編集: gallery の image-detail に「📌 下書き編集」ボタン (`drawPosition` がある item のみ表示)。
    content 側 `features/draft-draw/index.ts` の `enterDraftEditForItem` がマップ移動 → ペイントモード遷移 →
    既存ピクセルの seed まで行う。保存時は同じ gallery key を上書きし、title 等の既存メタデータを引き継ぐ。
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
