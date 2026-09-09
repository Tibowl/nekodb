export const GOODIE_INSTANT_CAMERA = 337

/**
 * Damage state used by analyzer / gameplay calculations. Sprite selection has
 * no special cases; see `goodieAssetSuffix` in ./getSuffixes.
 */
export function effectiveItemDamageState(
  itemId: number,
  itemDamageState: number
): number {
  return itemId === GOODIE_INSTANT_CAMERA && itemDamageState === 2 ? 0 : itemDamageState
}
