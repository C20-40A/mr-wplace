import {
  setupElementObserver,
  ElementConfig,
} from "@/components/element-observer";
import {
  findOpacityContainer,
  findPositionModal,
  findMapPin,
} from "@/constants/selectors";
import { addMapPinButton } from "@/utils/map-pin-helper";
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
import { type TimeTravelAPI } from "../../core/di";
import { t } from "@/i18n/manager";
import { IMG_ICON_TIME_TRAVEL } from "@/assets/iconImages";
import { storage } from "@/utils/browser-api";
import { showFeatureHint } from "@/features/feature-hints";

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

// 既存の tile_tmp_* キーをクリーンアップ（一度だけ実行）
// IMPORTANT: tile_tmp_* は完全に不要なレガシーデータで削除するだけ
// storage.get(null)を避け、chrome.storage.local APIを直接使用してキーのみ取得
export const cleanupLegacyTmpTiles = async (): Promise<void> => {
  const migrationKey = "migration_tile_tmp_cleanup_v1";
  const result = await storage.get(migrationKey);

  if (result[migrationKey]) return; // 既にクリーンアップ済み

  // これやっちゃだめ。local.get(null) は大量データでタイムアウトする可能性がある
  // const allKeys = await new Promise<string[]>((resolve) => {
  //   chrome.storage.local.get(null, (items) => {
  //     resolve(Object.keys(items));
  //   });
  // });
  const allKeys = await chrome.storage.local.getKeys();

  const tmpKeys = allKeys.filter((key) => key.startsWith("tile_tmp_"));

  if (tmpKeys.length > 0) {
    await storage.remove(tmpKeys);
    console.log(`🧑‍🎨 : Cleaned up ${tmpKeys.length} legacy tile_tmp_* keys`);
  }

  await storage.set({ [migrationKey]: true });
};

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

  const createMapPinButtons = (container: Element): void => {
    const button = addMapPinButton(container, {
      id: "timetravel-btn",
      iconSrc: IMG_ICON_TIME_TRAVEL,
      text: t`${"timetravel"}`,
      onClick: () => showCurrentPosition(),
    });

    if (button) showFeatureHint("timetravel-btn", button);
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
        showFeatureHint("timetravel-fab-btn", button);
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
        if (document.querySelector("#map-pin-button-group")) return;

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
  ui.showModal(); // モーダルを先に作成
  router.initialize("tile-list");
};

// 元のボタン用：現在位置のみ表示
export const showCurrentPosition = (): void => {
  ui.showModal(); // モーダルを先に作成
  router.initialize("current-position");
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
