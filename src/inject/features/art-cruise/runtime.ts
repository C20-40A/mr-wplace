export type ArtCruiseMapCenter = {
  lat: number;
  lng: number;
};

export type ArtCruiseMapLike = {
  getCenter: () => ArtCruiseMapCenter;
  getZoom: () => number;
  getBearing: () => number;
  getPitch: () => number;
  easeTo: (options: {
    center?: [number, number];
    zoom?: number;
    bearing?: number;
    pitch?: number;
    duration?: number;
    easing?: (t: number) => number;
  }) => void;
  stop: () => void;
  resize?: () => void;
  getCanvas?: () => HTMLCanvasElement;
  setVerticalFieldOfView?: (fov: number) => void;
  getVerticalFieldOfView?: () => number;
};

export type ArtCruiseRuntime = {
  map: ArtCruiseMapLike;
  createEnemyScanner?: (
    map: ArtCruiseMapLike,
  ) => import("./enemy/enemy-graphics/pixi-enemy-graphic-pool").ArtCruiseEnemyScannerLike & {
    update: (now: number) => void;
    setMaxSizePx: (sizePx: number) => void;
    destroy: () => void;
  };
  setBackgroundColor?: (color: string | null) => void;
  setMap3dEnabled?: (enabled: boolean) => void;
  notifyExit?: () => void;
  installTileFetchBypass?: () => () => void;
  enableTileFetchBypass?: boolean;
  enableDynamicTileEnemies?: boolean;
  enableGalleryFallbackEnemies?: boolean;
};

export const createArtCruiseFallbackMap = (): ArtCruiseMapLike => {
  let center = { lat: 0, lng: 0 };
  let zoom = 14;
  let bearing = 0;
  let pitch = 0;
  let verticalFieldOfView: number | undefined;

  return {
    getCenter: () => center,
    getZoom: () => zoom,
    getBearing: () => bearing,
    getPitch: () => pitch,
    easeTo: (options) => {
      if (options.center) center = { lng: options.center[0], lat: options.center[1] };
      if (typeof options.zoom === "number") zoom = options.zoom;
      if (typeof options.bearing === "number") bearing = options.bearing;
      if (typeof options.pitch === "number") pitch = options.pitch;
    },
    stop: () => {},
    resize: () => {},
    setVerticalFieldOfView: (fov) => {
      verticalFieldOfView = fov;
    },
    getVerticalFieldOfView: () => verticalFieldOfView,
  };
};
