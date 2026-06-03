import { PLACES_INDOOR, PLACES_OUTDOOR } from "./config"
import type { FitnessContext } from "./fitness"
import { goodieById } from "./gameData"
import { goodieIsLargeForYard } from "./itemPools"
import type { ItemPools, YardState } from "./types"

type GenerationSlotValue = number | "open" | null

type SideDraft = {
  large: Set<number>
  small: Set<number>
  places: number
  allowLarge: boolean
  smallSlotLimit: number
}

type ItemPoolMembership = {
  largeItems: Set<number>
  smallItems: Set<number>
}

const itemPoolMembershipCache = new WeakMap<ItemPools, ItemPoolMembership>()

function choice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function randomBool(p: number): boolean {
  return Math.random() < p
}

function goodieIsLargeId(id: number): boolean {
  const g = goodieById.get(id)
  if (!g) throw new Error(`Unknown goodie #${id}`)
  return goodieIsLargeForYard(g)
}

function itemPoolMembership(pools: ItemPools): ItemPoolMembership {
  const cached = itemPoolMembershipCache.get(pools)
  if (cached) return cached
  const membership = {
    largeItems: new Set(pools.largeItems),
    smallItems: new Set(pools.smallItems),
  }
  itemPoolMembershipCache.set(pools, membership)
  return membership
}

function draftSlotCount(draft: SideDraft): number {
  return draft.large.size * 2 + draft.small.size
}

function draftSmallLimit(draft: SideDraft): number {
  return Math.min(draft.smallSlotLimit, draft.places - draft.large.size * 2)
}

function draftHas(draft: SideDraft, id: number): boolean {
  return draft.large.has(id) || draft.small.has(id)
}

function tryAddGoodieToDraft(
  draft: SideDraft,
  used: Set<number>,
  id: number
): boolean {
  if (draftHas(draft, id)) return true
  if (used.has(id)) return false
  if (goodieIsLargeId(id)) {
    if (
      !draft.allowLarge ||
      draft.large.size > 0 ||
      draftSlotCount(draft) + 2 > draft.places ||
      draft.small.size > draft.places - 2
    ) {
      return false
    }
    draft.large.add(id)
  } else {
    if (draft.small.size + 1 > draftSmallLimit(draft)) return false
    draft.small.add(id)
  }
  used.add(id)
  return true
}

function addRequiredToSide(
  draft: SideDraft,
  used: Set<number>,
  ids: readonly number[],
  label: string
): void {
  for (const id of ids) {
    if (draftHas(draft, id)) continue
    if (!tryAddGoodieToDraft(draft, used, id)) {
      throw new Error(`Required ${label} goodie #${id} cannot fit`)
    }
  }
}

function addFloatingRequiredGoodies(
  indoor: SideDraft | null,
  outdoor: SideDraft | null,
  used: Set<number>,
  ids: readonly number[]
): void {
  for (const id of ids) {
    if ((indoor && draftHas(indoor, id)) || (outdoor && draftHas(outdoor, id))) {
      continue
    }
    const firstIndoor = randomBool(0.5)
    const first = firstIndoor ? indoor : outdoor
    const second = firstIndoor ? outdoor : indoor
    if (
      (first && tryAddGoodieToDraft(first, used, id)) ||
      (second && tryAddGoodieToDraft(second, used, id))
    ) {
      continue
    }
    throw new Error(`Required goodie #${id} cannot fit`)
  }
}

function addRequiredGoodies(
  ctx: FitnessContext,
  indoor: SideDraft | null,
  outdoor: SideDraft | null,
  used: Set<number>
): void {
  const requiredIndoor = ctx.constraints.requiredIndoorGoodieIds ?? []
  const requiredOutdoor = ctx.constraints.requiredOutdoorGoodieIds ?? []
  if (requiredIndoor.length > 0) {
    if (indoor) {
      addRequiredToSide(indoor, used, requiredIndoor, "indoor")
    } else if (requiredIndoor.some((id) => !used.has(id))) {
      throw new Error("Indoor side is fixed and cannot accept required goodies")
    }
  }
  if (requiredOutdoor.length > 0) {
    if (outdoor) {
      addRequiredToSide(outdoor, used, requiredOutdoor, "outdoor")
    } else if (requiredOutdoor.some((id) => !used.has(id))) {
      throw new Error("Outdoor side is fixed and cannot accept required goodies")
    }
  }
  addFloatingRequiredGoodies(
    indoor,
    outdoor,
    used,
    ctx.constraints.requiredGoodieIds
  )
}

