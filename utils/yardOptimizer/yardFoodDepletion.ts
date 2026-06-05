import type { TubbsMode } from "./tubbsMode"
import { shouldRefillOutdoorBowlSim } from "./tubbsEconomy"

const EMPTY_CAT_ID = -1

export type TubbsOccupancyState = {
  occupant: Record<number, number>
  stay: Record<number, number>
  catCooldown: Record<number, number>
}

/**
 * Per-bowl food state, attached to {@link YardVisitState} ONLY when a non-`off` Tubbs mode runs.
 *
 * The outdoor bowl is the single food playspace in the runtime, so it carries a real depletion
 * countdown (`remainingTicks`) and an `empty` flag. The indoor bowl is NOT a playspace in this
 * runtime (indoor food rolls are skipped), so its refill cadence is a deterministic clock —
 * `indoorRefillCountdown` ticks down and, on reaching 0, fires an indoor-refill event used to
 * gate the `kickRefill` / `graze` outdoor refill policies. No RNG is consumed by any of this.
 */
export type YardFoodState = {
  outdoor: { remainingTicks: number; empty: boolean }
  indoorRefillCountdown: number
  /**
   * Ticks elapsed since the outdoor bowl was last refilled. Food-round modes need this to cap
   * outdoor refill rate at `Ro` even when indoor checks (`Ri`) come faster.
   */
  outdoorTicksSinceRefill: number
}

export type RefillInfo = { itemId: number; isIndoor: boolean; tick: number }

export type YardFoodDepletionInit = {
  outdoorBowlDurationTicks?: number
  indoorBowlDurationTicks?: number
}

/**
 * Build the optional food state for an active Tubbs mode. Outdoor bowl starts full; the indoor
 * clock starts a full period from tick 0. Returns `undefined` when there is no outdoor bowl
 * duration to model (caller should not attach food state then).
 */
export function initYardFoodState(opts: YardFoodDepletionInit): YardFoodState | undefined {
  const outdoorDur = opts.outdoorBowlDurationTicks
  if (!(outdoorDur && outdoorDur > 0)) return undefined
  const indoorDur = opts.indoorBowlDurationTicks
  return {
    outdoor: { remainingTicks: outdoorDur, empty: false },
    indoorRefillCountdown: indoorDur && indoorDur > 0 ? indoorDur : Number.POSITIVE_INFINITY,
    outdoorTicksSinceRefill: 0,
  }
}

/** HOOK A: block new outdoor visits while the outdoor bowl is empty. */
export function outdoorVisitBlockedByEmptyBowl(
  food: YardFoodState | undefined,
  isIndoor: boolean
): boolean {
  return food !== undefined && !isIndoor && food.outdoor.empty
}

/** HOOK B: Tubbs clears the outdoor bowl on a successful visit. */
export function tubbsClearsOutdoorBowl(
  food: YardFoodState | undefined,
  params: {
    catId: number
    tubbsCatId: number | undefined
    itemId: number
    outdoorBowlItemId: number | undefined
    isIndoor: boolean
  }
): void {
  if (food === undefined) return
  if (
    params.catId === params.tubbsCatId &&
    params.itemId === params.outdoorBowlItemId &&
    !params.isIndoor
  ) {
    food.outdoor.empty = true
    food.outdoor.remainingTicks = 0
  }
}

export type YardFoodTickAdvance = {
  indoorRefilledThisTick: boolean
}

/**
 * Advance deterministic food clocks at the start of a tick. RNG-free; skipped when `food` is absent.
 */
export function advanceYardFoodClocks(
  food: YardFoodState,
  indoorBowlDurationTicks: number | undefined
): YardFoodTickAdvance {
  let indoorRefilledThisTick = false
  if (Number.isFinite(food.indoorRefillCountdown)) {
    food.indoorRefillCountdown -= 1
    if (food.indoorRefillCountdown <= 0) {
      indoorRefilledThisTick = true
      const period =
        indoorBowlDurationTicks && indoorBowlDurationTicks > 0
          ? indoorBowlDurationTicks
          : Number.POSITIVE_INFINITY
      food.indoorRefillCountdown = period
    }
  }
  if (!food.outdoor.empty && food.outdoor.remainingTicks > 0) {
    food.outdoor.remainingTicks -= 1
    if (food.outdoor.remainingTicks <= 0) {
      food.outdoor.empty = true
      food.outdoor.remainingTicks = 0
    }
  }
  food.outdoorTicksSinceRefill += 1
  return { indoorRefilledThisTick }
}

/**
 * Decide whether the OUTDOOR bowl is refilled this tick. PURE state-machine, consumes NO RNG.
 * Returns `true` iff it refilled.
 */
export function applyOutdoorBowlRefillPolicy(
  food: YardFoodState,
  mode: TubbsMode,
  params: {
    indoorRefilledThisTick: boolean
    outdoorBowlDurationTicks: number
    bowlOccupied: boolean
  }
): boolean {
  if (!food.outdoor.empty) return false
  const onFoodRound = isOutdoorBowlFoodRound(food, {
    indoorRefilledThisTick: params.indoorRefilledThisTick,
    outdoorBowlDurationTicks: params.outdoorBowlDurationTicks,
  })
  if (
    !shouldRefillOutdoorBowlSim(mode, {
      bowlOccupied: params.bowlOccupied,
      onFoodRound,
    })
  ) {
    return false
  }
  food.outdoor.empty = false
  food.outdoor.remainingTicks = params.outdoorBowlDurationTicks
  food.outdoorTicksSinceRefill = 0
  return true
}

