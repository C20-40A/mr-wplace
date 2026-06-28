import { ArtCruiseScene } from "./scene";
import {
  createArtCruiseFallbackMap,
  type ArtCruiseRuntime,
} from "./runtime";
import type { ArtCruiseAudioUrls } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";
import type { ArtCruiseDebugConfig } from "./types";

export type ArtCruiseWebStartData = {
  audioUrls?: ArtCruiseAudioUrls;
  mandalaUrls?: ArtCruiseMandalaUrls;
  debug?: ArtCruiseDebugConfig;
};

let scene: ArtCruiseScene | null = null;
let runtime: ArtCruiseRuntime | null = null;
let startData: ArtCruiseWebStartData | undefined;

const createWebRuntime = (): ArtCruiseRuntime => ({
  map: createArtCruiseFallbackMap(),
  enableTileFetchBypass: false,
  enableDynamicTileEnemies: false,
  enableGalleryFallbackEnemies: false,
});

const createScene = () => {
  if (!runtime) return null;

  return new ArtCruiseScene({
    map: runtime.map,
    runtime,
    audioUrls: startData?.audioUrls,
    mandalaUrls: startData?.mandalaUrls,
    debug: startData?.debug,
    viewportConfig: {
      maxWidthRatio: 1,
      maxHeightRatio: 1,
      marginPx: 0,
    },
    onExit: stopArtCruiseWeb,
    onReturnToTitle: returnToTitle,
  });
};

const returnToTitle = () => {
  scene?.destroy();
  scene = createScene();
  scene?.start();
};

export const startArtCruiseWeb = (data?: ArtCruiseWebStartData) => {
  if (scene) return;

  startData = data;
  runtime = createWebRuntime();
  scene = createScene();
  scene?.start();
  console.log("🧑‍🎨 : Art cruise web started");
};

export const stopArtCruiseWeb = () => {
  scene?.destroy();
  scene = null;
  runtime = null;
  startData = undefined;
  console.log("🧑‍🎨 : Art cruise web stopped");
};