function fillDraft(
  draft: SideDraft,
  used: Set<number>,
  pools: ItemPools,
  forbidden: Set<number>,
  preferLarge: boolean
): void {
  if (
    preferLarge &&
    draft.allowLarge &&
    draft.large.size === 0 &&
    draftSlotCount(draft) + 2 <= draft.places &&
    draft.small.size <= draft.places - 2
  ) {
    const largeAvail = pools.largeItems.filter(
      (id) => !used.has(id) && !forbidden.has(id)
    )
    if (largeAvail.length > 0) {
      const item = choice(largeAvail)
      draft.large.add(item)
      used.add(item)
    }
  }
  while (draft.small.size < draftSmallLimit(draft)) {
    const smallAvail = pools.smallItems.filter(
      (id) => !used.has(id) && !forbidden.has(id)
    )
    if (smallAvail.length === 0) break
    const item = choice(smallAvail)
    draft.small.add(item)
    used.add(item)
  }
}

function fillConstrainedDrafts(
  ctx: FitnessContext,
  pools: ItemPools,
  indoor: SideDraft | null,
  outdoor: SideDraft | null,
  used: Set<number>
): void {
  const forbidden = new Set(ctx.constraints.forbiddenGoodieIds)
  const selectLargeIndoor =
    indoor != null &&
    (indoor.large.size > 0 ||
      (randomBool(0.5) && pools.largeItems.length > 0 && indoor.places >= 2))
  const selectLargeOutdoor =
    outdoor != null &&
    (outdoor.large.size > 0 ||
      (randomBool(0.5) &&
        pools.largeItems.length > (selectLargeIndoor ? 1 : 0) &&
        outdoor.places >= 2))
  if (indoor) fillDraft(indoor, used, pools, forbidden, selectLargeIndoor)
  if (outdoor) fillDraft(outdoor, used, pools, forbidden, selectLargeOutdoor)
}

function allOpenGenerationConstraints() {
  return {
    foodIndoor: "open" as const,
    foodOutdoor: "open" as const,
    indoorLarge: "open" as const,
    indoorSmallSlots: Array.from(
      { length: PLACES_INDOOR },
      () => "open" as const
    ),
    outdoorLarge: "open" as const,
    outdoorSmallSlots: Array.from(
      { length: PLACES_OUTDOOR },
      () => "open" as const
    ),
  }
}

function foodFromSlot(
  slot: GenerationSlotValue,
  pool: readonly number[]
): number {
  if (typeof slot === "number") return slot
  if (slot === null) return 0
  if (pool.length === 0) throw new Error("Open food slot has no selected foods")
  return choice([...pool])
}

function foodFromCandidateOrSlot(
  slot: GenerationSlotValue,
  pool: readonly number[],
  candidateFood: number | null
): number {
  if (typeof slot === "number") return slot
  if (slot === null) return 0
  if (candidateFood != null && pool.includes(candidateFood)) return candidateFood
  return foodFromSlot(slot, pool)
}

function draftFromSlots(
  largeSlot: GenerationSlotValue,
  smallSlots: readonly GenerationSlotValue[],
  places: number,
  used: Set<number>
): SideDraft {
  const draft: SideDraft = {
    large: new Set(),
    small: new Set(),
    places,
    allowLarge: largeSlot === "open" || typeof largeSlot === "number",
    smallSlotLimit: smallSlots.filter((slot) => slot !== null).length,
  }
  if (typeof largeSlot === "number" && !tryAddGoodieToDraft(draft, used, largeSlot)) {
    throw new Error(`Fixed large goodie #${largeSlot} cannot fit`)
  }
  for (const slot of smallSlots) {
    if (typeof slot === "number" && !tryAddGoodieToDraft(draft, used, slot)) {
      throw new Error(`Fixed small goodie #${slot} cannot fit`)
    }
  }
  return draft
}

