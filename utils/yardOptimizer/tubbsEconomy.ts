import { metricTotal } from "./analyzer/analyzerResults"
import {
  CAT_STAY_TICK_AVG,
  TICKS_PER_DAY,
  TUBBS_CAT_ID,
  visitsPerDayFromMass,
} from "./analyzer/constants"
import {
  bowlDailySpendNativeBulkTriplet,
  bowlRefillsPerDay,
  FOOD_PENALTY,
  SILVER_FISH_PER_GOLD_FISH,
} from "./foodBowlEconomy"
import {
  tubbsKeepsGift,
  tubbsKickTiming,
  tubbsRefillTiming,
  type TubbsKickTiming,
  type TubbsMode,
} from "./tubbsMode"
import { GOLD_GIFT_PROBABILITY_OUTDOOR } from "./visitEconomy"
import type { FishRatesPerDay, YardAnalyzerSummary } from "./yardAnalyzerSnapshot"
import type { YardState } from "./types"

// --- currency / analyzer surfaces ---

export type TubbsCurrencyTriple = {
  silver: number
  gold: number
  goldEquiv: number
}

export type TubbsAnalyzerSurfaces = {
  lastOutdoorBowlCostFactor: number
  lastBowlIncomeHaircut: TubbsCurrencyTriple
}

// --- renewal model (analyzer) ---

/** Sum Tubbs's outdoor stay-rate mass across the whole calc space (independent of target cats). */
export function computeTubbsOutdoorMass(
  calcSpace: Record<string, Record<number, [number, number, number][]>>,
  getIsIndoors: (playspaceId: number) => boolean,
  tubbsCatId: number = TUBBS_CAT_ID
): number {
  let mass = 0
  for (const [, catDict] of Object.entries(calcSpace)) {
    const catData = catDict[tubbsCatId]
    if (!catData) continue
    for (const row of catData) {
      if (!getIsIndoors(row[2])) mass += row[0]
    }
  }
  return mass
}

/**
 * Closed-form outdoor refill rate per mode (analyzer renewal path). Trait-driven, no mode literals:
 * food-round modes refill at the union cadence `max(Ri, Ro)` capped by the empty rate; prompt modes
 * refill at the empty rate, except a let-be prompt mode (helper, kick timing `none`) cannot refill
 * while Tubbs camps, so its demand rate divides by `1 + mass`.
 */
export function outdoorRefillRateForMode(
  mode: TubbsMode,
  params: { emptyRate: number; mass: number; Ri: number; Ro: number }
): number {
  const { emptyRate, mass, Ri, Ro } = params
  if (tubbsRefillTiming(mode) === "foodRound") {
    return Math.min(Math.max(Ri, Ro), emptyRate)
  }
  return tubbsKickTiming(mode) === "none" ? emptyRate / (1 + mass) : emptyRate
}

/** Tubbs visit rate Rt (visits per day) from converged outdoor mass. */
function tubbsVisitRateFromMass(tubbsOutdoorMass: number): number {
  return visitsPerDayFromMass(tubbsOutdoorMass)
}

/**
 * Competing-risks empty rate from a visit rate `Rt` and outdoor timer rate `Ro` — the SINGLE place
 * the renewal formula `Rt/(1−exp(−Rt/Ro))` lives. Falls back to the pure timer `Ro` when Tubbs never
 * visits. Both the mass-based `tubbsEmptyRate` and the boosted economy path route through it.
 */
export function tubbsEmptyRateFromRt(Rt: number, Ro: number): number {
  if (!(Rt > 0) || !(Ro > 0)) return Ro > 0 ? Ro : 0
  return Rt / (1 - Math.exp(-Rt / Ro))
}

/** Renewal emptying rate for Tubbs + timer depletion at full bowl, from converged outdoor mass. */
export function tubbsEmptyRate(tubbsOutdoorMass: number, foodTypeOutdoor: number): number {
  return tubbsEmptyRateFromRt(
    tubbsVisitRateFromMass(tubbsOutdoorMass),
    bowlRefillsPerDay(foodTypeOutdoor)
  )
}

export type TubbsOutdoorBowlEconomyInput = {
  mode: TubbsMode
  tubbsOutdoorMass: number
  foodTypeIndoor: number
  foodTypeOutdoor: number
  /** Tubbs's own stay-weighted bowl income, split so kick modes can make it silver-only. */
  tubbsBowlIncome: TubbsCurrencyTriple
}

