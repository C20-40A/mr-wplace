import type { WplaceMap } from "@/inject/types";
import type { ArtCruiseDebugConfig, ArtCruiseDebugSpawnOptions } from "./debug/types";
import type { ArtCruiseViewportConfig } from "./viewport";
import type { ArtCruiseAudioUrls } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";

export type { ArtCruiseDebugConfig, ArtCruiseDebugEnemyId, ArtCruiseDebugSpawnOptions } from "./debug/types";

export type ArtCruiseSceneOptions = {
  map: WplaceMap;
  audioUrls?: ArtCruiseAudioUrls;
  mandalaUrls?: ArtCruiseMandalaUrls;
  debug?: ArtCruiseDebugConfig;
  viewportConfig?: ArtCruiseViewportConfig;
  onExit?: () => void;
  onGameStart?: () => void;
  onPauseChange?: (paused: boolean) => void;
};
