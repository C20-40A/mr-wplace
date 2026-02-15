#!/usr/bin/env bun
/**
 * i18n CLI - Manage translation keys across all locale files
 *
 * Usage:
 *   bun scripts/i18n.ts list                          - Show key count per language
 *   bun scripts/i18n.ts missing [--base en]           - Show missing keys per language
 *   bun scripts/i18n.ts get <key>                     - Show value of key in all languages
 *   bun scripts/i18n.ts search <pattern>              - Search keys/values by regex
 *   bun scripts/i18n.ts add <key> --en "val" --ja "val" ...  - Add key to specified languages
 *   bun scripts/i18n.ts remove <key>                  - Remove key from all languages
 *   bun scripts/i18n.ts update <key> --<lang> "val"   - Update key value in specified languages
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";

const LOCALES_DIR = resolve(dirname(import.meta.path), "../src/i18n/locales");

const LANGS = ["en", "ja", "de", "es", "fr", "pt", "ru", "vi"] as const;
type Lang = (typeof LANGS)[number];

const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  ja: "日本語",
  de: "Deutsch",
  es: "Español",
  fr: "Français",
  pt: "Português",
  ru: "Русский",
  vi: "Tiếng Việt",
};

// --- File I/O ---

const localePath = (lang: Lang) => resolve(LOCALES_DIR, `${lang}.ts`);

const readLocaleFile = (lang: Lang): string => readFileSync(localePath(lang), "utf-8");

/** Parse a locale .ts file into { key: value } entries preserving order */
const parseLocale = (lang: Lang): Map<string, string> => {
  const content = readLocaleFile(lang);
  const entries = new Map<string, string>();
  // Match key: "value" or key: 'value' patterns (handles escaped quotes)
  const re = /^\s+(\w+):\s*"((?:[^"\\]|\\.)*)"/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) entries.set(m[1], m[2]);
  // Also match single-quoted values
  const reSingle = /^\s+(\w+):\s*'((?:[^'\\]|\\.)*)'/gm;
  while ((m = reSingle.exec(content))) {
    if (!entries.has(m[1])) entries.set(m[1], m[2]);
  }
  return entries;
};

/** Add a key-value pair to a locale file (before the closing `};`) */
const addEntry = (lang: Lang, key: string, value: string) => {
  let content = readLocaleFile(lang);
  // Check if key already exists
  const existing = parseLocale(lang);
  if (existing.has(key)) {
    console.error(`  ✗ Key "${key}" already exists in ${lang}.ts (use 'update' instead)`);
    return false;
  }
  // Insert before the final `};`
  const escaped = value.replace(/"/g, '\\"');
  content = content.replace(/\n};?\s*$/, `\n  ${key}: "${escaped}",\n};\n`);
  writeFileSync(localePath(lang), content, "utf-8");
  return true;
};

/** Remove a key from a locale file */
const removeEntry = (lang: Lang, key: string): boolean => {
  let content = readLocaleFile(lang);
  // Match the full line including the key
  const re = new RegExp(`^\\s+${key}:\\s*["'].*["'],?\\n`, "m");
  if (!re.test(content)) return false;
  content = content.replace(re, "");
  writeFileSync(localePath(lang), content, "utf-8");
  return true;
};

