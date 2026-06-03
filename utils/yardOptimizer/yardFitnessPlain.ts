import type { YardState } from "./types"

/** Structured-clone friendly copy of {@link YardState} (no `Set`). */
export type PlainYard = {
  foodTypeIndoor: number
  foodTypeOutdoor: number
  indoorLarge: number[]
  indoorSmall: number[]
  outdoorLarge: number[]
  outdoorSmall: number[]
  value: number
  valueSecondary: number
  requirementPenalty?: number
  mementoUnreachableTargets?: number
  hardRejectLevel?: number
}

export function yardToPlain(y: YardState): PlainYard {
  return {
    foodTypeIndoor: y.foodTypeIndoor,
    foodTypeOutdoor: y.foodTypeOutdoor,
    indoorLarge: [...y.indoorLarge],
    indoorSmall: [...y.indoorSmall],
    outdoorLarge: [...y.outdoorLarge],
    outdoorSmall: [...y.outdoorSmall],
    value: y.value,
    valueSecondary: y.valueSecondary,
    requirementPenalty: y.requirementPenalty,
    mementoUnreachableTargets: y.mementoUnreachableTargets,
    hardRejectLevel: y.hardRejectLevel,
  }
}

export function plainToYard(p: PlainYard): YardState {
  return {
    foodTypeIndoor: p.foodTypeIndoor,
    foodTypeOutdoor: p.foodTypeOutdoor,
    indoorLarge: new Set(p.indoorLarge),
    indoorSmall: new Set(p.indoorSmall),
    outdoorLarge: new Set(p.outdoorLarge),
    outdoorSmall: new Set(p.outdoorSmall),
    value: p.value,
    valueSecondary: p.valueSecondary,
    requirementPenalty: p.requirementPenalty,
    mementoUnreachableTargets: p.mementoUnreachableTargets,
    hardRejectLevel: p.hardRejectLevel,
  }
}
