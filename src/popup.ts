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
  loadTileBoundariesFromStorage,
  getTileBoundaries,
  setTileBoundaries,
} from "./states/tile-boundaries";
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

import { tabs } from "@/utils/browser-api";
import { FEEDBACK_FORM_URL } from "@/constants/url";
import { BUY_ME_COFFEE_IMAGE } from "./assets/buyMeACoffee";

const updateUI = (): void => {
  // Update feedback form URL based on current locale
  const feedbackLink = document.getElementById(
    "feedback-link"
  ) as HTMLAnchorElement;
  if (feedbackLink) {
    const currentLocale = I18nManager.getCurrentLocale();
    const localeKey = currentLocale as keyof typeof FEEDBACK_FORM_URL;
    feedbackLink.href = FEEDBACK_FORM_URL[localeKey] || FEEDBACK_FORM_URL.en;
  }

  // Update gallery data labels
  const galleryDataLabel = document.getElementById("gallery-data-label");
  const exportBtnLabel = document.getElementById("export-btn-label");
  const importBtnLabel = document.getElementById("import-btn-label");
  const resetBtnLabel = document.getElementById("reset-btn-label");

  if (galleryDataLabel) galleryDataLabel.textContent = t`${"gallery_data"}`;
  if (exportBtnLabel) exportBtnLabel.textContent = t`${"export"}`;
  if (importBtnLabel) importBtnLabel.textContent = t`${"import"}`;
  if (resetBtnLabel) resetBtnLabel.textContent = t`${"reset_gallery"}`;
};

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById(
    "language-select"
  ) as HTMLSelectElement;
  const navigationSelect = document.getElementById(
    "navigation-select"
  ) as HTMLSelectElement | null;
  const tileBoundariesSelect = document.getElementById(
    "tile-boundaries-select"
  ) as HTMLSelectElement | null;
  const lockButtonEnhancerSelect = document.getElementById(
    "lock-button-enhancer-select"
  ) as HTMLSelectElement;
  const closeConfirmSelect = document.getElementById(
    "close-confirm-select"
  ) as HTMLSelectElement;

  // Set Buy Me a Coffee image
  const coffeeImg = document.getElementById("coffee-img") as HTMLImageElement;
  if (coffeeImg && BUY_ME_COFFEE_IMAGE) coffeeImg.src = BUY_ME_COFFEE_IMAGE;

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());
  const currentLocale = I18nManager.getCurrentLocale();

  // navigation mode初期化
  await loadNavigationModeFromStorage();
  const currentMode = getNavigationMode();

  // tile boundaries初期化
  await loadTileBoundariesFromStorage();
  const currentTileBoundaries = getTileBoundaries();

  // lock button enhancer初期化
  await loadLockButtonEnhancerFromStorage();
  const currentLockButtonEnhancer = getLockButtonEnhancer();

  // close confirm初期化
  await loadCloseConfirmFromStorage();
  const currentCloseConfirm = getCloseConfirm();

  // Get map instance ready state from content script
  const currentTab = (await tabs.query({ active: true, currentWindow: true }))[0];
  let mapInstanceReady = false;
  if (currentTab?.id) {
    try {
      const response = await tabs.sendMessage(currentTab.id, { type: "GET_MAP_INSTANCE_READY" });
      mapInstanceReady = response?.ready || false;
    } catch (error) {
      console.warn("🧑‍🎨 : Failed to get map instance ready state:", error);
    }
  }

  languageSelect.value = currentLocale;
  if (navigationSelect) navigationSelect.value = currentMode.toString();
  if (tileBoundariesSelect)
    tileBoundariesSelect.value = currentTileBoundaries.toString();
  lockButtonEnhancerSelect.value = currentLockButtonEnhancer.toString();
  closeConfirmSelect.value = currentCloseConfirm.toString();
  updateUI();

  // Show tile boundaries setting only if map instance is ready
  if (mapInstanceReady) {
    document
      .getElementById("tile-boundaries-setting")
      ?.removeAttribute("style"); // remove display: none
    document.getElementById("navigation-setting")?.removeAttribute("style"); // remove display: none
  }

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

  // タイル境界変更イベント (currently disabled)
  tileBoundariesSelect?.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newVisible = target.value === "true";

    // 設定を保存
    await setTileBoundaries(newVisible);

    // content.tsに通知
    await notifyContentScript({
      type: "TILE_BOUNDARIES_CHANGED",
      visible: newVisible,
    });
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
    "export-gallery-btn"
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
    "import-gallery-btn"
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
    "reset-gallery-btn"
  ) as HTMLButtonElement;
  if (!resetBtn) return;

  try {
    resetBtn.disabled = true;
    resetBtn.innerHTML = `⏳ ${t`${"resetting"}`}`;

    await notifyContentScript({ type: "GALLERY_RESET" });
    alert(t`${"gallery_reset_success"}`);
  } catch (error) {
    console.error("🧑‍🎨 : Reset failed:", error);
    alert(t`${"reset_failed"}`);
  } finally {
    resetBtn.disabled = false;
    resetBtn.innerHTML = `🗑️ <span id="reset-btn-label">${t`${"reset_gallery"}`}</span>`;
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
