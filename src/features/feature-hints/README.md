# Feature Hints

初回表示のヒントツールチップ機能の仕様と使い方。

## 概要

- 対象要素の近くに吹き出し型ヒントを表示する
- ヒントは `id` 単位で管理され、一度閉じたら再表示しない
- 既存 UI レイアウトを壊さないように、`body` 直下の独立オーバーレイで描画する

## 関連ファイル

- `src/features/feature-hints/index.ts`
  - feature 側から呼ぶ公開 API
- `src/components/hint-tooltip.ts`
  - ツールチップ描画、位置計算、閉じる挙動
- `src/states/feature-hints.ts`
  - 既読フラグの永続化（`chrome.storage.local`）

## 使い方

### 1. ヒントIDを定義する

`src/features/feature-hints/index.ts` の `FeatureHintId` と `HINT_DEFINITIONS` に追加する。

```ts
export type FeatureHintId =
  | "show-unplaced-only"
  | "color-isolate"
  | "data-saver"
  | "your-feature-id";

const HINT_DEFINITIONS: Record<FeatureHintId, FeatureHintDefinition> = {
  "your-feature-id": {
    messageKey: "hint_your_feature",
    placement: "top",
  },
};
```

`placement` は `top | bottom | left | right`。

### 2. i18nキーを追加する

`scripts/i18n.ts` を使って `hint_*` キーを追加する。

例:

```bash
bun scripts/i18n.ts add hint_your_feature \
  --en "Your hint message" \
  --ja "ヒント文言"
```

### 3. 対象要素生成後に呼ぶ

ボタンやアイコンが生成された直後に `showFeatureHint` を呼ぶ。

```ts
import { showFeatureHint } from "@/features/feature-hints";

showFeatureHint("your-feature-id", buttonElement);
```

## 動作仕様

- 表示は `id` ごとに 1 回だけ
- `show-unplaced-only` は「配置済み色を薄くする」補助機能として案内する
- 閉じる条件:
  - 吹き出しの `✕` ボタン
  - 対象要素のクリック
  - ツールチップ外クリック
  - `Escape` キー
- 画面スクロール・リサイズ時は位置を再計算
- 優先配置が入らない場合は空きスペースが大きい方向にフォールバック

## ストレージ仕様

- キー: `mr_wplace_feature_hints_v1`
- 形式: `Record<string, true>`
- 例:

```json
{
  "show-unplaced-only": true,
  "data-saver": true
}
```

## 注意点

- `target` には `isConnected === true` の要素を渡すこと
- 同じ `id` を複数機能で使い回さないこと（既読管理が衝突するため）
- ヒント文は短くし、1メッセージ1目的を推奨
