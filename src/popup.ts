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
  type NavigationMode,
} from "./states/navigation-mode";
import { tabs } from "@/utils/browser-api";

const updateUI = (): void => {
  const coffeeLink = document.querySelector(".coffee-link") as HTMLElement;
  if (coffeeLink) {
    coffeeLink.textContent = `☕ ${t`${"buy_me_coffee"}`}`;
  }
};

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById(
    "language-select"
  ) as HTMLSelectElement;
  const navigationSelect = document.getElementById(
    "navigation-select"
  ) as HTMLSelectElement;

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());
  const currentLocale = I18nManager.getCurrentLocale();

  // navigation mode初期化
  await loadNavigationModeFromStorage();
  const currentMode = getNavigationMode();

  languageSelect.value = currentLocale;
  navigationSelect.value = currentMode.toString();
  updateUI();

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
});
