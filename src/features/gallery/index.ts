import { GalleryItem } from "./storage";
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

  // 外部インターフェース（initButton前に定義必須）
  const show = () => {
    router.initialize("list");
    ui.showModal();
  };

  const showSelectionMode = (onSelect: (item: GalleryItem) => void) => {
    state.onSelect = onSelect;
    router.initialize("image-selector");
    ui.showModal();
  };

  const setDrawToggleCallback = (
    callback: (key: string) => Promise<boolean>
  ) => {
    state.onDrawToggle = callback;
  };

  const navigateToImageEditor = () => {
    router.navigate("image-editor");
    ui.showModal();
  };

  const showDetail = (item: GalleryItem) => {
    state.currentDetailItem = item;
    state.editingItem = undefined;
    router.navigate("image-detail");
  };

  const routeMap: Record<
    string,
    (container: HTMLElement) => void | Promise<void>
  > = {
    list: (container) => {
      const route = new GalleryList();
      route.render(container, router, showDetail, state.onDrawToggle, () =>
        ui.closeModal()
      );
    },

    "image-editor": async (container) => {
      const route = new GalleryImageEditor();
      route.setOnSaveSuccess(() => {
        state.editingItem = undefined;
        router.navigateBack();
      });
      route.render(container);
      
      // 編集モード判定
      if (state.editingItem) {
        console.log("🧑‍🎨 : Loading existing image for edit", state.editingItem.key);
        await route.loadExistingImage(state.editingItem);
      }
    },

    "image-detail": async (container) => {
      if (!state.currentDetailItem) return;
      const route = new GalleryImageDetail();
      route.render(
        container,
        router,
        state.currentDetailItem,
        async (key) => {
          const { GalleryStorage } = await import("./storage");
          await new GalleryStorage().delete(key);
          state.editingItem = undefined;
          router.navigateBack();
        },
        () => {
          // 編集ボタンコールバック
          state.editingItem = state.currentDetailItem;
        }
      );
    },

    "image-selector": (container) => {
      const route = new GalleryImageSelector();
      route.render(
        container,
        router,
        async (item) => {
          if (!state.onSelect) return;
          // inline化: findGalleryItemByKey
          const { GalleryStorage } = await import("./storage");
          const items = await new GalleryStorage().getAll();
          const galleryItem = items.find((i) => i.key === item.key);
          if (galleryItem) {
            state.onSelect(galleryItem);
            ui.closeModal();
          }
        },
        () => router.navigate("image-editor"),
        async (item) => {
          // 詳細表示コールバック
          const { GalleryStorage } = await import("./storage");
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
      route.render(container, state.currentDetailItem);
    },
  };

  const renderCurrentRoute = async (route: string) => {
    const container = ui.getContainer();
    if (!container) return;
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
        },
      },
    ]);
  };

  // 初期化
  router.setOnRouteChange(renderCurrentRoute);
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
