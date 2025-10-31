## Firefox 対応完了 (2025-10-31)

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
- `src/inject/fetch-interceptor.ts`: tile 処理を inject 側で完結するように変更
- `src/inject/message-handler.ts`: gallery images の受信処理追加
- `src/inject/types.ts`: `mrWplaceGalleryImages` 型定義追加
- `src/content.ts`: gallery 画像を inject 側に送信する処理追加

### メリット
- Firefox の extension context セキュリティ制約を回避
- page context なら通常の Canvas API がフル活用できる
- Chrome との互換性も維持
