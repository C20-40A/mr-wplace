# UserStatus 責務分割+Notification実装ナレッジ

## 責務分割アーキテクチャ
```
StatusManager → StatusUIComponents + StatusCalculator + TimerService + NotificationModal
     ↓              ↓                    ↓                ↓               ↓
   統合制御      UI要素作成           データ計算        タイマー処理    詳細表示Modal
```

## ファイル構成
```
src/features/user-status/
├── ui/
│   ├── components.ts           # UI要素作成（Container+🔔+Badge+Countdown）
│   └── notification-modal.ts   # Modal詳細表示（utils/modal.ts流用）
├── services/
│   ├── calculator.ts           # データ計算（レベル・チャージ・進捗HTML）
│   └── timer-service.ts        # タイマー（カウントダウン+interval管理）
├── manager.ts                  # 統合制御（全責務統合）
└── index.ts                   # 公開API（elementObserver統合）
```

## Notification機能仕様
- **🔔位置**: Container一番左（CSS order:-1）
- **UI**: button + hover効果 + pointer-events:all
- **Modal**: utils/modal.ts統一パターン流用
- **内容**: Level進捗詳細+Charge状態詳細+プログレスバー

## 技術実装パターン

### 責務分離原則
```typescript
// UI作成のみ
StatusUIComponents.createNotificationIcon()

// データ計算のみ  
StatusCalculator.calculateNextLevelPixels()

// Modal表示制御のみ
NotificationModal.show(userData)

// 統合管理のみ
StatusManager.updateFromUserData()
```

### 既存パターン流用
- **Modal統一**: utils/modal.ts.createModal()使用
- **elementObserver**: 既存パターン維持
- **i18n**: 未対応（最小限実装優先）
- **lifecycle**: init/destroy/updateFromUserData維持

### Container構造変更
```typescript
// BEFORE: countdown + badge
// AFTER: notificationIcon(order:-1) + countdown + badge
setupContainer() {
  this.container.appendChild(this.notificationIcon);  // 一番左
  this.container.appendChild(this.chargeCountdown);
  this.container.appendChild(this.nextLevelBadge);
}
```

## Modal内容仕様
- **Level Section**: 現在レベル+総pixel+次レベル必要pixel+プログレスバー
- **Charge Section**: 現在charge/max+cooldown秒数+chargeプログレスバー
- **レスポンシブ**: maxWidth:32rem
- **スタイル**: TailwindCSS使用

## 状態管理統合
```typescript
private currentUserData?: WPlaceUserData;  // Modal表示用データ保持
updateFromUserData(userData) {
  this.currentUserData = userData;         // 保持更新
  // 既存Badge/Countdown更新
  // notificationIconクリックで this.notificationModal.show(userData)
}
```

## 削除なし・既存機能維持
- レベル進捗表示維持
- チャージカウントダウン維持  
- elementObserver統合維持
- 表示制御ロジック維持
- TimerService interval管理維持

**Core**: 責務完全分離+🔔Modal統合+既存機能100%維持+utils/modal統一パターン流用で最小限実装完了