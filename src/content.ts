import { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { ThemeToggleStorage } from "@/features/theme-toggle/storage";
import { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { runtime } from "@/utils/browser-api";
// Doctor feature removed in Phase 3 - functionality integrated into SAVER/MIGRATOR
import { I18nManager } from "@/i18n/manager";
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

//  Data migration - convert legacy dataUrl to new format
// Run in background to avoid blocking initialization
const runMigrationInBackground = async () => {
  try {
    const { needsMigration, runDataMigration } = await import(
      "@/features/migration/data-migrator"
    );

    if (await needsMigration()) {
      console.log("🧑‍🎨 [Migration] Starting background migration...");
      const result = await runDataMigration();

      if (result.failed.length > 0) {
        console.warn(
          `🧑‍🎨 [Migration] Some items failed to migrate:`,
          result.failed
        );
      }

      // Refresh gallery images in inject context after migration
      if (result.migrated > 0) {
        await sendGalleryImagesToInject();
        console.log(`🧑‍🎨 [Migration] Gallery images refreshed`);
      }
    }
  } catch (error) {
    console.error("🧑‍🎨 [Migration] Migration failed (non-critical):", error);
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

// データをDOM属性で渡す（CSP safe）
const injectDomBridgeData = async () => {
  console.log("🧑‍🎨: Injecting data element...");
  const themeStart = performance.now();
  const currentTheme = await ThemeToggleStorage.get();
  const themeEnd = performance.now();
  console.log(
    `🧑‍🎨: ThemeToggleStorage.get() took ${(themeEnd - themeStart).toFixed(2)}ms`
  );

  const dataElement = document.createElement("div");
  dataElement.id = "__mr_wplace_data__";
  dataElement.setAttribute("data-theme", currentTheme);
  dataElement.style.display = "none";
  (document.head || document.documentElement).prepend(dataElement);
  console.log("🧑‍🎨: Injected data element");
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
  runtime.onMessage.addListener(async (message) => {
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
};

registerMessageListeners();

(async () => {
  console.log("🧑‍🎨: Starting initialization...");

  runMigrationInBackground();

  await loadInjectScript();

  await injectDomBridgeData();

  await initializeMainFeatures();
})();
