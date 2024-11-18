type Language = "en" | "ja"

export function translate(tableName: string, key: string, lang: Language) {
  const table = getTable(tableName, lang)
  return table[key] ?? key
}

function getTable(tableName: string, lang: Language) {
  const file = require(`../NekoAtsume2Data/localization/${lang}/${tableName}.json`)
  return file as Record<string, string>
}