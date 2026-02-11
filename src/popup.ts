import { I18nManager, t } from "./i18n/manager";
import {
  setLocale,
  detectBrowserLanguage,
  type SupportedLocale,
} from "./i18n/index";
import {
  loadNavigationModeFromStorage,
  getNavigationMode,
  setNavigationMode,
} from "./states/navigation-mode";
import {
  loadLockButtonEnhancerFromStorage,
  getLockButtonEnhancer,
  setLockButtonEnhancer,
} from "./states/lock-button-enhancer";
import {
  loadCloseConfirmFromStorage,
  getCloseConfirm,
  setCloseConfirm,
} from "./states/close-confirm";
import {
  loadPaintModeStyleFromStorage,
  getPaintModeStyle,
  setPaintModeStyle,
} from "./states/paint-mode-style";
import {
  loadCloseButtonSwapFromStorage,
  getCloseButtonSwap,
  setCloseButtonSwap,
} from "./states/close-button-swap";
import {
  loadFabVisibilityFromStorage,
  getFabVisibility,
  setFabVisibility,
  FAB_FEATURES,
  type FabFeature,
} from "./states/fab-visibility";
import { ColorPaletteStorage } from "@/components/color-palette/storage";

import { tabs } from "@/utils/browser-api";
import { FEEDBACK_FORM_URL } from "@/constants/url";
import { BUY_ME_COFFEE_IMAGE } from "./assets/buyMeACoffee";

