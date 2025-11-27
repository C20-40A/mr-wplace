これまでの議論を統合し、\*\*「Unified Layer & Progressive Migration Architecture（統合レイヤー＆漸進的移行アーキテクチャ）」\*\*の設計ドキュメントを作成しました。

この設計は、君が最も懸念していた\*\*「安全な移行」「メモリ効率」「CRUD の整合性」\*\*を完全に解決するものです。

---

# Architecture Design Document: Project "Mr. Wplace" v2

## 1\. Core Concept (基本理念)

従来の「描画時にオンデマンドで計算・分割する」方式を廃止し、\*\*「描画は単純化、重い処理は Worker で非同期化」\*\*するアーキテクチャへ移行する。

- **Unified Layer:** Gallery, Text, Snapshot を全て「Layer」として統一的に扱う。
- **Progressive Migration:** 起動時の一括変換は行わず、ユーザーが地図を閲覧している裏側で、少しずつデータを最適化（タイル化）していく。
- **Worker-First:** 重い画像処理は全て Web Worker（別スレッド）に隔離し、UI スレッド（地図操作）を絶対にブロックしない。

---

## 2\. Data Model (データ構造)

データを「軽量なメタデータ」と「重量な画像データ」に分離し、状態（最適化済みか否か）を管理する。

### 2.1 Layer Metadata (IndexedDB: `layers`)

アプリケーションが起動時に読み込む軽量リスト。

```typescript
interface LayerItem {
  id: string;
  type: "gallery" | "text" | "snapshot";
  visible: boolean;
  zIndex: number;
  opacity: number;

  // 状態管理フラグ
  isOptimized: boolean; // true = タイル化済み(State B), false = 生データ使用(State A)

  // 座標・範囲
  coords: { x: number; y: number };
  bounds: { top: number; left: number; right: number; bottom: number };
}
```

### 2.2 Image Data (IndexedDB)

2 つの形態を許容するハイブリッド構成。

| Store Name            | 内容                          | 役割                                   | 寿命                         |
| :-------------------- | :---------------------------- | :------------------------------------- | :--------------------------- |
| **`legacy_blobs`**    | 生データ (Blob/DataURL)       | 未処理・編集中の一時保管場所 (State A) | 最適化完了まで、または編集中 |
| **`optimized_tiles`** | 分割済み画像 (1000x1000 Blob) | 描画用高速データ (State B)             | 恒久保管 (編集されるまで)    |

---

## 3\. Workflow & Logic (処理フロー)

### 3.1 The "Hybrid" Rendering Flow (描画フロー)

**Repository Pattern** により、レンダラーは内部状態（最適化済みか？）を意識せず画像を取得する。

**ロジック詳細:**

1.  **Request:** レンダラーが `getTile(layerId, tileX, tileY)` を要求。
2.  **Check:** `layer.isOptimized` を確認。
    - **YES:** `optimized_tiles` から該当タイルを即座に返す (**高速パス**)。
    - **NO:** `legacy_blobs` から生データを取得し、メモリ上でその部分だけ切り出して返す (**フォールバックパス**)。
3.  **Trigger:** NO の場合、Worker に対して「暇な時にこのレイヤーを最適化せよ」とメッセージを送る (既定キューになければ)。

### 3.2 Progressive Background Migration (移行フロー)

Web Worker 内で実行される「見えない」処理。

1.  **Message Receive:** Main Thread から `MIGRATE_REQUEST` を受信。
2.  **Queueing:** タスクをキューに追加（**同時実行数 1** に制限）。
3.  **Processing:**
    - OffscreenCanvas で生データを展開。
    - グリッドに合わせて分割 (Slice)。
    - 透明部分が多いタイルは破棄 (Sparse Optimization)。
4.  **Save:** `optimized_tiles` に保存し、メタデータの `isOptimized` を `true` に更新。
5.  **Cleanup:** 生データをメモリから解放。

### 3.3 CRUD & Invalidation (編集・移動・削除)

データの整合性を保つための「無効化戦略」。

