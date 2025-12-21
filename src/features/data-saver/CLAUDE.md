# Data Saver Feature

## Overview

The Data Saver feature provides **offline tile caching** with persistent storage across browser sessions. When enabled, processed tiles (with overlays) are cached in both memory and IndexedDB, allowing:

- 🚀 Faster tile loading (no re-processing)
- 📱 Offline browsing capability
- 💾 Persistent cache across page reloads
- 🎯 Smart LRU eviction when cache limit is reached

## Architecture

### Two-Layer Cache System

```
┌─────────────────────────────────────────────────────────┐
│ Tile Request                                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 1. Check Memory Cache (Map)                            │
│    - Fast in-memory lookup                             │
│    - Cleared on page reload                            │
└────────────────┬────────────────────────────────────────┘
                 │ Cache Miss
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 2. Check IndexedDB Cache                               │
│    - Persistent across sessions                        │
│    - Updates lastAccessed timestamp                    │
│    - Loads into memory cache                           │
└────────────────┬────────────────────────────────────────┘
                 │ Cache Miss
                 ▼
┌─────────────────────────────────────────────────────────┐
│ 3. Fetch from Network                                  │
│    - Download original tile                            │
│    - Apply overlays (gallery, snapshots, filters)      │
│    - Cache processed result                            │
└─────────────────────────────────────────────────────────┘
```

### Context Separation

**Content Script Context** (`src/features/data-saver/`):

- UI management (FAB button, settings modal)
- Storage operations (Chrome storage API)
- IndexedDB access for content script side

**Inject Context** (`src/inject/`):

- Tile interception and processing
- IndexedDB access for inject side (separate instance)
- Cache management with LRU eviction

## File Structure

```
src/features/data-saver/
├── CLAUDE.md                    # This file
├── index.ts                     # Main feature, UI, settings modal
├── storage.ts                   # Chrome storage wrapper
└── cache-storage.ts             # IndexedDB wrapper (content script side)

src/inject/
├── cache-storage.ts             # IndexedDB wrapper (inject side)
├── fetch-interceptor.ts         # Tile interception with cache logic
└── handlers/state-handlers.ts   # Cache size sync, clear cache handler
```

## Caching Strategy

The caching behavior depends on **data saver state** and **cache existence**:

| Data Saver | Cache Exists | Behavior                             |
| ---------- | ------------ | ------------------------------------ |
| OFF        | NO           | ❌ No caching. Fetch & process only. |
| OFF        | YES          | ✅ Process tile and update cache.    |
| ON         | NO           | ✅ Fetch, process, and cache.        |
| ON         | YES          | ⚡ Return cached tile (fastest).     |

### Case Breakdown

1. **Case 1: Data Saver OFF, No Cache**

   - Normal operation, no caching
   - Tiles are processed but not stored

2. **Case 2: Data Saver OFF, Cache Exists**

   - User previously had data saver ON
   - Update existing cache entries
   - Keeps cache warm for when data saver is re-enabled

3. **Case 3: Data Saver ON, No Cache**

   - First visit to this tile with data saver ON
   - Fetch, process, and store for future use

4. **Case 4: Data Saver ON, Cache Exists**
   - Best case: return cached tile immediately
   - No network request, no processing
   - This is the "offline mode" scenario

## LRU Eviction

When cache size exceeds `maxCacheSize`, the **Least Recently Used (LRU)** eviction policy is applied:

1. All cached tiles are sorted by `lastAccessed` timestamp
2. Oldest entries are deleted first
3. Eviction continues until cache size is within limit

**Example:**

```
maxCacheSize = 100
currentSize = 105

→ Delete 5 oldest tiles (by lastAccessed)
→ Cache size reduced to 100
```

## Storage Structure

### Chrome Storage (Sync)

```typescript
{
  "data-saver-enabled": boolean,      // Default: false
  "data-saver-cache-size": number     // Default: 100
}
```

### IndexedDB

**Database:** `mr-wplace-cache`
**Object Store:** `tiles`

**Key:** `"${tileX},${tileY}"` (e.g., `"0,0"`)

**Value:**

```typescript
{
  blob: Blob,           // Processed tile as PNG blob
  lastAccessed: number  // Timestamp for LRU eviction
}
```

## UI Components

### FAB Button

Located in bottom-right corner alongside other map controls.

**States:**

