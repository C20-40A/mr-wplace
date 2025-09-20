import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import { SELECTORS } from "../../constants/selectors";
import { TimeTravelRouter, TimeTravelRoute } from "./router";
import {
  TimeTravelUI,
  createTimeTravelButton,
  createTimeTravelFAB,
} from "./ui";
import { TileListRoute } from "./routes/tile-list";
import { SnapshotRoute } from "./routes/snapshot-route";
import { SnapshotDetailRoute } from "./routes/snapshot-detail";

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

  constructor() {
    this.router = new TimeTravelRouter();
    this.ui = new TimeTravelUI(this.router);
    this.currentPositionRoute = new SnapshotRoute({ showSaveButton: true });
    this.tileListRoute = new TileListRoute();
    this.tileSnapshotsRoute = new SnapshotRoute({ showSaveButton: false });
    this.snapshotDetailRoute = new SnapshotDetailRoute();
    this.init();

    // グローバルアクセス用（既存パターンに倣う）
    (window as any).wplaceStudio = (window as any).wplaceStudio || {};
    (window as any).wplaceStudio.timeTravel = {
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
        selector: '[data-wplace-timetravel="true"]',
        containerSelector: SELECTORS.positionModal,
        create: this.createTimeTravelButton.bind(this),
      },
      {
        id: "timetravel-fab-btn",
        selector: "#timetravel-fab-btn",
        containerSelector: SELECTORS.toggleOpacityButton,
        create: this.createTimeTravelFAB.bind(this),
      },
    ];

    setupElementObserver(buttonConfigs);
    console.log("⏰ TimeTravel button observer initialized");
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
      case "snapshot-detail":
        this.snapshotDetailRoute.render(container, this.router);
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
