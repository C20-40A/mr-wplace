import { Toast } from "@/components/toast";
import { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { ThemeToggleStorage } from "@/features/theme-toggle/storage";
import { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { runtime } from "@/utils/browser-api";
// Doctor feature removed in Phase 3 - functionality integrated into SAVER/MIGRATOR
import { I18nManager } from "@/i18n/manager";
import { detectBrowserLanguage } from "@/i18n/index";
import { initializeFeatures } from "@/core/initializer";
import { setupMessageHandlers } from "@/core/message-handlers";
import {
  sendGalleryImagesToInject,
  sendTileBoundariesToInject,
} from "@/core/bridge";

// Re-export bridge functions for backward compatibility
export {
  sendGalleryImagesToInject,
  saveLayerToIndexedDB,
  sendComputeDeviceToInject,
  sendShowUnplacedOnlyToInject,
  sendColorFilterToInject,
  sendCacheSizeToInject,
  requestTotalStatsComputation,
  sendTextLayersToInject,
  sendTileBoundariesToInject,
} from "@/core/bridge";

(async () => {
  try {
    // Log initial memory usage (Chrome only)
    const initialMemory = (performance as any).memory?.usedJSHeapSize;
    if (initialMemory) {
      console.log(
        `🧑‍🎨: Initial memory usage: ${(initialMemory / 1024 / 1024).toFixed(
          2
        )}MB`
      );
    }

    console.log("🧑‍🎨: Starting initialization...");

    // Phase 3: Doctor cleanup removed - SAVER now generates thumbnails immediately on save
    // No need for delayed cleanup or dataUrl deletion

    // Fetchインターセプターの注入
    {
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

      console.log("🧑‍🎨: Injected fetch interceptor");
    }

    // データをDOM属性で渡す（CSP safe）
    {
      console.log("🧑‍🎨: Injecting data element...");
      const themeStart = performance.now();
      const currentTheme = await ThemeToggleStorage.get();
      const themeEnd = performance.now();
      console.log(
        `🧑‍🎨: ThemeToggleStorage.get() took ${(themeEnd - themeStart).toFixed(
          2
        )}ms`
      );

      const dataElement = document.createElement("div");
      dataElement.id = "__mr_wplace_data__";
      dataElement.setAttribute("data-theme", currentTheme);
      dataElement.style.display = "none";
      (document.head || document.documentElement).prepend(dataElement);
      console.log("🧑‍🎨: Injected data element");
    }

    // Global instance初期化（inject.js message listener前）
    window.mrWplace = {} as any;

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

    // Log final memory usage (Chrome only)
    const finalMemory = (performance as any).memory?.usedJSHeapSize;
    if (finalMemory && initialMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      console.log(
        `🧑‍🎨: Final memory usage: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `🧑‍🎨: Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`
      );
    }
  } catch (error) {
    console.error("🧑‍🎨: Failed to initialize", error);
    if (error instanceof Error) {
      Toast.error(`initialization error: ${error.message}`);
    } else {
      Toast.error(`initialization error: ${String(error)}`);
    }
  }
})();

// メッセージリスナー（言語切替、ギャラリー更新）
runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "LOCALE_CHANGED") {
    // i18nマネージャーの状態を更新
    await I18nManager.init(message.locale);
    return;
  }

  if (message.type === "GALLERY_UPDATED") {
    // ギャラリーデータが更新されたらinject側に同期
    await sendGalleryImagesToInject();
    return;
  }

  if (message.type === "TILE_BOUNDARIES_CHANGED") {
    // タイル境界表示設定が変更されたらinject側に通知
    await sendTileBoundariesToInject();
    return;
  }
});
