## Firefox 対応完了 (2025-11-01)

### 問題
Chrome では動作していた tile overlay 処理が Firefox で失敗していた:
- `content.ts` (extension context) での `ImageBitmap`/`ImageData` 処理が Firefox のセキュリティチェックでエラー
- `InvalidStateError: Failed to extract Uint8ClampedArray from ImageData (security check failed?)`

### 解決策
**inject 側 (page context) で画像処理を完結させる**

新しい処理フロー:
1. `content.ts` → `inject.js` に gallery 画像データを postMessage で送信
2. `inject.js` (page context) で fetch intercept → tile blob 取得
3. **inject.js 内で Canvas API を使って overlay 合成** (NEW)
4. 合成済み blob を直接 fetch の Response として返す

### 変更ファイル
- `src/inject/tile-processor.ts` (NEW): page context での Canvas 合成ロジック
  - `Image` オブジェクトで dataUrl を直接読み込み (fetch 不要)
- `src/inject/fetch-interceptor.ts`: tile 処理を inject 側で完結するように変更
- `src/inject/message-handler.ts`: gallery images の受信処理追加
  - キャッシュクリア + 小さなパンでマップ強制再描画
- `src/inject/types.ts`: `mrWplaceGalleryImages` 型定義追加
- `src/content.ts`: gallery 画像を inject 側に送信する処理追加
  - `sendGalleryImagesToInject()` を export
- `src/features/tile-overlay/index.ts`: 画像配置時に inject 側を更新
- `src/features/gallery/index.ts`: 画像削除時に inject 側を更新

### メリット
- Firefox の extension context セキュリティ制約を回避
- page context なら通常の Canvas API がフル活用できる
- Chrome との互換性も維持
- リアルタイム更新: 画像追加・削除・移動時に自動反映 (リロード不要)

### 注意点
- dataUrl は base64 データなので、`Image` オブジェクトで直接読み込む (fetch/createImageBitmap は不要)
- マップの強制再描画は不要。タイルキャッシュのクリアのみで十分
- `wplace-studio-drawing-complete` イベントで drawing-loader を hide する (inject 側で処理が完結しているため、`mr-wplace-processed` は送信されない)
