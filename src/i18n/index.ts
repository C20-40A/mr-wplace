// サポート対象ロケール型定義
export type SupportedLocale = "ja" | "en" | "pt" | "es";

// 翻訳辞書の型定義
export interface Translations {
  [key: string]: string;
}

export interface LocaleData {
  ja: Translations;
  en: Translations;
  pt: Translations;
  es: Translations;
}

// 現在のロケール管理
let currentLocale: SupportedLocale = "en";

// Chrome Storage連携
const STORAGE_KEY = "mr_wplace_locale";

// ストレージから設定を読み込み
export async function loadLocaleFromStorage(): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const storedLocale = result[STORAGE_KEY] as SupportedLocale;
    if (storedLocale === "ja" || storedLocale === "en" || storedLocale === "pt" || storedLocale === "es") {
      currentLocale = storedLocale;
    }
  }
}

// ストレージに設定を保存
export async function saveLocaleToStorage(locale: SupportedLocale): Promise<void> {
  if (typeof chrome !== "undefined" && chrome.storage) {
    await chrome.storage.local.set({ [STORAGE_KEY]: locale });
  }
}

// 翻訳辞書
const translations: LocaleData = {
  ja: {},
  en: {},
  pt: {},
  es: {},
};

// ロケール設定（ストレージ連携版）
export async function setLocale(locale: SupportedLocale): Promise<void> {
  currentLocale = locale;
  await saveLocaleToStorage(locale);
}

// 現在のロケール取得
export function getLocale(): SupportedLocale {
  return currentLocale;
}

// ブラウザ言語検出
export function detectBrowserLanguage(): SupportedLocale {
  const lang = navigator.language.substring(0, 2);
  if (lang === "ja" || lang === "en" || lang === "pt" || lang === "es") {
    return lang as SupportedLocale;
  }
  return "en";
}

// 翻訳辞書登録
export function registerTranslations(
  locale: SupportedLocale,
  data: Translations
): void {
  Object.assign(translations[locale], data);
}

// タグ付きテンプレートリテラル関数
export function t(strings: TemplateStringsArray, ...values: any[]): string {
  let result = "";

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];

    if (i < values.length) {
      const value = values[i];
      // fallback: current locale → en → key name
      if (typeof value === "string") {
        result += translations[currentLocale][value] 
          || translations["en"][value] 
          || value;
      } else {
        result += value;
      }
    }
  }

  return result;
}