- **Move / Resize / Edit:**
  1.  `legacy_blobs` に新しい生データを保存。
  2.  `layer.isOptimized = false` に設定。
  3.  既存の `optimized_tiles` を削除予約。
  4.  → 結果：次回の描画から即座に「フォールバックパス」が使われ、見た目が更新される。その後、裏で再最適化が走る。
- **Delete:**
  1.  全てのストアから関連 ID のデータを削除。

---

## 4\. Risk Mitigation (課題と対策)

懸念点に対する、システムレベルでの防御策。

| 課題                   | 発生原因                                              | **本設計での対策**                                                                                                                 |
| :--------------------- | :---------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- |
| **処理落ち (Jank)**    | メインスレッドで巨大画像を処理/保存するため。         | **Web Worker への完全委譲**。メインスレッドは「表示」のみに専念し、計算と保存は裏で行う。                                          |
| **メモリ不足 (Crash)** | 多数の画像を一度に処理したり、GC が追いつかないため。 | **Serial Queue (直列処理)**。Worker は「一度に 1 枚」しか処理しない。また、`ImageBitmap.close()` でメモリを明示的に解放する。      |
| **データ不整合**       | 保存中に編集が行われたり、新旧データが混在するため。  | **Invalidation Strategy**。編集された瞬間「最適化データ」を無効(ゴミ)とみなし、強制的に生データ表示へ戻す。                        |
| **移行の失敗**         | ブラウザを閉じるなどして中断される。                  | **Stateless Check**。次回起動時、`isOptimized: false` のままなので、描画された瞬間に再び移行キュー積まれるだけ。データは壊れない。 |

---

## 5\. Implementation Roadmap (詳細)

**詳細設計ドキュメント:**
- **[Implementation Design](./docs/migration/implementation-design.md)** - 詳細な実装設計、API仕様、データモデル
- **[Concerns & Mitigation](./docs/migration/concerns-and-mitigation.md)** - 懸念点と対策、リスク評価
- **[Testing Strategy](./docs/migration/testing-strategy.md)** - テスト戦略、パフォーマンス測定

---

### Phase 1: Worker Infrastructure (基盤作成)

**目標:** メインスレッドをブロックせずに画像を分割・保存できることを実証

**実装タスク:**

#### 1.1 Worker ファイルの作成
- [ ] `src/inject/workers/migration.worker.ts` を作成
  - OffscreenCanvas で画像分割ロジックを実装
  - ImageBitmap の明示的な close() でメモリ解放
  - IndexedDB への保存処理

#### 1.2 タスクキュー管理
- [ ] `src/inject/workers/queue.ts` を作成
  - 直列キュー（同時実行数 1）
  - 優先度付きキュー（0=高優先度、1=低優先度）
  - エラー時も処理継続

#### 1.3 通信プロトコル
- [ ] `src/inject/workers/messaging.ts` を作成
  - 型安全なメッセージング（WorkerRequest / WorkerResponse）
  - タイムアウト処理
  - ロギング機能

#### 1.4 IndexedDB ヘルパー
- [ ] `src/inject/workers/idb-helper.ts` を作成
  - Worker 内での IndexedDB 操作
  - トランザクション管理
  - エラーハンドリング

**テスト:**
- [ ] Unit Test: タスクキューが直列処理できる
- [ ] Unit Test: 優先度が正しく機能する
- [ ] Unit Test: ImageBitmap が正しく close() される
- [ ] Unit Test: エラー時も処理が継続する

**完了条件:**
- 全 Unit Test が通過（カバレッジ 90%+）
- Worker が画像を分割し IndexedDB に保存できる
- メモリリークが発生しない

---

### Phase 2: Repository & Data Layer (データ層)

**目標:** Repository Pattern で内部実装を隠蔽し、高速パス/フォールバックを自動切り替え

**実装タスク:**

#### 2.1 IndexedDB スキーマ
- [ ] `src/inject/db/schema.ts` を作成
  - `layers` - レイヤーメタデータ
  - `legacy_blobs` - 生データ（State A）
  - `optimized_tiles` - 分割済みデータ（State B）
  - `statistics` - 統計情報
  - Indexes の作成（type, visible, layerId）

