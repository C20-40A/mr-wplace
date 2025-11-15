# UserStatus実装ナレッジ

## アーキテクチャ（v1.10.2以降）

```
inject context                    content context
   ↓                                    ↓
/me intercept                   NotificationModal
   ↓                                    ↓
StatusManager → UI表示         アラーム管理（将来実装）
   ↓
window.mrWplace.wplaceChargeData
   ↓
TimerService (countdown)
```

## 移行履歴（2025-11-16）

**問題**: inject context と content script context は分離されており、postMessage 経由でデータを送っても `window.mrWplace.wplaceChargeData` が content script 側で上書きされて消えていた。

**解決**: User status の表示を完全に inject context に移行。

### inject context（ページコンテキスト）
- `/me` endpoint をインターセプト
- `StatusManager` で UI 作成・更新
- `window.mrWplace.wplaceChargeData` を直接設定
- `TimerService` でカウントダウン表示
- UI クリック時に content script へメッセージ送信

### content script（拡張機能コンテキスト）
- `NotificationModal` を管理（Chrome storage API が必要）
- inject からのモーダル表示要求を受信
- アラーム機能（将来実装時）

## ファイル構成・役割

### inject context
```
src/inject/
  handlers/user-status-handler.ts  # /me データハンドラー
  user-status/
    status-manager.ts               # UI 管理（inject 版）
    ui-components.ts                # UI コンポーネント
```

### content context
```
src/features/user-status/
  ui/notification-modal.ts          # モーダル（Chrome API 使用）
  services/
    calculator.ts                   # charge/level 計算（共有）
    timer-service.ts                # countdown 表示（共有）
```

### 共有コンポーネント
- `calculator.ts`: inject/content 両方で使用可能
- `timer-service.ts`: inject/content 両方で使用可能

## メッセージフロー

```
inject → content (モーダル表示要求)
  {
    source: "mr-wplace-open-user-modal",
    userData: { level, pixelsPainted, charges, ... }
  }
```

## 技術実装

### Charge計算
- `window.mrWplace.wplaceChargeData` を inject context で設定
- globalChargeData優先、なければuserData.charges
- current/max*100 で進捗計算

### UI仕様
- 位置: 画面上部中央
- 背景: 白、ホバーで薄灰色
- ゲージ: 青（レベル）、黄色（チャージ）
- クリック: モーダル表示

## データフロー

```
/me fetch → inject intercept → handleUserStatusUpdate()
                                      ↓
                          window.mrWplace.wplaceChargeData 設定
                                      ↓
                          StatusManager.updateFromUserData()
                                      ↓
                          UI 更新 + TimerService 開始
                                      ↓
                          1秒ごとに countdown 更新
```

## 制約
- inject context では Chrome API 使用不可
- content script context では window.mrWplace が inject と別
- モーダルや storage 操作は content script 側で実行
