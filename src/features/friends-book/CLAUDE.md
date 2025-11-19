# Friends Book Feature

## 概要

WPlaceの他のユーザーを「友人帳」に登録・管理する機能。ユーザー名、ID、同盟情報、メモ、タグを保存できる。

## 機能

- **友人追加**: "Painted by:" の横のボタンから現在表示されているユーザーを友人帳に追加
- **友人リスト**: 右下FABボタンで友人一覧をモーダル表示
- **タグ管理**: 友人にタグ（色＋名前）を付けて分類
- **メモ機能**: 各友人に自由なメモを保存
- **ソート**: 追加順、名前順、タグ順で並び替え
- **フィルター**: タグでフィルタリング
- **編集・削除**: 友人情報の編集・削除
- **オンライン同期**: CSV URLから友人リストを同期（追加同期・上書き同期）

## アーキテクチャ

### データフロー

```
1. ユーザーがマップ上のピクセルをクリック
   ↓
2. WPlace が /s0/pixel/<tileX>/<tileY>?x=<x>&y=<y> を fetch
   ↓
3. inject/fetch-interceptor.ts がインターセプト
   ↓
4. レスポンスから paintedBy データを抽出
   ↓
5. window.postMessage で content script に送信
   {
     source: "mr-wplace-painted-by-user",
     userData: { id, name, allianceId, allianceName, equippedFlag }
   }
   ↓
6. content script (index.ts) が受信して lastPaintedByUser に保存
   ↓
7. ユーザーが「友人帳に追加」ボタンをクリック
   ↓
8. showAddFriendDialog() でダイアログ表示
   ↓
9. FriendsBookStorage.addFriend() で Chrome storage に保存
```

### Context 分離

- **inject context** (page context): fetch をインターセプトしてユーザー情報を取得
- **content script** (extension context): ユーザー情報を受信・保存・UI管理

この分離が必要な理由:
- inject context は WPlace の fetch にアクセス可能
- content script は Chrome storage API にアクセス可能
- 両者は直接的に変数を共有できない → postMessage で通信

## ファイル構成

```
src/features/friends-book/
├── CLAUDE.md          # このファイル
├── index.ts           # メイン機能、ボタン配置、モーダル管理
├── types.ts           # Friend, Tag 型定義
├── storage.ts         # Chrome storage CRUD 操作
└── ui.ts             # UI components（ダイアログ、モーダル、レンダリング）
```

## データ構造

### Friend

```typescript
interface Friend {
  id: number;              // WPlace user ID
  name: string;            // ユーザー名
  equippedFlag: number;    // 装備フラグ
  allianceId?: number;     // 同盟ID (optional)
  allianceName?: string;   // 同盟名 (optional)
  picture?: string;        // アイコン画像 base64 (optional)
  memo?: string;           // 自由メモ
  tag?: Tag;               // タグ
}
```

### Tag

```typescript
interface Tag {
  name?: string;  // タグ名 (optional)
  color: string;  // 色 (hex code)
}
```

### Storage Key

- `mr_wplace_friends_book`: 友人リストを JSON 配列として保存
- `mr_wplace_friends_book_sync_url`: CSV同期URLを保存

## UI Components

### 1. 友人追加ボタン ("Painted by:" 横)

**場所**: `createAddToFriendsButton()`

- セレクター:
  1. `span` 要素の内容で "Painted by:" or "Pintado por:" を検索
  2. fallback: 固定セレクター
- アイコン: 👥 (SVG)
- 動作: クリックで友人追加ダイアログを表示

### 2. 友人追加/編集ダイアログ

**場所**: `ui.ts` - `showAddFriendDialog()`

- ユーザー情報表示（名前、ID、同盟）
- メモ入力フィールド
- タグ選択UI
  - 既存タグから選択
  - 新規タグ作成
  - タグクリア
- 追加/更新ボタン

### 3. 新規タグ作成ダイアログ

**場所**: `ui.ts` - `showNewTagDialog()`

- タグ名入力（オプション）
- 色選択（17色パレット）
- 作成/キャンセルボタン

### 4. 友人帳FABボタン (右下)

**場所**: `createFriendsBookFAB()`

- 👥👥 アイコン (SVG)
- hover で拡大アニメーション
- クリックで友人リストモーダルを表示

### 5. 友人リストモーダル

**場所**: `ui.ts` - `createFriendsBookModal()`

#### ヘッダー
- ソートドロップダウン（追加順、名前順、タグ順）

#### タグフィルター
- 各タグのボタン（友人数表示付き）
- クリックでON/OFFトグル

#### 友人カード
- アバター（ユーザーIDベースの生成アイコン）
- ユーザー名、ID
- 同盟名（あれば）
- メモ（あれば）
- タグバッジ（あれば）
- 編集・削除ボタン

