# UserStatus実装ナレッジ

## アーキテクチャ
```
StatusManager → NotificationModal → service_worker.js → chrome.alarms/notifications
     ↓              ↓                    ↓                      ↓
userData監視    threshold管理         アラーム制御           通知表示
```

## ファイル構成・役割
```
manager.ts                 # userData変化→アラーム自動更新
ui/notification-modal.ts   # threshold設定UI、Start/Stop制御
services/calculator.ts     # charge/level計算
services/timer-service.ts  # UI countdown表示
service_worker.js          # chrome.alarms→chrome.notifications
```

## 技術実装

### Threshold管理
- chrome.storage.local: `ALARM_THRESHOLD` (default: 80)
- NotificationModal: slider UI + Start Monitor時保存
- StatusManager: userData変化時storage読み取り→アラーム更新

### アラーム制御フロー
```
1. Start Monitor → storage保存 + アラーム設定
2. paint使用 → userData変化 → StatusManager.handleChargeAlarmUpdate()
3. storage読み取り → 時刻再計算 → アラーム更新
```

### Charge計算
- globalChargeData優先、なければuserData.charges
- current/max*100 >= threshold → アラーム停止
- 未到達 → (requiredCharges-current) * cooldownMs で時刻計算

### service_worker.js
- START_CHARGE_ALARM/STOP_CHARGE_ALARM/GET_ALARM_INFO
- chrome.alarms.create(ALARM_ID, {when})
- アラーム発火 → chrome.notifications.create

## UI仕様
- slider: threshold設定（10-100%, step5）
- Start/Stop Monitor: アラーム制御
- リアルタイム表示: Estimated time更新
- Modal: click→詳細表示

## データフロー統合
```
paint使用 → fetchハイジャック → userData更新 → StatusManager.updateFromUserData()
                                                      ↓
アラーム設定中 → handleChargeAlarmUpdate() → storage読み取り → 時刻再計算 → アラーム更新
```

## 制約
- chrome.alarms: when時刻指定（相対時間なし）
- globalChargeData/userData.charges: 両対応必要
- threshold変化: Start Monitor時のみ保存（slider変更毎は重い）

TODO: Start/Stop → enable/disable仕様変更予定