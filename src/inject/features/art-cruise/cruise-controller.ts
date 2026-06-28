import type { ArtCruiseMapLike } from "./runtime";

const STEP_LAT = 0.008;
const STEP_DURATION = 3000;
const INITIAL_ZOOM_DURATION = 800;
const NEXT_STEP_LEAD_MS = 120;
export const ART_CRUISE_ZOOM = 14;

type ArtCruiseMap = ArtCruiseMapLike & {
  getVerticalFieldOfView?: () => number;
};

type MapViewSnapshot = {
  center: { lng: number; lat: number };
  zoom: number;
  bearing: number;
  pitch: number;
  verticalFieldOfView?: number;
};

export class ArtCruiseCruiseController {
  private paused = false;
  private active = false;
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private viewSnapshot: MapViewSnapshot | null = null;

  constructor(private readonly map: ArtCruiseMap) {}

  start = () => {
    if (this.active) return;

    this.active = true;
    this.paused = false;
    this.viewSnapshot = this.captureMapView();
    this.map.easeTo({ zoom: ART_CRUISE_ZOOM, duration: INITIAL_ZOOM_DURATION });
    this.stepTimer = setTimeout(this.step, INITIAL_ZOOM_DURATION);
  };

  stop = (beforeRestore?: () => void) => {
    if (!this.active) return;

    this.active = false;
    this.paused = false;
    this.clearStepTimer();
    this.map.stop();
    beforeRestore?.();
    this.restoreMapView();
    this.viewSnapshot = null;
  };

  setPaused = (paused: boolean) => {
    if (!this.active || this.paused === paused) return;

    this.paused = paused;
    if (paused) {
      this.clearStepTimer();
      this.map.stop();
      return;
    }

    this.step();
  };

  private step = () => {
    this.stepTimer = null;
    if (!this.active || this.paused) return;

    const center = this.map.getCenter();
    this.map.easeTo({
      center: [center.lng, center.lat + STEP_LAT],
      zoom: ART_CRUISE_ZOOM,
      duration: STEP_DURATION,
      easing: (t) => t,
    });

    this.scheduleNextStep();
  };

  private scheduleNextStep = () => {
    if (this.paused) return;

    this.clearStepTimer();
    this.stepTimer = setTimeout(this.step, STEP_DURATION - NEXT_STEP_LEAD_MS);
  };

  private clearStepTimer = () => {
    if (this.stepTimer === null) return;

    clearTimeout(this.stepTimer);
    this.stepTimer = null;
  };

  private captureMapView = (): MapViewSnapshot => ({
    center: this.map.getCenter(),
    zoom: this.map.getZoom(),
    bearing: this.map.getBearing(),
    pitch: this.map.getPitch(),
    verticalFieldOfView: this.map.getVerticalFieldOfView?.(),
  });

  private restoreMapView = () => {
    if (!this.viewSnapshot) return;

    this.map.easeTo({
      center: [this.viewSnapshot.center.lng, this.viewSnapshot.center.lat],
      zoom: this.viewSnapshot.zoom,
      bearing: this.viewSnapshot.bearing,
      pitch: this.viewSnapshot.pitch,
      duration: 0,
    });
    if (typeof this.viewSnapshot.verticalFieldOfView === "number") {
      this.map.setVerticalFieldOfView(this.viewSnapshot.verticalFieldOfView);
    }
  };
}