const updateUI = (): void => {
  // Update feedback form URL based on current locale
  const feedbackLink = document.getElementById(
    "feedback-link",
  ) as HTMLAnchorElement;
  if (feedbackLink) {
    const currentLocale = I18nManager.getCurrentLocale();
    const localeKey = currentLocale as keyof typeof FEEDBACK_FORM_URL;
    feedbackLink.href = FEEDBACK_FORM_URL[localeKey] || FEEDBACK_FORM_URL.en;
  }

  // Update all popup labels
  const labelMap: Record<string, string> = {
    "popup-language-label": "popup_language",
    "popup-navigation-label": "popup_navigation",
    "popup-nav-map-jump": "popup_navigation_map_jump",
    "popup-nav-url-jump": "popup_navigation_url_jump",
    "popup-lock-button-label": "popup_lock_button",
    "popup-close-confirm-label": "popup_close_confirm",
    "popup-paint-mode-style-label": "popup_paint_mode_style",
    "popup-close-button-swap-label": "popup_close_button_swap",
    "popup-bug-report-label": "popup_bug_report",
    "popup-fab-visibility-label": "popup_fab_visibility",
    "popup-fab-gallery-label": "popup_fab_gallery",
    "popup-fab-bookmark-label": "popup_fab_bookmark",
    "popup-fab-time-travel-label": "popup_fab_time_travel",
    "popup-fab-data-saver-label": "popup_fab_data_saver",
    "popup-fab-filter-label": "popup_fab_color_filter",
    "popup-compute-device-label": "compute_device_label",
    "gallery-data-label": "gallery_data",
    "export-btn-label": "export",
    "import-btn-label": "import",
    "reset-btn-label": "reset_gallery",
  };
  for (const [id, key] of Object.entries(labelMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }

  // Update Enabled/Disabled options
  const enabledText = t("enabled");
  const disabledText = t("disabled");
  document.querySelectorAll<HTMLOptionElement>(".popup-enabled-option").forEach(
    (el) => (el.textContent = enabledText),
  );
  document
    .querySelectorAll<HTMLOptionElement>(".popup-disabled-option")
    .forEach((el) => (el.textContent = disabledText));
};

// Dev mode easter egg
let titleClickCount = 0;
const setupDevModeEasterEgg = (): void => {
  const title = document.querySelector(".header h2") as HTMLHeadingElement;
  if (!title) return;

  title.style.cursor = "pointer";
  title.style.userSelect = "none";

  title.addEventListener("click", async () => {
    titleClickCount++;

    // Visual effect based on click count
    const effects = [
      () => (title.style.transform = "scale(1.1)"),
      () => (title.style.color = "#ff0"),
      () => (title.style.transform = "rotate(5deg)"),
      () => (title.style.color = "#0ff"),
      () => (title.style.transform = "rotate(-5deg) scale(1.1)"),
      () => (title.style.color = "#f0f"),
      () => (title.style.transform = "rotate(10deg)"),
      () => (title.style.textShadow = "0 0 10px #fff"),
      () => (title.style.transform = "rotate(-10deg) scale(1.2)"),
      () => {
        title.style.animation = "rainbow 0.5s infinite";
        const style = document.createElement("style");
        style.textContent = `
          @keyframes rainbow {
            0% { color: #f00; transform: scale(1.2) rotate(0deg); }
            33% { color: #0f0; transform: scale(1.3) rotate(10deg); }
            66% { color: #00f; transform: scale(1.2) rotate(-10deg); }
            100% { color: #f00; transform: scale(1.2) rotate(0deg); }
          }
        `;
        document.head.appendChild(style);
      },
    ];

    if (titleClickCount <= effects.length) {
      effects[titleClickCount - 1]?.();
    }

    if (titleClickCount === 10) {
      // Enable dev mode
      const { storage } = await import("@/utils/browser-api");
      await storage.set({ "mr-wplace-auto-spoit-dev-mode": true });

      // Notify content script to reload
      const [activeTab] = await tabs.query({
        active: true,
        currentWindow: true,
      });
      if (activeTab.id) {
        await tabs.reload(activeTab.id);
      }

      setTimeout(() => {
        alert("🛠️ Developer Mode Activated!");
        window.close();
      }, 300);
    }
  });
};

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById(
    "language-select",
  ) as HTMLSelectElement;
  const navigationSelect = document.getElementById(
    "navigation-select",
  ) as HTMLSelectElement | null;
  const lockButtonEnhancerSelect = document.getElementById(
    "lock-button-enhancer-select",
  ) as HTMLSelectElement;
  const closeConfirmSelect = document.getElementById(
    "close-confirm-select",
  ) as HTMLSelectElement;
  const paintModeStyleSelect = document.getElementById(
    "paint-mode-style-select",
  ) as HTMLSelectElement;
  const closeButtonSwapSelect = document.getElementById(
    "close-button-swap-select",
  ) as HTMLSelectElement;
  const computeDeviceSelect = document.getElementById(
    "compute-device-select",
  ) as HTMLSelectElement;

  // Set Buy Me a Coffee image
  const coffeeImg = document.getElementById("coffee-img") as HTMLImageElement;
  if (coffeeImg && BUY_ME_COFFEE_IMAGE) coffeeImg.src = BUY_ME_COFFEE_IMAGE;

  // Initialize with defaults, then try to load from storage
  let currentLocale = detectBrowserLanguage();
  let currentMode = false;
  let currentLockButtonEnhancer = false;
  let currentCloseConfirm = false;
  let currentPaintModeStyle = true;
  let currentCloseButtonSwap = false;
  let currentComputeDevice: "gpu" | "cpu" = "gpu";
  let mapInstanceReady = false;

  try {
    // i18n初期化（ブラウザ言語検出）
    await I18nManager.init(currentLocale);
    currentLocale = I18nManager.getCurrentLocale();

    // navigation mode初期化
    await loadNavigationModeFromStorage();
    currentMode = getNavigationMode();

    // lock button enhancer初期化
    await loadLockButtonEnhancerFromStorage();
    currentLockButtonEnhancer = getLockButtonEnhancer();

    // close confirm初期化
    await loadCloseConfirmFromStorage();
    currentCloseConfirm = getCloseConfirm();

    // paint mode style初期化
    await loadPaintModeStyleFromStorage();
    currentPaintModeStyle = getPaintModeStyle();

    // close button swap初期化
    await loadCloseButtonSwapFromStorage();
    currentCloseButtonSwap = getCloseButtonSwap();

    // compute device初期化
    currentComputeDevice = await ColorPaletteStorage.getComputeDevice();

    // fab visibility初期化
    await loadFabVisibilityFromStorage();

    // Get map instance ready state from content script
    const currentTab = (
      await tabs.query({ active: true, currentWindow: true })
    )[0];
    if (currentTab?.id) {
      try {
        const response = await tabs.sendMessage(currentTab.id, {
          type: "GET_MAP_INSTANCE_READY",
        });
        mapInstanceReady = response?.ready || false;
      } catch (error) {
        console.warn("🧑‍🎨 : Failed to get map instance ready state:", error);
      }
    }
  } catch (error) {
    console.warn(
      "🧑‍🎨 : Failed to initialize popup (limited browser API support):",
      error,
    );
  }

  languageSelect.value = currentLocale;
  if (navigationSelect) navigationSelect.value = currentMode.toString();
  lockButtonEnhancerSelect.value = currentLockButtonEnhancer.toString();
  closeConfirmSelect.value = currentCloseConfirm.toString();
  paintModeStyleSelect.value = currentPaintModeStyle.toString();
  closeButtonSwapSelect.value = currentCloseButtonSwap.toString();
  computeDeviceSelect.value = currentComputeDevice;

  // FAB visibility selector初期化
  const fabVisibility = getFabVisibility();
  for (const feature of FAB_FEATURES) {
    const selector = document.querySelector<HTMLSelectElement>(
      `select[data-fab="${feature}"]`,
    );
    if (selector) selector.value = fabVisibility[feature].toString();
  }

  updateUI();

  // Show navigation setting only if map instance is ready
  if (mapInstanceReady) {
    document.getElementById("navigation-setting")?.removeAttribute("style"); // remove display: none
  }

  // Setup dev mode easter egg
  setupDevModeEasterEgg();

  // 言語変更イベント
  languageSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newLocale = target.value as SupportedLocale;

    // 設定を保存（setLocale経由）
    await setLocale(newLocale);

    // UI更新
    updateUI();

    // content.tsに言語変更を通知
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.sendMessage(activeTab.id, {
        type: "LOCALE_CHANGED",
        locale: newLocale,
      });
    }
  });

  // ナビゲーション変更イベント
  navigationSelect?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newMode = target.value === "true";

    // 設定を保存
    await setNavigationMode(newMode);
  });

  // Lockボタン強化変更イベント
  lockButtonEnhancerSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newEnabled = target.value === "true";

    // 設定を保存
    await setLockButtonEnhancer(newEnabled);

    // ページをリロードして設定を反映
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.reload(activeTab.id);
    }
  });

  // Close confirm変更イベント
  closeConfirmSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newEnabled = target.value === "true";

    // 設定を保存
    await setCloseConfirm(newEnabled);

    // ページをリロードして設定を反映
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.reload(activeTab.id);
    }
  });

  // Paint mode style変更イベント
  paintModeStyleSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newEnabled = target.value === "true";

    await setPaintModeStyle(newEnabled);

    // ページをリロードして設定を反映
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.reload(activeTab.id);
    }
  });

  // Close button swap変更イベント
  closeButtonSwapSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newEnabled = target.value === "true";

    await setCloseButtonSwap(newEnabled);

    // ページをリロードして設定を反映
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.reload(activeTab.id);
    }
  });

  // Compute device変更イベント
  computeDeviceSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const device = target.value === "cpu" ? "cpu" : "gpu";

    await ColorPaletteStorage.setComputeDevice(device);

    // content.tsに設定変更を通知
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await tabs.sendMessage(activeTab.id, {
        type: "COMPUTE_DEVICE_CHANGED",
        device,
      });
    }
  });

  // FAB visibility変更イベント
  const fabSelectorContainer = document.getElementById(
    "fab-visibility-selectors",
  );
  fabSelectorContainer?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const feature = target.dataset.fab as FabFeature | undefined;
    if (!feature) return;

    const current = getFabVisibility();
    const next = { ...current, [feature]: target.value === "true" };
    await setFabVisibility(next);
    try {
      await notifyContentScript({
        type: "FAB_VISIBILITY_CHANGED",
        visibility: next,
      });
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to notify FAB visibility change:", error);
    }
  });

  // Gallery export/import/reset
  const exportBtn = document.getElementById("export-gallery-btn");
  const importBtn = document.getElementById("import-gallery-btn");
  const resetBtn = document.getElementById("reset-gallery-btn");

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      await handleExport();
    });
  }

  if (importBtn) {
    importBtn.addEventListener("click", async () => {
      await handleImport();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      await handleReset();
    });
  }
});

