export type YardState = {
  foodTypeIndoor: number
  foodTypeOutdoor: number
  indoorLarge: Set<number>
  indoorSmall: Set<number>
  outdoorLarge: Set<number>
  outdoorSmall: Set<number>
  /** Primary fitness (what we maximize first). */
  value: number
  /** Tiebreaker when primary scores tie; higher is better. */
  valueSecondary: number
  /** Minimum-requirement penalty used by ranking; lower is better. */
  requirementPenalty?: number
  /** Selected target cats with no finite modeled memento wait; lower is better. */
  mementoUnreachableTargets?: number
  /** Hard reject ranking level. 0 = scored, 1 = hard rule reject, 2 = invalid yard shape. */
  hardRejectLevel?: number
}

export type ItemPools = {
  largeItems: number[]
  smallItems: number[]
  allowedFoodsIndoor: readonly number[]
  allowedFoodsOutdoor: readonly number[]
}

/** Yard with cached `used` set (crossover / mutation). */
export type YardWithUsed = YardState & { used: Set<number> }