/** Update a key's value in a locale file */
const updateEntry = (lang: Lang, key: string, value: string): boolean => {
  let content = readLocaleFile(lang);
  const escaped = value.replace(/"/g, '\\"');
  const re = new RegExp(`^(\\s+${key}:\\s*)"(?:[^"\\\\]|\\\\.)*"`, "m");
  if (!re.test(content)) return false;
  content = content.replace(re, `$1"${escaped}"`);
  writeFileSync(localePath(lang), content, "utf-8");
  return true;
};

// --- Commands ---

const cmdList = () => {
  console.log("Language    Keys   File");
  console.log("─".repeat(40));
  for (const lang of LANGS) {
    const entries = parseLocale(lang);
    const name = `${lang} (${LANG_NAMES[lang]})`;
    console.log(`${name.padEnd(20)} ${String(entries.size).padStart(4)}   ${lang}.ts`);
  }
};

const cmdMissing = (baseLang: Lang = "en") => {
  const base = parseLocale(baseLang);
  const baseKeys = [...base.keys()];
  let totalMissing = 0;

  for (const lang of LANGS) {
    if (lang === baseLang) continue;
    const entries = parseLocale(lang);
    const missing = baseKeys.filter((k) => !entries.has(k));
    if (missing.length === 0) {
      console.log(`${lang}: ✓ all keys present`);
    } else {
      totalMissing += missing.length;
      console.log(`${lang}: ${missing.length} missing key(s)`);
      for (const k of missing) console.log(`  - ${k}: "${base.get(k)}"`);
    }
  }

  // Also check for extra keys not in base
  for (const lang of LANGS) {
    if (lang === baseLang) continue;
    const entries = parseLocale(lang);
    const extra = [...entries.keys()].filter((k) => !base.has(k));
    if (extra.length > 0) {
      console.log(`\n${lang}: ${extra.length} extra key(s) not in ${baseLang}`);
      for (const k of extra) console.log(`  + ${k}: "${entries.get(k)}"`);
    }
  }

  if (totalMissing === 0) console.log("\n✓ All languages are fully translated");
  else console.log(`\n✗ ${totalMissing} total missing translations`);
};

const cmdGet = (key: string) => {
  let found = false;
  for (const lang of LANGS) {
    const entries = parseLocale(lang);
    const val = entries.get(key);
    if (val !== undefined) {
      found = true;
      console.log(`${lang}: "${val}"`);
    } else {
      console.log(`${lang}: (not found)`);
    }
  }
  if (!found) console.log(`\nKey "${key}" not found in any language`);
};

const cmdSearch = (pattern: string) => {
  const re = new RegExp(pattern, "i");
  let count = 0;
  for (const lang of LANGS) {
    const entries = parseLocale(lang);
    const matches: [string, string][] = [];
    for (const [k, v] of entries) {
      if (re.test(k) || re.test(v)) matches.push([k, v]);
    }
    if (matches.length > 0) {
      console.log(`\n${lang} (${matches.length} matches):`);
      for (const [k, v] of matches) {
        console.log(`  ${k}: "${v}"`);
        count++;
      }
    }
  }
  if (count === 0) console.log(`No matches for "${pattern}"`);
};

const cmdAdd = (key: string, values: Partial<Record<Lang, string>>) => {
  const langs = Object.keys(values) as Lang[];
  if (langs.length === 0) {
    console.error("Error: No language values specified. Use --en \"value\" --ja \"value\" etc.");
    process.exit(1);
  }
  console.log(`Adding key "${key}":`);
  for (const lang of langs) {
    const val = values[lang]!;
    const ok = addEntry(lang, key, val);
    if (ok) console.log(`  ✓ ${lang}: "${val}"`);
  }
};

const cmdRemove = (key: string) => {
  console.log(`Removing key "${key}":`);
  for (const lang of LANGS) {
    const ok = removeEntry(lang, key);
    console.log(`  ${ok ? "✓" : "·"} ${lang}${ok ? "" : " (not found)"}`);
  }
};

const cmdUpdate = (key: string, values: Partial<Record<Lang, string>>) => {
  const langs = Object.keys(values) as Lang[];
  if (langs.length === 0) {
    console.error("Error: No language values specified. Use --en \"value\" --ja \"value\" etc.");
    process.exit(1);
  }
  console.log(`Updating key "${key}":`);
  for (const lang of langs) {
    const val = values[lang]!;
    const ok = updateEntry(lang, key, val);
    if (ok) console.log(`  ✓ ${lang}: "${val}"`);
    else console.log(`  ✗ ${lang}: key not found (use 'add' instead)`);
  }
};

// --- CLI arg parsing ---

const parseLangArgs = (args: string[]): Partial<Record<Lang, string>> => {
  const values: Partial<Record<Lang, string>> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const lang = arg.slice(2) as Lang;
      if (LANGS.includes(lang) && i + 1 < args.length) {
        values[lang] = args[++i];
      }
    }
  }
  return values;
};

// --- Main ---

const [cmd, ...rest] = process.argv.slice(2);

switch (cmd) {
  case "list":
  case "ls":
    cmdList();
    break;

  case "missing":
  case "diff": {
    const baseIdx = rest.indexOf("--base");
    const baseLang = baseIdx >= 0 ? (rest[baseIdx + 1] as Lang) : "en";
    cmdMissing(baseLang);
    break;
  }

  case "get": {
    const key = rest[0];
    if (!key) {
      console.error("Usage: bun scripts/i18n.ts get <key>");
      process.exit(1);
    }
    cmdGet(key);
    break;
  }

  case "search":
  case "find": {
    const pattern = rest[0];
    if (!pattern) {
      console.error("Usage: bun scripts/i18n.ts search <pattern>");
      process.exit(1);
    }
    cmdSearch(pattern);
    break;
  }

  case "add": {
    const key = rest[0];
    if (!key) {
      console.error("Usage: bun scripts/i18n.ts add <key> --en \"value\" --ja \"value\" ...");
      process.exit(1);
    }
    cmdAdd(key, parseLangArgs(rest.slice(1)));
    break;
  }

  case "remove":
  case "rm": {
    const key = rest[0];
    if (!key) {
      console.error("Usage: bun scripts/i18n.ts remove <key>");
      process.exit(1);
    }
    cmdRemove(key);
    break;
  }

  case "update":
  case "set": {
    const key = rest[0];
    if (!key) {
      console.error("Usage: bun scripts/i18n.ts update <key> --en \"value\" --ja \"value\" ...");
      process.exit(1);
    }
    cmdUpdate(key, parseLangArgs(rest.slice(1)));
    break;
  }

  default:
    console.log(`i18n CLI - Manage translation keys

Commands:
  list                              Show key count per language
  missing [--base en]               Show missing keys compared to base language
  get <key>                         Show value of key in all languages
  search <pattern>                  Search keys/values by regex pattern
  add <key> --en "val" --ja "val"   Add key to specified languages
  remove <key>                      Remove key from all languages
  update <key> --en "val"           Update key value in specified languages

Languages: ${LANGS.join(", ")}
`);
}