- 🟢 Green glow: Data saver ON
- ⚪ Default: Data saver OFF
- 🔧 Cog icon: Opens settings modal (top-right overlay)

**Features:**

- Toggle data saver on/off
- Settings modal access
- Hover scale animation

### Settings Modal

Comprehensive cache management interface with:

#### 1. Header

- Title: "Offline Cache Settings"
- Subtitle: "Manage persistent tile cache"
- Icon: Document/storage icon

#### 2. Info Alert

- Explains what the feature does
- Mentions IndexedDB storage
- Highlights offline capability

#### 3. Statistics Grid

**Left Card - Cached Tiles:**

- Current cache count
- Percentage of limit
- Primary color theme

**Right Card - Max Capacity:**

- Maximum cache size setting
- Current limit display
- Secondary color theme

#### 4. Cache Size Slider

- Range: 10 to 1000 tiles
- Step: 10 tiles
- Real-time updates:
  - Display value (e.g., "250 tiles")
  - Estimated storage (e.g., "~12 MB")
- Calculation: ~50KB per tile average

#### 5. Progress Bar

- Visual representation of cache usage
- Color coding:
  - 🟦 Blue (primary): 0-69% usage
  - 🟨 Yellow (warning): 70-89% usage
  - 🔴 Red (error): 90-100% usage

#### 6. Action Buttons

**Clear All Cache:**

- Deletes all cached tiles from IndexedDB
- Clears memory cache in inject context
- Confirmation dialog before execution
- Loading state with spinner
- Success feedback (green checkmark)

**Refresh Stats:**

- Re-queries IndexedDB for current cache size
- Updates all statistics displays
- Loading state with spinner
- Useful after browser operations or debugging

#### 7. Footer Buttons

- **Cancel:** Close without saving
- **Save Settings:** Apply new cache size and close

## Key Implementation Details

### 1. Cache Size Synchronization

When cache size is changed in settings:

```typescript
// content.ts
await DataSaverStorage.setMaxCacheSize(newSize);
await sendCacheSizeToInject();

// inject/handlers/state-handlers.ts
export const handleCacheSizeUpdate = (data: { maxCacheSize: number }) => {
  if (window.mrWplaceDataSaver) {
    window.mrWplaceDataSaver.maxCacheSize = data.maxCacheSize;
  }
};
```

### 2. Cache Eviction on Write

Every time a tile is cached to IndexedDB:

```typescript
await tileCacheDB.setCachedTile(cacheKey, processedBlob, maxCacheSize);
// ↓ Internally calls
await this.evictIfNeeded(maxSize);
```

### 3. lastAccessed Timestamp Update

When a tile is retrieved from IndexedDB:

```typescript
// Update timestamp in transaction
store.put({ blob: cached.blob, lastAccessed: Date.now() }, key);
```

This ensures frequently accessed tiles stay in cache longer.

### 4. Dual-Context IndexedDB Access

Both content script and inject context have their own IndexedDB instances:

- **Content script:** Used for settings modal statistics
- **Inject context:** Used for actual tile caching during fetch interception

They access the **same IndexedDB database** but in different contexts.

## Message Communication

### Content → Inject

```typescript
// Cache size update
window.postMessage(
  {
    source: "mr-wplace-cache-size-update",
    maxCacheSize: number,
  },
  "*"
);

// Cache clear request
window.postMessage(
  {
    source: "mr-wplace-cache-clear",
  },
  "*"
);
```

### Handlers (inject/message-handler.ts)

```typescript
if (source === "mr-wplace-cache-size-update") {
  handleCacheSizeUpdate(event.data);
}

if (source === "mr-wplace-cache-clear") {
  handleCacheClear();
}
```

## Common Operations

### Checking Cache Size

```typescript
const size = await tileCacheDB.getCacheSize();
console.log(`Current cache: ${size} tiles`);
```

### Clearing Cache

```typescript
// Clear IndexedDB
await tileCacheDB.clearCache();

// Clear memory cache in inject
window.postMessage({ source: "mr-wplace-cache-clear" }, "*");
```

### Manually Evicting Old Tiles

Eviction happens automatically, but you can trigger it manually:

```typescript
// In inject context
await window.mrWplaceDataSaver.tileCacheDB.setCachedTile(
  key,
  blob,
  window.mrWplaceDataSaver.maxCacheSize
);
```

