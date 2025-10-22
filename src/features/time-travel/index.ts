import {
  setupElementObserver,
  ElementConfig,
} from "../../components/element-observer";
import {
  findOpacityContainer,
  findPositionModal,
  findMapPin,
} from "../../constants/selectors";
import {
  getOrCreateMapPinButtonGroup,
  createMapPinGroupButton,
} from "@/components/map-pin-button";
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
import { TileMergeRoute } from "./routes/tile-merge";
import { TileStatisticsRoute } from "./routes/tile-statistics";
import { di, type TimeTravelAPI } from "../../core/di";
import { t } from "@/i18n/manager";
import { IMG_ICON_TIME_TRAVEL } from "@/assets/iconImages";

/**
 * タイムマシン機能
 * - 現在位置のスナップショット管理
 * - タイル一覧→タイルスナップショット一覧
 */

// モジュールスコープに保持
let router: TimeTravelRouter;
let ui: TimeTravelUI;
let tileListRoute: TileListRoute;
let currentPositionRoute: SnapshotRoute;
let tileSnapshotsRoute: SnapshotRoute;
let snapshotDetailRoute: SnapshotDetailRoute;
let snapshotShareRoute: SnapshotShareRoute;
let importSnapshotRoute: ImportSnapshotRoute;
let tileMergeRoute: TileMergeRoute;
let tileStatisticsRoute: TileStatisticsRoute;

export const initTimeTravel = (): void => {
  router = new TimeTravelRouter();
  ui = new TimeTravelUI(router);
  currentPositionRoute = new SnapshotRoute({ showSaveButton: true });
  tileListRoute = new TileListRoute();
  tileSnapshotsRoute = new SnapshotRoute({ showSaveButton: false });
  snapshotDetailRoute = new SnapshotDetailRoute();
  snapshotShareRoute = new SnapshotShareRoute();
  importSnapshotRoute = new ImportSnapshotRoute();
  tileMergeRoute = new TileMergeRoute();
  tileStatisticsRoute = new TileStatisticsRoute();

  // ルーティング設定
  router.setOnRouteChange((route) => {
    renderCurrentRoute(route);
  });

  /**
   * マップピン周辺にボタンを作成
   */
  const createMapPinButtons = (container: Element): void => {
    const group = getOrCreateMapPinButtonGroup(container);

    // 既存ボタンチェック
    if (group.querySelector("#timetravel-btn")) {
      console.log("🧑‍🎨 : TimeTravel button already exists");
      return;
    }

    const button = createMapPinGroupButton({
      // icon: "⏰",
      iconSrc: IMG_ICON_TIME_TRAVEL,
      text: t`${"timetravel"}`,
      onClick: () => showCurrentPosition(),
    });
    button.id = "timetravel-btn";

    group.appendChild(button);
    console.log("🧑‍🎨 : TimeTravel button added to group");
  };

  const buttonConfigs: ElementConfig[] = [
    {
      id: "timetravel-fab-btn",
      getTargetElement: findOpacityContainer,
      createElement: (container) => {
        const button = createTimeTravelFAB();
        button.id = "timetravel-fab-btn";
        button.addEventListener("click", () => show());
        container.className += " flex flex-col-reverse gap-1";
        container.appendChild(button);
      },
    },
    // 優先: マップピン周辺にボタン配置
    {
      id: "timetravel-map-pin-btn",
      getTargetElement: findMapPin,
      createElement: createMapPinButtons,
    },
    // フォールバック: position modalにボタン配置
    {
      id: "timetravel-btn-fallback",
      getTargetElement: findPositionModal,
      createElement: (container) => {
        // マップピングループが既に存在する場合はスキップ
        if (document.querySelector("#map-pin-button-group")) {
          console.log(
            "🧑‍🎨 : Map pin button group already exists, skipping fallback"
          );
          return;
        }

        const button = createTimeTravelButton();
        button.id = "timetravel-btn-fallback";
        button.addEventListener("click", () => showCurrentPosition());
        container.prepend(button);
        console.log("🧑‍🎨 : Fallback button created in position modal");
      },
    },
  ];

  setupElementObserver(buttonConfigs);
  console.log("⏰ TimeTravel button observer initialized");
};

const renderCurrentRoute = (route: TimeTravelRoute): void => {
  const container = ui.getContainer();
  if (!container) return;

  switch (route) {
    case "current-position":
      currentPositionRoute.render(container, router);
      break;
    case "tile-list":
      tileListRoute.render(container, router);
      break;
    case "tile-snapshots":
      tileSnapshotsRoute.render(container, router);
      break;
    case "snapshot-detail":
      snapshotDetailRoute.render(container, router);
      break;
    case "snapshot-share":
      snapshotShareRoute.render(container, router);
      break;
    case "import-snapshot":
      importSnapshotRoute.render(container, router);
      break;
    case "tile-merge":
      tileMergeRoute.render(container, router);
      break;
    case "tile-statistics":
      tileStatisticsRoute.render(container, router);
      break;
  }
};

// 外部インターフェース：FABはタイル一覧からスタート
export const show = (): void => {
  router.initialize("tile-list");
  ui.showModal();
};

// 元のボタン用：現在位置のみ表示
export const showCurrentPosition = (): void => {
  router.initialize("current-position");
  ui.showModal();
};

export const navigateToDetail = (fullKey: string): void => {
  (router as any).selectedSnapshot = { fullKey };
  router.navigate("snapshot-detail");
};

export const closeModal = (): void => {
  ui.closeModal();
};

// API export
export const timeTravelAPI: TimeTravelAPI = {
  initTimeTravel,
  show,
  showCurrentPosition,
  navigateToDetail,
  closeModal,
};
