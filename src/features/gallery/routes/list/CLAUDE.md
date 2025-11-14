# Gallery List Route - Implementation Notes

## Overview

The gallery list route displays all saved images in a grid layout with progress bars showing painting completion status. This document details the architecture, data flow, and implementation specifics for the progress display feature.

## Architecture

### Content � Inject Communication for Stats

The gallery list operates across two contexts:

1. **Content Script Context** (`src/content.ts`)
   - Manages gallery storage (Chrome storage API)
   - Renders UI components
   - Requests statistics from inject context

2. **Inject Script Context** (`src/inject/`)
   - Maintains overlay layers and tile data
   - Calculates color statistics from tiles
   - Responds to statistics requests

### Data Flow

```
GalleryList (content)
    �
[1] Fetch items from storage
    �
[2] Filter items with drawPosition
    �
[3] Call getStatsPerImage(imageKeys) � postMessage
    �
inject/message-handler.ts
    �
[4] handleImageStatsRequest
    �
[5] getStatsPerImage(imageKeys)
    �
[6] Aggregate stats from perTileColorStats Map
    �
[7] postMessage response back to content
    �
GalleryList receives stats
    �
[8] Set matchedColorStats & totalColorStats on items
    �
[9] Pass items to GalleryListUI
    �
[10] ImageGridComponent renders progress bars
```

## Problem History (2025-11-05)

### Issue

Progress bars were not displaying in the gallery list, despite color filter and paint-stats features working correctly.

### Root Cause

**Statistics data existed only in inject context but was not being fetched when rendering the gallery list.**

- `perTileColorStats` Map exists in `inject/tile-draw/states-inject.ts`
- Statistics are computed in background when images are added (`computeStatsInBackground`)
- GalleryList was rendering items directly from storage without fetching inject-side stats
- `ImageGridComponent` expected `currentColorStats` and `totalColorStats` but received undefined

### Solution

Implemented a request-response pattern to fetch per-image statistics from inject context when rendering the gallery list.

## Implementation Details

### 1. Inject-Side Stats Aggregation

**File**: `src/inject/tile-draw/utils/getStatsPerImage.ts` (NEW)

```typescript
export const getStatsPerImage = (
  imageKeys: string[]
): Record<string, { matched: Record<string, number>; total: Record<string, number> }> => {
  const result: Record<...> = {};

  for (const imageKey of imageKeys) {
    const tileStatsMap = perTileColorStats.get(imageKey);
    if (!tileStatsMap) continue;

    const matched: Record<string, number> = {};
    const total: Record<string, number> = {};

    // Aggregate stats across all tiles for this image
    for (const stats of tileStatsMap.values()) {
      for (const [colorKey, count] of stats.matched.entries()) {
        matched[colorKey] = (matched[colorKey] || 0) + count;
      }
      for (const [colorKey, count] of stats.total.entries()) {
        total[colorKey] = (total[colorKey] || 0) + count;
      }
    }

    result[imageKey] = { matched, total };
  }

  return result;
};
```

**Purpose**: Aggregates tile-level statistics into image-level statistics.

**Data Source**: `perTileColorStats` Map, populated by:
- `computeStatsInBackground()` when images are added
- `recomputeAllStats()` when color filter changes
- Tile rendering statistics (fallback)

### 2. Message Handler Registration

**File**: `src/inject/message-handler.ts`

**Listener registration** (line 81-84):
```typescript
if (event.data.source === "mr-wplace-request-image-stats") {
  handleImageStatsRequest(event.data);
  return;
}
```

**Handler implementation** (line 382-398):
```typescript
const handleImageStatsRequest = (data: { imageKeys: string[]; requestId: string }): void => {
  const stats = getStatsPerImage(data.imageKeys);

  window.postMessage(
    {
      source: "mr-wplace-response-image-stats",
      requestId: data.requestId,
      stats,
    },
    "*"
  );

  console.log(`>�<� : Sent image stats for ${data.imageKeys.length} images (request: ${data.requestId})`);
};
```