#### 2.2 LayerRepository
- [ ] `src/inject/db/layer-repository.ts` を作成
  - `getTile(layerId, tileKey)` - 高速パス/フォールバック自動切り替え
  - `getLayerMetadata(layerId)` - メタデータ取得
  - `saveLayer(layer, blob)` - レイヤー保存
  - `invalidateLayer(layerId)` - レイヤー無効化（編集時）
  - `clearCache(layerId?)` - キャッシュクリア
  - メモリキャッシュ管理（最大100枚）

#### 2.3 Migration Manager
- [ ] `src/content.ts` に移行ロジックを追加
  - `migrateToIndexedDB()` - Chrome Storage → IndexedDB
  - `migrateLightweightMetadata()` - 軽量データ先行移行（< 100ms）
  - `migrateHeavyData()` - 重いデータのバックグラウンド移行
  - `resumeMigration()` - 中断された移行の再開
  - 移行ステータス管理

#### 2.4 CRUD 操作の統合
- [ ] `src/features/gallery/storage.ts` の更新
  - `save()` を IndexedDB に変更
  - `delete()` の連携
  - inject への通知

**テスト:**
- [ ] Unit Test: IndexedDB スキーマが正しく作成される
- [ ] Unit Test: Repository が高速パス/フォールバックを切り替える
- [ ] Integration Test: 移行処理が正しく動作する
- [ ] Integration Test: 移行中断から復旧できる

**完了条件:**
- IndexedDB スキーマが作成される
- Repository が高速パス/フォールバックを自動切り替え
- 移行処理が正常に動作する
- 移行中断から復旧可能

---

### Phase 3: Integration (統合)

**目標:** 既存コードと新システムを統合し、全機能が動作する

**実装タスク:**

#### 3.1 fetch-interceptor との統合
- [ ] `src/inject/fetch-interceptor.ts` を更新
  - LayerRepository 経由でタイルを取得
  - 既存の描画処理と統合

#### 3.2 content ↔ inject 通信
- [ ] `src/inject/message-handler.ts` を更新
  - `mr-wplace-save-layer` - レイヤー保存リクエスト
  - `mr-wplace-layer-updated` - レイヤー更新通知
  - `mr-wplace-migration-rollback` - ロールバック通知

#### 3.3 Gallery の統合
- [ ] `src/features/gallery/storage.ts` を更新
  - 移行完了後は IndexedDB のみを使用
  - dataUrl → Blob 変換
  - inject への保存リクエスト

#### 3.4 Text / Snapshot の統合
- [ ] `src/features/text-draw/text-layer-storage.ts` を更新
- [ ] `src/features/time-travel/storage.ts` を更新

**テスト:**
- [ ] Integration Test: content ↔ inject 通信が動作する
- [ ] Integration Test: fetch-interceptor が Repository 経由でタイルを取得
- [ ] Integration Test: 編集時に無効化される
- [ ] E2E Test: 基本シナリオ（画像追加・表示・編集）

**完了条件:**
- fetch-interceptor が Repository 経由でタイルを取得
- content ↔ inject の通信が正常動作
- 既存機能が全て動作する

---

### Phase 4: Migration & Cleanup (仕上げ)

**目標:** レガシーコードを削除し、パフォーマンスを最適化

**実装タスク:**

#### 4.1 レガシーコード削除
- [ ] `src/inject/tile-draw/image-processing/split-tiles.ts` の Main thread 分割処理を削除
- [ ] `src/inject/handlers/overlay-handlers.ts` の `addImageToOverlayLayers()` 呼び出しを削除
- [ ] `sendGalleryImagesToInject()` での dataUrl 送信を削除

#### 4.2 容量最適化
- [ ] Chrome Storage のクリーンアップ
  - 移行完了後、画像データを削除
  - メタデータのみ保持（ロールバック用）

#### 4.3 パフォーマンス測定
- [ ] 起動時間の測定（目標: < 1秒）
- [ ] タイル取得時間の測定
  - キャッシュヒット: < 1ms
  - 最適化済み: < 16ms
  - フォールバック: < 50ms
- [ ] メモリ使用量の測定（目標: < 100MB）

#### 4.4 ドキュメント更新
- [ ] `CLAUDE.md` の更新
- [ ] `src/inject/CLAUDE.md` の更新
- [ ] 移行ガイドの作成

