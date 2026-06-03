// Goodies with non-standard damage-state handling. Most quirks are sprite/asset
// picks (cosmetic); only one is a gameplay rule (analyzer).

// Bunny Bed DX: RepairPattern 2 but shares a `_repair_break` asset (cosmetic only).
export const GOODIE_BUNNY_BED_DX = 320
// Shoji Screen Stand: RepairPattern -2; only `""` and `_break` sprites exist (cosmetic only).
export const GOODIE_SHOJI_SCREEN_STAND = 332
// Instant Camera: RepairPattern -2 with a `_repair_break` sprite (cosmetic), AND
// the analyzer treats damage state 2 as state 0 — see effectiveItemDamageState below.
export const GOODIE_INSTANT_CAMERA = 337

/**
 * Damage state used by analyzer / gameplay calculations.
 *
 * Currently the only gameplay quirk: Instant Camera (337) at state 2 is treated
 * as state 0. All other quirks for the IDs above are purely cosmetic — see
 * `goodieDamageSuffix` in YardPreviewView.tsx and `getSuffixes` in ./getSuffixes.ts.
 */
export function effectiveItemDamageState(
  itemId: number,
  itemDamageState: number
): number {
  return itemId === GOODIE_INSTANT_CAMERA && itemDamageState === 2 ? 0 : itemDamageState
}
