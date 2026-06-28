import type { ArtCruiseDebugConfig, ArtCruiseDebugSpawnOptions } from "./debug/types";
import type { ArtCruiseViewportConfig } from "./viewport";
import type { ArtCruiseAudioUrls } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";
import type { ArtCruiseMapLike, ArtCruiseRuntime } from "./runtime";

export type { ArtCruiseDebugConfig, ArtCruiseDebugEnemyId, ArtCruiseDebugSpawnOptions } from "./debug/types";

export type ArtCruiseSceneOptions = {
  map: ArtCruiseMapLike;
  runtime?: ArtCruiseRuntime;
  audioUrls?: ArtCruiseAudioUrls;
  mandalaUrls?: ArtCruiseMandalaUrls;
  debug?: ArtCruiseDebugConfig;
  viewportConfig?: ArtCruiseViewportConfig;
  onExit?: () => void;
  onReturnToTitle?: () => void;
  onGameStart?: () => void;
  onPauseChange?: (paused: boolean) => void;
};
