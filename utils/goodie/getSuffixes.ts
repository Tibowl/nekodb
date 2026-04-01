import { GoodieRecord } from "../tables"

export function getSuffixes(goodie: GoodieRecord) {
  if (goodie.Id == 320) return [ // Bunny Bed DX
    // This goodie has RepairPattern 2 but has a shared repair_break
    "",
    "_break",
    "_repair_1",
    "_repair_2",
    "_repair_break",
  ]

  if (goodie.RepairPattern == -2) {
    // This goodie has a unique repair pattern that doesn't follow the normal rules, so we just hardcode the suffixes
    if (goodie.Id == 332) return [ // Shoji Screen Stand
      "",
      "_break",
    ]

    if (goodie.Id == 337) return [ // Instant Camera
      "",
      "_break",
      "_repair_break",
    ]
    throw new Error(`Goodie with id ${goodie.Id} has RepairPattern -2 but is not handled in getSuffixes`)
  }

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
