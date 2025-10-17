// mrWplace グローバル型定義

import { ExtendedBookmarks } from "../features/bookmark";
import { ColorFilter } from "../features/color-filter";
import { Drawing } from "../features/drawing";
import { DrawingLoader } from "../features/drawing-loader";
import { TileOverlay } from "../features/tile-overlay";
import { TileSnapshot } from "../features/time-travel/utils/tile-snapshot";
import type { UserStatus } from "../features/user-status";
import { ChargeData } from "../features/user-status/services/timer-service";
import type { ColorFilterManager } from "../utils/color-filter-manager";
import type { AutoSpoit } from "../features/auto-spoit";

// Runtime拡張ChargeData型（startTime, timeToFull追加）
export interface RuntimeChargeData extends ChargeData {
  startTime: number;
  timeToFull: number;
}

interface mrWplace {
  tileOverlay: TileOverlay;
  favorites: ExtendedBookmarks;
  drawing: Drawing;
  tileSnapshot: TileSnapshot;
  drawingLoader: DrawingLoader;
  colorFilter: ColorFilter;
  userStatus: UserStatus;
  colorFilterManager?: ColorFilterManager;
  autoSpoit?: AutoSpoit;
  wplaceChargeData?: RuntimeChargeData;
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
  }
}

export {};
