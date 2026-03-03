export const VIEWPORT_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;

export const VIEWPORT_MEDIA_QUERIES = {
  smUp: `(min-width: ${VIEWPORT_BREAKPOINTS.sm}px)`,
  lgUp: `(min-width: ${VIEWPORT_BREAKPOINTS.lg}px)`,
} as const;

export const isMobileViewport = (width = window.innerWidth): boolean =>
  width < VIEWPORT_BREAKPOINTS.sm;

export const isTabletOrBelowViewport = (width = window.innerWidth): boolean =>
  width <= VIEWPORT_BREAKPOINTS.md;

export const isDesktopViewport = (width = window.innerWidth): boolean =>
  width >= VIEWPORT_BREAKPOINTS.lg;
