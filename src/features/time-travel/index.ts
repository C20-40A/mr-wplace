import { ButtonObserver, ButtonConfig } from "../../components/button-observer";
import { Toast } from "../../components/toast";
import { CONFIG } from "../bookmark/config";
import { TimeTravelRouter, TimeTravelRoute } from "./router";
import {
  TimeTravelUI,
  createTimeTravelButton,
  createTimeTravelFAB,
  createSnapshotDownloadModal,
} from "./ui";
import { TileListRoute } from "./routes/tile-list";
import { SnapshotRoute } from "./routes/snapshot-route";

/**
 * タイムマシン機能（統合・拡張版）
 * - 現在位置のスナップショット管理（既存機能）
 * - タイル一覧→タイルスナップショット一覧（新機能）
 */
export class TimeTravel {
  private buttonObserver: ButtonObserver;
  private router: TimeTravelRouter;
  private ui: TimeTravelUI;
  private tileListRoute: TileListRoute;
  private currentPositionRoute: SnapshotRoute;
  private tileSnapshotsRoute: SnapshotRoute;
  private currentDownloadBlob: Blob | null = null;

  constructor() {
    this.router = new TimeTravelRouter();
    this.ui = new TimeTravelUI(this.router);
    this.currentPositionRoute = new SnapshotRoute({ showSaveButton: true });
    this.tileListRoute = new TileListRoute();
    this.tileSnapshotsRoute = new SnapshotRoute({ showSaveButton: false });
    this.buttonObserver = new ButtonObserver();
    this.init();
    
    // グローバルアクセス用（既存パターンに倣う）
    (window as any).wplaceStudio = (window as any).wplaceStudio || {};
    (window as any).wplaceStudio.timeTravel = { ui: this.ui };
  }

  private init(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        this.observeAndInit()
      );
    } else {
      this.observeAndInit();
    }
  }

  private observeAndInit(): void {
    // ルーティング設定（Gallery流用）
    this.router.setOnRouteChange((route) => {
      this.ui.updateHeader(route);
      this.renderCurrentRoute(route);
    });

    const buttonConfigs: ButtonConfig[] = [
      {
        id: "timetravel-btn",
        selector: '[data-wplace-timetravel="true"]',
        containerSelector: CONFIG.selectors.positionModal,
        create: this.createTimeTravelButton.bind(this),
      },
      {
        id: "timetravel-fab-btn",
        selector: "#timetravel-fab-btn",
        containerSelector: CONFIG.selectors.toggleOpacityButton,
        create: this.createTimeTravelFAB.bind(this),
      },
    ];

    this.buttonObserver.startObserver(buttonConfigs);
    this.createDownloadModal();
    console.log("⏰ WPlace Studio: TimeTravel button observer initialized");
  }

  createTimeTravelButton(container: Element): HTMLButtonElement {
    const button = createTimeTravelButton(container);
    button.addEventListener("click", () => this.showCurrentPosition());
    return button;
  }

  createTimeTravelFAB(toggleButton: Element): HTMLButtonElement {
    const button = createTimeTravelFAB(toggleButton);
    button.addEventListener("click", () => this.show());
    return button;
  }

  private renderCurrentRoute(route: TimeTravelRoute): void {
    const container = this.ui.getContainer();
    if (!container) return;

    switch (route) {
      case "current-position":
        this.currentPositionRoute.render(container, this.router);
        break;
      case "tile-list":
        this.tileListRoute.render(container, this.router);
        break;
      case "tile-snapshots":
        this.tileSnapshotsRoute.render(container, this.router);
        break;
    }
  }

  // 外部インターフェース：FABはタイル一覧からスタート
  show(): void {
    this.router.initialize("tile-list");
    this.ui.showModal();
  }

  // 元のボタン用：現在位置のみ表示
  showCurrentPosition(): void {
    this.router.initialize("current-position");
    this.ui.showModal();
  }

  private createDownloadModal(): void {
    const downloadModal = createSnapshotDownloadModal();

    // ダウンロードModalのイベント
    downloadModal
      .querySelector("#wps-download-snapshot-btn")
      ?.addEventListener("click", () => {
        this.downloadCurrentSnapshot();
      });
  }

  private downloadCurrentSnapshot(): void {
    if (!this.currentDownloadBlob) {
      Toast.error("No image to download");
      return;
    }

    const url = URL.createObjectURL(this.currentDownloadBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapshot-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    Toast.success("Download started");
  }


}
