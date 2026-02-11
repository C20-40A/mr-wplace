import { TileSnapshot } from "@/features/time-travel/utils/tile-snapshot";
import { NotificationModal } from "@/features/user-status/ui/notification-modal";
import { runtime } from "@/utils/browser-api";
import { I18nManager } from "@/i18n/manager";
import { setupMessageHandlers } from "@/core/message-handlers";
import { sendGalleryImagesToInject } from "@/core/bridge";
import { cleanupLegacyTmpTiles } from "@/features/time-travel";
import {
  setMapInstanceReady,
  getMapInstanceReady,
} from "@/states/map-instance-ready";
import {
  getFabVisibility,
  loadFabVisibilityFromStorage,
  type FabFeature,
} from "@/states/fab-visibility";

// Re-export bridge functions for backward compatibility
export {
  sendGalleryImagesToInject,
  sendComputeDeviceToInject,
  sendShowUnplacedOnlyToInject,
  sendColorFilterToInject,
  sendCacheSizeToInject,
  requestTotalStatsComputation,
  sendTextLayersToInject,
} from "@/core/bridge";

/**
 * Run migration with modal UI
 */
const runMigrationWithModal = async (): Promise<void> => {
  const importStartedAt = performance.now();
  const { needsMigration, runDataMigration } = await import(
    "@/features/migration/data-migrator"
  );
  console.log(
    `🧑‍🎨 [Migration] data-migrator import completed in ${Math.round(
      performance.now() - importStartedAt
    )}ms`
  );

  const needsCheckStartedAt = performance.now();
  const shouldMigrate = await needsMigration();
  console.log(
    `🧑‍🎨 [Migration] needsMigration resolved in ${Math.round(
      performance.now() - needsCheckStartedAt
    )}ms (result=${shouldMigrate})`
  );

  if (!shouldMigrate) {
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
        `🧑‍🎨 [Migration] Some items failed to migrate: ${result.failed.join(
          ", "
        )}`
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
  // Note: SnapshotRepository is now initialized only in inject context
  const tileSnapshot = new TileSnapshot();

  // NotificationModal initialization (for user status modal)
  const notificationModal = new NotificationModal();

  // Setup message handlers from inject side
  setupMessageHandlers(tileSnapshot, notificationModal);

  // initializerモジュール読込をDOM待機と並列化
  const initializerPromise = import("@/core/initializer");

  // DOM準備待機
  const domWaitStartedAt = performance.now();
  if (document.readyState === "loading" && !document.body) {
    await new Promise((resolve) => {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    });
  }
  console.log(
    `🧑‍🎨: DOM gate passed in ${Math.round(
      performance.now() - domWaitStartedAt
    )}ms (readyState=${document.readyState}, hasBody=${Boolean(document.body)})`
  );

  // Initialize all features
  const { initializeFeatures } = await initializerPromise;
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

  // Load and send front tile layer setting to inject
  const { loadFrontTileLayerFromStorage, getFrontTileLayer } = await import(
    "@/states/front-tile-layer"
  );
  await loadFrontTileLayerFromStorage();
  const frontTileLayerEnabled = getFrontTileLayer();
  window.postMessage(
    {
      source: "mr-wplace-front-tile-layer-update",
      enabled: frontTileLayerEnabled,
    },
    "*"
  );
};

const scheduleLegacyTmpTilesCleanup = () => {
  const runCleanup = () => {
    cleanupLegacyTmpTiles().catch((err) => {
      console.warn("🧑‍🎨 : Failed to cleanup legacy tmp tiles:", err);
    });
  };

  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(runCleanup, { timeout: 5000 });
    return;
  }

  setTimeout(runCleanup, 3000);
};

const FAB_VISIBILITY_STYLE_ID = "mr-wplace-fab-visibility-style";

const FAB_SELECTOR_MAP: Record<FabFeature, string[]> = {
  gallery: ["#gallery-btn"],
  bookmark: ["#bookmarks-btn"],
  "time-travel": ["#timetravel-fab-btn"],
  "data-saver": ["#data-saver-btn"],
  filter: ["#color-filter-fab-btn"],
};