export type TubbsOutdoorBowlEconomyResult = {
  fullFraction: number
  refillRate: number
  costFactor: number
  haircut: TubbsCurrencyTriple
}

const ZERO_TRIPLE: TubbsCurrencyTriple = { silver: 0, gold: 0, goldEquiv: 0 }

/** Shared renewal kernel: boosted Rt, empty rate, refill rate, and bowl-full fraction `f`. */
type TubbsRenewalRates = {
  Rt: number
  visitBoost: number
  emptyRate: number
  refillRate: number
  fullFraction: number
  Ri: number
  Ro: number
  timing: TubbsKickTiming
}

function tubbsRenewalRates(
  mode: TubbsMode,
  tubbsOutdoorMass: number,
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): TubbsRenewalRates | null {
  const mass = Math.max(0, Math.min(1, tubbsOutdoorMass))
  const Ro = bowlRefillsPerDay(foodTypeOutdoor)
  if (mode === "off" || !(mass > 0) || !(Ro > 0)) return null
  const Ri = bowlRefillsPerDay(foodTypeIndoor)
  const timing = tubbsKickTiming(mode)
  const { boost: visitBoost, effective: Rt } = tubbsVisitRate(
    mode,
    tubbsOutdoorMass,
    foodTypeIndoor,
    foodTypeOutdoor
  )
  let emptyRate = Ro
  let refillRate = Ro
  let fullFraction = 1
  if (Rt > 0) {
    emptyRate = tubbsEmptyRateFromRt(Rt, Ro)
    refillRate = outdoorRefillRateForMode(mode, { emptyRate, mass, Ri, Ro })
    fullFraction = Math.min(1, refillRate / emptyRate)
  }
  return { Rt, visitBoost, emptyRate, refillRate, fullFraction, Ri, Ro, timing }
}

/**
 * Expected fraction of his rolled stay that Tubbs actually camps on the bowl before leaving, given a
 * mode's kick timing (the `tubbsKickTiming` trait — NOT a mode name). Only an `onFoodRound` shoo can
 * interrupt him mid-camp: he is kicked at the next food round (refill of either bowl, cadence
 * `max(Ri, Ro)`), so camped time is `min(naturalStay, residual-to-next-food-round)`. With residual ~
 * uniform[0, L] (L = food-round interval in ticks) and mean stay S, `E[min(S, U)]/S = 1 − S/(2L)` for
 * `S ≤ L`, else `L/(2S)`. `none` (never shooed) and `onSight` (shooed after the visit settles) both
 * keep the full stay. Used by the analyzer gift haircut; the sim derives the same emergently.
 */
function tubbsCampedStayFraction(
  timing: TubbsKickTiming,
  Ri: number,
  Ro: number
): number {
  if (timing !== "onFoodRound") return 1
  const foodRoundRate = Math.max(Ri, Ro)
  if (!(foodRoundRate > 0)) return 1
  const L = TICKS_PER_DAY / foodRoundRate
  const S = CAT_STAY_TICK_AVG
  const f = S <= L ? 1 - S / (2 * L) : L / (2 * S)
  return Math.max(0, Math.min(1, f))
}

/**
 * Fraction of his stay Tubbs actually OCCUPIES the bowl before he is removed (which is when his
 * cooldown starts). `onSight` shoos him the instant he lands ⇒ ~0 occupancy (his gift still settles,
 * but his cooldown starts immediately). `onFoodRound` ⇒ the camped fraction. `none` ⇒ full. This is
 * the occupancy clock, which differs from the gift-credit clock only for `onSight`.
 */
function tubbsBowlOccupancyFraction(
  timing: TubbsKickTiming,
  Ri: number,
  Ro: number
): number {
  if (timing === "onSight") return 0
  return tubbsCampedStayFraction(timing, Ri, Ro)
}

/**
 * Visit-rate multiplier from kicking: removing Tubbs early starts his cooldown sooner, so his visit
 * cycle `1/Rt` shrinks by the lost stay `S·(1−occupancyFraction)`. `boost = cycle/(cycle − lost) =
 * 1/(1 − lost·Rt)`. 1 when nothing is lost (no kick / full occupancy). This lifts his visit rate,
 * which then ripples through BOTH the empty rate (cost/availability) and his per-visit bowl gift.
 */
