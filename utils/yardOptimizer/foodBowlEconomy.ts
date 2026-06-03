/**
 * Bowl **restock** economics from shipped game tables (not hand-tuned constants).
 *
 * - **`FoodRecordTable`**: `DurationMinutes` — how long one fill lasts before empty.
 * - **`GoodsRecordTable`**: `Silver` / `Gold` shop prices (`-1` = not sold that way).
 *
 * Refill rate (continuous approximation): `(24×60) / DurationMinutes` fills per bowl per day.
 * Two bowls (indoor + outdoor) may use different food ids.
 *
 * When **both** silver and gold prices exist (deluxe), we pick the **cheaper gold-equivalent**
 * option (50 silver ≡ 1 gold) and attribute spend to that currency only, matching a rational
 * in-game purchase.
 *
 * **`FOOD_PENALTY`** (default) uses the game’s **bulk “×3” shop deals** for food ids **2–6**,
 * because single-line `GoodsRecordTable` prices do not match how players usually restock. Id **1**
 * and **7** fall back to `GoodsRecordTable` (no triplet numbers in scope). See
 * {@link FOOD_BULK_TRIPLET_NATIVE}.
 */

import { MINUTES_PER_TICK, TICKS_PER_DAY } from "./analyzer/constants"
import FoodRecordTable from "../../NekoAtsume2Data/tables/FoodRecordTable.json"
import GoodsRecordTable from "../../NekoAtsume2Data/tables/GoodsRecordTable.json"

/**
 * Shop / UI exchange rate: 50 silver fish ≡ 1 gold fish for food pricing and naive gold-equiv
 * ledgers. Distinct from {@link ANALYZER_SILVER_PER_GOLD_FOR_SILVER_EQUIV} in analyzer/constants
 * (gift payout mix inside the mean-field engine).
 */
export const SILVER_FISH_PER_GOLD_FISH = 50

/**
 * Bulk purchase: native fish cost for **3** bowl refills at the in-game tiered deal.
 *
 * Maps to shipped `SpecialGoodsRecordTable.json` tiers (`NekoCan3`/`KatsuoCan3`/…/`Sashimi3`) for
 * gold items; Frisky is silver-only triple. Stamp-card requirements on those rows are excluded
 * from this gold-/silver-equiv model.
 *
 * Food id naming matches `FoodRecordTable` / shop (2 Frisky, 3 Ritzy, 4 Bonito, 5 Deluxe tuna,
 * 6 Sashimi; 7 Ritzy-tier boat falls back to `GoodsRecordTable` in builders below).
 */
export const FOOD_BULK_TRIPLET_NATIVE: Partial<
  Record<
    number,
    {
      /** Total silver fish for the 3-pack (−1 if none). */
      silver: number
      /** Total gold fish for the 3-pack (−1 if none). */
      gold: number
    }
  >
> = Object.freeze({
  2: { silver: 30, gold: -1 }, // Frisky Bitz
  3: { silver: -1, gold: 7 }, // Ritzy (`NekoCan3`)
  4: { silver: -1, gold: 17 }, // Bonito (`KatsuoCan3`)
  5: { silver: -1, gold: 30 }, // Deluxe tuna (`MaguroCan3`)
  6: { silver: -1, gold: 12 }, // Sashimi (`Sashimi3`)
})

const foodById = new Map(
  (FoodRecordTable as { Id: number; DurationMinutes: number }[]).map((r) => [
    r.Id,
    r,
  ])
)
const goodById = new Map(
  (GoodsRecordTable as { Id: number; Silver: number; Gold: number }[]).map(
    (r) => [r.Id, r]
  )
)

/** One bowl: refills per in-game day from bowl duration only. */
export function bowlRefillsPerDay(foodId: number): number {
  const food = foodById.get(foodId)
  if (!food || food.DurationMinutes <= 0) return 0
  return (24 * 60) / food.DurationMinutes
}

/** Sim tick duration for one bowl fill at this food id (`TICKS_PER_DAY / refills-per-day`). */
export function bowlDurationTicks(foodId: number): number {
  const r = bowlRefillsPerDay(foodId)
  return r > 0 ? Math.round(TICKS_PER_DAY / r) : 0
}

/**
 * Refills per in-game day on whichever of the two bowls empties sooner (shorter
 * `DurationMinutes`). Used to express elapsed game time as “# of food” on one axis.
 */
export function shortestBowlRefillsPerGameDay(
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): number {
  return Math.max(
    bowlRefillsPerDay(foodTypeIndoor),
    bowlRefillsPerDay(foodTypeOutdoor),
    0
  )
}

/**
 * When both bowls share the same refill rate, prefers indoor. Otherwise the id with
 * the shorter bowl-emptying time (more refills per day).
 */
