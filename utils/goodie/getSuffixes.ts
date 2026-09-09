/** Accepts both `GoodieRecord` and the slimmer `OptimizerGoodieRecord`. */
export type GoodieDamageInfo = {
  Id: number
  Toughness?: number | null
  RepairPattern?: number | null
  AnimePngs?: readonly string[] | null
}

/** Toughness 0 never leaves GoodsState.Default, so its damage sprites are unreachable. */
export function takesDamage(goodie: GoodieDamageInfo) {
  return goodie.Toughness !== 0
}

/**
 * Sprite suffix for a damage state (cosmetic; gameplay is ./itemDamageState).
 * The game picks the first asset that exists rather than reading RepairPattern,
 * but at the repair counts the site models the record predicts it — checked
 * against all 262. To list what exists, use ./server/goodieVariants.
 */
export function goodieAssetSuffix(
  goodie: GoodieDamageInfo | undefined,
  state: 0 | 1 | 2
): string {
  if (!goodie || state === 0 || !takesDamage(goodie)) return ""
  if (state === 1) return "_break"
  const repairPattern = goodie.RepairPattern ?? 0
  if (repairPattern >= 2) return "_repair_1"
  if (repairPattern >= 0) return "_repair"
  return "" // no repaired sprite at all; the game's chain runs out too
}
