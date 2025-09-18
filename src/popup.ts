import { I18nManager, t } from "./i18n/manager";
import { setLocale, detectBrowserLanguage } from "./i18n/index";

function updateUI(): void {
  const coffeeLink = document.querySelector(".coffee-link") as HTMLElement;
  if (coffeeLink) {
    coffeeLink.textContent = `☕ ${t`${"buy_me_coffee"}`}`;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById(
    "language-select"
  ) as HTMLSelectElement;

  // i18n初期化（ブラウザ言語検出）
  await I18nManager.init(detectBrowserLanguage());
  const currentLocale = I18nManager.getCurrentLocale();

  languageSelect.value = currentLocale;
  updateUI();

  // 言語変更イベント
  languageSelect.addEventListener("change", async (event) => {
    const target = event.target as HTMLSelectElement;
    const newLocale = target.value as "ja" | "en";

    // 設定を保存（setLocale経由）
    await setLocale(newLocale);

    // UI更新
    updateUI();

    // content.tsに言語変更を通知
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab.id) {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: "LOCALE_CHANGED",
        locale: newLocale,
      });
    }
  });
});
