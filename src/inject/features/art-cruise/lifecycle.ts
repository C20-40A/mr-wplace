import { getMapInstanceFromWplace } from "../map-instance/get-map-instance";
import { changeBackgroundColor } from "../map-instance/background-color-control";
import { changeMap3dEnabled } from "../map-instance/map-control";
import { ArtCruiseCruiseController } from "./cruise-controller";
import { ArtCruiseScene } from "./scene";
import type { ArtCruiseDebugConfig } from "./types";
import type { ArtCruiseAudioUrls } from "./audio";
import type { ArtCruiseMandalaUrls } from "./bg-layer";

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

  get active() {
    return this.cruising;
  }

  start = (data?: ArtCruiseStartData) => {
    if (this.cruising) return;

    const map = getMapInstanceFromWplace();
    if (!map) {
      console.warn("🧑‍🎨 : Art cruise map instance is missing");
      return;
    }

    if (data?.fontUrl) {
      const font = new FontFace("misaki gothic", `url(${data.fontUrl})`);
      font.load().then((f) => document.fonts.add(f)).catch(() => {});
    }

    this.cruising = true;
    this.cruiseController = new ArtCruiseCruiseController(map);
    changeBackgroundColor("#000000");
    changeMap3dEnabled(true);
    this.scene = new ArtCruiseScene({
      map,
      audioUrls: data?.audioUrls,
      mandalaUrls: data?.mandalaUrls,
      debug: data?.debug,
      onExit: this.notifyContentExit,
      onGameStart: this.cruiseController.start,
      onPauseChange: this.cruiseController.setPaused,
    });
    this.scene.start();
    console.log("🧑‍🎨 : Art cruise started");
  };

  stop = () => {
    if (!this.cruising) return;
    this.cruising = false;
    this.scene?.destroy();
    this.scene = null;
    changeBackgroundColor(null);
    this.cruiseController?.stop();
    this.cruiseController = null;
    changeMap3dEnabled(false);
    console.log("🧑‍🎨 : Art cruise stopped");
  };

  private notifyContentExit = () =>
    window.postMessage({ source: "mr-wplace-art-cruise-exit" }, "*");
}