**Message Format**:
- Request: `{ source: "mr-wplace-request-image-stats", imageKeys: string[], requestId: string }`
- Response: `{ source: "mr-wplace-response-image-stats", requestId: string, stats: Record<...> }`

### 3. Content-Side Request Function

**File**: `src/utils/inject-bridge.ts`

```typescript
export const getStatsPerImage = async (
  imageKeys: string[]
): Promise<Record<string, { matched: Record<string, number>; total: Record<string, number> }>> => {
  const requestId = generateRequestId();

  return new Promise((resolve) => {
    const handler = (event: MessageEvent) => {
      if (
        event.data.source === "mr-wplace-response-image-stats" &&
        event.data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        resolve(event.data.stats);
      }
    };

    window.addEventListener("message", handler);

    window.postMessage(
      {
        source: "mr-wplace-request-image-stats",
        imageKeys,
        requestId,
      },
      "*"
    );

    // Timeout after 5 seconds
    setTimeout(() => {
      window.removeEventListener("message", handler);
      console.warn(">�<� : Image stats request timed out");
      resolve({});
    }, 5000);
  });
};
```

**Features**:
- Async/await interface for easy usage
- Request ID matching to handle concurrent requests
- 5-second timeout with fallback to empty object
- Automatic cleanup of event listeners

### 4. GalleryList Integration

**File**: `src/features/gallery/routes/list/index.ts` (line 26-42)

```typescript
async render(
  container: HTMLElement,
  router: GalleryRouter,
  onImageClick?: (item: GalleryItem) => void,
  onDrawToggle?: (key: string) => Promise<boolean>,
  onCloseModal?: () => void
): Promise<void> {
  this.onDrawToggleCallback = onDrawToggle;
  const items = await this.storage.getAll();

  // Fetch stats for items with draw position
  const itemsWithDrawPosition = items.filter((item) => item.drawPosition);
  if (itemsWithDrawPosition.length > 0) {
    const imageKeys = itemsWithDrawPosition.map((item) => item.key);
    const statsPerImage = await getStatsPerImage(imageKeys);

    console.log(">�<� : Fetched stats for gallery images:", statsPerImage);

    // Assign stats to items
    for (const item of itemsWithDrawPosition) {
      const stats = statsPerImage[item.key];
      if (stats) {
        item.matchedColorStats = stats.matched;
        item.totalColorStats = stats.total;
      }
    }
  }

  this.ui.render(items, ...);
}
```

**Logic**:
1. Fetch all items from storage
2. Filter items that have `drawPosition` (placed on map)
3. Extract image keys and request stats from inject
4. Assign `matchedColorStats` and `totalColorStats` to items
5. Pass enhanced items to UI for rendering

**Why filter by drawPosition?**
- Images without draw position are not in overlay layers
- They have no statistics to display
- Requesting stats for non-placed images would return empty data

### 5. UI Rendering

**File**: `src/features/gallery/routes/list/components/ImageGridComponent.ts`

**Progress bar rendering** (line 339-397):
```typescript
private createProgressBarHtml(item: ImageItem): string {
  if (!item.currentColorStats || !item.totalColorStats) return "";

  const matched = Object.values(item.currentColorStats).reduce((sum, count) => sum + count, 0);
  const total = Object.values(item.totalColorStats).reduce((sum, count) => sum + count, 0);

  if (total === 0) return "";

  const percentage = (matched / total) * 100;
  const remaining = total - matched;
  const timeStr = this.formatEstimatedTime(remaining);

  return `<div style="...">
    <span>${percentage.toFixed(1)}%</span>
    <div class="progress-bar" style="width: ${percentage.toFixed(1)}%"></div>
    <span>${matched.toLocaleString()}/${total.toLocaleString()}</span>
    <span>${remaining}px(${timeStr})</span>
  </div>`;
}
```

