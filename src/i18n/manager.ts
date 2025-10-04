import {
  t,
  setLocale,
  getLocale,
  loadLocaleFromStorage,
  formatDate,
  formatDateShort,
  type SupportedLocale,
} from "./index";
import "./translations"; // 翻訳辞書を自動登録

// 使用例とヘルパー関数
export class I18nManager {
  static async init(defaultLocale: SupportedLocale = "en"): Promise<void> {
    const loaded = await loadLocaleFromStorage();
    if (!loaded) {
      await setLocale(defaultLocale);
    }
  }

  static getCurrentLocale(): SupportedLocale {
    return getLocale();
  }
}

// 翻訳・日付関数を再エクスポート
export { t, formatDate, formatDateShort };