## Performance Considerations

### Storage Size Estimates

| Cache Size | Estimated Storage | Use Case                      |
| ---------- | ----------------- | ----------------------------- |
| 10 tiles   | ~0.5 MB           | Minimal cache, testing        |
| 100 tiles  | ~5 MB             | Default, good for casual use  |
| 500 tiles  | ~25 MB            | Heavy users, large maps       |
| 1000 tiles | ~50 MB            | Maximum, for offline archives |

**Note:** Actual size varies based on:

- Tile content (more detail = larger size)
- Number of overlays applied
- PNG compression efficiency

### Memory Usage

- **Memory cache (Map):** Cleared on page reload
- **IndexedDB:** Persistent, uses disk storage
- **LRU eviction:** Prevents unbounded growth

### Network Impact

When data saver is ON:

- ✅ Cached tiles: 0 network requests
- ⚠️ Cache miss: 1 network request (same as OFF)
- 💾 After initial load, most tiles are cached

## Debugging

### Check Cache State (Inject Context)

Open browser console on WPlace page:

```javascript
// Check cache state
console.log(window.mrWplaceDataSaver);

// Check memory cache size
console.log(window.mrWplaceDataSaver.tileCache.size);

// Check IndexedDB cache size
await window.mrWplaceDataSaver.tileCacheDB.getCacheSize();

// List all cached tile keys
for (const [key, blob] of window.mrWplaceDataSaver.tileCache) {
  console.log(key, blob.size);
}
```

### Inspect IndexedDB Directly

1. Open Chrome DevTools
2. Go to **Application** tab
3. Expand **IndexedDB** > **mr-wplace-cache**
4. Click **tiles** object store
5. View all cached entries with timestamps

### Common Issues

**Issue:** Cache not persisting across reloads

- ✅ Check IndexedDB is initialized: `await tileCacheDB.init()`
- ✅ Verify data saver is ON
- ✅ Check browser storage quota not exceeded

**Issue:** Tiles not being cached

- ✅ Ensure `window.mrWplaceDataSaver.enabled === true`
- ✅ Check fetch-interceptor is running
- ✅ Verify tiles match pattern `/tiles/\d+/\d+\.png/`

**Issue:** Cache size not updating in UI

- ✅ Click "Refresh Stats" button
- ✅ Check console for errors
- ✅ Verify IndexedDB is accessible (not private browsing)

## Future Improvements

### Potential Enhancements

1. **Compression:** Use WebP or compressed PNG for smaller cache size
2. **Selective Caching:** Cache only specific zoom levels
3. **Background Preloading:** Pre-cache tiles around current viewport
4. **Cache Export/Import:** Backup and restore cache data
5. **Statistics Dashboard:** Show cache hit rate, storage breakdown
6. **Smart Eviction:** Consider tile importance (e.g., zoom level, frequency)

### Limitations

- **Browser Storage Quota:** IndexedDB has browser-imposed limits (~50-100 MB typical)
- **Tile Count ≠ Storage Size:** Actual size varies per tile
- **No Automatic Cleanup:** Cache persists until manually cleared or evicted
- **Single-Origin:** Cache is specific to WPlace domain

## Testing Checklist

When modifying data-saver code:

- [ ] Test cache persistence (reload page, tiles should load from cache)
- [ ] Test LRU eviction (set low cache limit, verify old tiles are removed)
- [ ] Test settings modal (change cache size, verify sync to inject)
- [ ] Test clear cache (verify IndexedDB and memory are cleared)
- [ ] Test offline mode (disable network, tiles should load from cache)
- [ ] Test storage size estimates (verify ~50KB per tile average)
- [ ] Test with overlays (gallery images, snapshots, filters)
- [ ] Test across page reloads (cache should persist)
- [ ] Test with data saver toggle (verify caching behavior changes)

## Related Files

For understanding the full tile processing pipeline:

- `src/inject/fetch-interceptor.ts` - Tile request interception
- `src/inject/features/tile-draw/tile-overlay-renderer.ts` - Tile processing with overlays
- `src/inject/handlers/state-handlers.ts` - Message handlers for cache operations
- `src/content.ts` - Initial cache size sync on extension load
- `CLAUDE.md` (root) - Overall architecture and inject context details

---

**Last Updated:** 2025-11-11
**Feature Status:** ✅ Production Ready