**Display Components**:
- **Percentage**: `(matched / total) * 100`
- **Progress bar**: Visual indicator with gradient
- **Pixel counts**: `matched/total` formatted with commas
- **Estimated time**: Based on 30 seconds per pixel
  - Days (d), hours (h), minutes (m) format

## Data Structures

### GalleryItem (storage)

```typescript
interface GalleryItem extends BaseImageItem {
  key: string;
  dataUrl: string;
  timestamp: number;
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  // Statistics (populated at render time)
  matchedColorStats?: Record<string, number>;  // Color key � matched pixel count
  totalColorStats?: Record<string, number>;     // Color key � total pixel count
}
```

### Stats Response Format

```typescript
Record<string, {
  matched: Record<string, number>;  // Color key � count
  total: Record<string, number>;    // Color key � count
}>
```

**Example**:
```json
{
  "image_1699999999999": {
    "matched": { "#FFFFFF": 120, "#FF0000": 45 },
    "total": { "#FFFFFF": 500, "#FF0000": 300 }
  },
  "image_1699999999998": {
    "matched": { "#00FF00": 200 },
    "total": { "#00FF00": 800 }
  }
}
```

### perTileColorStats (inject)

```typescript
Map<string, Map<string, ColorStats>>
// imageKey � tileKey � { matched: Map, total: Map }
```

**Example**:
```javascript
perTileColorStats = Map {
  "image_1699999999999" => Map {
    "15_20" => {
      matched: Map { "#FFFFFF" => 60, "#FF0000" => 20 },
      total: Map { "#FFFFFF" => 250, "#FF0000" => 150 }
    },
    "15_21" => {
      matched: Map { "#FFFFFF" => 60, "#FF0000" => 25 },
      total: Map { "#FFFFFF" => 250, "#FF0000" => 150 }
    }
  }
}
```

## Statistics Calculation Timing

Statistics are calculated at multiple points:

### 1. Background Calculation (Primary)

**Trigger**: When image is added to overlay layers
**File**: `src/inject/tile-draw/states-inject.ts:66-96`

```typescript
const computeStatsInBackground = (imageKey: string, tiles: Record<string, ImageBitmap>): void => {
  if (window.mrWplaceDataSaver?.enabled) {
    console.log(`>�<� : Skipping background stats computation (data saver is ON)`);
    return;
  }

  setTimeout(() => {
    const colorFilter = window.mrWplace?.colorFilterManager?.isFilterActive()
      ? window.mrWplace.colorFilterManager.selectedRGBs
      : undefined;

    computeStatsForImage(imageKey, tiles, colorFilter)
      .then((tileStatsMap) => {
        perTileColorStats.set(imageKey, tileStatsMap);
        console.log(`>�<� : Background stats computation complete for ${imageKey}`);
      })
      .catch((error) => {
        console.warn(`>�<� : Background stats computation failed for ${imageKey}:`, error);
      });
  }, 2000);
};
```

**Characteristics**:
- Runs 2 seconds after image is added (avoids conflict with tile rendering)
- Fetches background tiles from `https://backend.wplace.live/tiles/${tileX}/${tileY}.png`
- Processes tiles sequentially (10 tiles, 100ms wait between batches)
- Respects color filter settings
- Skipped when data saver is ON (tiles not cached yet)

### 2. Color Filter Change

**Trigger**: When color filter settings change
**File**: `src/inject/message-handler.ts:277-302`

```typescript
const recomputeAllStats = (colorFilter?: number[][]): void => {
  if (window.mrWplaceDataSaver?.enabled) {
    console.log(`>�<� : Skipping stats recomputation (data saver is ON)`);
    return;
  }

  setTimeout(async () => {
    for (const layer of overlayLayers) {
      if (!layer.tiles) continue;
      try {
        const tileStatsMap = await computeStatsForImage(layer.imageKey, layer.tiles, colorFilter);
        perTileColorStats.set(layer.imageKey, tileStatsMap);
        console.log(`>�<� : Recomputed stats for ${layer.imageKey}`);
      } catch (error) {
        console.warn(`>�<� : Failed to recompute stats for ${layer.imageKey}:`, error);
      }
    }
  }, 2000);
};
```

