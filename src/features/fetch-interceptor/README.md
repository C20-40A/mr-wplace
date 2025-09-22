# Fetch Interceptor

WPlace のタイル画像リクエストをキャッチするシンプルな fetch ハイジャック

## 動作

- Chrome 拡張読み込み時に自動で fetch を上書き
- WPlace タイル URL 検出時にログ出力
- 元のレスポンスをそのまま返すパススルー

## ログ例

```
WPlace tile: https://backend.wplace.live/files/s0/tiles/520/218.png
```

## 拡張方法

`inject.js`の if 文内に処理を追加することで機能拡張可能
