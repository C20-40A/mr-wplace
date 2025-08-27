# WPlace Studio - Fetch Interceptor

WPlaceのタイル画像リクエストをキャッチするシンプルなfetchハイジャック

## 動作

- Chrome拡張読み込み時に自動でfetchを上書き  
- WPlaceタイルURL検出時にログ出力
- 元のレスポンスをそのまま返すパススルー

## ログ例

```
WPlace tile: https://backend.wplace.live/files/s0/tiles/1803/802.png
```

## 拡張方法

`inject.js`のif文内に処理を追加することで機能拡張可能