**テスト:**
- [ ] E2E Test: 全ユーザーシナリオ
- [ ] Performance Test: 全パフォーマンス目標を達成
- [ ] Regression Test: 既存機能が正常動作

**完了条件:**
- レガシーコードが削除される
- パフォーマンス目標を全て達成
- ドキュメントが更新される

---

## 6\. Critical Success Factors (重要成功要因)

### 6.1 データ安全性（最優先）
- ✅ 移行中断から復旧可能
- ✅ Chrome Storage のデータは保持（ロールバック用）
- ✅ トランザクション失敗時のロールバック
- ✅ 容量超過時の自動クリーンアップ

### 6.2 起動パフォーマンス（優先2）
- ✅ 軽量移行 < 100ms（UI が即座に表示可能）
- ✅ 重い処理はバックグラウンド実行
- ✅ プログレスバーでユーザーに状況を伝える

### 6.3 実装の複雑性（優先3）
- ✅ Repository Pattern で抽象化
- ✅ 詳細なドキュメント作成
- ✅ 型安全な通信ヘルパー

### 6.4 動作時のパフォーマンス（優先4）
- ✅ メモリキャッシュでタイル取得を高速化
- ✅ Worker の優先度付きキュー

---

## 7\. Risk Management (リスク管理)

### Critical リスク（Phase 1 完了前に解決必須）
- 🔴 C-001: 移行中断によるデータ消失 → ステータス管理 + 再開機能
- 🔴 C-002: IndexedDB 容量超過 → 事前チェック + 自動クリーンアップ
- 🔴 C-003: データ不整合 → IndexedDB 一元管理
- 🔴 C-004: トランザクションエラー → ロールバック機能

### High リスク（Phase 1-2 で解決）
- 🟠 P-001: 初回移行のフリーズ → バックグラウンド移行
- 🟠 P-002: IndexedDB 読み込み遅延 → 可視レイヤーのみ読み込み
- 🟠 M-001: ImageBitmap メモリリーク → finally で close()

詳細は [Concerns & Mitigation](./docs/migration/concerns-and-mitigation.md) を参照。

---

## 8\. Testing Strategy (テスト戦略)

### Unit Test（カバレッジ 90%+）
- Worker の基本機能
- タスクキュー管理
- Repository の分岐ロジック
- メモリ管理

### Integration Test（カバレッジ 85%+）
- content ↔ inject 通信
- fetch-interceptor 統合
- 移行処理
- CRUD 操作

### E2E Test（リリース前）
- ユーザーシナリオ全体
- 移行中断・復旧
- パフォーマンス測定

詳細は [Testing Strategy](./docs/migration/testing-strategy.md) を参照。

---

## 9\. Performance Targets (パフォーマンス目標)

| 項目 | 現状 | 目標 | 測定方法 |
|------|------|------|----------|
| 起動時間 | 5-10秒 | < 1秒 | performance.now() |
| タイル取得（キャッシュ） | - | < 1ms | performance.now() |
| タイル取得（最適化済み） | - | < 16ms | performance.now() |
| タイル取得（フォールバック） | - | < 50ms | performance.now() |
| メモリ使用量 | 100MB+ | < 100MB | performance.memory |
| ストレージ使用量 | Chrome Storage 制限 | IndexedDB（数GB） | navigator.storage.estimate() |

---

## 10\. Next Steps (次のアクション)

### 即座に開始
1. **Phase 1 の実装開始**
   - `src/inject/workers/migration.worker.ts` の作成
   - タスクキューの実装
   - Unit Test の作成

2. **詳細設計の確認**
   - [Implementation Design](./docs/migration/implementation-design.md) を読む
   - [Concerns & Mitigation](./docs/migration/concerns-and-mitigation.md) でリスクを理解
   - [Testing Strategy](./docs/migration/testing-strategy.md) でテスト方針を把握

### Phase 1 完了後
1. IndexedDB スキーマの作成
2. LayerRepository の実装
3. 移行ロジックの実装

まず **Phase 1 (Worker の実装)** から着手し、「メインスレッドをブロックせずに画像を分割・保存できること」を実証するのが良いでしょう。これさえできれば勝ったも同然です。
