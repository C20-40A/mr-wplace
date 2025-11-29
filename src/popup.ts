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
import { tabs } from "@/utils/browser-api";
import { GalleryStorage } from "@/features/gallery/storage";
import {
  exportGalleryToZip,
  importGalleryFromZip,
  downloadBlob,
} from "@/utils/gallery-export";
import { FEEDBACK_FORM_URL } from "@/constants/url";
import { BUY_ME_COFFEE_IMAGE } from "./assets/buyMeACoffee";

const updateUI = (): void => {
  // Update feedback form URL based on current locale
  const feedbackLink = document.getElementById(
    "feedback-link"
  ) as HTMLAnchorElement;
  if (feedbackLink) {
    const currentLocale = I18nManager.getCurrentLocale();
    // Narrow the locale to the known keys of FEEDBACK_FORM_URL before indexing
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

// Check if mapInstance exists and hide features that require it
const checkMapInstanceAndUpdateUI = async (): Promise<void> => {
  try {
    const [activeTab] = await tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!activeTab.id) {
      console.log("🧑‍🎨 : No active tab found");
      return;
    }

    // Execute script to check if window.wplaceMap exists
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => {
        return typeof (window as any).wplaceMap !== "undefined";
      },
    });

    const hasMapInstance = results?.[0]?.result ?? false;

    console.log("🧑‍🎨 : Map instance exists:", hasMapInstance);

    // Hide navigation and tile boundaries settings if no map instance
    const navigationGroup = document
      .getElementById("navigation-select")
      ?.closest(".setting-group") as HTMLElement;
    const tileBoundariesGroup = document
      .getElementById("tile-boundaries-select")
      ?.closest(".setting-group") as HTMLElement;

    if (navigationGroup) {
      navigationGroup.style.display = hasMapInstance ? "block" : "none";
    }

    if (tileBoundariesGroup) {
      tileBoundariesGroup.style.display = hasMapInstance ? "block" : "none";
    }
  } catch (error) {
    console.error("🧑‍🎨 : Failed to check map instance:", error);
    // On error, hide the features to be safe
    const navigationGroup = document
      .getElementById("navigation-select")
      ?.closest(".setting-group") as HTMLElement;
    const tileBoundariesGroup = document
      .getElementById("tile-boundaries-select")
      ?.closest(".setting-group") as HTMLElement;

    if (navigationGroup) {
      navigationGroup.style.display = "none";
    }

    if (tileBoundariesGroup) {
      tileBoundariesGroup.style.display = "none";
    }
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById(
    "language-select"
  ) as HTMLSelectElement;
  const navigationSelect = document.getElementById(
    "navigation-select"
  ) as HTMLSelectElement;
  const tileBoundariesSelect = document.getElementById(
    "tile-boundaries-select"
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

  languageSelect.value = currentLocale;
  navigationSelect.value = currentMode.toString();
  tileBoundariesSelect.value = currentTileBoundaries.toString();
  updateUI();

  // Check if mapInstance exists and hide features that require it
  await checkMapInstanceAndUpdateUI();

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
  navigationSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newMode = target.value === "true";

    // 設定を保存
    await setNavigationMode(newMode);
  });

  // タイル境界変更イベント
  tileBoundariesSelect.addEventListener("change", async (event) => {
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

  // Gallery export/import/reset
  const exportBtn = document.getElementById("export-gallery-btn");
  const importBtn = document.getElementById("import-gallery-btn");
  const resetBtn = document.getElementById("reset-gallery-btn");
  const fileInput = document.getElementById(
    "import-gallery-file"
  ) as HTMLInputElement;

  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      await handleExport();
    });
  }

  if (importBtn && fileInput) {
    importBtn.addEventListener("click", () => {
      fileInput.click();
    });

    fileInput.addEventListener("change", async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await handleImport(file);
        // Clear file input
        fileInput.value = "";
      }
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", async () => {
      await handleReset();
    });
  }
});