function tubbsKickVisitBoost(
  tubbsVisitRatePerDay: number,
  occupancyFraction: number
): number {
  if (!(tubbsVisitRatePerDay > 0)) return 1
  const lostStayDays = (CAT_STAY_TICK_AVG * (1 - occupancyFraction)) / TICKS_PER_DAY
  const denom = 1 - lostStayDays * tubbsVisitRatePerDay
  // Cap at the physical ceiling: a cat cannot visit faster than back-to-back stays with no cooldown,
  // i.e. TICKS_PER_DAY/CAT_STAY_TICK_AVG visits/day. This bounds the boost (and rescues the denom→0
  // singularity, unreachable at realistic mass) without any fitted constant; in range it is inert.
  const maxBoost = TICKS_PER_DAY / CAT_STAY_TICK_AVG / tubbsVisitRatePerDay
  const boost = denom > 0 ? 1 / denom : maxBoost
  return Math.min(boost, maxBoost)
}

/**
 * Tubbs's bowl visit rate under a mode, as `{ base, boost, effective }`. The SINGLE source of the
 * effective (kick-boosted) rate: the economy (empty rate → cost/availability AND the per-visit gift)
 * and the bench reporter both read it, so the boost is derived exactly once and cannot drift between
 * call sites. `base` is the mass-derived renewal rate (stay constant `CAT_STAY_TICK_AVG`); `boost`
 * is 1 for every non-kick mode (occupancy fraction 1 ⇒ no shortened cooldown).
 */
type TubbsVisitRate = { base: number; boost: number; effective: number }
function tubbsVisitRate(
  mode: TubbsMode,
  tubbsOutdoorMass: number,
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): TubbsVisitRate {
  const base = tubbsVisitRateFromMass(tubbsOutdoorMass)
  const occ = tubbsBowlOccupancyFraction(
    tubbsKickTiming(mode),
    bowlRefillsPerDay(foodTypeIndoor),
    bowlRefillsPerDay(foodTypeOutdoor)
  )
  const boost = tubbsKickVisitBoost(base, occ)
  return { base, boost, effective: base * boost }
}

/** Effective (kick-boosted) bowl visit rate/day — accessor over the single `tubbsVisitRate` source. */
export function tubbsEffectiveVisitRate(
  mode: TubbsMode,
  tubbsOutdoorMass: number,
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): number {
  return tubbsVisitRate(mode, tubbsOutdoorMass, foodTypeIndoor, foodTypeOutdoor).effective
}

/** Renewal-derived outdoor-bowl availability, refill rate, cost factor, and income haircut. */
export function computeTubbsOutdoorBowlEconomy(
  input: TubbsOutdoorBowlEconomyInput
): TubbsOutdoorBowlEconomyResult {
  const mode = input.mode
  const Ro = bowlRefillsPerDay(input.foodTypeOutdoor)

  const rates = tubbsRenewalRates(
    mode,
    input.tubbsOutdoorMass,
    input.foodTypeIndoor,
    input.foodTypeOutdoor
  )
  if (rates === null) {
    return {
      fullFraction: 1,
      refillRate: Ro > 0 ? Ro : 0,
      costFactor: 1,
      haircut: ZERO_TRIPLE,
    }
  }

  const { visitBoost, refillRate, fullFraction, timing, Ri, Ro: RoOut } = rates
  const costFactor = refillRate / RoOut
  // The empty-bowl AVAILABILITY effect (fewer outdoor cats ⇒ less gross income, fewer visits, slower
  // mementos) is applied ONCE at the source — the analyzer scales non-Tubbs outdoor occupancy by the
  // retention ρ (= `outdoorOccupancyRetention`), so it already shows up in gross. The ONLY income
  // term left here is Tubbs's OWN bowl gift. Kicking sets his gold conversion to zero; it does not
  // erase the visit. He still leaves the silver branch, so the haircut removes gold and adds the
  // small silver branch that used to be displaced by outdoor gold conversion. He is excluded from ρ
  // since he is the cause of the empty bowl. No availability subtraction at net.
  const giftKept = tubbsKeepsGift(mode) ? 1 : 0
  const haircut: TubbsCurrencyTriple = { ...ZERO_TRIPLE }
  if (giftKept === 0) {
    const pGold = GOLD_GIFT_PROBABILITY_OUTDOOR
    // Kicked Tubbs keeps SILVER on every visit (gold conversion 0): base silver + the silver his
    // gold-conversion visits now leave instead. His kept silver = (boosted visit rate) × (per-visit
    // camped silver): `visitBoost` lifts the gift just as it lifts the empty rate above, and `fCamp`
    // is the per-visit stay he is credited (full for onSight, partial when shooed at a food round).
    const extraSilver =
      pGold < 1 ? input.tubbsBowlIncome.silver * (pGold / (1 - pGold)) : 0
    const fCamp = tubbsCampedStayFraction(timing, Ri, RoOut)
    const keptSilver = visitBoost * fCamp * (input.tubbsBowlIncome.silver + extraSilver)
    haircut.silver = input.tubbsBowlIncome.silver - keptSilver
    haircut.gold = input.tubbsBowlIncome.gold
    haircut.goldEquiv =
      haircut.gold + haircut.silver / SILVER_FISH_PER_GOLD_FISH
  }

  return { fullFraction, refillRate, costFactor, haircut }
}