export function shortestDurationFoodId(
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): number {
  const rIn = bowlRefillsPerDay(foodTypeIndoor)
  const rOut = bowlRefillsPerDay(foodTypeOutdoor)
  if (rIn <= 0 && rOut <= 0) return foodTypeIndoor
  return rIn >= rOut ? foodTypeIndoor : foodTypeOutdoor
}

/**
 * How to rescale **in-game days → a larger number** for memento-lab UI only.
 * Math stays in game days; multiply labels/ticks by `displayMul`.
 */
export type MementoTimeDisplayBasis =
  | "gameDay"
  | "shortestBowlRefill"
  | "priciestCanRefill"

/**
 * Dedupes and validates candidate food ids for display scaling.
 */
function normaliseCandidateFoodIds(foodIds?: readonly number[]): number[] {
  if (!foodIds || foodIds.length === 0) {
    return [1, 2, 3, 4, 5, 6, 7]
  }
  const out: number[] = []
  for (const id of foodIds) {
    if (Number.isInteger(id) && id >= 1 && id <= 7 && !out.includes(id)) out.push(id)
  }
  return out.length > 0 ? out : [1, 2, 3, 4, 5, 6, 7]
}

/**
 * Food id 1…7 with highest {@link perRefillGoldEquivBulkTriplet} (bulk marginal).
 * Tie → lower id.
 */
export function priciestShopFoodIdByRefillGoldEquivBulk(
  candidateFoodIds?: readonly number[]
): number {
  const candidates = normaliseCandidateFoodIds(candidateFoodIds)
  let bestId = candidates[0]!
  let bestCost = -1
  for (const id of candidates) {
    const c = perRefillGoldEquivBulkTriplet(id)
    if (c > bestCost) {
      bestCost = c
      bestId = id
    }
  }
  return bestId
}

export type MementoTimeDisplayScale = {
  /** Multiply game-days by this for on-screen “time” (refills/day or 1). */
  displayMul: number
  /** Food id used as the refill “yardstick”, or null for raw days. */
  referenceFoodId: number | null
  basis: MementoTimeDisplayBasis
}

/**
 * **Display only:** converts elapsed game time to tick labels / copy. Simulation
 * and probability code should keep using raw game-days.
 */
export function mementoTimeDisplayScale(
  basis: MementoTimeDisplayBasis,
  foodTypeIndoor: number,
  foodTypeOutdoor: number,
  availableFoodIds?: readonly number[]
): MementoTimeDisplayScale {
  if (basis === "gameDay") {
    return { displayMul: 1, referenceFoodId: null, basis }
  }
  if (basis === "shortestBowlRefill") {
    const refId = shortestDurationFoodId(foodTypeIndoor, foodTypeOutdoor)
    const m = shortestBowlRefillsPerGameDay(foodTypeIndoor, foodTypeOutdoor)
    return {
      displayMul: m > 0 ? m : 1,
      referenceFoodId: refId,
      basis,
    }
  }
  const refId = priciestShopFoodIdByRefillGoldEquivBulk(
    availableFoodIds
  )
  const m = bowlRefillsPerDay(refId)
  return {
    displayMul: m > 0 ? m : 1,
    referenceFoodId: refId,
    basis: "priciestCanRefill",
  }
}

/**
 * Per restock, how the player pays if they always buy the cheaper listed option
 * (when two prices exist).
 */
export function perRefillSpendNative(good: {
  Silver: number
  Gold: number
}): { silver: number; gold: number } {
  const s = good.Silver
  const g = good.Gold
  if (s < 0 && g < 0) return { silver: 0, gold: 0 }
  if (s >= 0 && g < 0) return { silver: s, gold: 0 }
  if (s < 0 && g >= 0) return { silver: 0, gold: g }
  const equivSilver = s / SILVER_FISH_PER_GOLD_FISH
  if (equivSilver <= g) return { silver: s, gold: 0 }
  return { silver: 0, gold: g }
}

/** Gold-equivalent cost of one restock for `foodId` (silver÷50 + gold). */
export function perRefillGoldEquiv(foodId: number): number {
  const good = goodById.get(foodId)
  if (!good) return 0
  const { silver, gold } = perRefillSpendNative(good)
  return silver / SILVER_FISH_PER_GOLD_FISH + gold
}

/**
 * Gold-equivalent cost of **one** refill when always restocking via the **3-pack bulk** deal
 * (`FOOD_BULK_TRIPLET_NATIVE`). For ids without a triplet entry, falls back to
 * {@link perRefillGoldEquiv}.
 */
export function perRefillGoldEquivBulkTriplet(foodId: number): number {
  const tri = FOOD_BULK_TRIPLET_NATIVE[foodId]
  if (!tri) return perRefillGoldEquiv(foodId)
  const s = tri.silver
  const g = tri.gold
  let sum = 0
  if (s >= 0) sum += s / SILVER_FISH_PER_GOLD_FISH
  if (g >= 0) sum += g
  return sum / 3
}

