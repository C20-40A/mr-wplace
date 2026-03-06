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
  loadCloseButtonBigFromStorage,
  getCloseButtonBig,
  setCloseButtonBig,
} from "./states/close-button-big";
import {
  loadFabVisibilityFromStorage,
  getFabVisibility,
  setFabVisibility,
  FAB_FEATURES,
} from "./states/fab-visibility";
import { ColorPaletteStorage } from "@/components/color-palette/storage";

import { runtime, storage, tabs } from "@/utils/browser-api";
import { FEEDBACK_FORM_URL } from "@/constants/url";
import { BUY_ME_COFFEE_IMAGE } from "./assets/buyMeACoffee";

const AREA_REGIONS_KEY = "areaRegions_v1";
const AREA_REGION_GROUPS_KEY = "areaRegionGroups_v1";
const NO_CONTENT_RECEIVER_ERROR_MESSAGE = "No active tab content receiver available";
const POPUP_WINDOW_OPENED = "POPUP_WINDOW_OPENED";
const POPUP_WINDOW_CLOSED = "POPUP_WINDOW_CLOSED";
const CLOSE_POPUP_WINDOW = "CLOSE_POPUP_WINDOW";

const notifyPopupWindowState = async (
  type: typeof POPUP_WINDOW_OPENED | typeof POPUP_WINDOW_CLOSED,
) => {
  try {
    await runtime.sendMessage({ type });
  } catch {
    // Ignore if service worker is not reachable
  }
};

runtime.onMessage.addListener((message) => {
  if (message?.type !== CLOSE_POPUP_WINDOW) return;
  window.close();
});

const isNoContentReceiverError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes(NO_CONTENT_RECEIVER_ERROR_MESSAGE) ||
    error.message.includes("Could not establish connection") ||
    error.message.includes("Receiving end does not exist")
  );
};

// --- Toggle button helpers ---

const updateToggleBtn = (btn: HTMLButtonElement, on: boolean) => {
  btn.dataset.on = on.toString();
  btn.textContent = on ? "ON" : "OFF";
};

const getToggle = (id: string) =>
  document.getElementById(id) as HTMLButtonElement | null;

const setupToggle = (
  id: string,
  initial: boolean,
  onChange: (value: boolean) => Promise<void>,
) => {
  const btn = getToggle(id);
  if (!btn) return;
  updateToggleBtn(btn, initial);
  btn.addEventListener("click", async () => {
    const next = btn.dataset.on !== "true";
    updateToggleBtn(btn, next);
    await onChange(next);
  });
};

const reloadActiveTab = async () => {
  const [activeTab] = await tabs.query({ active: true, currentWindow: true });
  if (activeTab.id) await tabs.reload(activeTab.id);
};

// --- Notify helpers ---

const notifyContentScript = async (message: any): Promise<any> => {
  const [activeTab] = await tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) throw new Error(NO_CONTENT_RECEIVER_ERROR_MESSAGE);
  return await tabs.sendMessage(activeTab.id, message);
};

const notifyContentScriptBestEffort = async (message: any): Promise<any | undefined> => {
  try {
    return await notifyContentScript(message);
  } catch (error) {
    if (!isNoContentReceiverError(error)) throw error;
    return undefined;
  }
};

// --- i18n UI update ---

const updateUI = (): void => {
  const feedbackLink = document.getElementById("feedback-link") as HTMLAnchorElement;
  if (feedbackLink) {
    const localeKey = I18nManager.getCurrentLocale() as keyof typeof FEEDBACK_FORM_URL;
    feedbackLink.href = FEEDBACK_FORM_URL[localeKey] || FEEDBACK_FORM_URL.en;
  }

  const labelMap: Record<string, string> = {
    "popup-language-label": "popup_language",
    "popup-navigation-label": "popup_navigation",
    "popup-nav-map-jump": "popup_navigation_map_jump",
    "popup-nav-url-jump": "popup_navigation_url_jump",
    "popup-lock-button-label": "popup_lock_button",
    "popup-close-confirm-label": "popup_close_confirm",
    "popup-paint-mode-style-label": "popup_paint_mode_style",
    "popup-close-button-big-label": "popup_close_button_big",
    "popup-bug-report-label": "popup_bug_report",
    "popup-fab-visibility-label": "popup_fab_visibility",
    "popup-fab-gallery-label": "popup_fab_gallery",
    "popup-fab-bookmark-label": "popup_fab_bookmark",
    "popup-fab-time-travel-label": "popup_fab_time_travel",
    "popup-fab-data-saver-label": "popup_fab_data_saver",
    "popup-fab-filter-label": "popup_fab_color_filter",
    "popup-compute-device-label": "compute_device_label",
    "fab-visibility-toggle-label": "popup_fab_visibility_show",
    "danger-zone-label": "danger_zone",
    "danger-zone-toggle-label": "danger_zone_show",
    "reset-gallery-btn-label": "reset_gallery",
    "reset-areas-btn-label": "reset_areas",
  };
  for (const [id, key] of Object.entries(labelMap)) {
    const el = document.getElementById(id);
    if (el) el.textContent = t(key);
  }
};