/**
 * Outdoor OCCUPANCY retention ρ ∈ (0,1] while the bowl cycles full/empty — the same `f/(1−θ(1−f))`
 * factor the income haircut uses, but needing only mass/θ/mode (no income), so the analyzer can
 * apply it to the VISIT metrics (catProbability, memento, stayRate) at the source. By Little's
 * law outdoor visits, mementos, and income all ride the same occupancy, so one factor governs all.
 * Returns 1 (no haircut) under `off` / no Tubbs mass / no outdoor bowl.
 */
export function outdoorOccupancyRetention(input: {
  mode: TubbsMode
  tubbsOutdoorMass: number
  outdoorPlaceOccupancy: number
  foodTypeIndoor: number
  foodTypeOutdoor: number
}): number {
  const rates = tubbsRenewalRates(
    input.mode,
    input.tubbsOutdoorMass,
    input.foodTypeIndoor,
    input.foodTypeOutdoor
  )
  if (rates === null) return 1
  const f = rates.fullFraction
  if (f >= 1) return 1
  const theta = Math.max(0, Math.min(1, input.outdoorPlaceOccupancy))
  return f / (1 - theta * (1 - f))
}

// --- analyzer retention scaling (ρ at source) ---

/** Per-playspace mask: outdoor visits suppressed by empty-bowl retention ρ. Null when ρ = 1. */
export function buildOutdoorRetentionSuppressedMask(params: {
  rho: number
  catId: number
  tubbsCatId: number
  foodTypeOutdoor: number
  playspaceIds: readonly number[]
  playspaceToItemId: Record<number, number>
  isIndoor: readonly boolean[]
}): readonly boolean[] | null {
  if (params.rho >= 1) return null
  return params.playspaceIds.map(
    (psid, i) =>
      !params.isIndoor[i] &&
      !(
        params.catId === params.tubbsCatId &&
        params.playspaceToItemId[psid] === params.foodTypeOutdoor
      )
  )
}

/** Stay-rate mass after scaling suppressed outdoor playspaces by ρ. */
export function visitStayRateWithOutdoorRetention(
  perPlayspaceMass: readonly number[],
  outdoorSuppressed: readonly boolean[] | null,
  rho: number,
  totalMass: number
): number {
  if (outdoorSuppressed === null) return totalMass
  let kept = 0
  let suppressed = 0
  for (let i = 0; i < perPlayspaceMass.length; i++) {
    const p = perPlayspaceMass[i]!
    if (outdoorSuppressed[i]) suppressed += p
    else kept += p
  }
  return kept + rho * suppressed
}

/** Indoor/outdoor mass split with the same per-playspace ρ rule as visit metrics. */
export function indoorOutdoorMassWithRetention(
  perPlayspaceMass: readonly number[],
  isIndoor: readonly boolean[],
  outdoorSuppressed: readonly boolean[] | null,
  rho: number
): { indoorMass: number; outdoorMass: number } {
  let indoorMass = 0
  let outdoorMass = 0
  for (let i = 0; i < perPlayspaceMass.length; i++) {
    const p = perPlayspaceMass[i]!
    if (isIndoor[i]) indoorMass += p
    else outdoorMass += outdoorSuppressed !== null && outdoorSuppressed[i] ? rho * p : p
  }
  return { indoorMass, outdoorMass }
}

