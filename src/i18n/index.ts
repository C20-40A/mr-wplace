// 翻訳辞書の型定義
export interface Translations {
  [key: string]: string;
}

export interface LocaleData {
  ja: Translations;
  en: Translations;
}

// 現在のロケール管理
let currentLocale: 'ja' | 'en' = 'ja';

// Chrome Storage連携
const STORAGE_KEY = 'wplace_studio_locale';

// ストレージから設定を読み込み
export async function loadLocaleFromStorage(): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      const result = await chrome.storage.local.get([STORAGE_KEY]);
      const storedLocale = result[STORAGE_KEY];
      if (storedLocale === 'ja' || storedLocale === 'en') {
        currentLocale = storedLocale;
      }
    }
  } catch (error) {
    console.warn('Failed to load locale from storage:', error);
  }
}

// ストレージに設定を保存
export async function saveLocaleToStorage(locale: 'ja' | 'en'): Promise<void> {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      await chrome.storage.local.set({ [STORAGE_KEY]: locale });
    }
  } catch (error) {
    console.warn('Failed to save locale to storage:', error);
  }
}

// 翻訳辞書
const translations: LocaleData = {
  ja: {},
  en: {}
};

// ロケール設定（ストレージ連携版）
export async function setLocale(locale: 'ja' | 'en'): Promise<void> {
  currentLocale = locale;
  await saveLocaleToStorage(locale);
}

// 現在のロケール取得
export function getLocale(): 'ja' | 'en' {
  return currentLocale;
}

// ブラウザ言語検出
export function detectBrowserLanguage(): 'ja' | 'en' {
  return navigator.language.startsWith('ja') ? 'ja' : 'en';
}

// 翻訳辞書登録
export function registerTranslations(locale: 'ja' | 'en', data: Translations): void {
  Object.assign(translations[locale], data);
}

// タグ付きテンプレートリテラル関数
export function t(strings: TemplateStringsArray, ...values: any[]): string {
  let result = '';
  
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    
    if (i < values.length) {
      const value = values[i];
      // 翻訳キーかどうかチェック（文字列で翻訳辞書にある場合）
      if (typeof value === 'string' && translations[currentLocale][value]) {
        result += translations[currentLocale][value];
      } else {
        // 翻訳キーでない場合はそのまま使用
        result += value;
      }
    }
  }
  
  return result;
}
