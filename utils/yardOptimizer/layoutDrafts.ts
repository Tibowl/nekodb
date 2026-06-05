import {
  PLACES_INDOOR,
  PLACES_OUTDOOR,
} from "./config"
import type { FixedIndoorHalf, FixedOutdoorHalf } from "./fitness"
import type { YardGenerationConstraints } from "./fitnessConstraints"
import type { ItemPools, YardState } from "./types"
import { cloneYard } from "./yardCore"

/** Editable mirror of the current yard — synced when optimizer yields `best` (idle only). */
export type ManualYardDraft = {
  foodIndoor: number
  foodOutdoor: number
  indoorLarge: number | null
  indoorSmall: number[]
  outdoorLarge: number | null
  outdoorSmall: number[]
}

export type FixedIndoorDraft = {
  foodIndoor: SlotDraftValue
  indoorLarge: SlotDraftValue
  indoorSmallSlots: SlotDraftValue[]
}

export type FixedOutdoorDraft = {
  foodOutdoor: SlotDraftValue
  outdoorLarge: SlotDraftValue
  outdoorSmallSlots: SlotDraftValue[]
}

export type SlotDraftValue = number | "open" | null
export type YardPreset = "full" | "outdoor_only" | "custom"

function defaultSlotValue(mode: "open" | "closed"): SlotDraftValue {
  return mode === "open" ? "open" : null
}

export function isFixedSlotValue(value: SlotDraftValue): value is number {
  return typeof value === "number"
}

function parseSlotDraftValue(value: unknown): SlotDraftValue {
  if (value === "open") return "open"
  if (value === null || value === undefined) return null
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function indoorDraftAllClosed(draft: FixedIndoorDraft): boolean {
  return (
    draft.foodIndoor === null &&
    draft.indoorLarge === null &&
    draft.indoorSmallSlots.every((slot) => slot === null)
  )
}

function indoorDraftAllOpen(draft: FixedIndoorDraft): boolean {
  return (
    draft.foodIndoor === "open" &&
    draft.indoorLarge === "open" &&
    draft.indoorSmallSlots.every((slot) => slot === "open")
  )
}

function outdoorDraftAllClosed(draft: FixedOutdoorDraft): boolean {
  return (
    draft.foodOutdoor === null &&
    draft.outdoorLarge === null &&
    draft.outdoorSmallSlots.every((slot) => slot === null)
  )
}

function outdoorDraftAllOpen(draft: FixedOutdoorDraft): boolean {
  return (
    draft.foodOutdoor === "open" &&
    draft.outdoorLarge === "open" &&
    draft.outdoorSmallSlots.every((slot) => slot === "open")
  )
}

export function deriveYardPresetFromSlots(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): YardPreset {
  if (indoorDraftAllOpen(indoor) && outdoorDraftAllOpen(outdoor)) return "full"
  if (indoorDraftAllClosed(indoor) && outdoorDraftAllOpen(outdoor)) {
    return "outdoor_only"
  }
  return "custom"
}

export type YardDraftPinFlags = {
  pinIndoor: boolean
  pinOutdoor: boolean
}

export function draftPinFlagsFromDrafts(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): YardDraftPinFlags {
  return {
    pinIndoor: indoorDraftAllClosed(indoor),
    pinOutdoor: outdoorDraftAllClosed(outdoor),
  }
}

function fixedOutdoorDraftToBaseline(
  draft: FixedOutdoorDraft
): FixedOutdoorHalf {
  return {
    foodTypeOutdoor: isFixedSlotValue(draft.foodOutdoor) ? draft.foodOutdoor : 0,
    outdoorLarge: new Set(isFixedSlotValue(draft.outdoorLarge) ? [draft.outdoorLarge] : []),
    outdoorSmall: new Set(draft.outdoorSmallSlots.filter(isFixedSlotValue)),
  }
}

export function fixedHalvesFromDrafts(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): { indoor?: FixedIndoorHalf; outdoor?: FixedOutdoorHalf } {
  const halves: { indoor?: FixedIndoorHalf; outdoor?: FixedOutdoorHalf } = {}
  if (indoorDraftAllClosed(indoor)) {
    halves.indoor = fixedIndoorDraftToBaseline(indoor)
  }
  if (outdoorDraftAllClosed(outdoor)) {
    halves.outdoor = fixedOutdoorDraftToBaseline(outdoor)
  }
  return halves
}

export function defaultFixedIndoorDraft(
  mode: "open" | "closed" = "open"
): FixedIndoorDraft {
  const value = defaultSlotValue(mode)
  return {
    foodIndoor: value,
    indoorLarge: value,
    indoorSmallSlots: Array.from({ length: PLACES_INDOOR }, () => value),
  }
}

export function defaultFixedOutdoorDraft(
  mode: "open" | "closed" = "open"
): FixedOutdoorDraft {
  const value = defaultSlotValue(mode)
  return {
    foodOutdoor: value,
    outdoorLarge: value,
    outdoorSmallSlots: Array.from({ length: PLACES_OUTDOOR }, () => value),
  }
}

export function parseFixedIndoorDraft(x: unknown): FixedIndoorDraft | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  const foodIndoor = parseSlotDraftValue(o.foodIndoor)
  const indoorLarge = parseSlotDraftValue(o.indoorLarge)
  if (!Array.isArray(o.indoorSmallSlots)) return null
  const indoorSmallSlots = o.indoorSmallSlots
    .slice(0, PLACES_INDOOR)
    .map(parseSlotDraftValue)
  while (indoorSmallSlots.length < PLACES_INDOOR) indoorSmallSlots.push(null)
  return { foodIndoor, indoorLarge, indoorSmallSlots }
}

