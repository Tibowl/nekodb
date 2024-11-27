import { GoodieRecord } from "../tables"

export function getSuffixes(goodie: GoodieRecord) {
  if (goodie.Toughness == 0) return [""]
  if (goodie.RepairPattern == 0) return [
    "",
    "_break",
    "_repair",
  ]

  if (goodie.RepairPattern == 1) return [
    "",
    "_break",
    "_repair",
    "_repair_break",
  ]

  const patterns = [
    "",
    "_break",
  ]

  for (let i = 1; i < goodie.RepairPattern + 1; i++) {
    patterns.push(`_repair_${i}`)
    patterns.push(`_repair_${i}_break`)
  }

  return patterns
}
  