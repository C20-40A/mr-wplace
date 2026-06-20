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
export const DYNAMIC_ENEMY_MAX_SIZE_STORAGE_KEY =
  "mr-wplace-art-cruise-dynamic-enemy-max-size";
export const GALLERY_ENEMY_FALLBACK_STORAGE_KEY =
  "mr-wplace-art-cruise-gallery-enemy-fallback";
export type ResolutionLevel = 0 | 1 | 2 | 3;
export const RESOLUTION_LABELS: Record<ResolutionLevel, string> = {
  0: "PIXEL(recommend)",
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
  if (raw !== null && (n === 0 || n === 1 || n === 2 || n === 3))
    return n as ResolutionLevel;
  return 0; // default: LOW
};
export const setResolutionLevel = (level: ResolutionLevel) => {
  try {
    localStorage.setItem(RESOLUTION_STORAGE_KEY, String(level));
  } catch {
    /* ignore */
  }
};
export const resolveResolutionValue = (level: ResolutionLevel): number => {
  const v = RESOLUTION_VALUES[level];
  return v === "native" ? window.devicePixelRatio || 1 : v;
};
export const INPUT_SHIELD_ID = "mr-wplace-art-cruise-input-shield";
export const UI_ROOT_ID = "mr-wplace-art-cruise-ui";
export const D_PAD_ROOT_ID = "mr-wplace-art-cruise-d-pad";
export const D_PAD_ENABLED_STORAGE_KEY = "mr-wplace-art-cruise-d-pad-enabled";
export const MUSIC_VOLUME_STORAGE_KEY = "mr-wplace-art-cruise-music-volume";
export const SE_VOLUME_STORAGE_KEY = "mr-wplace-art-cruise-se-volume";
export const HIDDEN_MARKER_STYLE_ID =
  "mr-wplace-art-cruise-hidden-marker-style";

export const getDPadEnabled = () =>
  localStorage.getItem(D_PAD_ENABLED_STORAGE_KEY) !== "false";

export const setDPadEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(D_PAD_ENABLED_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    /* ignore */
  }
};

const clampVolume = (value: number) =>
  Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

const getStoredVolume = (key: string, fallback: number) => {
  const raw = localStorage.getItem(key);
  const n = Number(raw);
  if (raw !== null && Number.isFinite(n)) return clampVolume(n);
  return fallback;
};

const setStoredVolume = (key: string, volume: number) => {
  const next = clampVolume(volume);
  try {
    localStorage.setItem(key, String(next));
  } catch {
    /* ignore */
  }
  return next;
};

export const DEFAULT_MUSIC_VOLUME = 0.5;
export const DEFAULT_SE_VOLUME = 0.6;
export const getMusicVolume = () =>
  getStoredVolume(MUSIC_VOLUME_STORAGE_KEY, DEFAULT_MUSIC_VOLUME);
export const setMusicVolume = (volume: number) =>
  setStoredVolume(MUSIC_VOLUME_STORAGE_KEY, volume);
export const getSeVolume = () =>
  getStoredVolume(SE_VOLUME_STORAGE_KEY, DEFAULT_SE_VOLUME);
export const setSeVolume = (volume: number) =>
  setStoredVolume(SE_VOLUME_STORAGE_KEY, volume);

export const GAME_LOGICAL_WIDTH = 650;
export const GAME_LOGICAL_HEIGHT = 866;
export const POINTER_FOLLOW_RATE = 0.2;
export const D_PAD_TARGET_SPEED = 520;

export const BULLET_INTERVAL_MS = 70;

export const ENEMY_MAX_COUNT = 7;
export const ENEMY_BOSS_SIZE_UNITS = 3.0;
export const ENEMY_BULLET_MAX_COUNT = 1200;

export const DYNAMIC_ENEMY_SCAN_INTERVAL_MS = 4_000;
export const DYNAMIC_ENEMY_SCAN_TILE_LIMIT = 1;
export const DYNAMIC_ENEMY_POOL_LIMIT = 24;
export const DYNAMIC_ENEMY_SCANNER_POOL_LIMIT = 24;
export const DYNAMIC_ENEMY_MAX_CANDIDATES_PER_TILE = 4;
export const DYNAMIC_ENEMY_BOSS_MIN_OPAQUE_PIXELS = 2000;
export const DYNAMIC_ENEMY_ALPHA_THRESHOLD = 16;
export const DYNAMIC_ENEMY_MIN_SIZE_PX = 10;
export const DYNAMIC_ENEMY_MAX_SIZE_PX = 250;
export const DYNAMIC_ENEMY_MAX_SIZE_MIN_PX = 30;
export const DYNAMIC_ENEMY_MAX_SIZE_MAX_PX = 1000;
export const DYNAMIC_ENEMY_MIN_OPAQUE_PIXELS = 48;
export const DYNAMIC_ENEMY_MAX_OPAQUE_PIXELS = 12_000;
export const DYNAMIC_ENEMY_SIZE_UNITS = 1.2;

const clampDynamicEnemyMaxSize = (value: number) =>
  Math.max(
    DYNAMIC_ENEMY_MAX_SIZE_MIN_PX,
    Math.min(DYNAMIC_ENEMY_MAX_SIZE_MAX_PX, Math.round(value)),
  );

export const getDynamicEnemyMaxSizePx = () => {
  const raw = localStorage.getItem(DYNAMIC_ENEMY_MAX_SIZE_STORAGE_KEY);
  const n = Number(raw);
  if (Number.isFinite(n)) return clampDynamicEnemyMaxSize(n);
  return DYNAMIC_ENEMY_MAX_SIZE_PX;
};

export const setDynamicEnemyMaxSizePx = (sizePx: number) => {
  const next = clampDynamicEnemyMaxSize(sizePx);
  try {
    localStorage.setItem(DYNAMIC_ENEMY_MAX_SIZE_STORAGE_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
};

export const getGalleryEnemyFallbackEnabled = () =>
  localStorage.getItem(GALLERY_ENEMY_FALLBACK_STORAGE_KEY) !== "false";

export const setGalleryEnemyFallbackEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(
      GALLERY_ENEMY_FALLBACK_STORAGE_KEY,
      enabled ? "true" : "false",
    );
  } catch {
    /* ignore */
  }
};

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

export const ART_CRUISE_VERSION = "1.2.1";