export function parseFixedOutdoorDraft(x: unknown): FixedOutdoorDraft | null {
  if (!x || typeof x !== "object") return null
  const o = x as Record<string, unknown>
  const foodOutdoor = parseSlotDraftValue(o.foodOutdoor)
  const outdoorLarge = parseSlotDraftValue(o.outdoorLarge)
  if (!Array.isArray(o.outdoorSmallSlots)) return null
  const outdoorSmallSlots = o.outdoorSmallSlots
    .slice(0, PLACES_OUTDOOR)
    .map(parseSlotDraftValue)
  while (outdoorSmallSlots.length < PLACES_OUTDOOR) outdoorSmallSlots.push(null)
  return { foodOutdoor, outdoorLarge, outdoorSmallSlots }
}

function fixedIndoorDraftToBaseline(
  draft: FixedIndoorDraft
): FixedIndoorHalf {
  return {
    foodTypeIndoor: isFixedSlotValue(draft.foodIndoor) ? draft.foodIndoor : 0,
    indoorLarge: new Set(isFixedSlotValue(draft.indoorLarge) ? [draft.indoorLarge] : []),
    indoorSmall: new Set(draft.indoorSmallSlots.filter(isFixedSlotValue)),
  }
}

export function generationConstraintsFromDrafts(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): YardGenerationConstraints {
  return {
    foodIndoor: indoor.foodIndoor,
    foodOutdoor: outdoor.foodOutdoor,
    indoorLarge: indoor.indoorLarge,
    indoorSmallSlots: [...indoor.indoorSmallSlots],
    outdoorLarge: outdoor.outdoorLarge,
    outdoorSmallSlots: [...outdoor.outdoorSmallSlots],
  }
}

export function draftFromBest(best: YardState): ManualYardDraft {
  return {
    foodIndoor: best.foodTypeIndoor,
    foodOutdoor: best.foodTypeOutdoor,
    indoorLarge: [...best.indoorLarge][0] ?? null,
    indoorSmall: [...best.indoorSmall].sort((a, b) => a - b),
    outdoorLarge: [...best.outdoorLarge][0] ?? null,
    outdoorSmall: [...best.outdoorSmall].sort((a, b) => a - b),
  }
}

export function draftsEqual(a: ManualYardDraft, b: ManualYardDraft): boolean {
  const sortNum = (xs: number[]) => [...xs].sort((x, y) => x - y)
  return (
    a.foodIndoor === b.foodIndoor &&
    a.foodOutdoor === b.foodOutdoor &&
    a.indoorLarge === b.indoorLarge &&
    a.outdoorLarge === b.outdoorLarge &&
    JSON.stringify(sortNum(a.indoorSmall)) === JSON.stringify(sortNum(b.indoorSmall)) &&
    JSON.stringify(sortNum(a.outdoorSmall)) === JSON.stringify(sortNum(b.outdoorSmall))
  )
}

export function applyDraftToPartialYard(
  best: YardState,
  draft: ManualYardDraft,
  pinFlags: YardDraftPinFlags
): YardState {
  const base = cloneYard(best)
  const next: YardState = { ...base, value: 0, valueSecondary: 0 }
  if (!pinFlags.pinIndoor) {
    next.foodTypeIndoor = draft.foodIndoor
    next.indoorLarge = new Set(draft.indoorLarge != null ? [draft.indoorLarge] : [])
    next.indoorSmall = new Set(draft.indoorSmall)
  }
  if (!pinFlags.pinOutdoor) {
    next.foodTypeOutdoor = draft.foodOutdoor
    next.outdoorLarge = new Set(draft.outdoorLarge != null ? [draft.outdoorLarge] : [])
    next.outdoorSmall = new Set(draft.outdoorSmall)
  }
  return next
}

