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
  static async init(locale: SupportedLocale = "en"): Promise<void> {
    // まずストレージから読み込み
    await loadLocaleFromStorage();

    // ストレージに値がない場合のみデフォルト値を設定
    const currentLocale = getLocale();
    if (!currentLocale) await setLocale(locale);
  }

  static getCurrentLocale(): SupportedLocale {
    return getLocale();
  }
}

// 翻訳・日付関数を再エクスポート
export { t, formatDate, formatDateShort };
