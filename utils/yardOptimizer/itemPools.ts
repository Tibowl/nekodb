import {
  DEFAULT_ALLOWED_FOODS_INDOOR,
  DEFAULT_ALLOWED_FOODS_OUTDOOR,
} from "./config"
import { goodieById, goodies } from "./gameData"
import type { ItemPools } from "./types"

export type DefaultItemPoolsOptions = {
  /**
   * When true, exclude goodies that have a seasonal shop window (`SellableMonths`) but are
   * **not** active this calendar month. All other toys (non-seasonal + in-season seasonal) stay
   * in the random pool — this does not shrink the pool to only current-month seasonal items.
   */
  seasonalOnly?: boolean
  /** Calendar month 1–12; defaults to the current month in the local timezone. */
  month?: number
}

function sellableInMonth(
  g: { SellableMonths?: number[] | null },
  month1to12: number
): boolean {
  const m = g.SellableMonths
  return Array.isArray(m) && m.length > 0 && m.includes(month1to12)
}

export function isOptimizerGoodie(g: {
  Id: number
  IsDebug: boolean
  IsForceNotForSale: boolean
  Category: number
}): boolean {
  return !g.IsDebug && !g.IsForceNotForSale && g.Id > 10 && g.Category !== 1
}

/**
 * True if the goodie is a seasonal-shop item and the given month is **not** in its window
 * (off-season for the shop).
 */
export function isOffSeasonSeasonalShopGoodie(
  g: { SellableMonths?: number[] | null },
  month1to12: number
): boolean {
  const m = g.SellableMonths
  if (!Array.isArray(m) || m.length === 0) return false
  return !m.includes(month1to12)
}

/** Non-food toy IDs whose `SellableMonths` includes `month` (in-season seasonal shop). Sorted ascending. */
export function seasonalToyIdsForMonth(month1to12?: number): number[] {
  const month = month1to12 ?? new Date().getMonth() + 1
  return goodies
    .filter(isOptimizerGoodie)
    .filter((g) => sellableInMonth(g, month))
    .map((g) => g.Id)
    .sort((a, b) => a - b)
}

/** Non-food toy IDs that have `SellableMonths` but not this month (excluded when seasonal filter is on). */
export function inactiveSeasonalToyIdsForMonth(month1to12?: number): number[] {
  const month = month1to12 ?? new Date().getMonth() + 1
  return goodies
    .filter(isOptimizerGoodie)
    .filter((g) => isOffSeasonSeasonalShopGoodie(g, month))
    .map((g) => g.Id)
    .sort((a, b) => a - b)
}

/**
 * Yard slot width: large goodies use two of five placement units per side (`PLACES_*`).
 * Same rule as the goodies page — `Attribute === 0` → small, else large (`GoodsAttribute.IsLarge`).
 */
export function goodieIsLargeForYard(g: { Attribute: number }): boolean {
  return g.Attribute !== 0
}

export function defaultItemPools(options?: DefaultItemPoolsOptions): ItemPools {
  const toyGoods = goodies.filter(isOptimizerGoodie)
  const toyIds = toyGoods.map((g) => g.Id)
  let poolIds = toyIds
  if (options?.seasonalOnly) {
    const month = options.month ?? new Date().getMonth() + 1
    poolIds = toyIds.filter((id) => {
      const g = goodieById.get(id)
      if (!g) return true
      return !isOffSeasonSeasonalShopGoodie(g, month)
    })
  }
  const largeItems = poolIds.filter((id) => goodieIsLargeForYard(goodieById.get(id)!))
  const smallItems = poolIds.filter((id) => !goodieIsLargeForYard(goodieById.get(id)!))
  return {
    largeItems,
    smallItems,
    allowedFoodsIndoor: [...DEFAULT_ALLOWED_FOODS_INDOOR],
    allowedFoodsOutdoor: [...DEFAULT_ALLOWED_FOODS_OUTDOOR],
  }
}