**Characteristics**:
- Recalculates all image stats with new filter
- Sequential processing (one image at a time)
- 2-second delay before starting

### 3. Tile Rendering (Fallback)

**Trigger**: When tiles are rendered with overlay
**File**: `src/inject/tile-draw/tile-overlay-renderer.ts`

Statistics are also calculated during actual tile rendering as a fallback mechanism.

## Performance Considerations

### Request Optimization

- **Batch requests**: Single request for all images instead of per-image requests
- **Selective fetching**: Only fetch stats for images with `drawPosition`
- **Timeout handling**: 5-second timeout prevents hanging UI

### Statistics Calculation

- **Sequential processing**: Avoids overwhelming the network/CPU
- **Delayed execution**: 2-second delay prevents conflict with tile rendering
- **Data saver awareness**: Skips background calculation when tiles aren't cached
- **Tile batching**: Processes 10 tiles at a time with 100ms pause

### Memory Management

- **Map-based storage**: Efficient lookup by image key and tile key
- **Lazy calculation**: Stats only calculated for placed images
- **No persistent storage**: Stats are recalculated on each page load (intentional - reflects current map state)

## Error Handling

### 1. Timeout Fallback

If inject context doesn't respond within 5 seconds:
```typescript
setTimeout(() => {
  window.removeEventListener("message", handler);
  console.warn(">�<� : Image stats request timed out");
  resolve({});  // Return empty object
}, 5000);
```

**Result**: Progress bars won't show, but UI remains functional

### 2. Missing Statistics

```typescript
if (!item.currentColorStats || !item.totalColorStats) return "";
```

**Result**: No progress bar rendered for that item

### 3. Data Saver Mode

When data saver is ON, background statistics calculation is skipped:
```typescript
if (window.mrWplaceDataSaver?.enabled) {
  console.log(`>�<� : Skipping background stats computation (data saver is ON)`);
  return;
}
```

**Fallback**: Statistics are calculated during tile rendering when user visits the area

### 4. Network Errors

Background tile fetch may fail:
```typescript
const fetchWithTimeout = async (url: string, timeout = 5000): Promise<Response | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    console.warn(`>�<� : Fetch failed for ${url}:`, error);
    return null;
  }
};
```

**Result**: That tile's statistics are skipped, but other tiles continue processing

## Debugging

### Check Statistics Availability (Inject Context)

Open browser console on the WPlace page:

```javascript
// Check if stats exist for an image
console.log(perTileColorStats.get("image_1699999999999"));

// Check all overlay layers
console.log(overlayLayers);

// Check total stats entries
console.log(perTileColorStats.size);
```

### Check Request/Response Flow

Enable verbose logging by watching for >�<� emoji:

```javascript
// Content side (gallery list)
">�<� : Fetched stats for gallery images: {...}"

// Inject side (message handler)
">�<� : Sent image stats for 3 images (request: req_1699999999999_1)"
```

### Check Item Data (Content Context)

In `src/features/gallery/routes/list/ui.ts:39-46`:

```typescript
console.log(
  ">�<� : renderGalleryList items:",
  items.map((i) => ({
    key: i.key,
    hasCurrentStats: !!i.matchedColorStats,
    hasTotalStats: !!i.totalColorStats,
  }))
);
```

### Progress Bar Rendering

In `src/features/gallery/routes/list/components/ImageGridComponent.ts:340-367`:

```typescript
console.log(
  ">�<� : createProgressBarHtml",
  item.key,
  "currentColorStats:", item.currentColorStats,
  "totalColorStats:", item.totalColorStats
);

console.log(
  ">�<� : Progress",
  item.key,
  "matched:", matched,
  "total:", total
);
```

## Known Limitations

### 1. Statistics Not Persisted

Statistics are calculated on each page load and not stored in Chrome storage.

**Reason**: Statistics reflect current map state. If the background map changes (other users place pixels), stored statistics would be stale.

