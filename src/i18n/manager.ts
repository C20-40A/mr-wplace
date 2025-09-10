import { t, setLocale, getLocale, loadLocaleFromStorage } from './index';
import './translations'; // 翻訳辞書を自動登録

// 使用例とヘルパー関数
export class I18nManager {
  static async init(locale: 'ja' | 'en' = 'ja'): Promise<void> {
    // まずストレージから読み込み
    await loadLocaleFromStorage();
    
    // ストレージに値がない場合のみデフォルト値を設定
    const currentLocale = getLocale();
    if (!currentLocale) {
      await setLocale(locale);
    }
  }

  static async switchLocale(): Promise<void> {
    const current = getLocale();
    const newLocale = current === 'ja' ? 'en' : 'ja';
    await setLocale(newLocale);
  }

  static getCurrentLocale(): 'ja' | 'en' {
    return getLocale();
  }
}

// 翻訳関数を再エクスポート
export { t };