export function isOutdoorBowlFoodRound(
  food: YardFoodState,
  params: { indoorRefilledThisTick: boolean; outdoorBowlDurationTicks: number }
): boolean {
  return (
    params.indoorRefilledThisTick ||
    food.outdoorTicksSinceRefill >= params.outdoorBowlDurationTicks
  )
}

/** Shoo Tubbs immediately after an outdoor-bowl visit (`kickSight`). */
export function tubbsKickSightAfterOutdoorBowlVisit(
  mode: TubbsMode | undefined,
  visit: {
    catId: number
    tubbsCatId: number | undefined
    itemId: number
    outdoorBowlItemId: number | undefined
    isIndoor: boolean
    playspaceId: number
  },
  state: TubbsOccupancyState,
  useCooldown: boolean,
  randomCooldownTicks: () => number
): void {
  if (mode !== "kickSight") return
  if (visit.catId !== visit.tubbsCatId) return
  if (visit.itemId !== visit.outdoorBowlItemId) return
  if (visit.isIndoor) return
  state.occupant[visit.playspaceId] = EMPTY_CAT_ID
  state.stay[visit.playspaceId] = 0
  if (useCooldown && visit.tubbsCatId !== undefined) {
    state.catCooldown[visit.tubbsCatId] = randomCooldownTicks()
  }
}

/** Shoo Tubbs at a food round before the outdoor bowl can refill (`kickRefill`). */
export function tubbsKickRefillAtFoodRound(
  mode: TubbsMode | undefined,
  params: {
    food: YardFoodState
    tubbsCatId: number | undefined
    bowlPlayspaceIds: number[] | undefined
    indoorRefilledThisTick: boolean
    outdoorBowlDurationTicks: number
  },
  state: TubbsOccupancyState,
  useCooldown: boolean,
  randomCooldownTicks: () => number,
  onTubbsEject?: (playspaceId: number, remainingStay: number) => void
): void {
  if (mode !== "kickRefill") return
  if (params.tubbsCatId === undefined) return
  const bowlCat = outdoorBowlOccupant(state.occupant, params.bowlPlayspaceIds)
  if (bowlCat !== params.tubbsCatId) return
  if (
    !isOutdoorBowlFoodRound(params.food, {
      indoorRefilledThisTick: params.indoorRefilledThisTick,
      outdoorBowlDurationTicks: params.outdoorBowlDurationTicks,
    })
  ) {
    return
  }
  for (let i = 0; i < (params.bowlPlayspaceIds?.length ?? 0); i++) {
    const pid = params.bowlPlayspaceIds![i]!
    if (state.occupant[pid] !== params.tubbsCatId) continue
    const remainingStay = state.stay[pid] ?? 0
    onTubbsEject?.(pid, remainingStay)
    state.occupant[pid] = EMPTY_CAT_ID
    state.stay[pid] = 0
    if (useCooldown) {
      state.catCooldown[params.tubbsCatId] = randomCooldownTicks()
    }
    break
  }
}

/** Which cat, if any, is still camped on the outdoor bowl after stay timers decrement. */
export function outdoorBowlOccupant(
  occupant: Record<number, number>,
  bowlPlayspaceIds: number[] | undefined
): number | null {
  if (bowlPlayspaceIds === undefined) return null
  for (let i = 0; i < bowlPlayspaceIds.length; i++) {
    const catId = occupant[bowlPlayspaceIds[i]!] ?? -1
    if (catId !== -1) return catId
  }
  return null
}

/**
 * End-of-tick outdoor refill policy. RNG-free; caller fires `onRefill` when this returns true.
 */
export function runOutdoorBowlRefillPolicy(
  food: YardFoodState,
  mode: TubbsMode,
  params: {
    tick: number
    indoorRefilledThisTick: boolean
    outdoorBowlDurationTicks: number
    outdoorBowlItemId: number | undefined
    bowlPlayspaceIds: number[] | undefined
    tubbsCatId: number | undefined
    occupant: Record<number, number>
    stay: Record<number, number>
    catCooldown: Record<number, number>
    useCooldown: boolean
    randomCooldownTicks: () => number
    onRefill?: (info: RefillInfo) => void
    onTubbsEject?: (playspaceId: number, remainingStay: number) => void
  }
): void {
  tubbsKickRefillAtFoodRound(
    mode,
    {
      food,
      tubbsCatId: params.tubbsCatId,
      bowlPlayspaceIds: params.bowlPlayspaceIds,
      indoorRefilledThisTick: params.indoorRefilledThisTick,
      outdoorBowlDurationTicks: params.outdoorBowlDurationTicks,
    },
    {
      occupant: params.occupant,
      stay: params.stay,
      catCooldown: params.catCooldown,
    },
    params.useCooldown,
    params.randomCooldownTicks,
    params.onTubbsEject
  )
  const bowlCat = outdoorBowlOccupant(params.occupant, params.bowlPlayspaceIds)
  const refilled = applyOutdoorBowlRefillPolicy(food, mode, {
    indoorRefilledThisTick: params.indoorRefilledThisTick,
    outdoorBowlDurationTicks: params.outdoorBowlDurationTicks,
    bowlOccupied: bowlCat !== null,
  })
  if (refilled && params.onRefill !== undefined) {
    params.onRefill({
      itemId: params.outdoorBowlItemId ?? -1,
      isIndoor: false,
      tick: params.tick,
    })
  }
}
