export const CANVAS_ROOT_ID = "mr-wplace-art-cruise-canvas-root";
export const DEBUG_MODE_STORAGE_KEY = "mr-wplace-art-cruise-debug";
export const SHOW_HITBOXES_STORAGE_KEY = "mr-wplace-art-cruise-show-hitboxes";
export const isDebugMode = () =>
  localStorage.getItem(DEBUG_MODE_STORAGE_KEY) === "true";

/**
 * Resolution quality levels (stored as integer 0-3).
 * pixelated rendering means lower values look clean even at large viewports.
 * Default is 0 (lowest) for best out-of-the-box performance.
 */
export const RESOLUTION_STORAGE_KEY = "mr-wplace-art-cruise-resolution";
export type ResolutionLevel = 0 | 1 | 2 | 3;
export const RESOLUTION_LABELS: Record<ResolutionLevel, string> = {
  0: "LOW",
  1: "MEDIUM",
  2: "HIGH",
  3: "NATIVE",
};
/** Physical pixel ratios for each level. NATIVE = actual devicePixelRatio. */
export const RESOLUTION_VALUES: Record<ResolutionLevel, number | "native"> = {
  0: 1,
  1: 1.5,
  2: 2,
  3: "native",
};

export const getResolutionLevel = (): ResolutionLevel => {
  const raw = localStorage.getItem(RESOLUTION_STORAGE_KEY);
  const n = Number(raw);
  if (raw !== null && (n === 0 || n === 1 || n === 2 || n === 3)) return n as ResolutionLevel;
  return 0; // default: LOW
};
export const setResolutionLevel = (level: ResolutionLevel) => {
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, String(level));
  } catch { /* ignore */ }
};
export const resolveResolutionValue = (level: ResolutionLevel): number => {
  const v = RESOLUTION_VALUES[level];
  return v === "native" ? (window.devicePixelRatio || 1) : v;
};
export const INPUT_SHIELD_ID = "mr-wplace-art-cruise-input-shield";
export const UI_ROOT_ID = "mr-wplace-art-cruise-ui";
export const HIDDEN_MARKER_STYLE_ID =
  "mr-wplace-art-cruise-hidden-marker-style";

export const GAME_LOGICAL_WIDTH = 650;
export const GAME_LOGICAL_HEIGHT = 866;
export const POINTER_FOLLOW_RATE = 0.2;

export const BULLET_INTERVAL_MS = 70;

export const ENEMY_MAX_COUNT = 7;
export const ENEMY_BOSS_SIZE_UNITS = 3.0;
export const ENEMY_BULLET_MAX_COUNT = 1200;

export const DYNAMIC_ENEMY_SCAN_INTERVAL_MS = 4_000;
export const DYNAMIC_ENEMY_SCAN_TILE_LIMIT = 1;
export const DYNAMIC_ENEMY_POOL_LIMIT = 24;
export const DYNAMIC_ENEMY_SCANNER_POOL_LIMIT = 24;
export const DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE = 4;
export const DYNAMIC_ENEMY_ALPHA_THRESHOLD = 16;
export const DYNAMIC_ENEMY_MIN_SIZE_PX = 10;
export const DYNAMIC_ENEMY_MAX_SIZE_PX = 150;
export const DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS = 48;
export const DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS = 12_000;
export const DYNAMIC_ENEMY_SIZE_UNITS = 1.2;

export const VIEW_CROP_TOP_RATIO = 1 / 4;
export const VIEW_VISIBLE_RATIO = 1 - VIEW_CROP_TOP_RATIO;

export const GAME_VIEWPORT_ASPECT_WIDTH = 3;
export const GAME_VIEWPORT_ASPECT_HEIGHT = 4;
export const GAME_VIEWPORT_MARGIN_PX = 24;
export const GAME_VIEWPORT_MAX_WIDTH_RATIO = 0.92;
export const GAME_VIEWPORT_MAX_HEIGHT_RATIO = 0.92;

export const PLAYER_HIT_RADIUS = 7;

/** プレイヤー最大HP（被弾で 1 減り、0 でゲームオーバー） */
export const PLAYER_MAX_HP = 5;
/** 被弾後の無敵時間（この間は再被弾しない・点滅する） */
export const PLAYER_INVINCIBLE_MS = 2500;
/** 無敵中の点滅周期 */
export const PLAYER_BLINK_INTERVAL_MS = 120;

export const ENEMY_SPEED = 170;

export const ART_CRUISE_VERSION = "1.0.0";
