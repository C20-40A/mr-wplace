import { registerTranslations } from "./index";
import { enTranslations } from "./locales/en";
import { esTranslations } from "./locales/es";
import { jaTranslations } from "./locales/ja";
import { ptTranslations } from "./locales/pt";

// 翻訳辞書を登録
registerTranslations("ja", jaTranslations);
registerTranslations("en", enTranslations);
registerTranslations("pt", ptTranslations);
registerTranslations("es", esTranslations);
