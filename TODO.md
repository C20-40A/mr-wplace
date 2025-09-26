# クリティカル

- 黒色だけなぜか enhance されない。transparent と同じ扱いになっている？
- タイルの import, 時刻が import されてないというより、「ダウンロードした時刻」になっている問題

# マイナー

- ギャラリー画像＋位置を export して、複数人で編集できる機能
  - シェアボタン。tile+pixel の座標表示。lat lng のリンク表示。説明表示
- アイコンを pixel art にする
- 「持っている色のみ」の filter
- color filter の enable all/ disable all を i18n
- filter 適用中に描画中モーダル表示
- タイル詳細に削除ボタンあってもいい
- ui.ts 系は functional のほうがいいかもしれない
- 入力文字を描画したい
- 逆ジオあってもいいかも
  - https://nominatim.org/ が利用可能
- お気に入りモーダルを整理可能にする
- ギャラリーから、画像に移動したとき、即座に描画されない？
- ギャラリーから画像を削除したとき、空のアイテムが残る
- 文字入力モーダルを初期で選択状態に変更
- Transparent の色が、既存の色を上書きできない
- UI の描画方法を統合する
- 道路引くツール
- ギャラリー画像の入れ替えもあってもいいかも
- Current Charges が少しだけ手持ちのものとずれている問題
- 大きな範囲の tile が異なると alert を出す
- 友人帳
- 現在何パーセントの進捗か表示(ゲーミフィケーション)
- スナップショットを削除しても、タイルの設定は残る

# DONE v1.3.3

- 表示中の色を Enhance する
- 現在選択中の色を filter に表示
- image import で color pick
- 画像読み込み時の color filter

# DONE v1.3.0

- notification
- フルチャージまでの時間
- next level までの pixel のバッジ少しわかりにくい

# DONE v1.2.2

- タイルの描画状態は、storage 保存にする
- window.mrWplace?.tileOverlay;のような方式は微妙

# DONE v1.2.1

- レベルアップまでの残りの pixel 数
- skirk marble 相当の機能
  - 描画画像のカラーフィルター

# DONE v1.2.0

- Tile の import 機能
- 言語設定がポルトガル語だと、セレクタが動作しない。おそらく、Title が変化しているため。
- 一度、タイル一覧を表示してしまうと、次以降タイムマシンで前回の位置のスナップショットが表示される
- map 移動モードの option 化
- maplibre-gl のインスタンスを取得する
  - MyLocation ボタンのイベントリスナーからたどることは可能。（　 document.querySelector("div.absolute.bottom-3.right-3.z-30").childNodes[0].\_\_click[3].v 　）
  - "#map"に`__click` はなかった。 getEventListeners($0) で調べることは可能
  - document.querySelector(".maplibregl-canvas")
- goTo は map のインスタンス使えるかも
- selector 失敗したとき用の、予備の UI

# DONE v1.1.0

- 言語変更後に即座に適用
- タイルに名称を設定できると便利
- タイムマシン機能で描画中のタイルを Disable にできない
- タイムスタンプの描画できてない？
- タイルまたぎの描画できてない？
  - おそらく複数描画の影響。描画を整理したほうがいいかもしれない。
  - 描画する候補は、ギャラリーではなく、別の描画用の list を作り、そこで管理する。
- ギャラリーのルーティングができてない
- ある地点のスナップショットを表示（ここにはスナップショットがあり、スナップショット一覧が表示される）　 → 　そして、別のスナップショットがない場所のスナップショット一覧を表示しようとする → 期待する動作：スナップショットがないという表示。実際の動作：前回表示した別の地点のスナップショット一覧が表示される
- 画像エディタに https://pepoafonso.github.io/color_converter_wplace/index.html へのリンク
- src/features/bookmark/import-export.ts の i18n
- お気に入りがない場合の UI が少しずれている
- 現在位置のスナップショットから、id を消し、スナップショットダウンロードする場合のファイル名を変更
- スナップショットの描画が被る場合がある
- 描画中にスナップショットを削除すると、描画がリセットできなくなる問題の修正
- i18n を増やす
