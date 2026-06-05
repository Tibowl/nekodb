import {
  PLACES_INDOOR,
  PLACES_OUTDOOR,
  GA_EVOLUTION_SOLVER_TIER,
} from "./config"
import type {
  FitnessContext,
  FixedIndoorHalf,
  FixedOutdoorHalf,
} from "./fitness"
import {
  assignValue,
  type SolverTier,
  yardFitnessBetter,
  yardFitnessCompareDesc,
} from "./fitness"
import type { ItemPools, YardState } from "./types"
import { yardStructureError } from "./yardLayoutRules"
import { buildYardThroughOpenSlots } from "./yardSlotBuilder"
import { yardSignature } from "./yardSignature"

export { yardSignature } from "./yardSignature"
export {
  defaultItemPools,
  goodieIsLargeForYard,
  inactiveSeasonalToyIdsForMonth,
  isOffSeasonSeasonalShopGoodie,
  isOptimizerGoodie,
  seasonalToyIdsForMonth,
  type DefaultItemPoolsOptions,
} from "./itemPools"

export type { ItemPools, YardWithUsed } from "./types"

export function validateYard(
  y: YardState,
  placesIndoor = PLACES_INDOOR,
  placesOutdoor = PLACES_OUTDOOR
): void {
  const err = yardStructureError(y, placesIndoor, placesOutdoor)
  if (err) throw new Error(err)
}

function applyFixedOutdoor(y: YardState, f: FixedOutdoorHalf): YardState {
  return {
    ...y,
    foodTypeOutdoor: f.foodTypeOutdoor,
    outdoorLarge: new Set(f.outdoorLarge),
    outdoorSmall: new Set(f.outdoorSmall),
  }
}

function applyFixedIndoor(y: YardState, f: FixedIndoorHalf): YardState {
  return {
    ...y,
    foodTypeIndoor: f.foodTypeIndoor,
    indoorLarge: new Set(f.indoorLarge),
    indoorSmall: new Set(f.indoorSmall),
  }
}

/** Reattach pinned halves after crossover/mutation. */
export function mergeFixedHalvesIntoYard(ctx: FitnessContext, y: YardState): YardState {
  let next = y
  if (ctx.fixedOutdoor) {
    next = applyFixedOutdoor(next, ctx.fixedOutdoor)
  }
  if (ctx.fixedIndoor) {
    next = applyFixedIndoor(next, ctx.fixedIndoor)
  }
  return next
}

/**
 * Random valid layout without mean-field scoring.
 * Use with parallel `assignValue` batches in hybrid search.
 */
export function generateYardStateUnscored(
  ctx: FitnessContext,
  pools: ItemPools
): YardState {
  const y = buildYardThroughOpenSlots(ctx, pools)
  validateYard(y)
  return y
}

export function mergePool(
  existing: YardState[],
  incoming: YardState[],
  poolSize: number
): YardState[] {
  const map = new Map<string, YardState>()
  const add = (y: YardState) => {
    const s = yardSignature(y)
    const prev = map.get(s)
    if (!prev || yardFitnessBetter(y, prev)) map.set(s, y)
  }
  for (const y of existing) add(y)
  for (const y of incoming) add(y)
  return [...map.values()]
    .sort(yardFitnessCompareDesc)
    .slice(0, poolSize)
}

/**
 * Score a user-edited layout with the GA evolution tier and merge
 * it into the genetic pool so **Continue** seeds the next generations with that layout.
 */
export function mergeUserLayoutIntoGeneticPool(
  ctx: FitnessContext,
  pool: YardState[],
  poolSize: number,
  yard: YardState,
  solverTier: SolverTier = GA_EVOLUTION_SOLVER_TIER
): YardState[] {
  const merged = mergeFixedHalvesIntoYard(ctx, cloneYard(yard))
  validateYard(merged)
  assignValue(ctx, merged, { solverTier })
  return mergePool(pool, [merged], poolSize)
}

export function cloneYard(y: YardState): YardState {
  return {
    foodTypeIndoor: y.foodTypeIndoor,
    foodTypeOutdoor: y.foodTypeOutdoor,
    indoorLarge: new Set(y.indoorLarge),
    indoorSmall: new Set(y.indoorSmall),
    outdoorLarge: new Set(y.outdoorLarge),
    outdoorSmall: new Set(y.outdoorSmall),
    value: y.value,
    valueSecondary: y.valueSecondary,
    requirementPenalty: y.requirementPenalty,
    mementoUnreachableTargets: y.mementoUnreachableTargets,
    hardRejectLevel: y.hardRejectLevel,
  }
}
