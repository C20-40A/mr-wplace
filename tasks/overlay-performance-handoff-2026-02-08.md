# Overlay Performance Handoff (2026-02-08)

## 直近で実施済み
- `scaleAndRenderWithMode` を x3全走査から x1基準描画へ変更。
- `applyOverlayProcessing` で `ImageBitmap -> Uint8ClampedArray` の重複変換を削減（lazy + 再利用）。
- `convertToImageBitmap` で型安全を保ちつつ不要コピーを回避。
- hot loop の色比較を配列生成なしに変更（component比較）。
- CPU color filter を文字列キーから数値キー比較へ変更。
- `colorFilterState` の `await import` を静的参照化。
- GalleryRepository v2 の解決をタイルごとではなく1回キャッシュ化。

## 次にやると効果が大きい候補（優先順）
1. `notifyStatsUpdate` の全量シリアライズを差分送信へ変更。
- 現状は1タイル更新で画像全タイル分を `Object.fromEntries` して `postMessage` している。
- image単位の巨大データでメインスレッド負荷が高い。
- 互換性のため、最初は `delta + full fallback` 方式が安全。

2. `affectedTiles.includes(coordStr)` の線形探索を `Set` 化。
- `TileDrawInstance` に `affectedTileSet?: Set<string>` を持たせる。
- レイヤー数/対象タイル数が増えるほど効く。

3. `convertImageBitmapToUint8ClampedArray` の OffscreenCanvas 生成を再利用。
- 毎回 `new OffscreenCanvas` を作っているため、小さいオーバーヘッドが蓄積。
- サイズ別に 1〜2個キャッシュで十分。

4. GPU path の同期点削減（`gl.finish()` 2回の見直し）。
- 現状は CPU/GPU 同期が強く、GPU利点を潰しやすい。
- まずは upload後の `gl.finish()` を外して計測。

## 計測のおすすめ
- 1タイル処理時間（ms）を `drawOverlayLayersOnTile` の先頭/末尾で計測。
- `matchingTiles.length` ごとの平均時間をログ集計。
- showUnplacedOnly ON/OFF, computeDevice gpu/cpu で比較。

## 注意点
- `inject` 側はページコンテキストで動作し、Chrome APIは使えない。
- 描画仕様（dot/cross/fill/border-only/huge-*）の見た目互換を必ず確認する。
- 変更は段階的に（1〜2件ずつ）入れて切り分けを優先する。
