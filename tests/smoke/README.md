# 主要機能のオフライン smoke test

```sh
npm run test:smoke
# PC だけ確認する場合
npm run test:smoke -- --project desktop
```

既存の Playwright / esbuild を使用。初回のみ Chromium が未導入なら
`npx playwright install chromium` を実行する（ブラウザーの配布元から取得）。
公式サイト・ログイン・実際のペイントは不要。ユーザーのブラウザープロファイルを
使わず、テストごとに独立したブラウザー環境を作る。HTTP と WebSocket は遮断し、
通信を試みた場合も失敗にする。自動定期実行は設定していない。

## 確認範囲

- 実際の GalleryUI / ImageGridComponent / Router を使った表示、描画表示切替、
  再描画、最小化・復元、戻る、閉じる・再表示、画像クリック。
- 実際の element-observer による、ツールバー置き換え後のボタン再生成と操作。
- 実際の gallery bridge / storage bridge によるメタデータ要求・応答、古い応答の
  無視、レイヤー順、未配置画像の除外、一時非表示の解除。保存先の応答だけを模擬。
- 背景色のレイヤー準備待ち、復元、待機中の変更・解除、購読の重複と解除。

desktop と tablet（Chromium の iPad サイズ・タッチ設定）の計6ケース。
tablet は Orion / WebKit 実機の互換性を保証するものではない。
エラー時は Playwright のスクリーンショットとトレースを `test-results/` に残す。

## 増やす時の境界

`harness.ts` は本番部品を公開する薄い入口。`fixtures.ts` が拡張APIを仮置きし、
`@/content` の参照を実際の gallery bridge に差し替えてアプリ全体の起動を防ぐ。
機能本体をテスト用に複製しない。新しい代表的な不具合が出た時にケースを追加する。

公式DOMセレクターの現状、拡張全体の起動、IndexedDBへの実保存、実タイルへの
オーバーレイ描画、公式テーマCSSの見た目は対象外。公式サイトの構造変更は、
必要な時の読み取り確認で補う。関連機能の変更時・リリース前に手動実行する。