### 6. Import/Export & オンライン同期モーダル

**場所**: `ui.ts` - `showImportExportDialog()`

#### オンライン同期セクション
- CSV URL入力欄（localStorageに自動保存）
- URLを開くボタン（新しいタブで開く）
- 追加同期ボタン（既存データと統合、同じIDは上書き）
- 上書き同期ボタン（既存データを全削除して置き換え、確認あり）

#### Import セクション
- ローカルCSVファイルからインポート

#### Export セクション
- 全友人をCSVでエクスポート
- タグでフィルタリングしてエクスポート

## Storage 操作

### FriendsBookStorage クラス

- `getFriends()`: 全友人を取得
- `addFriend(friend)`: 友人を追加
- `removeFriend(id)`: 友人を削除
- `updateFriend(friend)`: 友人を更新
- `getFriendById(id)`: 特定の友人を取得
- `getExistingTags()`: 使用中のタグ一覧を取得
- `updateTag(oldTag, newTag)`: タグを一括更新
- `deleteTag(tag)`: タグを削除（友人からも削除）
- `getSyncUrl()`: 保存されたCSV同期URLを取得
- `setSyncUrl(url)`: CSV同期URLを保存
- `importFriends(friends, mode)`: 友人をインポート（merge/replace）
- `exportFriendsByTags(tags)`: タグでフィルタリングして友人をエクスポート

## postMessage 通信

### inject → content

**メッセージ**: `mr-wplace-painted-by-user`

```typescript
{
  source: "mr-wplace-painted-by-user",
  userData: {
    id: number,
    name: string,
    allianceId?: number,
    allianceName?: string,
    equippedFlag: number
  }
}
```

**送信**: `src/inject/fetch-interceptor.ts:68-76`

**受信**: `src/features/friends-book/index.ts:234-245`

## 実装の注意点

### 1. Context 分離

❌ **ダメな例**:
```typescript
// content script で直接 inject の変数にアクセス
const userData = window.mrWplaceTempPaintedByUser; // undefined!
```

✅ **正しい例**:
```typescript
// inject から postMessage で送信
window.postMessage({ source: "mr-wplace-painted-by-user", userData }, "*");

// content script で受信
window.addEventListener("message", (event) => {
  if (event.data.source === "mr-wplace-painted-by-user") {
    lastPaintedByUser = event.data.userData;
  }
});
```

### 2. ボタン配置のタイミング

`setupElementObserver()` を使用して、DOM の変化に対応。

"Painted by:" 要素は:
- マップ上のピクセルをクリックした時に動的に表示される
- 別のピクセルをクリックすると再作成される

→ `ElementConfig` で継続的に監視

### 3. タグの一意性

タグのキー: `${color}-${name || ""}`

同じ色と名前の組み合わせは同一タグとして扱われる。

### 4. 追加順の管理

配列の順序 = 追加順。新しく追加された友人は配列の末尾に追加される。
ソート「追加順」では配列を逆順 (`.reverse()`) にして新しい友人を上に表示。

## デバッグ

### Console ログ

- `🧑‍🎨 : Sent paintedBy user data to content script` - inject 送信成功
- `🧑‍🎨 : Received painted by user data` - content 受信成功
- `🧑‍🎨 : Add to friends button created` - ボタン作成成功

### Chrome DevTools

**Storage確認**:
1. DevTools > Application > Storage > Extension storage
2. `mr_wplace_friends_book` キーを確認

**メッセージ確認**:
```javascript
// inject context (ページのコンソール)
window.mrWplaceTempPaintedByUser // undefined (使用していない)

// content script
// lastPaintedByUser を確認する方法はないが、ログで確認可能
```

## 今後の拡張案

- ✅ アイコン画像の保存（`picture` フィールドは用意済み、未実装）
- ✅ 友人のプロフィールページへのリンク
- ✅ 友人が最後にペイントした場所を記録
- ✅ 友人との遭遇履歴
- ✅ Import/Export 機能（bookmark と同様）
- ✅ 検索機能

## 変更履歴

### 2025-11-19: オンライン同期機能を追加

- CSV URLを保存してオンライン同期が可能に（主にGoogleスプレッドシートを想定）
- 追加同期（マージ）と上書き同期の2種類をサポート
- URLを開くボタンも追加
- Import/Exportモーダルに統合

### 2025-11-19: `addedDate` フィールドを削除

- 内部的に `addedDate` フィールドを削除し、配列順で追加順を管理
- CSV import/export は後方互換性を保持（古いCSVも読み込み可能）
- localstorageに残っている古いデータも問題なく動作

## 完成日

2025-11-17
