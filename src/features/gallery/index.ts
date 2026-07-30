import { GalleryItem } from "../../states/galleryStorage";
import { GalleryRouter } from "./router";
import { createGalleryButton, GalleryUI } from "./ui";
import { GalleryList } from "./routes/list";
import { GalleryImageEditor } from "./routes/image-editor";
import { GalleryImageDetail } from "./routes/image-detail";
import { GalleryImageShare } from "./routes/image-share";
import { GalleryImageSelector } from "./routes/image-selector";
import { setupElementObserver } from "../../components/element-observer";
import { findOpacityContainer } from "../../constants/selectors";
import type { GalleryAPI } from "../../core/di";
import { showFeatureHint } from "@/features/feature-hints";

// ========================================
// クロージャモジュール（内部実装）
// ========================================

const createGallery = () => {
  const router = new GalleryRouter();
  const ui = new GalleryUI(router);

  // 状態統一
  const state = {
    currentDetailItem: undefined as GalleryItem | undefined,
    editingItem: undefined as GalleryItem | undefined,
    onSelect: undefined as ((item: GalleryItem) => void) | undefined,
    onDrawToggle: undefined as ((key: string) => Promise<boolean>) | undefined,
  };

  // 現在アクティブなルートインスタンスを保持
  let currentRouteInstance: { destroy?: () => void } | null = null;

  // 外部インターフェース（initButton前に定義必須）
  const show = () => {
    ui.showModal(); // モーダルを先に作成
    router.initialize("list");
  };

  const showSelectionMode = (onSelect: (item: GalleryItem) => void) => {
    state.onSelect = onSelect;
    ui.showModal(); // モーダルを先に作成
    router.initialize("image-selector");
  };

  const setDrawToggleCallback = (
    callback: (key: string) => Promise<boolean>
  ) => {
    state.onDrawToggle = callback;
  };

  const navigateToImageEditor = () => {
    state.editingItem = undefined; // 新規追加モードを保証
    ui.showModal(); // モーダルを先に作成
    router.navigate("image-editor");
  };

  const showDetail = async (item: GalleryItem) => {
    // Fetch full image from IndexedDB
    const { GalleryStorage } = await import("../../states/galleryStorage");
    const storage = new GalleryStorage();
    const fullImageItem = await storage.get(item.key);

    state.currentDetailItem = fullImageItem || item; // Fallback to thumbnail if fetch fails
    state.editingItem = undefined;
    router.navigate("image-detail");
  };

  const routeMap: Record<
    string,
    (container: HTMLElement) => void | Promise<void>
  > = {
    list: async (container) => {
      state.editingItem = undefined; // listに戻るときは編集モードをクリア
      const route = new GalleryList();
      currentRouteInstance = route; // インスタンスを保存
      await route.render(
        container,
        router,
        showDetail,
        state.onDrawToggle,
        () => ui.closeModal()
      );
    },

    "image-editor": async (container) => {
      const route = new GalleryImageEditor();
      currentRouteInstance = route; // インスタンスを保存
      route.setOnSaveSuccess(async () => {
        // Notify inject side to update overlay layers
        const { sendGalleryImagesToInject } = await import("@/content");
        await sendGalleryImagesToInject();

        state.editingItem = undefined;
        router.navigateBack();
      });
      route.render(container);

      // 編集モード判定
      if (state.editingItem) {
        console.log(
          "🧑‍🎨 : Loading existing image for edit",
          state.editingItem.key
        );
        await route.loadExistingImage(state.editingItem);
      }
    },

    "image-detail": async (container) => {
      if (!state.currentDetailItem) return;
      const route = new GalleryImageDetail();
      currentRouteInstance = route; // インスタンスを保存
      route.render(
        container,
        router,
        state.currentDetailItem,
        async (key) => {
          const { GalleryStorage } = await import(
            "../../states/galleryStorage"
          );
          await new GalleryStorage().delete(key);
          state.editingItem = undefined;

          // Update inject side after deletion
          const { sendGalleryImagesToInject } = await import("@/content");
          await sendGalleryImagesToInject();

          router.navigateBack();
        },
        () => {
          // 編集ボタンコールバック
          state.editingItem = state.currentDetailItem;
        },
        ui,
        async (item) => {
          // 下書き編集ボタンコールバック: gallery を閉じてマップ上で編集させる
          ui.closeModal();
          const { enterDraftEditForItem } = await import(
            "@/features/draft-draw"
          );
          await enterDraftEditForItem(item);
        }
      );
    },

    "image-selector": (container) => {
      const route = new GalleryImageSelector();
      currentRouteInstance = route; // インスタンスを保存
      route.render(
        container,
        async (item: GalleryItem) => {
          if (!state.onSelect) return;
          // inline化: findGalleryItemByKey
          const { GalleryStorage } = await import(
            "../../states/galleryStorage"
          );
          const items = await new GalleryStorage().getAll();
          const galleryItem = items.find((i) => i.key === item.key);
          if (galleryItem) {
            state.onSelect(galleryItem);
            ui.closeModal();
          }
        },
        () => router.navigate("image-editor"),
        async (item: GalleryItem) => {
          // 詳細表示コールバック
          const { GalleryStorage } = await import(
            "../../states/galleryStorage"
          );
          const items = await new GalleryStorage().getAll();
          const galleryItem = items.find((i) => i.key === item.key);
          if (galleryItem) {
            showDetail(galleryItem);
          }
        }
      );
    },

    "image-share": (container) => {
      if (!state.currentDetailItem) return;
      const route = new GalleryImageShare();
      currentRouteInstance = route; // インスタンスを保存
      route.render(container, state.currentDetailItem);
    },
  };

  const renderCurrentRoute = async (route: string) => {
    // 古いルートを破棄
    if (currentRouteInstance?.destroy) {
      console.log("🧑‍🎨 : Destroying previous route instance");
      currentRouteInstance.destroy();
      currentRouteInstance = null;
    }

    const container = ui.getContainer();
    if (!container) return;

    // image-editor ルートではモーダルを広げる
    const modalBox = container.closest(".modal-box") as HTMLElement | null;
    if (modalBox) {
      modalBox.style.maxWidth = route === "image-editor" ? "90vw" : "64rem";
    }

    await routeMap[route]?.(container);
  };

  const initButton = () => {
    setupElementObserver([
      {
        id: "gallery-btn",
        getTargetElement: findOpacityContainer,
        createElement: (container) => {
          const button = createGalleryButton();
          button.id = "gallery-btn";
          button.onclick = show;
          container?.appendChild(button);
          showFeatureHint("gallery-btn", button);
        },
      },
    ]);
  };

  // モーダルが閉じられたときのクリーンアップ処理を設定
  const cleanupOnModalClose = () => {
    if (currentRouteInstance?.destroy) {
      console.log("🧑‍🎨 : Cleaning up route instance on modal close");
      currentRouteInstance.destroy();
      currentRouteInstance = null;
    }
    state.editingItem = undefined; // 編集モード状態をクリア
  };

  // 初期化
  router.setOnRouteChange(renderCurrentRoute);
  ui.setOnModalClose(cleanupOnModalClose);
  initButton();

  return {
    show,
    showSelectionMode,
    setDrawToggleCallback,
    navigateToImageEditor,
  };
};

// ========================================
// DI Container用公開API
// ========================================

// シングルトンインスタンス
let galleryInstance: ReturnType<typeof createGallery> | null = null;

export const galleryAPI: GalleryAPI = {
  initGallery: () => {
    galleryInstance = createGallery();
  },
  showGallery: () => galleryInstance?.show(),
  showSelectionMode: (onSelect) => galleryInstance?.showSelectionMode(onSelect),
  setDrawToggleCallback: (callback) =>
    galleryInstance?.setDrawToggleCallback(callback),
};