const applyFabVisibilityStyles = (
  visibility: Readonly<Record<FabFeature, boolean>>
) => {
  const hiddenSelectors: string[] = [];

  for (const [feature, visible] of Object.entries(visibility) as [
    FabFeature,
    boolean,
  ][]) {
    if (visible) continue;
    const selectors = FAB_SELECTOR_MAP[feature];
    if (!selectors) continue;
    hiddenSelectors.push(...selectors);
  }

  let styleTag = document.getElementById(
    FAB_VISIBILITY_STYLE_ID,
  ) as HTMLStyleElement | null;
  if (!styleTag) {
    styleTag = document.createElement("style");
    styleTag.id = FAB_VISIBILITY_STYLE_ID;
    (document.head || document.documentElement).appendChild(styleTag);
  }

  styleTag.textContent =
    hiddenSelectors.length > 0
      ? `${hiddenSelectors.join(", ")} { display: none !important; }`
      : "";
};

// メッセージリスナー
const registerMessageListeners = () => {
  // Listen for map instance captured message from inject
  window.addEventListener("message", async (event: MessageEvent) => {
    if (event.data.source === "mr-wplace-map-instance-captured") {
      setMapInstanceReady(event.data.ready);
      console.log("🧑‍🎨 : Map instance ready state updated:", event.data.ready);
    }
  });

  runtime.onMessage.addListener(async (message, _sender, sendResponse) => {
    if (message.type === "GET_MAP_INSTANCE_READY") {
      sendResponse({ ready: getMapInstanceReady() });
      return true;
    }

    if (message.type === "LOCALE_CHANGED") {
      // i18nマネージャーの状態を更新
      await I18nManager.init(message.locale);
      return;
    }

    if (message.type === "OVERLAY_MODE_CHANGED") {
      // Overlay mode設定を更新してinjectに通知
      window.postMessage(
        {
          source: "mr-wplace-front-tile-layer-update",
          enabled: message.enabled,
        },
        "*"
      );
      return;
    }

    if (message.type === "COMPUTE_DEVICE_CHANGED") {
      window.postMessage(
        {
          source: "mr-wplace-compute-device",
          device: message.device,
        },
        "*"
      );
      return;
    }

    if (message.type === "FAB_VISIBILITY_CHANGED") {
      applyFabVisibilityStyles(message.visibility ?? getFabVisibility());
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
      await sendGalleryImagesToInject();
      return;
    }

    // Delegate to inject via postMessage
    if (message.type === "GALLERY_IMPORT") {
      window.postMessage(
        {
          source: "mr-wplace-gallery-import",
          requestId: Date.now().toString(),
        },
        "*"
      );
      return;
    }

    if (message.type === "GALLERY_EXPORT") {
      window.postMessage(
        {
          source: "mr-wplace-gallery-export",
          requestId: Date.now().toString(),
        },
        "*"
      );
      return;
    }

    if (message.type === "GALLERY_RESET") {
      window.postMessage(
        { source: "mr-wplace-gallery-reset", requestId: Date.now().toString() },
        "*"
      );
      return;
    }
  });
};

registerMessageListeners();

(async () => {
  console.log("🧑‍🎨: Starting initialization...");
  const wakeupStartedAt = performance.now();

  try {
    await loadFabVisibilityFromStorage();
    applyFabVisibilityStyles(getFabVisibility());

    const injectStartedAt = performance.now();
    await loadInjectScript();
    console.log(
      `🧑‍🎨: loadInjectScript completed in ${Math.round(
        performance.now() - injectStartedAt
      )}ms`
    );

    // Run migration before initializing features (blocking)
    const migrationStartedAt = performance.now();
    await runMigrationWithModal();
    console.log(
      `🧑‍🎨: migration check completed in ${Math.round(
        performance.now() - migrationStartedAt
      )}ms`
    );

    const featureInitStartedAt = performance.now();
    await initializeMainFeatures();
    console.log(
      `🧑‍🎨: initializeMainFeatures completed in ${Math.round(
        performance.now() - featureInitStartedAt
      )}ms`
    );
    scheduleLegacyTmpTilesCleanup();
    console.log("🧑‍🎨: scheduled legacy tmp cleanup on idle");
    console.log(
      `🧑‍🎨: wakeup sequence completed in ${Math.round(
        performance.now() - wakeupStartedAt
      )}ms`
    );
  } catch (error) {
    console.error("🧑‍🎨: Critical initialization error:", error);
  }
})();