// --- Dev mode easter egg ---

let titleClickCount = 0;
const setupDevModeEasterEgg = (): void => {
  const title = document.querySelector(".header h2") as HTMLHeadingElement;
  if (!title) return;

  title.style.cursor = "pointer";
  title.style.userSelect = "none";

  title.addEventListener("click", async () => {
    titleClickCount++;

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

    if (titleClickCount <= effects.length) effects[titleClickCount - 1]?.();

    if (titleClickCount === 10) {
      const { storage } = await import("@/utils/browser-api");
      await storage.set({ "mr-wplace-auto-spoit-dev-mode": true });
      const [activeTab] = await tabs.query({ active: true, currentWindow: true });
      if (activeTab.id) await tabs.reload(activeTab.id);
      setTimeout(() => {
        alert("🛠️ Developer Mode Activated!");
        window.close();
      }, 300);
    }
  });
};

// --- Reset handlers ---

const handleResetGallery = async (): Promise<void> => {
  if (!confirm(t`${"confirm_reset"}`)) return;
  const btn = document.getElementById("reset-gallery-btn") as HTMLButtonElement;
  if (!btn) return;

  try {
    btn.disabled = true;
    btn.innerHTML = `⏳ ${t`${"resetting"}`}`;
    await notifyContentScript({ type: "GALLERY_RESET" });
    alert(t("gallery_reset_success"));
  } catch (error) {
    console.error("🧑‍🎨 : Gallery reset failed:", error);
    alert(t("reset_failed"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = `🗑️ <span id="reset-gallery-btn-label">${t("reset_gallery")}</span>`;
  }
};

const handleResetAreas = async (): Promise<void> => {
  if (!confirm(t`${"confirm_reset_areas"}`)) return;
  const btn = document.getElementById("reset-areas-btn") as HTMLButtonElement;
  if (!btn) return;

  try {
    btn.disabled = true;
    btn.innerHTML = `⏳ ${t`${"resetting"}`}`;
    try {
      const response = await notifyContentScript({ type: "AREA_RESET" });
      if (response?.success === false)
        throw new Error(response.error || "Area reset failed");
    } catch (error) {
      if (!isNoContentReceiverError(error)) throw error;
      await storage.set({ [AREA_REGIONS_KEY]: [], [AREA_REGION_GROUPS_KEY]: [] });
      console.log("🧑‍🎨 : Area reset completed from popup storage fallback");
    }
    alert(t("areas_reset_success"));
  } catch (error) {
    console.error("🧑‍🎨 : Area reset failed:", error);
    alert(t("reset_failed"));
  } finally {
    btn.disabled = false;
    btn.innerHTML = `🗑️ <span id="reset-areas-btn-label">${t("reset_areas")}</span>`;
  }
};

// --- Main ---

document.addEventListener("DOMContentLoaded", async () => {
  await notifyPopupWindowState(POPUP_WINDOW_OPENED);

  const languageSelect = document.getElementById("language-select") as HTMLSelectElement;
  const navigationSelect = document.getElementById("navigation-select") as HTMLSelectElement | null;
  const computeDeviceSelect = document.getElementById("compute-device-select") as HTMLSelectElement;

  // Set Buy Me a Coffee image
  const coffeeImg = document.getElementById("coffee-img") as HTMLImageElement;
  if (coffeeImg && BUY_ME_COFFEE_IMAGE) coffeeImg.src = BUY_ME_COFFEE_IMAGE;

  // Initialize defaults
  let currentLocale = detectBrowserLanguage();
  let currentMode = false;
  let currentComputeDevice: "gpu" | "cpu" = "gpu";
  let mapInstanceReady = false;

  try {
    await I18nManager.init(currentLocale);
    currentLocale = I18nManager.getCurrentLocale();
    languageSelect.value = currentLocale;
    updateUI();

    await Promise.all([
      loadNavigationModeFromStorage(),
      loadLockButtonEnhancerFromStorage(),
      loadCloseConfirmFromStorage(),
      loadPaintModeStyleFromStorage(),
      loadCloseButtonBigFromStorage(),
      loadFabVisibilityFromStorage(),
    ]);

    currentMode = getNavigationMode();
    currentComputeDevice = await ColorPaletteStorage.getComputeDevice();

    try {
      const response = await notifyContentScript({ type: "GET_MAP_INSTANCE_READY" });
      mapInstanceReady = response?.ready || false;
    } catch (error) {
      if (!isNoContentReceiverError(error))
        console.warn("🧑‍🎨 : Failed to get map instance ready state:", error);
    }
  } catch (error) {
    console.warn("🧑‍🎨 : Failed to initialize popup:", error);
  }

  languageSelect.value = currentLocale;
  if (navigationSelect) navigationSelect.value = currentMode.toString();
  computeDeviceSelect.value = currentComputeDevice;

  // Boolean toggle settings (save + reload tab)
  setupToggle("lock-button-enhancer-toggle", getLockButtonEnhancer(), async (v) => {
    await setLockButtonEnhancer(v);
    await reloadActiveTab();
  });
  setupToggle("close-confirm-toggle", getCloseConfirm(), async (v) => {
    await setCloseConfirm(v);
    await reloadActiveTab();
  });
  setupToggle("paint-mode-style-toggle", getPaintModeStyle(), async (v) => {
    await setPaintModeStyle(v);
    await reloadActiveTab();
  });
  setupToggle("close-button-big-toggle", getCloseButtonBig(), async (v) => {
    await setCloseButtonBig(v);
    await reloadActiveTab();
  });

  // FAB visibility toggles
  const fabVisibility = getFabVisibility();
  for (const feature of FAB_FEATURES) {
    const btn = document.querySelector<HTMLButtonElement>(`.toggle-btn[data-fab="${feature}"]`);
    if (!btn) continue;
    updateToggleBtn(btn, fabVisibility[feature]);
    btn.addEventListener("click", async () => {
      const next = btn.dataset.on !== "true";
      updateToggleBtn(btn, next);
      const current = getFabVisibility();
      const updated = { ...current, [feature]: next };
      await setFabVisibility(updated);
      try {
        await notifyContentScript({ type: "FAB_VISIBILITY_CHANGED", visibility: updated });
      } catch (error) {
        console.warn("🧑‍🎨 : Failed to notify FAB visibility change:", error);
      }
    });
  }

  updateUI();

  // Show navigation setting only if map instance is ready
  if (mapInstanceReady)
    document.getElementById("navigation-setting")?.removeAttribute("style");

  // Reveal settings after initialization complete
  document.getElementById("settings-body")?.removeAttribute("style");

  setupDevModeEasterEgg();

  // Language change
  languageSelect.addEventListener("change", async (event) => {
    const newLocale = (event.target as HTMLSelectElement).value as SupportedLocale;
    await setLocale(newLocale);
    updateUI();
    await notifyContentScriptBestEffort({ type: "LOCALE_CHANGED", locale: newLocale });
  });

  // Navigation change
  navigationSelect?.addEventListener("change", async (event) => {
    await setNavigationMode((event.target as HTMLSelectElement).value === "true");
  });

  // Compute device change
  computeDeviceSelect.addEventListener("change", async (event) => {
    const device = (event.target as HTMLSelectElement).value === "cpu" ? "cpu" : "gpu";
    await ColorPaletteStorage.setComputeDevice(device);
    await notifyContentScriptBestEffort({ type: "COMPUTE_DEVICE_CHANGED", device });
  });

  // FAB Visibility toggle
  const fabContent = document.getElementById("fab-visibility-content");
  const fabLabel = document.getElementById("fab-visibility-toggle-label");
  document.getElementById("toggle-fab-visibility-btn")?.addEventListener("click", () => {
    if (!fabContent || !fabLabel) return;
    const isHidden = fabContent.style.display === "none";
    fabContent.style.display = isHidden ? "block" : "none";
    fabLabel.textContent = isHidden ? t("popup_fab_visibility_hide") : t("popup_fab_visibility_show");
  });

  // Danger Zone toggle
  const dangerContent = document.getElementById("danger-zone-content");
  const dangerLabel = document.getElementById("danger-zone-toggle-label");
  document.getElementById("toggle-danger-zone-btn")?.addEventListener("click", () => {
    if (!dangerContent || !dangerLabel) return;
    const isHidden = dangerContent.style.display === "none";
    dangerContent.style.display = isHidden ? "block" : "none";
    dangerLabel.textContent = isHidden ? t("danger_zone_hide") : t("danger_zone_show");
  });

  // Reset buttons
  document.getElementById("reset-gallery-btn")?.addEventListener("click", handleResetGallery);
  document.getElementById("reset-areas-btn")?.addEventListener("click", handleResetAreas);
});

window.addEventListener("beforeunload", () => {
  void notifyPopupWindowState(POPUP_WINDOW_CLOSED);
});
