---
name: i18n
description: 多言語翻訳キーの追加・削除・更新・検索をCLIスクリプトで効率的に管理するスキル。 Trigger= "i18n", "翻訳", "多言語", "translation", "locale" 使用場面=翻訳キーの追加、削除、更新、検索、不足キーの確認
---

## 重要: ファイルを直接Readしない

localeファイル (`src/i18n/locales/*.ts`) は各400-500行あり、7言語で合計3000行超。
**絶対にlocaleファイルを直接Readしないこと。** 代わりに `bun scripts/i18n.ts` を使う。

## 言語一覧

| Code | Language   | File  | Export Name    |
| ---- | ---------- | ----- | -------------- |
| en   | English    | en.ts | enTranslations |
| ja   | 日本語     | ja.ts | jaTranslations |
| es   | Español    | es.ts | esTranslations |
| fr   | Français   | fr.ts | frTranslations |
| pt   | Português  | pt.ts | ptTranslations |
| ru   | Русский    | ru.ts | ruTranslations |
| vi   | Tiếng Việt | vi.ts | viTranslations |

- ベース言語: `en` (English) — 全キーの基準
- フォールバック: `en` → キー名そのまま

## CLIコマンド

すべて `bun scripts/i18n.ts` で実行:

### キー数の確認

```bash
bun scripts/i18n.ts list
```

### 不足キーの確認

```bash
bun scripts/i18n.ts missing              # enをベースに比較
bun scripts/i18n.ts missing --base ja    # jaをベースに比較
```

### キーの値を全言語で確認

```bash
bun scripts/i18n.ts get <key>
```

### キー/値の検索

```bash
bun scripts/i18n.ts search <regex-pattern>
```

### キーの追加

```bash
bun scripts/i18n.ts add <key> --en "English" --ja "日本語" --es "Español" ...
```

- 最低限 `--en` と `--ja` を指定する
- 他言語は可能な限り指定。不明な場合はユーザに確認するか、`missing`コマンドで後から確認

### キーの削除

```bash
bun scripts/i18n.ts remove <key>
```

- 全言語から一括削除

### キーの更新

```bash
bun scripts/i18n.ts update <key> --en "New value" --ja "新しい値"
```

- 指定した言語のみ更新

## ワークフロー例

### 新機能に翻訳キーを追加する場合

1. まず既存のキーを検索して重複がないか確認:

   ```bash
   bun scripts/i18n.ts search "feature_name"
   ```

2. キーを追加 (en/jaは必須、他言語も可能な限り):

   ```bash
   bun scripts/i18n.ts add feature_button_label --en "Click Me" --ja "クリック" --es "Haz clic" --fr "Cliquez" --pt "Clique" --ru "Нажмите" --vi "Nhấp"
   ```

3. 追加結果を確認:
   ```bash
   bun scripts/i18n.ts get feature_button_label
   ```

### 不足翻訳を埋める場合

1. 不足キーを確認:

   ```bash
   bun scripts/i18n.ts missing
   ```

2. 各言語の不足キーを追加/更新

## キー命名規則

- `feature_action` パターン: `gallery_save`, `bookmark_delete`
- セクションプレフィックス: `gallery_`, `map_filter_`, `tutorial_`, `popup_`
- ネストは `_` で表現: `map_filter_area_save_new`

## コードでの使用

```typescript
import { t } from "@/i18n/manager";
const label = t("feature_button_label");
```
