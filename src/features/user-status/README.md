# UserStatus Charge Monitor - 簡略化実装ナレッジ

## アーキテクチャ（簡略化）
```
service_worker.js → chrome.alarms → checkChargeAndNotify() → chrome.notifications
     ↓                  ↓                      ↓                    ↓
   シンプル制御     1分間隔監視      80%固定判定      通知表示+wplace.live開く
```

## ファイル変更
```
service_worker.js          # 簡略化: 80%固定、複雑設定削除
NotificationModal.ts       # Start/Stopボタンのみ、設定UI削除
content.ts                # window.wplaceChargeData設定追加
manifest.json              # alarms,notifications権限（両方必要）
```

## 機能仕様（最小限）
- **監視開始**: Start Monitorボタン
- **監視停止**: Stop Monitorボタン  
- **判定**: charge 80%固定（current/max*100>=80）
- **通知**: chrome.notifications（1分間隔チェック）
- **クリック**: 通知クリック→wplace.live開く

## 技術実装
### service_worker.js
- `chrome.alarms.create('charge-check', 1分間隔)`
- `checkChargeAndNotify()`: tabs.query→sendMessage→GET_CHARGE_DATA
- `chrome.notifications.create('charge-ready')`

### content.ts  
- UserData受信時: `window.wplaceChargeData = {current, max}` 設定
- GET_CHARGE_DATA応答: wplaceChargeData返却

### NotificationModal
- Start/Stopボタン: `chrome.runtime.sendMessage`でservice_worker制御
- UI: 緑Start・赤Stopボタン、説明テキストのみ

## 削除した複雑機能
- ~~設定UI（スライダー・トグル・保存）~~
- ~~chrome.storage設定管理~~
- ~~パーセンテージ可変設定~~
- ~~複雑イベントリスナー~~

## 制約
- **両権限必要**: "alarms"（監視）+"notifications"（通知表示）
- **80%固定**: 可変設定なし
- **1分間隔**: chrome.alarms最小制約
- **wplace.liveタブ必要**: 他タブではcharge data取得不可

**Core**: 複雑設定削除→Start/Stopボタン制御→80%固定通知の最小限実装完了