/** One bowl’s **daily** spend in native currencies (continuous refill model). */
export function bowlDailySpendNative(foodId: number): {
  silver: number
  gold: number
  goldEquiv: number
} {
  const r = bowlRefillsPerDay(foodId)
  const good = goodById.get(foodId)
  if (!good || r <= 0) return { silver: 0, gold: 0, goldEquiv: 0 }
  const { silver, gold } = perRefillSpendNative(good)
  return {
    silver: r * silver,
    gold: r * gold,
    goldEquiv: r * (silver / SILVER_FISH_PER_GOLD_FISH + gold),
  }
}

/**
 * Like {@link bowlDailySpendNative}, but per-refill cost uses {@link perRefillGoldEquivBulkTriplet}
 * (bulk 3-pack marginal gold-equiv / refill). Native silver/gold **per day** are approximated by
 * splitting the triplet across three refills so daily gold and silver scale with refills/day.
 */
export function bowlDailySpendNativeBulkTriplet(foodId: number): {
  silver: number
  gold: number
  goldEquiv: number
} {
  const r = bowlRefillsPerDay(foodId)
  const tri = FOOD_BULK_TRIPLET_NATIVE[foodId]
  if (!tri || r <= 0) return bowlDailySpendNative(foodId)
  const s = tri.silver
  const g = tri.gold
  const perRefillSilver = s >= 0 ? s / 3 : 0
  const perRefillGold = g >= 0 ? g / 3 : 0
  return {
    silver: r * perRefillSilver,
    gold: r * perRefillGold,
    goldEquiv: r * perRefillGoldEquivBulkTriplet(foodId),
  }
}

/**
 * **`FOOD_PENALTY`-shaped** array: index = food type id 0…7. Index 0 = no bowl / closed slot;
 * each id’s value = **one bowl’s** average daily cost in **gold-equivalent fish** (for the
 * optimizer / `netGoldEquiv` objective).
 */
export function buildFoodPenaltyDailyGoldEquiv(): readonly number[] {
  const out: number[] = [0]
  for (let id = 1; id <= 7; id++) {
    out.push(bowlDailySpendNativeBulkTriplet(id).goldEquiv)
  }
  return out
}

/**
 * Gold fish equivalent food cost per **one bowl** per in-game day — same shape the optimizer
 * uses for `netGoldEquiv`. Uses {@link FOOD_BULK_TRIPLET_NATIVE} for ids **2–6** (marginal cost
 * per refill = triplet native ÷ 3 × refills/day); ids **1** and **7** use single-line
 * `GoodsRecordTable`. Index = food id 0…7 (0 = no bowl / closed slot).
 *
 * **Note:** Import this from `foodBowlEconomy`, not `config`, so bundles that only need
 * memento rates (e.g. the memento yard worker) do not embed the food/ goods JSON tables.
 */
export const FOOD_PENALTY: readonly number[] = buildFoodPenaltyDailyGoldEquiv()

/**
 * Total bowl spend over `endDays` for indoor + outdoor food types (two independent bowls).
 *
 * The indoor bowl is a deterministic clock (Tubbs-independent), always `endDays × base`. For the
 * OUTDOOR bowl, pass `outdoorRefills` (the count the SIMULATOR actually spent over the run) to charge
 * `refills × per-refill price` — the sim's own measurement, never the analyzer's cost factor. Omit it
 * (off / no food model) and the outdoor bowl falls back to its deterministic base spend over
 * `endDays`. Under a non-off Tubbs mode the sim refills at the mode's own cadence (prompt at the
 * empty rate, or food-round at `max(Ri, Ro)` capped by the empty rate, which still exceeds the off
 * baseline when the indoor bowl empties faster), and that shows up directly in `outdoorRefills`.
 */
export function yardFoodSpendForRunNative(
  foodTypeIndoor: number,
  foodTypeOutdoor: number,
  endDays: number,
  outdoorRefills?: number
): { silver: number; gold: number; goldEquiv: number } {
  if (!(endDays > 0)) {
    return { silver: 0, gold: 0, goldEquiv: 0 }
  }
  const inB = bowlDailySpendNativeBulkTriplet(foodTypeIndoor)
  const outB = bowlDailySpendNativeBulkTriplet(foodTypeOutdoor)
  // Outdoor: sim-measured refills × per-refill price (base = daily ÷ refills-per-day) when provided,
  // else the deterministic base daily spend over the run.
  const Ro = bowlRefillsPerDay(foodTypeOutdoor)
  const outScale =
    outdoorRefills !== undefined && Ro > 0 ? outdoorRefills / Ro : endDays
  const silver = endDays * inB.silver + outScale * outB.silver
  const gold = endDays * inB.gold + outScale * outB.gold
  const goldEquiv = endDays * inB.goldEquiv + outScale * outB.goldEquiv
  return { silver, gold, goldEquiv }
}