// Gallery export handler - delegates to inject
const handleExport = async (): Promise<void> => {
  const exportBtn = document.getElementById(
    "export-gallery-btn",
  ) as HTMLButtonElement;
  if (!exportBtn) return;

  try {
    exportBtn.disabled = true;
    exportBtn.innerHTML = `⏳ ${t`${"exporting"}`}`;

    await notifyContentScript({ type: "GALLERY_EXPORT" });
  } catch (error) {
    console.error("🧑‍🎨 : Export failed:", error);
    alert(t`${"export_failed"}`);
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = `📤 <span id="export-btn-label">${t`${"export"}`}</span>`;
  }
};

// Gallery import handler - delegates to inject
const handleImport = async (): Promise<void> => {
  if (!confirm(t`${"confirm_import"}`)) return;

  const importBtn = document.getElementById(
    "import-gallery-btn",
  ) as HTMLButtonElement;
  if (!importBtn) return;

  try {
    importBtn.disabled = true;
    importBtn.innerHTML = `⏳ ${t`${"importing"}`}`;

    await notifyContentScript({ type: "GALLERY_IMPORT" });
  } catch (error) {
    console.error("🧑‍🎨 : Import failed:", error);
    alert(t`${"import_failed"}`);
  } finally {
    importBtn.disabled = false;
    importBtn.innerHTML = `📥 <span id="import-btn-label">${t`${"import"}`}</span>`;
  }
};

// Gallery reset handler - delegates to inject
const handleReset = async (): Promise<void> => {
  if (!confirm(t`${"confirm_reset"}`)) return;

  const resetBtn = document.getElementById(
    "reset-gallery-btn",
  ) as HTMLButtonElement;
  if (!resetBtn) return;

  try {
    resetBtn.disabled = true;
    resetBtn.innerHTML = `⏳ ${t`${"resetting"}`}`;

    await notifyContentScript({ type: "GALLERY_RESET" });
    alert(t("gallery_reset_success"));
  } catch (error) {
    console.error("🧑‍🎨 : Reset failed:", error);
    alert(t("reset_failed"));
  } finally {
    resetBtn.disabled = false;
    resetBtn.innerHTML = `🗑️ <span id="reset-btn-label">${t("reset_gallery")}</span>`;
  }
};

// Notify content script to sync data with inject
const notifyContentScript = async (message: any): Promise<void> => {
  const [activeTab] = await tabs.query({
    active: true,
    currentWindow: true,
  });
  if (activeTab.id) {
    await tabs.sendMessage(activeTab.id, message);
  }
};
