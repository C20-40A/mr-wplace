import { registerTranslations } from "./index";
import { enTranslations } from "./locales/en";
import { esTranslations } from "./locales/es";
import { jaTranslations } from "./locales/ja";
import { ptTranslations } from "./locales/pt";
import { viTranslations } from "./locales/vi";
import { frTranslations } from "./locales/fr";
import { ruTranslations } from "./locales/ru";

// 翻訳辞書を登録
registerTranslations("ja", jaTranslations);
registerTranslations("en", enTranslations);
registerTranslations("pt", ptTranslations);
registerTranslations("es", esTranslations);
registerTranslations("vi", viTranslations);
registerTranslations("fr", frTranslations);
registerTranslations("ru", ruTranslations);
