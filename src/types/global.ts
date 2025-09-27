// mrWplace グローバル型定義

import { ExtendedBookmarks } from "../features/bookmark";
import { ColorFilter } from "../features/color-filter";
import { Drawing } from "../features/drawing";
import { DrawingLoader } from "../features/drawing-loader";
import { Gallery } from "../features/gallery";
import { GalleryImageEditor } from "../features/gallery/routes/image-editor";
import { TileOverlay } from "../features/tile-overlay";
import type { TimeTravel } from "../features/time-travel";
import { TileSnapshot } from "../features/time-travel/utils/tile-snapshot";
import type { UserStatus } from "../features/user-status";
import type { ColorFilterManager } from "../utils/color-filter-manager";

interface mrWplace {
  gallery: Gallery;
  tileOverlay: TileOverlay;
  favorites: ExtendedBookmarks;
  drawing: Drawing;
  tileSnapshot: TileSnapshot;
  timeTravel: TimeTravel;
  drawingLoader: DrawingLoader;
  colorFilter: ColorFilter;
  // Optional properties (動的に追加される可能性)
  imageEditor?: GalleryImageEditor;
  userStatus: UserStatus;
  colorFilterManager?: ColorFilterManager;
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
  }
}

export {};