// --- sim refill policy (tick-level mirror of renewal rates) ---

/**
 * Whether the sim should refill an empty outdoor bowl this tick — the tick-level mirror of
 * `outdoorRefillRateForMode`, reading the SAME `tubbsRefillTiming` trait so the closed form and the
 * sim cannot disagree on which modes are prompt versus food-round. Both refill only when the bowl is
 * free; a food-round mode also waits for the next food round. `off` never reaches here.
 */
export function shouldRefillOutdoorBowlSim(
  mode: TubbsMode,
  params: { bowlOccupied: boolean; onFoodRound: boolean }
): boolean {
  if (mode === "off") return false
  if (params.bowlOccupied) return false
  return tubbsRefillTiming(mode) === "foodRound" ? params.onFoodRound : true
}

// --- scoring nets (Tubbs-adjusted yard totals) ---

/** Tubbs-adjusted gross income per currency (before food penalty). */
export function tubbsAdjustedGrosses(
  results: Record<string, Record<string | number, number>>,
  analyzer: TubbsAnalyzerSurfaces
): TubbsCurrencyTriple {
  return {
    silver: metricTotal(results, "silver") - analyzer.lastBowlIncomeHaircut.silver,
    gold: metricTotal(results, "gold") - analyzer.lastBowlIncomeHaircut.gold,
    goldEquiv:
      metricTotal(results, "goldEquiv") - analyzer.lastBowlIncomeHaircut.goldEquiv,
  }
}

/** Whole-yard net fish rates after Tubbs haircut and outdoor-bowl cost scaling. */
function tubbsNetFishRatesPerDay(
  results: Record<string, Record<string | number, number>>,
  y: YardState,
  analyzer: TubbsAnalyzerSurfaces
): FishRatesPerDay {
  const ratio = analyzer.lastOutdoorBowlCostFactor
  const adj = tubbsAdjustedGrosses(results, analyzer)
  const inFood = bowlDailySpendNativeBulkTriplet(y.foodTypeIndoor)
  const outFood = bowlDailySpendNativeBulkTriplet(y.foodTypeOutdoor)
  return {
    netGoldPerDay: adj.gold - inFood.gold - outFood.gold * ratio,
    netGoldEquivPerDay:
      adj.goldEquiv -
      FOOD_PENALTY[y.foodTypeIndoor] -
      FOOD_PENALTY[y.foodTypeOutdoor] * ratio,
    netSilverPerDay: adj.silver - inFood.silver - outFood.silver * ratio,
  }
}

/** Gold-equiv food penalty with Tubbs outdoor-bowl cost factor applied. */
export function tubbsGoldEquivFoodPenalty(y: YardState, costFactor: number): number {
  return FOOD_PENALTY[y.foodTypeIndoor] + FOOD_PENALTY[y.foodTypeOutdoor] * costFactor
}

/** Naive gross gold-equiv from raw silver + gold totals (ledger-style). */
function naiveGoldEquivFromTotals(silverTotal: number, goldTotal: number): number {
  return silverTotal / SILVER_FISH_PER_GOLD_FISH + goldTotal
}

/** Full yard display summary: gross totals + Tubbs-adjusted nets. */
export function yardAnalyzerNetSummary(
  results: Record<string, Record<string | number, number>>,
  y: YardState,
  analyzer: TubbsAnalyzerSurfaces
): YardAnalyzerSummary {
  const silverTotal = metricTotal(results, "silver")
  const goldTotal = metricTotal(results, "gold")
  const goldEquivNaive = naiveGoldEquivFromTotals(silverTotal, goldTotal)
  const penGoldEquiv = tubbsGoldEquivFoodPenalty(y, analyzer.lastOutdoorBowlCostFactor)
  const nets = tubbsNetFishRatesPerDay(results, y, analyzer)
  return {
    ...nets,
    grossSilverPerDay: silverTotal,
    grossGoldPerDay: goldTotal,
    grossGoldEquivModelPerDay: metricTotal(results, "goldEquiv"),
    grossGoldEquivNaivePerDay: goldEquivNaive,
    netGoldEquivNaivePerDay: goldEquivNaive - penGoldEquiv,
    catProbabilityYardTotal: metricTotal(results, "catProbability"),
    stayRateYardTotal: metricTotal(results, "stayRate"),
  }
}
