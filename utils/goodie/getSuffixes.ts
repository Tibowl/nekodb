import {
  GOODIE_BUNNY_BED_DX,
  GOODIE_INSTANT_CAMERA,
  GOODIE_SHOJI_SCREEN_STAND,
} from "./itemDamageState"

/**
 * Minimal shape needed for damage-suffix logic. Accepts both `GoodieRecord`
 * (full record from `utils/tables`) and `OptimizerGoodieRecord` (the slimmer
 * yard-optimizer shape), since both expose these three fields.
 */
type GoodieDamageInfo = {
  Id: number
  Toughness?: number | null
  RepairPattern?: number | null
}

export function getSuffixes(goodie: GoodieDamageInfo) {
  if (goodie.Id == GOODIE_BUNNY_BED_DX) return [ // Bunny Bed DX
    // This goodie has RepairPattern 2 but has a shared repair_break
    "",
    "_break",
    "_repair_1",
    "_repair_2",
    "_repair_break",
  ]

  if (goodie.RepairPattern == -2) {
    // This goodie has a unique repair pattern that doesn't follow the normal rules, so we just hardcode the suffixes
    if (goodie.Id == GOODIE_SHOJI_SCREEN_STAND) return [ // Shoji Screen Stand
      "",
      "_break",
    ]

    if (goodie.Id == GOODIE_INSTANT_CAMERA) return [ // Instant Camera
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

  for (let i = 1; i < (goodie.RepairPattern ?? 0) + 1; i++) {
    patterns.push(`_repair_${i}`)
    patterns.push(`_repair_${i}_break`)
  }

  return patterns
}

/**
 * Picks the single suffix from `getSuffixes(goodie)` to render at a given
 * damage state. Purely cosmetic — drives which PNG/XML is loaded. For
 * analyzer/gameplay state mapping see `effectiveItemDamageState` in
 * ./itemDamageState.
 */
export function goodieAssetSuffix(
  goodie: GoodieDamageInfo | undefined,
  state: 0 | 1 | 2
): string {
  if (!goodie) return ""
  // Shoji Screen Stand and Instant Camera render their base sprite at state 2.
  // (Instant Camera also has a gameplay quirk that mirrors this; Shoji is
  // cosmetic only.)
  const cosmeticState =
    state === 2 &&
    (goodie.Id === GOODIE_SHOJI_SCREEN_STAND || goodie.Id === GOODIE_INSTANT_CAMERA)
      ? 0
      : state
  const suffixes = getSuffixes(goodie)
  return suffixes[cosmeticState] ?? suffixes[0] ?? ""
}
