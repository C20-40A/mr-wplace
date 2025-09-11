import { ButtonObserver, ButtonConfig } from "../../components/button-observer";
import { CONFIG } from "../bookmark/config";
import { TimeTravelRouter, TimeTravelRoute } from "./router";
import {
  TimeTravelUI,
  createTimeTravelButton,
  createTimeTravelFAB,
  createSnapshotDownloadModal,
} from "./ui";
import { CurrentPositionRoute } from "./routes/current-position";
import { TileListRoute } from "./routes/tile-list";
import { TileSnapshotsRoute } from "./routes/tile-snapshots";

/**
 * タイムマシン機能（統合・拡張版）
 * - 現在位置のスナップショット管理（既存機能）
 * - タイル一覧→タイルスナップショット一覧（新機能）
 */
export class TimeTravel {
  private buttonObserver: ButtonObserver;
  private router: TimeTravelRouter;
  private ui: TimeTravelUI;
  private currentPositionRoute: CurrentPositionRoute;
  private tileListRoute: TileListRoute;
  private tileSnapshotsRoute: TileSnapshotsRoute;
  private currentDownloadBlob: Blob | null = null;

  constructor() {
    this.router = new TimeTravelRouter();
    this.ui = new TimeTravelUI(this.router);
    this.currentPositionRoute = new CurrentPositionRoute();
    this.tileListRoute = new TileListRoute();
    this.tileSnapshotsRoute = new TileSnapshotsRoute();
    this.buttonObserver = new ButtonObserver();
    this.init();
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
      this.showToast("No image to download");
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

    this.showToast("Download started");
  }

  private showToast(message: string): void {
    const toast = document.createElement("div");
    toast.className = "toast toast-top toast-end z-50";
    toast.innerHTML = `
      <div class="alert alert-success">
        <span>${message}</span>
      </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}