export function validateManualDraft(
  draft: ManualYardDraft,
  pinFlags: YardDraftPinFlags,
  pools: ItemPools,
  requiredGoodieIds: readonly number[],
  forbiddenGoodieIds: readonly number[]
): string | null {
  const checkFood = (id: number, allowed: readonly number[], label: string) => {
    if (!allowed.includes(id)) return `${label} food #${id} is not in your allowed pool`
    return null
  }

  const collectUsed = (): number[] => {
    const u: number[] = []
    if (!pinFlags.pinIndoor) {
      if (draft.indoorLarge != null) u.push(draft.indoorLarge)
      u.push(...draft.indoorSmall)
    }
    if (!pinFlags.pinOutdoor) {
      if (draft.outdoorLarge != null) u.push(draft.outdoorLarge)
      u.push(...draft.outdoorSmall)
    }
    return u
  }

  const usedList = collectUsed()
  const seen = new Set<number>()
  for (const id of usedList) {
    if (seen.has(id)) return `Goodie #${id} appears twice in the yard`
    seen.add(id)
    const inLargePool = pools.largeItems.includes(id)
    const inSmallPool = pools.smallItems.includes(id)
    if (!inLargePool && !inSmallPool) return `Goodie #${id} is not in the current toy pool`
  }

  const needInSmall = PLACES_INDOOR - (draft.indoorLarge != null ? 2 : 0)
  const needOutSmall = PLACES_OUTDOOR - (draft.outdoorLarge != null ? 2 : 0)

  if (!pinFlags.pinIndoor) {
    const err = checkFood(draft.foodIndoor, pools.allowedFoodsIndoor, "Indoor")
    if (err) return err
    if (draft.indoorLarge != null && !pools.largeItems.includes(draft.indoorLarge)) {
      return "Indoor large item is not in the large toy pool"
    }
    if (draft.indoorSmall.length !== needInSmall) {
      return `Indoor: choose exactly ${needInSmall} small goodies (large counts as 2 slots)`
    }
    for (const id of draft.indoorSmall) {
      if (!pools.smallItems.includes(id)) return `Indoor small #${id} is not a small toy`
      if (pools.largeItems.includes(id)) return `#${id} is a large toy — use the large slot`
    }
  }

  if (!pinFlags.pinOutdoor) {
    const err = checkFood(draft.foodOutdoor, pools.allowedFoodsOutdoor, "Outdoor")
    if (err) return err
    if (draft.outdoorLarge != null && !pools.largeItems.includes(draft.outdoorLarge)) {
      return "Outdoor large item is not in the large toy pool"
    }
    if (draft.outdoorSmall.length !== needOutSmall) {
      return `Outdoor: choose exactly ${needOutSmall} small goodies`
    }
    for (const id of draft.outdoorSmall) {
      if (!pools.smallItems.includes(id)) return `Outdoor small #${id} is not a small toy`
      if (pools.largeItems.includes(id)) return `#${id} is a large toy — use the large slot`
    }
  }

  const usedSet = new Set(usedList)
  for (const id of requiredGoodieIds) {
    if (!usedSet.has(id)) return `Required goodie #${id} must be placed`
  }
  for (const id of forbiddenGoodieIds) {
    if (usedSet.has(id)) return `Goodie #${id} is forbidden by your rules`
  }

  return null
}

function countSlotStates(values: readonly SlotDraftValue[]): {
  fixed: number
  closed: number
} {
  let fixed = 0
  let closed = 0
  for (const value of values) {
    if (typeof value === "number") fixed++
    else if (value === null) closed++
  }
  return { fixed, closed }
}

export function formatCurrentLayoutSummary(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): string {
  const indoorCounts = countSlotStates([
    indoor.foodIndoor,
    indoor.indoorLarge,
    ...indoor.indoorSmallSlots,
  ])
  const outdoorCounts = countSlotStates([
    outdoor.foodOutdoor,
    outdoor.outdoorLarge,
    ...outdoor.outdoorSmallSlots,
  ])
  const fixed = indoorCounts.fixed + outdoorCounts.fixed
  const closed = indoorCounts.closed + outdoorCounts.closed
  if (fixed === 0 && closed === 0) return "all slots open"
  const parts: string[] = []
  if (fixed > 0) parts.push(`${fixed} fixed`)
  if (closed > 0) parts.push(`${closed} closed`)
  return `${parts.join(", ")} slot${fixed + closed === 1 ? "" : "s"}`
}

function sortedUniqueNumbers(ids: readonly number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function fixedIndoorGoodieIdsFromDraft(draft: FixedIndoorDraft): number[] {
  return sortedUniqueNumbers([
    ...(isFixedSlotValue(draft.indoorLarge) ? [draft.indoorLarge] : []),
    ...draft.indoorSmallSlots.filter(isFixedSlotValue),
  ])
}

export function fixedOutdoorGoodieIdsFromDraft(draft: FixedOutdoorDraft): number[] {
  return sortedUniqueNumbers([
    ...(isFixedSlotValue(draft.outdoorLarge) ? [draft.outdoorLarge] : []),
    ...draft.outdoorSmallSlots.filter(isFixedSlotValue),
  ])
}

export function fixedFoodTypesFromDrafts(
  indoor: FixedIndoorDraft,
  outdoor: FixedOutdoorDraft
): number[] {
  return sortedUniqueNumbers([
    ...(isFixedSlotValue(indoor.foodIndoor) ? [indoor.foodIndoor] : []),
    ...(isFixedSlotValue(outdoor.foodOutdoor) ? [outdoor.foodOutdoor] : []),
  ])
}