function addCandidateGoodiesToDraft(
  draft: SideDraft,
  used: Set<number>,
  ids: Iterable<number>,
  poolMembership: ItemPoolMembership,
  forbidden: Set<number>
): void {
  for (const id of ids) {
    if (forbidden.has(id) || used.has(id)) continue
    if (goodieIsLargeId(id)) {
      if (!poolMembership.largeItems.has(id)) continue
    } else if (!poolMembership.smallItems.has(id)) {
      continue
    }
    tryAddGoodieToDraft(draft, used, id)
  }
}

export function buildYardThroughOpenSlots(
  ctx: FitnessContext,
  pools: ItemPools,
  candidate?: YardState
): YardState {
  const slots = ctx.generationConstraints ?? allOpenGenerationConstraints()
  const forbidden = new Set(ctx.constraints.forbiddenGoodieIds)
  const poolMembership = itemPoolMembership(pools)
  const fixedIndoor = ctx.fixedIndoor ?? null
  const fixedOutdoor = ctx.fixedOutdoor ?? null
  const used = new Set<number>([
    ...(fixedIndoor?.indoorLarge ?? []),
    ...(fixedIndoor?.indoorSmall ?? []),
    ...(fixedOutdoor?.outdoorLarge ?? []),
    ...(fixedOutdoor?.outdoorSmall ?? []),
  ])

  const indoor = fixedIndoor
    ? null
    : draftFromSlots(
        slots.indoorLarge,
        slots.indoorSmallSlots.slice(0, PLACES_INDOOR),
        PLACES_INDOOR,
        used
      )
  const outdoor = fixedOutdoor
    ? null
    : draftFromSlots(
        slots.outdoorLarge,
        slots.outdoorSmallSlots.slice(0, PLACES_OUTDOOR),
        PLACES_OUTDOOR,
        used
      )

  addRequiredGoodies(ctx, indoor, outdoor, used)
  if (candidate) {
    if (indoor) {
      addCandidateGoodiesToDraft(
        indoor,
        used,
        [...candidate.indoorLarge, ...candidate.indoorSmall],
        poolMembership,
        forbidden
      )
    }
    if (outdoor) {
      addCandidateGoodiesToDraft(
        outdoor,
        used,
        [...candidate.outdoorLarge, ...candidate.outdoorSmall],
        poolMembership,
        forbidden
      )
    }
  }
  fillConstrainedDrafts(ctx, pools, indoor, outdoor, used)

  return {
    foodTypeIndoor: fixedIndoor
      ? fixedIndoor.foodTypeIndoor
      : foodFromCandidateOrSlot(
          slots.foodIndoor,
          pools.allowedFoodsIndoor,
          candidate?.foodTypeIndoor ?? null
        ),
    indoorLarge: fixedIndoor ? new Set(fixedIndoor.indoorLarge) : indoor!.large,
    indoorSmall: fixedIndoor ? new Set(fixedIndoor.indoorSmall) : indoor!.small,
    foodTypeOutdoor: fixedOutdoor
      ? fixedOutdoor.foodTypeOutdoor
      : foodFromCandidateOrSlot(
          slots.foodOutdoor,
          pools.allowedFoodsOutdoor,
          candidate?.foodTypeOutdoor ?? null
        ),
    outdoorLarge: fixedOutdoor ? new Set(fixedOutdoor.outdoorLarge) : outdoor!.large,
    outdoorSmall: fixedOutdoor ? new Set(fixedOutdoor.outdoorSmall) : outdoor!.small,
    value: 0,
    valueSecondary: 0,
  }
}
