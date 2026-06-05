import {
  PLACES_INDOOR,
  PLACES_OUTDOOR,
  tournamentSelectionSize,
  type GeneticConfig,
} from "./config"
import type { FitnessContext, SolverTier } from "./fitness"
import { assignValue, yardFitnessBetter } from "./fitness"
import type { ItemPools, YardState, YardWithUsed } from "./types"
import { buildYardThroughOpenSlots } from "./yardSlotBuilder"
import { cloneYard, validateYard } from "./yardCore"

function getUsed(y: YardState): Set<number> {
  return new Set([
    ...y.indoorLarge,
    ...y.indoorSmall,
    ...y.outdoorLarge,
    ...y.outdoorSmall,
  ])
}

function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomBool(p: number): boolean {
  return Math.random() < p
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

function crossoverSets(
  left: Set<number>,
  right: Set<number>,
  leftUsed: Set<number>,
  rightUsed: Set<number>
): [Set<number>, Set<number>] {
  if (left.size === 0) return [new Set(left), new Set(right)]
  if (left.size !== right.size) {
    throw new Error("crossoverSets length mismatch")
  }
  const l = [...left]
  const r = [...right]
  const swaps = randInt(0, l.length - 1)
  for (let i = 0; i < swaps; i++) {
    const swapIndex = randInt(0, l.length - 1)
    const tmp = l[swapIndex]!
    if (rightUsed.has(tmp) || leftUsed.has(r[swapIndex]!)) continue
    l[swapIndex] = r[swapIndex]!
    r[swapIndex] = tmp
  }
  return [new Set(l), new Set(r)]
}

function tryFinalizeYard(
  ctx: FitnessContext,
  y: YardState,
  solverTier: SolverTier | null = "full",
  pools?: ItemPools
): YardState | null {
  try {
    const finalized = pools ? buildYardThroughOpenSlots(ctx, pools, y) : y
    validateYard(finalized)
    if (solverTier != null) assignValue(ctx, finalized, { solverTier })
    return finalized
  } catch {
    return null
  }
}

/** Attach `.used` for crossover bookkeeping. */
export function withUsed(y: YardState): YardWithUsed {
  return Object.assign(y, { used: getUsed(y) })
}

export function crossoverMutation(
  ctx: FitnessContext,
  pools: ItemPools,
  left: YardWithUsed,
  right: YardWithUsed,
  solverTier: SolverTier | null = "full"
): YardState[] {
  let crossed = false
  let aIndoorL: Set<number>
  let bIndoorL: Set<number>
  let aIndoorS: Set<number>
  let bIndoorS: Set<number>
  if (left.indoorLarge.size === right.indoorLarge.size) {
    ;[aIndoorL, bIndoorL] = crossoverSets(
      left.indoorLarge,
      right.indoorLarge,
      left.used,
      right.used
    )
    ;[aIndoorS, bIndoorS] = crossoverSets(
      left.indoorSmall,
      right.indoorSmall,
      left.used,
      right.used
    )
    crossed = true
  } else {
    aIndoorL = new Set(left.indoorLarge)
    bIndoorL = new Set(right.indoorLarge)
    aIndoorS = new Set(left.indoorSmall)
    bIndoorS = new Set(right.indoorSmall)
  }

  let aOutdoorL: Set<number>
  let bOutdoorL: Set<number>
  let aOutdoorS: Set<number>
  let bOutdoorS: Set<number>
  if (left.outdoorLarge.size === right.outdoorLarge.size) {
    ;[aOutdoorL, bOutdoorL] = crossoverSets(
      left.outdoorLarge,
      right.outdoorLarge,
      left.used,
      right.used
    )
    ;[aOutdoorS, bOutdoorS] = crossoverSets(
      left.outdoorSmall,
      right.outdoorSmall,
      left.used,
      right.used
    )
    crossed = true
  } else {
    aOutdoorL = new Set(left.outdoorLarge)
    bOutdoorL = new Set(right.outdoorLarge)
    aOutdoorS = new Set(left.outdoorSmall)
    bOutdoorS = new Set(right.outdoorSmall)
  }

  if (!crossed) return []

  const [aFoodIn, bFoodIn] = randomBool(0.5)
    ? [right.foodTypeIndoor, left.foodTypeIndoor]
    : [left.foodTypeIndoor, right.foodTypeIndoor]
  const [aFoodOut, bFoodOut] = randomBool(0.5)
    ? [right.foodTypeOutdoor, left.foodTypeOutdoor]
    : [left.foodTypeOutdoor, right.foodTypeOutdoor]

  const ya: YardState = {
    foodTypeIndoor: aFoodIn,
    foodTypeOutdoor: aFoodOut,
    indoorLarge: aIndoorL,
    indoorSmall: aIndoorS,
    outdoorLarge: aOutdoorL,
    outdoorSmall: aOutdoorS,
    value: 0,
    valueSecondary: 0,
  }
  const yb: YardState = {
    foodTypeIndoor: bFoodIn,
    foodTypeOutdoor: bFoodOut,
    indoorLarge: bIndoorL,
    indoorSmall: bIndoorS,
    outdoorLarge: bOutdoorL,
    outdoorSmall: bOutdoorS,
    value: 0,
    valueSecondary: 0,
  }
  return [
    tryFinalizeYard(ctx, ya, solverTier, pools),
    tryFinalizeYard(ctx, yb, solverTier, pools),
  ].filter((x): x is YardState => x != null)
}

function indoorOutdoorCrossover(
  ctx: FitnessContext,
  pools: ItemPools,
  left: YardWithUsed,
  right: YardWithUsed,
  solverTier: SolverTier | null = "full"
): YardState[] {
  const same =
    left.indoorLarge.size === right.indoorLarge.size &&
    left.indoorLarge.size === left.outdoorLarge.size &&
    left.outdoorLarge.size === right.outdoorLarge.size &&
    left.indoorSmall.size === right.indoorSmall.size &&
    left.indoorSmall.size === left.outdoorSmall.size &&
    left.outdoorSmall.size === right.outdoorSmall.size
  if (!same) return []

  const [aIndoorL, bIndoorL] = crossoverSets(
    left.indoorLarge,
    right.outdoorLarge,
    left.used,
    right.used
  )
  const [aIndoorS, bIndoorS] = crossoverSets(
    left.indoorSmall,
    right.outdoorSmall,
    left.used,
    right.used
  )
  const [aOutdoorL, bOutdoorL] = crossoverSets(
    left.outdoorLarge,
    right.indoorLarge,
    left.used,
    right.used
  )
  const [aOutdoorS, bOutdoorS] = crossoverSets(
    left.outdoorSmall,
    right.indoorSmall,
    left.used,
    right.used
  )

  const [aFoodIn, bFoodIn] = randomBool(0.5)
    ? [right.foodTypeIndoor, left.foodTypeIndoor]
    : [left.foodTypeIndoor, right.foodTypeIndoor]
  const [aFoodOut, bFoodOut] = randomBool(0.5)
    ? [right.foodTypeOutdoor, left.foodTypeOutdoor]
    : [left.foodTypeOutdoor, right.foodTypeOutdoor]

  const ya: YardState = {
    foodTypeIndoor: aFoodIn,
    foodTypeOutdoor: aFoodOut,
    indoorLarge: aIndoorL,
    indoorSmall: aIndoorS,
    outdoorLarge: aOutdoorL,
    outdoorSmall: aOutdoorS,
    value: 0,
    valueSecondary: 0,
  }
  const yb: YardState = {
    foodTypeIndoor: bFoodIn,
    foodTypeOutdoor: bFoodOut,
    indoorLarge: bIndoorL,
    indoorSmall: bIndoorS,
    outdoorLarge: bOutdoorL,
    outdoorSmall: bOutdoorS,
    value: 0,
    valueSecondary: 0,
  }
  return [
    tryFinalizeYard(ctx, ya, solverTier, pools),
    tryFinalizeYard(ctx, yb, solverTier, pools),
  ].filter((x): x is YardState => x != null)
}

function pick<T>(items: T[]): [T[], T | null] {
  if (items.length === 0) return [items, null]
  const i = randInt(0, items.length - 1)
  const picked = items.splice(i, 1)[0]!
  return [items, picked]
}

export function mutateYard(
  ctx: FitnessContext,
  pools: ItemPools,
  yard: YardWithUsed | YardState,
  solverTier: SolverTier | null = "full"
): YardState {
  const { largeItems, smallItems } = pools
  const pi = PLACES_INDOOR
  const po = PLACES_OUTDOOR

  let indoorLarge = [...yard.indoorLarge]
  let indoorSmall = [...yard.indoorSmall]
  let outdoorLarge = [...yard.outdoorLarge]
  let outdoorSmall = [...yard.outdoorSmall]

  let removedIndoorL: number | null = null
  let removedIndoorS: number | null = null
  let removedOutdoorL: number | null = null
  let removedOutdoorS: number | null = null
  ;[indoorLarge, removedIndoorL] = pick(indoorLarge)
  ;[indoorSmall, removedIndoorS] = pick(indoorSmall)
  ;[outdoorLarge, removedOutdoorL] = pick(outdoorLarge)
  ;[outdoorSmall, removedOutdoorS] = pick(outdoorSmall)

  const usedItems = getUsed(yard)

  for (const x of [
    removedIndoorL,
    removedIndoorS,
    removedOutdoorL,
    removedOutdoorS,
  ]) {
    if (x != null) usedItems.delete(x)
  }

  const guaranteedModified = randInt(0, 3)

  if (
    largeItems.length > 0 &&
    ((removedIndoorL != null &&
      !(randomBool(0.1) && smallItems.length > pi + po)) ||
      (randomBool(0.1) && largeItems.length >= 2))
  ) {
    const newItem = ((): number => {
      while (true) {
        let n = choice(largeItems)
        if (guaranteedModified !== 0 && randomBool(0.7) && removedIndoorL != null) {
          n = removedIndoorL
        }
        if (!usedItems.has(n)) return n
      }
    })()
    indoorLarge.push(newItem)
    usedItems.add(newItem)
  }

  if (removedIndoorS != null) {
    while (indoorSmall.length + indoorLarge.length * 2 < pi) {
      const newItem = ((): number => {
        while (true) {
          let n = choice(smallItems)
          if (guaranteedModified !== 1 && randomBool(0.7) && removedIndoorS != null) {
            n = removedIndoorS
          }
          if (!usedItems.has(n)) return n
        }
      })()
      indoorSmall.push(newItem)
      usedItems.add(newItem)
    }
  }
  while (indoorSmall.length + indoorLarge.length * 2 > pi) {
    const [ns, removed] = pick(indoorSmall)
    indoorSmall = ns
    if (removed != null) usedItems.delete(removed)
  }

  if (
    largeItems.length > 0 &&
    ((removedOutdoorL != null &&
      !(randomBool(0.1) && smallItems.length > pi + po)) ||
      (randomBool(0.1) && largeItems.length >= 2))
  ) {
    const newItem = ((): number => {
      while (true) {
        let n = choice(largeItems)
        if (guaranteedModified !== 2 && randomBool(0.7) && removedOutdoorL != null) {
          n = removedOutdoorL
        }
        if (!usedItems.has(n)) return n
      }
    })()
    outdoorLarge.push(newItem)
    usedItems.add(newItem)
  }

  if (removedOutdoorS != null) {
    while (outdoorSmall.length + outdoorLarge.length * 2 < po) {
      const newItem = ((): number => {
        while (true) {
          let n = choice(smallItems)
          if (guaranteedModified !== 3 && randomBool(0.7) && removedOutdoorS != null) {
            n = removedOutdoorS
          }
          if (!usedItems.has(n)) return n
        }
      })()
      outdoorSmall.push(newItem)
      usedItems.add(newItem)
    }
  }
  while (outdoorSmall.length + outdoorLarge.length * 2 > po) {
    const [ns, removed] = pick(outdoorSmall)
    outdoorSmall = ns
    if (removed != null) usedItems.delete(removed)
  }

  const foodTypeIndoor = randomBool(0.7)
    ? yard.foodTypeIndoor
    : choice([...pools.allowedFoodsIndoor])
  const foodTypeOutdoor = randomBool(0.7)
    ? yard.foodTypeOutdoor
    : choice([...pools.allowedFoodsOutdoor])

  const next: YardState = {
    foodTypeIndoor,
    foodTypeOutdoor,
    indoorLarge: new Set(indoorLarge),
    indoorSmall: new Set(indoorSmall),
    outdoorLarge: new Set(outdoorLarge),
    outdoorSmall: new Set(outdoorSmall),
    value: 0,
    valueSecondary: 0,
  }
  const finalized = tryFinalizeYard(ctx, next, solverTier, pools)
  return finalized ?? yard
}

type OpenSlotMutationKind =
  | "foodIndoor"
  | "foodOutdoor"
  | "indoorLarge"
  | "indoorSmall"
  | "outdoorLarge"
  | "outdoorSmall"

function availableOpenSlotMutations(
  ctx: FitnessContext,
  pools: ItemPools,
  yard: YardState
): OpenSlotMutationKind[] {
  const slots = ctx.generationConstraints
  const out: OpenSlotMutationKind[] = []
  if (!ctx.fixedIndoor) {
    if ((!slots || slots.foodIndoor === "open") && pools.allowedFoodsIndoor.length > 0) {
      out.push("foodIndoor")
    }
    if ((!slots || slots.indoorLarge === "open") && yard.indoorLarge.size > 0) {
      out.push("indoorLarge")
    }
    const indoorOpenSmall = slots
      ? slots.indoorSmallSlots.filter((slot) => slot === "open").length
      : PLACES_INDOOR
    for (let i = 0; i < Math.min(indoorOpenSmall, yard.indoorSmall.size); i++) {
      out.push("indoorSmall")
    }
  }
  if (!ctx.fixedOutdoor) {
    if ((!slots || slots.foodOutdoor === "open") && pools.allowedFoodsOutdoor.length > 0) {
      out.push("foodOutdoor")
    }
    if ((!slots || slots.outdoorLarge === "open") && yard.outdoorLarge.size > 0) {
      out.push("outdoorLarge")
    }
    const outdoorOpenSmall = slots
      ? slots.outdoorSmallSlots.filter((slot) => slot === "open").length
      : PLACES_OUTDOOR
    for (let i = 0; i < Math.min(outdoorOpenSmall, yard.outdoorSmall.size); i++) {
      out.push("outdoorSmall")
    }
  }
  return out
}

function alternateFood(current: number, foods: readonly number[]): number {
  const alternatives = foods.filter((food) => food !== current)
  return choice(alternatives.length > 0 ? alternatives : foods)
}

function canChangeFood(current: number, foods: readonly number[]): boolean {
  return foods.some((food) => food !== current)
}

export function mutateFoodYard(
  ctx: FitnessContext,
  pools: ItemPools,
  yard: YardState,
  solverTier: SolverTier | null = "full"
): YardState {
  const slots = ctx.generationConstraints
  const canMutateIndoor =
    !ctx.fixedIndoor &&
    (!slots || slots.foodIndoor === "open") &&
    pools.allowedFoodsIndoor.length > 0
  const canMutateOutdoor =
    !ctx.fixedOutdoor &&
    (!slots || slots.foodOutdoor === "open") &&
    pools.allowedFoodsOutdoor.length > 0
  const canChangeIndoor =
    canMutateIndoor && canChangeFood(yard.foodTypeIndoor, pools.allowedFoodsIndoor)
  const canChangeOutdoor =
    canMutateOutdoor && canChangeFood(yard.foodTypeOutdoor, pools.allowedFoodsOutdoor)
  if (!canChangeIndoor && !canChangeOutdoor) return yard

  const next = cloneYard(yard)
  next.value = 0
  next.valueSecondary = 0
  const mutateIndoor = canChangeIndoor && (!canChangeOutdoor || randomBool(0.5))
  const mutateOutdoor = canChangeOutdoor && (!canChangeIndoor || !mutateIndoor || randomBool(0.5))
  if (mutateIndoor) {
    next.foodTypeIndoor = alternateFood(yard.foodTypeIndoor, pools.allowedFoodsIndoor)
  }
  if (mutateOutdoor) {
    next.foodTypeOutdoor = alternateFood(yard.foodTypeOutdoor, pools.allowedFoodsOutdoor)
  }
  const finalized = tryFinalizeYard(ctx, next, solverTier, pools)
  return finalized ?? yard
}

export function mutateOpenSlotYard(
  ctx: FitnessContext,
  pools: ItemPools,
  yard: YardState,
  solverTier: SolverTier | null = "full"
): YardState {
  const mutation = choice(availableOpenSlotMutations(ctx, pools, yard))
  if (!mutation) return yard
  const next = cloneYard(yard)
  next.value = 0
  next.valueSecondary = 0
  switch (mutation) {
    case "foodIndoor":
      next.foodTypeIndoor = alternateFood(yard.foodTypeIndoor, pools.allowedFoodsIndoor)
      break
    case "foodOutdoor":
      next.foodTypeOutdoor = alternateFood(yard.foodTypeOutdoor, pools.allowedFoodsOutdoor)
      break
    case "indoorLarge": {
      const item = choice([...next.indoorLarge])
      next.indoorLarge.delete(item)
      break
    }
    case "indoorSmall": {
      const item = choice([...next.indoorSmall])
      next.indoorSmall.delete(item)
      break
    }
    case "outdoorLarge": {
      const item = choice([...next.outdoorLarge])
      next.outdoorLarge.delete(item)
      break
    }
    case "outdoorSmall": {
      const item = choice([...next.outdoorSmall])
      next.outdoorSmall.delete(item)
      break
    }
  }
  const finalized = tryFinalizeYard(ctx, next, solverTier, pools)
  return finalized ?? yard
}

export function kTournament(
  pool: YardState[],
  genetic: GeneticConfig
): YardState[] {
  const winners: YardState[] = []
  const yardList = [...pool]
  const nSel = tournamentSelectionSize(genetic.poolSize)
  for (let i = 0; i < nSel; i++) {
    const kk = Math.min(genetic.tournamentK, yardList.length)
    if (kk === 0) break
    const participants: YardState[] = []
    const idxs = new Set<number>()
    while (participants.length < kk) {
      const j = randInt(0, yardList.length - 1)
      if (idxs.has(j)) continue
      idxs.add(j)
      participants.push(yardList[j]!)
    }
    const best = participants.reduce((a, b) => (yardFitnessBetter(a, b) ? a : b))
    winners.push(best)
    const bi = yardList.indexOf(best)
    if (bi >= 0) yardList.splice(bi, 1)
  }
  return winners
}

export function createOffspring(
  ctx: FitnessContext,
  pools: ItemPools,
  pool: YardState[],
  winners: YardState[],
  genetic: GeneticConfig,
  solverTier: SolverTier | null = "full"
): YardState[] {
  const offspring: YardState[] = []
  const leftHalf = winners.slice(0, Math.floor(winners.length / 2) + 1)
  const rightHalf = winners.slice(Math.floor(winners.length / 2) + 1)

  for (let i = 0; i < Math.min(leftHalf.length, rightHalf.length); i++) {
    const L = withUsed(leftHalf[i]!)
    const R = withUsed(rightHalf[i]!)
    offspring.push(...crossoverMutation(ctx, pools, L, R, solverTier))
    if (!ctx.fixedIndoor && !ctx.fixedOutdoor) {
      offspring.push(...indoorOutdoorCrossover(ctx, pools, L, R, solverTier))
    }
  }

  for (const result of [...offspring]) {
    if (randomBool(genetic.openSlotExplorationRate)) {
      offspring.push(mutateOpenSlotYard(ctx, pools, result, solverTier))
    }
  }

  for (const result of [...offspring]) {
    if (randomBool(genetic.foodMutationOffspringRate)) {
      offspring.push(mutateFoodYard(ctx, pools, result, solverTier))
    }
  }

  for (const result of [...offspring]) {
    if (randomBool(genetic.mutationOffspringRate)) {
      offspring.push(mutateYard(ctx, pools, withUsed(result), solverTier))
    }
  }

  for (const y of pool) {
    if (randomBool(genetic.mutationRate)) {
      offspring.push(mutateYard(ctx, pools, withUsed(cloneYard(y)), solverTier))
    }
  }
  return offspring
}
