import { storage } from "@/utils/browser-api";

// サポート対象ロケール型定義
export type SupportedLocale = "ja" | "en" | "pt" | "es" | "vi" | "fr" | "ru";

// 翻訳辞書の型定義
export interface Translations {
  [key: string]: string;
}

export interface LocaleData {
  ja: Translations;
  en: Translations;
  pt: Translations;
  es: Translations;
  vi: Translations;
  fr: Translations;
  ru: Translations;
}

// 現在のロケール管理
let currentLocale: SupportedLocale = "en";

// Chrome Storage連携
const STORAGE_KEY = "mr_wplace_locale";

// ストレージから設定を読み込み（成功時true）
export const loadLocaleFromStorage = async (): Promise<boolean> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedLocale = result[STORAGE_KEY] as SupportedLocale | undefined;
  if (
    storedLocale === "ja" ||
    storedLocale === "en" ||
    storedLocale === "pt" ||
    storedLocale === "es" ||
    storedLocale === "vi" ||
    storedLocale === "fr" ||
    storedLocale === "ru"
  ) {
    currentLocale = storedLocale;
    return true;
  }
  return false;
};

// ストレージに設定を保存
export const saveLocaleToStorage = async (
  locale: SupportedLocale
): Promise<void> => {
  await storage.set({ [STORAGE_KEY]: locale });
};

// 翻訳辞書
const translations: LocaleData = {
  ja: {},
  en: {},
  pt: {},
  es: {},
  vi: {},
  fr: {},
  ru: {},
};

// ロケール設定（ストレージ連携版）
export const setLocale = async (locale: SupportedLocale): Promise<void> => {
  currentLocale = locale;
  await saveLocaleToStorage(locale);
};

// 現在のロケール取得
export const getLocale = (): SupportedLocale => {
  return currentLocale;
};

// ブラウザ言語検出
export const detectBrowserLanguage = (): SupportedLocale => {
  const lang = navigator.language.substring(0, 2);
  if (
    lang === "ja" ||
    lang === "en" ||
    lang === "pt" ||
    lang === "es" ||
    lang === "vi" ||
    lang === "fr" ||
    lang === "ru"
  ) {
    return lang as SupportedLocale;
  }
  return "en";
};

// 翻訳辞書登録
export const registerTranslations = (
  locale: SupportedLocale,
  data: Translations
): void => {
  Object.assign(translations[locale], data);
};

// locale対応日付フォーマット関数
export const formatDate = (
  date: Date,
  options?: Intl.DateTimeFormatOptions
): string => {
  const localeMap = {
    ja: "ja-JP",
    en: "en-US",
    pt: "pt-BR",
    es: "es-ES",
    vi: "vi-VN",
    fr: "fr-FR",
    ru: "ru-RU",
  };
  return date.toLocaleString(localeMap[currentLocale], options);
};

export const formatDateShort = (date: Date): string => {
  const localeMap = {
    ja: "ja-JP",
    en: "en-US",
    pt: "pt-BR",
    es: "es-ES",
    vi: "vi-VN",
    fr: "fr-FR",
    ru: "ru-RU",
  };
  return date.toLocaleDateString(localeMap[currentLocale]);
};

// タグ付きテンプレートリテラル関数
export const t = (strings: TemplateStringsArray, ...values: any[]): string => {
  let result = "";

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];

    if (i < values.length) {
      const value = values[i];
      // fallback: current locale → en → key name
      if (typeof value === "string") {
        result +=
          translations[currentLocale][value] ||
          translations["en"][value] ||
          value;
      } else {
        result += value;
      }
    }
  }

  return result;
};
