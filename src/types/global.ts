// mrWplace グローバル型定義

import type { TimeTravel } from "../features/time-travel";
import type { UserStatus } from "../features/user-status";
import type { ColorFilterManager } from "../utils/color-filter-manager";

interface mrWplace {
  gallery: any;
  tileOverlay: any;
  favorites: any;
  drawing: any;
  tileSnapshot: any;
  timeTravel: TimeTravel;
  drawingLoader: any;
  colorFilter: any;
  // Optional properties (動的に追加される可能性)
  imageEditor?: any;
  userStatus: UserStatus;
  colorFilterManager?: ColorFilterManager;
}

declare global {
  interface Window {
    mrWplace?: mrWplace;
  }
}

export {};
