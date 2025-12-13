import { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { runtime } from "@/utils/browser-api";
import { I18nManager } from "@/i18n/manager";
import { initializeFeatures } from "@/core/initializer";
import { setupMessageHandlers } from "@/core/message-handlers";
import { sendTileBoundariesToInject } from "@/core/bridge";

// Re-export bridge functions for backward compatibility
export {
  sendGalleryImagesToInject,
  sendComputeDeviceToInject,
  sendShowUnplacedOnlyToInject,
  sendColorFilterToInject,
  sendCacheSizeToInject,
  requestTotalStatsComputation,
  sendTextLayersToInject,
  sendTileBoundariesToInject,
} from "@/core/bridge";

/**
 * Run migration with modal UI
 */
const runMigrationWithModal = async (): Promise<void> => {
  const { needsMigration, runDataMigration } = await import(
    "@/features/migration/data-migrator"
  );

  if (!(await needsMigration())) {
    console.log("🧑‍🎨 [Migration] No migration needed");
    return;
  }

  console.log("🧑‍🎨 [Migration] Migration needed, showing modal...");

  const { MigrationModal } = await import(
    "@/features/migration/migration-modal"
  );
  const modal = new MigrationModal();
  modal.show();

  try {
    const result = await runDataMigration((progress) => {
      modal.updateProgress(progress);
    });

    if (result.failed.length > 0) {
      console.warn(
        `🧑‍🎨 [Migration] Some items failed to migrate: ${result.failed.join(", ")}`
      );
    }

    await modal.complete();
    console.log(
      `🧑‍🎨 [Migration] Complete: ${result.migrated} migrated, ${result.skipped} skipped`
    );
  } catch (error) {
    console.error("🧑‍🎨 [Migration] Migration failed:", error);
    modal.showError(error instanceof Error ? error.message : "Unknown error");
    // Keep modal open for 2s to show error
    await new Promise((resolve) => setTimeout(resolve, 2000));
    modal.close();
  }
};

// injectスクリプトの注入
const loadInjectScript = async () => {
  const script = document.createElement("script");
  script.src = runtime.getURL("dist/inject.js");
  // scriptタグをheadの先頭に挿入
  (document.head || document.documentElement).prepend(script);

  // Wait for inject script to load and setup fetch interceptor
  await new Promise<void>((resolve) => {
    script.onload = () => {
      script.remove();
      // Add a small delay to ensure synchronous code in inject.js has executed
      setTimeout(resolve, 10);
    };
    script.onerror = () => {
      console.error("🧑‍🎨: Failed to load inject.js");
      resolve(); // Continue anyway
    };
  });

  console.log("🧑‍🎨: inject.js script injected");
};

const initializeMainFeatures = async () => {
  // Global instance初期化（inject.js message listener前）
  window.mrWplace = window.mrWplace || ({} as any);

  // TileSnapshot initialization (needed for message listener)
  const tileSnapshot = new TileSnapshot();

  // NotificationModal initialization (for user status modal)
  const notificationModal = new NotificationModal();

  // Setup message handlers from inject side
  setupMessageHandlers(tileSnapshot, notificationModal);

  // DOM準備待機
  if (document.readyState === "loading") {
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }
  console.log("🧑‍🎨: DOM ready, proceeding with initialization");

  // Initialize all features
  const { colorFilterManager, tileOverlay, autoSpoit } =
    await initializeFeatures();

  // Global access for ImageProcessor and Gallery
  // IMPORTANT: Use Object.assign to preserve existing properties (e.g., wplaceChargeData)
  Object.assign(window.mrWplace!, {
    colorFilterManager,
    tileOverlay,
    tileSnapshot,
    autoSpoit,
  });
};

// メッセージリスナー（言語切替、ギャラリー更新）
const registerMessageListeners = () => {
  runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (message.type === "LOCALE_CHANGED") {
      // i18nマネージャーの状態を更新
      await I18nManager.init(message.locale);
      return;
    }

    if (message.type === "TILE_BOUNDARIES_CHANGED") {
      // タイル境界表示設定が変更されたらinject側に通知
      await sendTileBoundariesToInject();
      return;
    }

    // Popup -> Content -> Inject bridge for gallery operations
    if (message.type === "GALLERY_SAVE_ITEM") {
      const { saveGalleryItem } = await import(
        "@/core/bridge/gallery-storage-bridge"
      );
      try {
        const result = await saveGalleryItem(
          message.id,
          message.imageDataUrl,
          message.metadata
        );
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return true; // Keep channel open for async response
    }

    if (message.type === "GALLERY_DELETE_ITEM") {
      const { deleteGalleryItem } = await import(
        "@/core/bridge/gallery-storage-bridge"
      );
      try {
        await deleteGalleryItem(message.id);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return true;
    }

    if (message.type === "GALLERY_GET_ALL") {
      const { getAllGalleryMetadata } = await import(
        "@/core/bridge/gallery-storage-bridge"
      );
      try {
        const result = await getAllGalleryMetadata();
        sendResponse({ success: true, result });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return true;
    }

    if (message.type === "GALLERY_GET_ALL_WITH_IMAGES") {
      const {
        getAllGalleryMetadata,
        getGalleryImageDataUrl,
        getGalleryThumbnailDataUrl,
      } = await import("@/core/bridge/gallery-storage-bridge");
      try {
        const metadataList = await getAllGalleryMetadata();
        const items = [];
        for (const meta of metadataList) {
          const dataUrl = await getGalleryImageDataUrl(meta.id);
          const thumbnail = await getGalleryThumbnailDataUrl(meta.id);
          items.push({
            key: meta.id,
            timestamp: meta.timestamp,
            dataUrl: dataUrl || "",
            thumbnail: thumbnail || undefined,
            title: meta.title,
            drawPosition: meta.coords,
            drawEnabled: meta.visible,
            layerOrder: meta.zIndex,
            width: meta.width,
            height: meta.height,
          });
        }
        sendResponse({ success: true, result: items });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return true;
    }

    if (message.type === "GALLERY_UPDATED") {
      // Refresh overlay layers in inject
      await sendGalleryImagesToInject();
      return;
    }
  });
};

registerMessageListeners();

(async () => {
  console.log("🧑‍🎨: Starting initialization...");

  await loadInjectScript();

  // Run migration before initializing features (blocking)
  await runMigrationWithModal();

  await initializeMainFeatures();
})();
