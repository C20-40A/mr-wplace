// i18n最小実装
const translations = {
  ja: { buy_me_coffee: "作者にコーヒーをおごる" },
  en: { buy_me_coffee: "Buy me a coffee" },
};

function updateUI(locale) {
  const t = (key) => translations[locale][key] || key;
  document.querySelector(".coffee-link").textContent = `☕ ${t(
    "buy_me_coffee"
  )}`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const languageSelect = document.getElementById("language-select");

  // 現在の設定を読み込み
  const result = await chrome.storage.local.get(["wplace_studio_locale"]);
  const currentLocale = result.wplace_studio_locale || "ja";

  languageSelect.value = currentLocale;
  updateUI(currentLocale);

  // 言語変更イベント
  languageSelect.addEventListener("change", async (event) => {
    const newLocale = event.target.value;

    // 設定を保存
    await chrome.storage.local.set({
      wplace_studio_locale: newLocale,
    });

    // UI更新
    updateUI(newLocale);

    // アクティブなタブに言語変更を通知
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (activeTab && activeTab.url && activeTab.url.includes("wplace.live")) {
      await chrome.tabs.sendMessage(activeTab.id, {
        type: "LOCALE_CHANGED",
        locale: newLocale,
      });
    }
  });
});
