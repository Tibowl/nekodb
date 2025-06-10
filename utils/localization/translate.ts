export type Language = "en" | "ja" | "ko"
export type TranslationTable = Record<Language, string>

export const availableLanguages: Language[] = ["en", "ja", "ko"]

export function translate(tableName: string, key: string, fallback?: string): TranslationTable {
  const result: TranslationTable = {
    en: translateKey(tableName, key, "en", fallback),
    ja: translateKey(tableName, key, "ja", fallback),
    ko: translateKey(tableName, key, "ko", fallback)
  }
  return result
}

function translateKey(tableName: string, key: string, lang: Language, fallback?: string): string {
  const table = getTable(tableName, lang)
  return table[key] ?? fallback ?? key
}

function getTable(tableName: string, lang: Language) {
  const file = require(`../../NekoAtsume2Data/localization/${lang}/${tableName}.json`)
  return file as Record<string, string>
}