**Impact**: Initial load may show no progress bars until background calculation completes (~2-5 seconds per image)

### 2. Data Saver Mode

Background calculation is disabled when data saver is ON.

**Reason**: Tiles are only available from cache, not from network fetch.

**Workaround**: Statistics are calculated when user visits the tile area (tiles get cached and rendered)

### 3. Large Images

Images spanning 50+ tiles may take 10-20 seconds to calculate statistics.

**Reason**: Sequential tile processing with throttling to avoid overwhelming the network

**Mitigation**: Background calculation doesn't block UI

### 4. Network Dependency

Background statistics require fetching tiles from backend.

**Failure Cases**:
- Backend is down
- Network is slow/unstable
- Tiles don't exist (outside map bounds)

**Result**: Statistics may be incomplete, but errors are caught and logged

## Future Improvements

### 1. Incremental Statistics Updates

Instead of recalculating all stats on color filter change, only recalculate changed colors.

**Benefit**: Faster filter updates

### 2. Persistent Statistics Cache

Store calculated statistics in IndexedDB with timestamp.

**Benefits**:
- Instant progress display on page load
- Reduce network requests

**Challenges**:
- Need invalidation strategy (map changes)
- Storage space (50KB+ per large image)

### 3. Web Worker for Stats Calculation

Move statistics calculation to Web Worker.

**Benefits**:
- Non-blocking UI
- Parallel processing

**Challenges**:
- Cannot access `window.mrWplace*` globals
- Need message-passing architecture

### 4. Progressive Loading

Show partial progress as statistics are calculated tile-by-tile.

**Benefits**:
- Better UX (progress bar appears gradually)
- User sees feedback immediately

**Implementation**: Emit progress events during `computeStatsForImage()`

### 5. Smart Fetch Priority

Prioritize background tile fetches for currently visible images in the gallery.

**Benefits**:
- Statistics appear faster for what user is looking at
- Better perceived performance

## Testing Checklist

When modifying gallery list or statistics:

- [ ] Progress bars show correctly for placed images
- [ ] Progress bars don't show for unplaced images
- [ ] Progress updates after color filter change
- [ ] Progress updates after drawing pixels
- [ ] No errors in console when data saver is ON
- [ ] Timeout handling works (test with network throttling)
- [ ] Progress bars show correct percentage (0-100%)
- [ ] Pixel counts and time estimates are accurate
- [ ] Multiple concurrent gallery opens don't break stats
- [ ] Stats persist during modal close/reopen (same session)
- [ ] Stats recalculate correctly on page reload

## Related Files

### Core Implementation

- `src/features/gallery/routes/list/index.ts` - Main route logic
- `src/features/gallery/routes/list/ui.ts` - UI rendering
- `src/features/gallery/routes/list/components/ImageGridComponent.ts` - Grid component
- `src/utils/inject-bridge.ts` - Content ↔ Inject communication bridge
- `src/inject/tile-draw/utils/getStatsPerImage.ts` - Inject-side aggregation
- `src/inject/message-handler.ts` - Request/response handling

### Supporting Files

- `src/inject/tile-draw/states-inject.ts` - Overlay layers management
- `src/inject/tile-draw/utils/computeStatsForImage.ts` - Background calculation
- `src/features/gallery/storage.ts` - Gallery storage interface
- `src/features/gallery/common-actions.ts` - Shared actions (toggle, goto)

## Version History

- **2025-11-05**: Fixed progress bar display by implementing inject�content stats sync
- **2025-11-01**: Initial implementation with background stats calculation (inject-side only)

## Summary

The gallery list progress bars work by:

1. **Storing statistics** in inject context (`perTileColorStats` Map)
2. **Calculating** in background when images are added and when filters change
3. **Requesting** stats via postMessage when rendering gallery list
4. **Displaying** matched/total pixel counts and estimated completion time

This architecture ensures accurate, real-time statistics while maintaining performance and avoiding storage overhead.
