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
- 下書き: `mr-wplace-draft-mode-update`, `mr-wplace-draft-erase-update`, `mr-wplace-draft-bucket-update`, `mr-wplace-draft-brush-update`, `mr-wplace-draft-map-lock-update`, `mr-wplace-draft-clear`, `mr-wplace-request-draft-seed`, `mr-wplace-request-draft-export`。
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
    → 描画 → 専用ツールバーから保存 / 終了。
    wplace の Paint ボタンも確定ボタンも触らない。
  - 操作体系:
    - 左クリック単発 = dot / 左ドラッグ = マップ平行移動
    - **Space 押下中に移動 = 連続 dotting (クリック不要。押しっぱなしでなぞるだけ)**
      - `pointermove` は button 無しでも飛んでくるので、`spaceHeld` を見て塗る。
      - Space 押下の瞬間にカーソル直下へ1px置く (`lastPointer` を保持しておく)。
      - keydown のリピートで補間起点がリセットされないよう初回のみ処理する。
      - keyup で `lastWorld` を切り、次のストロークが前回終点と線で繋がらないようにする。
      - Space 中の左押下は map へ渡さない (塗りながら pan すると破綻するため)。
    - 中クリック = spoit (下書きの色を拾って選択色にする) / 右ドラッグ = 消しゴム
    - ホイール = マップズーム
    - ツールバーの 🪣 ON 中は左クリックがバケツ塗りになる (消しゴムとは排他)
    - ツールバーの 🖌 でブラシ設定ポップアップ (サイズ / ディザリングスタイル)
    - **ツールバーの 🔒 (マップロック) ON 中は左ドラッグがそのまま描画になる** (pan しない)
      - Space の latch 版だが、Space と違い **ボタンを押している間だけ** 塗る。
        hover で塗ると地図上をなぞっただけで描けてしまい事故になるため。
      - `handlePointerDown` で先に `dragMode` を確定させる (pointermove 任せにしない)。
      - バケツ ON の時はロック中でも「クリック = バケツ」を優先する。
      - アイコンは開錠/施錠を差し替える (色だけだと状態が分かりにくい)。
  - UI は **bottom sheet 方式** (画面下辺に密着・全幅・上側だけ角丸)。
    モバイル/タブレットで左右マージンがあると地図を隠して邪魔になるため。
    `env(safe-area-inset-bottom)` でホームバーを避ける。
    操作説明と閉じるボタンは sheet の**外**に置く (`positionOverlays` が
    sheet の実高さを測って追従。ボタン文言で高さが変わるため毎回再計算)。
    - 操作説明: sheet の外・上に text のみを薄く置く。閉じるボタンと**同じ段**なので
      右端 52px を空けておく (`right:52px`)。
    - 閉じる: sheet の外・**右上に丸バツ** (`btn-circle`)、操作説明と同じ段。
      sheet 内に置くと保存ボタンの隣で誤爆しやすいため物理的に離す。
      未保存の変更 (`pixelCount !== savedPixelCount`) があれば `confirm` で確認してから閉じる。
      seed 直後は seeded 数を基準にするので「開いただけ」では確認が出ない。
    - アクション行は 保存 / 消しゴム / バケツ を**横一列で中央寄せ**。
      ツールアイコンは lucide の stroke SVG (`stroke="currentColor"` で theme 追従)。
      `btn-square` を使うので `updateToolbar` で className を組み直す時に**落とさないこと**。
    - パレットは **行数を 2-8 に収める** (列数は横幅ぶん好きなだけ使う)。
      色数が固定 (63) なので列数から行数が決まる。`layoutColorStrip` が
      sheet の実幅から「8行以内にする最小列数」〜「2行を割らない最大列数」の
      範囲で列数を決め、スウォッチ実寸 (22-40px) も同時に確定させる。
      これで**縦スクロールが不要**になる (地図 drag を殺す `overflow-y:auto` を避けられる)。
      `window.resize` で再計算するので、**解除漏れに注意** (`exitDraftMode` と
      `updateToolbar` の無効化パス両方で `removeEventListener`)。
    - 色スウォッチは hover で色名を吹き出し表示 (`showColorTip`。`title` の遅延を避ける)。
    - ブラシ設定ポップアップの「外側クリックで閉じる」は **capture 段階** で張るので
      popup 自身より先に走る。**popup 側の stopPropagation では止められない**ため、
      判定は伝播ではなく **target が popup の内側か** で行うこと
      (伝播に頼ると slider やスタイルボタンを押した瞬間に閉じて操作不能になる)。
      ブラシボタン自身も除外する (閉じてから toggle が走り、開き直してしまうため)。

  - **CRITICAL: この UI は Tailwind ユーティリティに頼らない。**
    拡張機能なのでページ側に utility class が存在せず効かない場面がある。
    レイアウト/色は **inline style** で書き、色は `var(--color-*)` を使う
    (固定色は使わない)。`btn` / `btn-sm` / `btn-square` / `btn-primary` などの
    DaisyUI **コンポーネント** class は wplace 本体の CSS にあるので利用可。
  - ON 中は content 側で `activateStickyFocusMode()` を呼び、他の UI を退かす。
    通常の focus mode は「どこかを click したら自動解除」だが、下書きは
    マップ上を連打するため解除されては困る。そのため sticky 版を用意し、
    解除は `deactivateFocusMode()` で明示的に行う。
    ツールバーは `#map` の `z-index:1000` より前に出す必要があるので `z-index:1001`。
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
    - **CRITICAL: 描画 canvas は `pointer-events:none` の表示専用**にする。
      canvas は map canvas の「兄弟かつ手前」なので、`pointer-events:auto` にすると
      map canvas が一切イベントを受け取れなくなり **maplibre 純正の pan/zoom が完全に死ぬ**
      (実際にこれで「ホイールズームができない」不具合が出た)。
    - 入力は **map の canvas container** (`map.getCanvasContainer()`) に
      capture 段階で張り、「自分が使う操作だけ」を `stopPropagation` で奪う。
      pan/zoom させたい操作は**素通りさせる**のが要点。
      - wheel は張らない (map にズームさせる)。
      - 左 pointerdown は止めない (map に pan させる)。単発クリック判定は
        pointerup で移動量 (`CLICK_SLOP`) を見て行う。
      - `click`/`dblclick` は常に止める。wplace のマップクリック popup が
        下書き操作と干渉するため。
      - `contextmenu` は常に止める (右ドラッグを消しゴムに使うため)。
    - ドラッグは `pointermove` が飛び飛びに来るため、前回位置から線形補間して塗る
      (`paintLine`)。これが無いとドラッグが点線になる。
    - 画面座標 -> world pixel は `map.unproject` -> `geo-converter.latLonToPixels`。
      自前で WebMercator 式を書かず、プロジェクト既存の座標変換に寄せる。
    - ブラシ色は `localStorage["selected-color"]` (wplace と同じキー) を
      `colorpalette` で RGB に解決する。透明色/未選択なら描かない。

  - `draft-brush.ts`: ブラシ形状 (**常に円**) + ディザリングスタイル。
    変えられるのは **サイズ (1-32px)** と **ディザスタイル** だけ。形状の選択肢は持たない。
    - ディザマスクは **world pixel 座標そのもの** で判定する (乱数ではない)。
      これが要点で、同じ場所を何度なぞってもマスクが同じ格子に乗るため
      ストロークが重なっても模様が崩れない。
    - スタイル: solid(100%) / checker(50%) / diagonal(33%) / dots25(25%) / hline(50%) / sparse(6%)。
    - ディザは **描画時のみ** 適用し、消しゴムには掛けない (掛けると消し残しが出て使えない)。
    - 円スタンプのオフセットはサイズ変更時にだけ組み直してキャッシュする。
    - content 側の `DITHER_MASKS` はプレビュー(8x8 SVG)用に**同じ式**を持つ。
      片方だけ変えると見た目と実際の塗りがズレるので、**必ず両方揃える**。
    - `paintLine` はブラシ半径の半分ずつ進める。太いブラシで 1px 刻みに打つと
      `size^2 * 距離` ぶん無駄になるため (1px ブラシでは従来通り 1px 刻み)。

  - `draft-store.ts`: 下書きの唯一の真実。タイルごとに 2 表現を持つ。
    - `pixels`: 保存(export)用の厳密なピクセル集合
    - `canvas`: 表示用の 1000x1000 ラスタ
    両方を常に同期して更新する。`setDraftStoreChangeListener` で変更を通知し、
    再描画 (`markDraftCanvasDirty`) と content への状態通知を走らせる。
    seed は数十万 pixel になりうるので `silent: true` で個別通知を抑え、最後に1回だけ通知する。
    通常の set/remove の通知は **queueMicrotask で1回に合流させる** (`notifyChange`)。
    太いブラシ1打点は数百 pixel を触るので、pixel ごとに通知すると
    同数の postMessage が飛んで実用にならない。表示は次フレームでまとめて
    描き直されるため 1操作 1通知で足りる。

  - `draft-bucket-fill.ts`: world pixel 空間の 4 近傍 flood fill。
    判定色は **下書き + 下地 (wplace 本体タイル) の合成**。下書きピクセルがあればそれ、
    無ければ下地の色を見る。これで既存アートの線がそのまま塗りの壁になり、
    下書きが空でも下地の領域だけを塗れる。**下地は読むだけで、塗る先は常に下書きレイヤー**。
    **CRITICAL**: 下書きは「広大な world map 上に浮いた疎なピクセル集合」なので、
    何も無いところをバケツすると理論上は無限に広がる。必ず
    `MAX_FILL_PIXELS` (10万) と `MAX_FILL_EXTENT` (開始点から±2000px) で打ち切る。
    打ち切り時は **1px も塗らずに** `too-large` を返す (all-or-nothing。
    中途半端に塗ると取り消しが面倒なため)。
    content 側は画面上部に控えめなヒントを 2.5 秒出す (トーストは使わない方針)。

  - `draft-base-layer.ts`: バケツの「壁」として下地タイルを読む口。
    `tile-draw/last-modified-cache.getOriginalBlob` (原本タイル Blob) を decode して参照する。
    **flood fill 本体は同期のまま**にしたいので、塗る直前に開始点の周辺 3x3 タイルだけ
    `prepareBaseTiles` で decode し、以降は `getBaseColorAtWorld` で同期に引く。
    3x3 で足りるのは `MAX_FILL_EXTENT` (±2000px) が高々隣接タイルまでしか届かないため。
    decode 済みタイルは 1枚 1000x1000 = 4MB なので保持は 9 枚まで (LRU)、
    下書きモード終了時に `clearBaseTileCache()` で解放する。
    下地が未取得 (画面外/未 fetch) のタイルは「色なし」= 壁にならない。
    透明ピクセル (a=0) も「下地なし」扱いで、塗れる空白になる。

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
