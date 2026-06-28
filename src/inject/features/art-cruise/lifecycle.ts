import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { changeBackgroundColor } from "../map-instance/background-color-control";
import { changeMap3dEnabled } from "../map-instance/map-control";
import { ArtCruiseCruiseController } from "./cruise-controller";
import { ArtCruiseScene } from "./scene";
import type { ArtCruiseDebugConfig, ArtCruiseSceneOptions } from "./types";
import type { WplaceMap } from "@/inject/types";
import type { ArtCruiseAudioUrls } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";
import type { ArtCruiseMapLike, ArtCruiseRuntime } from "./runtime";
import { installTileFetchBypass } from "./tile-fetch-bypass";
import { DynamicPixelArtEnemyScanner } from "./enemy/enemy-graphics/dynamic-pixel-art-scanner";

export type ArtCruiseStartData = {
  fontUrl?: string;
  audioUrls?: ArtCruiseAudioUrls;
  mandalaUrls?: ArtCruiseMandalaUrls;
  debug?: ArtCruiseDebugConfig;
};

/**
 * Art Cruise のセッション寿命を司る。
 * map 環境（背景色/3d/カメラ巡航）のセットアップと scene の生成・破棄を管理する。
 */
export class ArtCruiseLifecycle {
  private cruising = false;
  private scene: ArtCruiseScene | null = null;
  private cruiseController: ArtCruiseCruiseController | null = null;
  private runtime: ArtCruiseRuntime | null = null;
  private startData: ArtCruiseStartData | undefined;

  get active() {
    return this.cruising;
  }

  start = (data?: ArtCruiseStartData) => {
    if (this.cruising) return;

    const runtime = this.createWplaceRuntime();
    if (!runtime) {
      console.warn("🧑‍🎨 : Art cruise map instance is missing");
      return;
    }

    if (data?.fontUrl) {
      const font = new FontFace("misaki gothic", `url(${data.fontUrl})`);
      font.load().then((f) => document.fonts.add(f)).catch(() => {});
    }

    this.cruising = true;
    this.runtime = runtime;
    this.startData = data;
    this.cruiseController = new ArtCruiseCruiseController(runtime.map);
    runtime.setBackgroundColor?.("#000000");
    runtime.setMap3dEnabled?.(true);
    this.scene = this.createScene(runtime, data);
    this.scene.start();
    console.log("🧑‍🎨 : Art cruise started");
  };

  stop = () => {
    if (!this.cruising) return;
    this.cruising = false;
    this.scene?.destroy();
    this.scene = null;
    const runtime = this.runtime;
    runtime?.setBackgroundColor?.(null);
    this.cruiseController?.stop();
    this.cruiseController = null;
    this.runtime = null;
    this.startData = undefined;
    runtime?.setMap3dEnabled?.(false);
    console.log("🧑‍🎨 : Art cruise stopped");
  };

  private returnToTitle = () => {
    if (!this.cruising || !this.runtime || !this.cruiseController) return;

    this.cruiseController.stop();
    this.scene?.destroy();
    this.scene = this.createScene(this.runtime, this.startData);
    this.scene.start();
    console.log("🧑‍🎨 : Art cruise returned to title");
  };

  private createScene = (
    runtime: ArtCruiseRuntime,
    data?: ArtCruiseStartData,
  ): ArtCruiseScene => {
    const options: ArtCruiseSceneOptions = {
      map: runtime.map,
      runtime,
      audioUrls: data?.audioUrls,
      mandalaUrls: data?.mandalaUrls,
      debug: data?.debug,
      onExit: () => runtime.notifyExit?.(),
      onReturnToTitle: this.returnToTitle,
      onGameStart: this.cruiseController?.start,
      onPauseChange: this.cruiseController?.setPaused,
    };
    return new ArtCruiseScene(options);
  };

  private createWplaceRuntime = (): ArtCruiseRuntime | null => {
    const map = getMapInstanceFromWplace();
    if (!map) return null;

    return {
      map: map as ArtCruiseMapLike,
      setBackgroundColor: changeBackgroundColor,
      setMap3dEnabled: changeMap3dEnabled,
      notifyExit: this.notifyContentExit,
      createEnemyScanner: (map) =>
        new DynamicPixelArtEnemyScanner(map as WplaceMap),
      installTileFetchBypass,
      enableTileFetchBypass: true,
      enableDynamicTileEnemies: true,
      enableGalleryFallbackEnemies: true,
    };
  };

  private notifyContentExit = () =>
    window.postMessage({ source: "mr-wplace-art-cruise-exit" }, "*");
}
