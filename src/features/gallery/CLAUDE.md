# Gallery Feature - Implementation Notes

## Overview

The gallery feature allows users to save, edit, and manage images for drawing on the WPlace map. Images can be optionally named and displayed with progress tracking.

## Key Features

### Image Title (Added 2025-11-07)

Users can assign an optional title/name to gallery images for easier identification.

#### Data Model

**Location**: `src/features/gallery/storage.ts:11-24`

```typescript
export interface GalleryItem extends BaseImageItem {
  title?: string;  // Optional image name
  drawPosition?: { TLX: number; TLY: number; PxX: number; PxY: number };
  drawEnabled?: boolean;
  layerOrder?: number;
  // ... statistics fields
}
```

#### UI Components

1. **Image Detail Screen** (`src/features/gallery/routes/image-detail/index.ts:50-52`)
   - 📝 Title button in button area
   - Opens modal for title input using `showNameInputModal`
   - Saves title to storage
   - Shows success toast on update

2. **Gallery List Screen** (`src/features/gallery/routes/list/components/ImageGridComponent.ts:146-149`)
   - Displays title below image thumbnail
   - Only shown if title is set (empty titles are hidden)
   - Styled as: `text-sm text-gray-600 truncate`

#### Implementation Details

**Title Edit Flow**:
```
User clicks 📝 Title button
  ↓
showNameInputModal opens
  ↓
User enters/edits title (or leaves empty)
  ↓
Modal returns string (title) or null (cancelled)
  ↓
If not cancelled: save to storage via GalleryStorage.save()
  ↓
Update currentItem.title
  ↓
Show "Title updated" toast
```

**Title Display**:
- Gallery list passes `title` from `GalleryItem` to `ImageItem`
- `ImageGridComponent` renders title if present
- Title appears below image, above progress bar
- Text truncates with ellipsis if too long

#### i18n Keys

**Location**: All locale files in `src/i18n/locales/*.ts`

- `title`: "Title" / "タイトル" (button label)
- `edit_image_title`: "Edit Image Title" / "画像タイトルを編集" (modal title)
- `image_title_placeholder`: "Image name (optional)" / "画像の名前（任意）" (input placeholder)
- `title_updated`: "Title updated" / "タイトルを更新しました" (success message)

#### Usage Pattern

```typescript
// Get current title (empty string if not set)
const currentTitle = item.title || "";

// Show input modal
const newTitle = await showNameInputModal(
  t`${"edit_image_title"}`,
  t`${"image_title_placeholder"}`
);

// Handle result
if (newTitle === null) return; // User cancelled
if (newTitle === "") {
  // User cleared the title - save empty string
}

// Save to storage
await storage.save({ ...item, title: newTitle });
```

#### Design Decisions

1. **Optional Field**: Title is optional to keep UI simple for users who don't need it
2. **Modal Input**: Uses existing `showNameInputModal` for consistent UX
3. **Empty String vs Undefined**: Empty title is stored as `""`, not removed from object
4. **Display Location**: Title appears below image in grid for easy scanning
5. **Button Style**: `btn-ghost` for minimal, unobtrusive appearance

## Related Files

### Core Implementation
- `src/features/gallery/storage.ts` - Data model
- `src/features/gallery/routes/image-detail/index.ts` - Title editing UI
- `src/features/gallery/routes/list/ui.ts` - Data transformation
- `src/features/gallery/routes/list/components/ImageGridComponent.ts` - Title display

### Utilities
- `src/utils/modal.ts` - `showNameInputModal` function

### i18n
- `src/i18n/locales/ja.ts` - Japanese translations
- `src/i18n/locales/en.ts` - English translations
- `src/i18n/locales/es.ts` - Spanish translations
- `src/i18n/locales/pt.ts` - Portuguese translations
- `src/i18n/locales/vi.ts` - Vietnamese translations

## Testing Checklist

When modifying title functionality:

- [ ] Title can be set from image detail screen
- [ ] Title can be edited (changed)
- [ ] Title can be cleared (empty string)
- [ ] Title displays in gallery list
- [ ] Empty titles don't show in gallery list
- [ ] Long titles truncate with ellipsis
- [ ] Modal cancel doesn't change title
- [ ] Title persists after browser reload
- [ ] All translations work correctly (ja, en, es, pt, vi)
- [ ] Toast notifications appear on save

## Future Enhancements

Potential improvements for title feature:

1. **Inline editing**: Click on title in grid to edit directly
2. **Title search**: Filter gallery by title text
3. **Title validation**: Warn if title is too long
4. **Recent titles**: Suggest previously used titles
5. **Bulk title editing**: Edit titles for multiple images at once
