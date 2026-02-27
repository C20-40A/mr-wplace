import { storage } from "@/utils/browser-api";

// サポート対象ロケール型定義
export type SupportedLocale =
  | "ja"
  | "en"
  | "de"
  | "pt"
  | "es"
  | "vi"
  | "fr"
  | "ru";

// 翻訳辞書の型定義
export interface Translations {
  [key: string]: string;
}

export interface LocaleData {
  ja: Translations;
  en: Translations;
  de: Translations;
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

const isSupportedLocale = (locale: unknown): locale is SupportedLocale => {
  return (
    locale === "ja" ||
    locale === "en" ||
    locale === "de" ||
    locale === "pt" ||
    locale === "es" ||
    locale === "vi" ||
    locale === "fr" ||
    locale === "ru"
  );
};

// ストレージから設定を読み込み（成功時true）
export const loadLocaleFromStorage = async (): Promise<boolean> => {
  const result = await storage.get([STORAGE_KEY]);
  const storedLocale = result[STORAGE_KEY] as SupportedLocale | undefined;
  if (isSupportedLocale(storedLocale)) {
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
  de: {},
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
  if (isSupportedLocale(lang)) return lang;
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
    de: "de-DE",
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
    de: "de-DE",
    pt: "pt-BR",
    es: "es-ES",
    vi: "vi-VN",
    fr: "fr-FR",
    ru: "ru-RU",
  };
  return date.toLocaleDateString(localeMap[currentLocale]);
};

// タグ付きテンプレートリテラル関数（通常の関数呼び出しも許可）
export function t(strings: TemplateStringsArray, ...values: any[]): string;
export function t(key: string): string;
export function t(
  stringsOrKey: TemplateStringsArray | string,
  ...values: any[]
): string {
  // Function call syntax: t("key")
  if (typeof stringsOrKey === "string") {
    return (
      translations[currentLocale][stringsOrKey] ||
      translations["en"][stringsOrKey] ||
      stringsOrKey
    );
  }

  // Tagged template syntax: t`...`
  let result = "";
  const strings = stringsOrKey;

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
}
