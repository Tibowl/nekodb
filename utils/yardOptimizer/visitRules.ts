export const FIRST_FOOD_ITEM_ID = 1
export const LAST_FOOD_ITEM_ID = 7

export function isFoodItemId(itemId: number): boolean {
  return (
    Number.isInteger(itemId) &&
    itemId >= FIRST_FOOD_ITEM_ID &&
    itemId <= LAST_FOOD_ITEM_ID
  )
}

export const FROSTY_CAT_ID = 116
export const FROSTY_NON_WINTER_PLAYSPACE_ID = 1310

export function isWinterWeatherForFrosty(weather: string): boolean {
  return weather === "Winter" || weather === "Snow"
}

export function canCatAppearOnPlayspace(
  catId: number,
  playspaceId: number,
  weather: string
): boolean {
  if (catId !== FROSTY_CAT_ID) return true
  if (isWinterWeatherForFrosty(weather)) return true
  return playspaceId === FROSTY_NON_WINTER_PLAYSPACE_ID
}

export const SAPPHIRE_CAT_ID = 117
export const JEEVES_CAT_ID = 118

export type CompanionVisitRule = {
  triggerCatId: number
  companionCatId: number
}

export const COMPANION_VISIT_RULES: readonly CompanionVisitRule[] = [
  { triggerCatId: SAPPHIRE_CAT_ID, companionCatId: JEEVES_CAT_ID },
]
