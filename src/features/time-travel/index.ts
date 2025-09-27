import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import {
  findOpacityContainer,
  findPositionModal,
} from "../../constants/selectors";
import { TimeTravelRouter, TimeTravelRoute } from "./router";
import {
  TimeTravelUI,
  createTimeTravelButton,
  createTimeTravelFAB,
} from "./ui";
import { TileListRoute } from "./routes/tile-list";
import { SnapshotRoute } from "./routes/snapshot-route";
import { SnapshotDetailRoute } from "./routes/snapshot-detail";
import { SnapshotShareRoute } from "./routes/snapshot-share";
import { ImportSnapshotRoute } from "./routes/import-snapshot";

/**
 * タイムマシン機能
 * - 現在位置のスナップショット管理
 * - タイル一覧→タイルスナップショット一覧
 */
export class TimeTravel {
  private router: TimeTravelRouter;
  private ui: TimeTravelUI;
  private tileListRoute: TileListRoute;
  private currentPositionRoute: SnapshotRoute;
  private tileSnapshotsRoute: SnapshotRoute;
  private snapshotDetailRoute: SnapshotDetailRoute;
  private snapshotShareRoute: SnapshotShareRoute;
  private importSnapshotRoute: ImportSnapshotRoute;

  constructor() {
    this.router = new TimeTravelRouter();
    this.ui = new TimeTravelUI(this.router);
    this.currentPositionRoute = new SnapshotRoute({ showSaveButton: true });
    this.tileListRoute = new TileListRoute();
    this.tileSnapshotsRoute = new SnapshotRoute({ showSaveButton: false });
    this.snapshotDetailRoute = new SnapshotDetailRoute();
    this.snapshotShareRoute = new SnapshotShareRoute();
    this.importSnapshotRoute = new ImportSnapshotRoute();
    this.init();

    // グローバルアクセス用（既存パターンに倣う）
    window.mrWplace = window.mrWplace || {};
    window.mrWplace.timeTravel = {
      ui: this.ui,
      router: this.router,
    };
  }

  private init(): void {
    // ルーティング設定（Gallery流用）
    this.router.setOnRouteChange((route) => {
      this.renderCurrentRoute(route);
    });

    const buttonConfigs: ElementConfig[] = [
      {
        id: "timetravel-btn",
        getTargetElement: findPositionModal,
        createElement: (container) => {
          const button = createTimeTravelButton();
          button.id = "timetravel-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.showCurrentPosition());
          container.prepend(button);
        },
      },
      {
        id: "timetravel-fab-btn",
        getTargetElement: findOpacityContainer,
        createElement: (container) => {
          const button = createTimeTravelFAB();
          button.id = "timetravel-fab-btn"; // 重複チェック用ID設定
          button.addEventListener("click", () => this.show());
          container.className += " flex flex-col-reverse gap-1";
          container.appendChild(button);
        },
      },
    ];

    setupElementObserver(buttonConfigs);
    console.log("⏰ TimeTravel button observer initialized");
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
      case "snapshot-detail":
        this.snapshotDetailRoute.render(container, this.router);
        break;
      case "snapshot-share":
        this.snapshotShareRoute.render(container, this.router);
        break;
      case "import-snapshot":
        this.importSnapshotRoute.render(container, this.router);
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
}
