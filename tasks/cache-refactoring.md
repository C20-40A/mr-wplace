# キャッシュ層の整理

## 現状の構造

### 3層のキャッシュ

| キャッシュ | 場所 | 内容 | 目的 |
|-----------|------|------|------|
| `lastModifiedMap` + `processedBlobCache` | メモリ | 描画後 blob | polling 最適化（Last-Modified ヘッダで判定） |
| `originalBlobCache` | メモリ | 元タイル | area-fill で既存色判定 |
| `mrWplaceDataSaver.tileCache` | メモリ | 描画後 blob | Data Saver 用メモリキャッシュ |
| `tileCacheDB` (IndexedDB) | ディスク | 描画後 blob | Data Saver 永続化 |

### ファイル構成

```
src/inject/
├── cache-storage.ts                    # IndexedDB wrapper (tileCacheDB)
├── features/tile-draw/
│   └── last-modified-cache.ts          # Last-Modified + processedBlob + originalBlob
└── fetch-interceptor.ts                # キャッシュ利用のメインロジック
```

---

## 問題点

1. **processedBlobCache と tileCacheDB が両方「描画後」を保存** → 責務重複
2. **stateVersion 変更時の挙動が異なる**
   - Last-Modified キャッシュ: 全クリア（`checkStateChanged`）
   - IndexedDB: クリアしない（古い描画状態のまま残る）
3. **Data Saver ON 時に overlay 変更しても反映されない**
   - 現状: 古いキャッシュをそのまま返す
   - 理想: stateVersion 変わったら再描画

---

## 経緯

1. **Data Saver 追加**: 手動でタイル取得停止（オフライン化）のため IndexedDB キャッシュ導入
2. **問題発覚**: Data Saver ON だとタイル更新が反映されない
3. **Last-Modified キャッシュ追加**: 描画処理スキップのため。polling 最適化。
4. **結果**: 2つの独立したキャッシュが混在し複雑化

---

## 理想的な構造

### 案: キャッシュ一本化

```typescript
interface TileCacheEntry {
  lastModified: string;      // サーバーからの Last-Modified
  stateVersion: string;      // overlay 状態のハッシュ
  processedBlob: Blob;       // 描画後
}
```

**フロー:**
1. fetch → Last-Modified 取得
2. キャッシュの `lastModified` と `stateVersion` が両方一致 → キャッシュ返す
3. 不一致 → 描画処理 → キャッシュ更新

**Data Saver ON 時:**
- fetch しない
- キャッシュから返す
- `stateVersion` 不一致でも返す（オフライン優先）
- ただし `stateVersion` 変わったらログ出す or UI で警告

**メリット:**
- キャッシュ層が1つになりシンプル
- invalidate ロジックが統一される

---

## originalBlob について

- **用途**: area-fill で「既存の色」を判定
- **永続化**: 不要（最近 fetch したタイルだけ使えればいい）
- **方針**: メモリキャッシュのまま維持。IndexedDB 化しない。

---

## 実装ステップ

### Phase 1 ✅ 完了
`sendGalleryImagesToInject` での明示的 invalidate 削除
→ `stateVersion` による自動クリアに依存

### Phase 2（未着手）
IndexedDB キャッシュに `stateVersion` を追加
- 保存時: `{ lastModified, stateVersion, processedBlob }`
- 読み出し時: `stateVersion` 一致チェック追加
- Data Saver OFF 時は不一致なら再描画

### Phase 3（未着手）
メモリキャッシュ (`processedBlobCache`) と IndexedDB (`tileCacheDB`) の統合検討
- IndexedDB をメインにして、メモリは LRU キャッシュとして前段に置く
- または、Data Saver 専用として分離を維持

---

## 注意点

- **デグレリスク**: キャッシュ周りは複雑なので慎重に
- **パフォーマンス**: IndexedDB アクセスは非同期なのでオーバーヘッド考慮
- **area-fill**: originalBlob は別枠で維持必須

---

## 関連ファイル

- [src/inject/cache-storage.ts](../src/inject/cache-storage.ts)
- [src/inject/features/tile-draw/last-modified-cache.ts](../src/inject/features/tile-draw/last-modified-cache.ts)
- [src/inject/fetch-interceptor.ts](../src/inject/fetch-interceptor.ts)
- [src/features/data-saver/](../src/features/data-saver/)
