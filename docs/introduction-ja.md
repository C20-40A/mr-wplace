# Mr. Wplace

WPlaceでのピクセルアート制作を強力にサポートするブラウザ拡張機能です。テンプレート表示、進捗管理、ブックマークなど、制作が楽になる機能を詰め込みました。

---

## 主要機能

### 1. テンプレート機能（ギャラリー）

好きな画像をマップに重ねて、なぞるだけで完成します。

![テンプレート機能](images/intro/01-gallery.png)

**できること:**

- 画像をアップロードしてWPlace用に自動変換
- 明るさ・コントラスト・彩度・シャープネスの調整
- ディザリング（ベイヤー行列）で綺麗なドット絵に

- 制作予定の作品はシェアでき、ほかの人と共同開発することができます
- 進捗率・残りピクセル数・完成予定日を表示
- 複数画像をレイヤーで管理

---

### 2. マップに重ねる画像の見え方を変える

マップに重ねる画像の見え方をカスタマイズできます。

![カラーフィルター](images/intro/02-color-filter.png)

**カラーフィルター:**

- 特定の色だけを強調表示
- 現在選択中の色だけの表示に自動で切り替え
- パレットに残りピクセル数を表示

**未配置のみ表示:**

- 塗り終わった部分をグレーアウトし、塗り残しを一目で発見
- 巨大マーカーモードと組み合わせれば、数万ピクセルの大作でも塗り残しを一発で発見

---

### 3. 無限ブックマーク＆タグ

お気に入りの場所を無制限に保存・整理できます。

![ブックマーク](images/intro/03-bookmark.png)

**できること:**

- 現在地をワンクリックで保存
- タグで分類（自分の作品 / 気になる場所 / 荒らし監視 など）
- タグでフィルタリング
- 地名検索してジャンプ
- 緯度経度 ↔ WPlace座標の相互変換
- タグごとにエクスポート・シェア可能

---

### 4. 現時点のピクセルアートを保存・復元

タイルの「あの頃の状態」を保存・復元できます。

![アーカイブ](images/intro/04-time-travel.png)

**できること:**

- 現在のタイルをスナップショット保存
- 過去の状態をオーバーレイ表示
- 荒らし被害時の復元資料として活用
- 座標＋タイムスタンプ付きで画像をシェア
- 隣接タイルをマージして一枚の画像に

---

### 5. ほかのプレイヤー情報をメモ

「この人、前にも見たな...」をメモしておけます。

![友人帳](images/intro/05-friends-book.png)

**できること:**

- プレイヤー名・タグ・メモを登録
- ピクセルクリック時に「＋」ボタンで追加
- 登録したプレイヤー名にホバーでメモ表示
- CSV形式でインポート・エクスポート

---

### 6. テキスト描画の補助

マップ上にテキストを補助表示できます。

![テキスト描画](images/intro/06-text-draw.png)

**できること:**

- 12種類のピクセルフォントに対応
- 日本語（ひらがな・カタカナ）対応
- 矢印キーで位置を微調整
- 複数のテキストを同時に配置

---

### 7. マップ表示をカスタマイズ

明るさ、グリッド、境界線。自分好みの見え方にカスタマイズできます。

![マップ表示補助](images/intro/07-map-display.png)

- ☀️ ダークテーマ : マップとUIを暗くする
- ⚪ ハイコントラスト : コントラストを上げて見やすく
- 📐 タイル境界 : タイルの境界線を赤く表示
- 🔲 ピクセルグリッド : ピクセル単位のグリッド線を表示
- 🎨 背景色 : マップの背景色を変更

画面左上のボタンからワンクリックで切り替えられます。

---

### 8. ペイント通知

「チャージ溜まってるのに気づかなかった」を防ぎます。

![ペイント通知](images/intro/08-notification.png)

**できること:**

- ブラウザ通知でチャージ完了をお知らせ
- 通知のしきい値を10%〜100%で自由に設定
- Googleカレンダー連携でフルチャージ時刻を登録

---

### 9. スマホ向け機能

スマホの小さな画面でも、ストレスなくペイントできるよう、専用の設定を用意しています。

![スマホ向け機能](images/intro/09-mobile.png)

**できること:**

- パレットを非表示にして画面を広く使う
- ロックボタンを大きく表示して押しやすく
- 各種UIをタッチ操作に最適化

---

## その他

- **開発者向け機能**: ポップアップの「Mr. Wplace」の文字を何度もクリックすると、変な機能が使えるようになってしまいますが、開発用なので利用しないでください
- **データセーバー**: タイルをキャッシュして通信量を削減

---

## 規約について

Mr. Wplaceの視覚補助機能（テンプレート表示、カラーフィルターなど）は、WPlaceの利用規約で明示的に認められています。自動でピクセルを配置する機能は搭載していません。

---

## インストール方法

### PC（Chrome / Edge / Firefox）

以下のストアからワンクリックでインストール:

- [Chrome ウェブストア](https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej)
- [Microsoft Edge アドオン](https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip)
- [Firefox アドオン](https://addons.mozilla.org/ja/firefox/addon/mr-wplace/)

### iOS（Orion Browser）

1. [Orion Browser by Kagi](https://apps.apple.com/jp/app/orion-browser-by-kagi/id1484498200) をインストール
2. 設定 → 詳細設定 →「Chrome拡張機能とFirefox拡張機能」をON
3. [Chrome ウェブストア](https://chromewebstore.google.com/detail/mr-wplace/klbcmpogekmdckegggoapdjjlehonnej) からインストール

### Android

**Edge Canary:**

1. Edge Canaryアプリをインストール
2. [Edge アドオン](https://microsoftedge.microsoft.com/addons/detail/mr-wplace/acdodonamhbokadiikkfnnliplijigip) にアクセスで自動インストール

**Firefox Nightly:**

1. Firefox Nightly for Developersアプリをインストール
2. [Firefox アドオン](https://addons.mozilla.org/ja/firefox/addon/mr-wplace) からインストール

---

## 不具合報告・要望

- [技術局フォーラム](https://discordapp.com/channels/1405845560413651026/1420021661700329493)
- [不具合報告フォーム](https://docs.google.com/forms/d/e/1FAIpQLSe0L5I6wqGnsgHU9_gj2rm9UijzPeLws5OOuHu1HdxKNNug4g/viewform)
- [gihub issue](https://github.com/C20-40A/mr-wplace/issues)