// Gallery export handler
const handleExport = async (): Promise<void> => {
  const exportBtn = document.getElementById(
    "export-gallery-btn"
  ) as HTMLButtonElement;
  if (!exportBtn) return;

  try {
    // Disable button
    exportBtn.disabled = true;
    // const originalLabel = exportBtn.innerHTML;
    exportBtn.innerHTML = `⏳ ${t`${"exporting"}`}`;

    // Get all gallery items (full images for export)
    const storage = new GalleryStorage();
    const items = await storage.getAll({ fullImage: true });

    // Filter items with drawPosition
    const itemsToExport = items.filter((item) => item.drawPosition);

    if (itemsToExport.length === 0) {
      alert(t`${"no_images_to_export"}`);
      return;
    }

    // Create ZIP
    const zipBlob = await exportGalleryToZip(items);

    // Download
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const filename = `wplace_gallery_${timestamp}.zip`;
    downloadBlob(zipBlob, filename);

    console.log(`🧑‍🎨 : Exported ${itemsToExport.length} gallery images`);
  } catch (error) {
    console.error("🧑‍🎨 : Export failed:", error);
    alert(t`${"export_failed"}`);
  } finally {
    // Re-enable button
    const exportBtn = document.getElementById(
      "export-gallery-btn"
    ) as HTMLButtonElement;
    if (exportBtn) {
      exportBtn.disabled = false;
      exportBtn.innerHTML = `📤 <span id="export-btn-label">${t`${"export"}`}</span>`;
    }
  }
};

// Gallery import handler
const handleImport = async (file: File): Promise<void> => {
  // Confirmation dialog
  const confirmed = confirm(t`${"confirm_import"}`);
  if (!confirmed) return;

  const importBtn = document.getElementById(
    "import-gallery-btn"
  ) as HTMLButtonElement;
  if (!importBtn) return;

  try {
    // Disable button
    importBtn.disabled = true;
    const originalLabel = importBtn.innerHTML;
    importBtn.innerHTML = `⏳ ${t`${"importing"}`}`;

    // Parse ZIP
    const items = await importGalleryFromZip(file);

    if (items.length === 0) {
      alert(t`${"no_valid_images_in_zip"}`);
      return;
    }

    // Import items
    const storage = new GalleryStorage();
    for (const item of items) {
      const timestamp = Date.now();
      const key = `gallery_${timestamp}_${Math.random()
        .toString(36)
        .slice(2, 9)}`;

      await storage.save({
        key,
        timestamp,
        dataUrl: item.dataUrl,
        title: item.title,
        drawPosition: item.drawPosition,
        drawEnabled: true,
        layerOrder: item.layerOrder,
      });

      // Small delay to ensure unique timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    // Notify inject side to update overlay layers
    await notifyContentScript({ type: "GALLERY_UPDATED" });

    alert(t`${"import_success"}`.replace("{count}", items.length.toString()));

    console.log(`🧑‍🎨 : Imported ${items.length} gallery images`);
  } catch (error) {
    console.error("🧑‍🎨 : Import failed:", error);
    alert(t`${"import_failed"}`);
  } finally {
    // Re-enable button
    const importBtn = document.getElementById(
      "import-gallery-btn"
    ) as HTMLButtonElement;
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.innerHTML = `📥 <span id="import-btn-label">${t`${"import"}`}</span>`;
    }
  }
};

// Gallery reset handler
const handleReset = async (): Promise<void> => {
  // Confirmation dialog
  const confirmed = confirm(t`${"confirm_reset"}`);
  if (!confirmed) return;

  const resetBtn = document.getElementById(
    "reset-gallery-btn"
  ) as HTMLButtonElement;
  if (!resetBtn) return;

  try {
    // Disable button
    resetBtn.disabled = true;
    resetBtn.innerHTML = `⏳ ${t`${"resetting"}`}`;

    // Delete all gallery items
    const storage = new GalleryStorage();
    const items = await storage.getAll();

    for (const item of items) {
      await storage.delete(item.key);
    }

    // Notify inject side to update overlay layers
    await notifyContentScript({ type: "GALLERY_UPDATED" });

    alert(t`${"gallery_reset_success"}`);

    console.log(`🧑‍🎨 : Reset ${items.length} gallery images`);
  } catch (error) {
    console.error("🧑‍🎨 : Reset failed:", error);
    alert(t`${"reset_failed"}`);
  } finally {
    // Re-enable button
    const resetBtn = document.getElementById(
      "reset-gallery-btn"
    ) as HTMLButtonElement;
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.innerHTML = `🗑️ <span id="reset-btn-label">${t`${"reset_gallery"}`}</span>`;
    }
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
