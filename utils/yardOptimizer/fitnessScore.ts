import { metricTotal } from "./analyzer/analyzerResults"
import {
  CAT_STAY_TICK_AVG,
  MINUTES_PER_TICK,
  STAY_TICK_RANGE,
  visitsFromMassOverTicks,
  visitsPerDayFromHorizon,
} from "./analyzer/constants"
import { NekoAtsumeAnalyzer } from "./analyzer/nekoAtsumeAnalyzer"
import type { AnalyzerArgs } from "./analyzer/nekoAtsumeAnalyzer"
import {
  foodMementoRateForType,
  GA_MID_COMPONENT_INNER_DAMPING,
  GA_MID_COMPONENT_INNER_MAX_ITERATIONS,
  GA_MID_COMPONENT_INNER_TOLERANCE,
  GA_MID_SOLVER_CONVERGENCE_THRESHOLD,
  GA_MID_SOLVER_MAX_ITERATIONS,
  GA_SEARCH_OPEN_GATE_OVERRIDE,
  MEMENTO_LOTTERY_START_COME_COUNT,
} from "./config"
import {
  tubbsAdjustedGrosses,
  tubbsGoldEquivFoodPenalty,
  yardAnalyzerNetSummary,
} from "./tubbsEconomy"
import type { YardState } from "./types"
import { yardHasInvalidStructure } from "./yardLayoutRules"
import { yardSignature } from "./yardSignature"
import {
  profileAssignValueAnalyze,
  profileAssignValueCacheHit,
  profileAssignValueEnter,
  profileAssignValueGoodieReject,
  yardOptimizerProfilingActive,
} from "./optimizerProfile"
import { isRareCatId } from "../cat/getCatType"
import {
  walkUntilSuccessDistributionMixture,
  type WalkExactDistribution,
} from "../mementoLottery"
import {
  feasibilityViolationScore,
  passesGoodieConstraints,
} from "./fitnessConstraints"
import type {
  FitnessContext,
  FitnessObjective,
  FixedIndoorHalf,
  FixedOutdoorHalf,
  SolverTier,
} from "./fitnessContext"
import {
  firstOrderFishVariancePerDay,
  type FullAnalyzeSnapshot,
  type MementoWaitStatsRow,
  type YardAnalyzerSummary,
} from "./yardAnalyzerSnapshot"

export const FITNESS_HARD_REJECT_NONE = 0
export const FITNESS_HARD_REJECT_RULES = 1
export const FITNESS_HARD_REJECT_LAYOUT = 2

function yardHardRejectLevel(y: YardState): number {
  return Math.max(0, y.hardRejectLevel ?? 0)
}

function fixedOutdoorKey(f: FixedOutdoorHalf | undefined): unknown {
  if (!f) return null
  return {
    fo: f.foodTypeOutdoor,
    ol: [...f.outdoorLarge].sort((a, b) => a - b),
    os: [...f.outdoorSmall].sort((a, b) => a - b),
  }
}

function fixedIndoorKey(f: FixedIndoorHalf | undefined): unknown {
  if (!f) return null
  return {
    fi: f.foodTypeIndoor,
    il: [...f.indoorLarge].sort((a, b) => a - b),
    is: [...f.indoorSmall].sort((a, b) => a - b),
  }
}

/**
 * Stable key for (yard layout + target cats). Uses shared {@link yardSignature} for layout.
 */
function fitnessCacheKey(
  ctx: FitnessContext,
  y: YardState,
  solverTier: SolverTier
): string {
  return JSON.stringify({
    obj: ctx.objective,
    blend: ctx.objectiveBlendTerms,
    secObj: ctx.secondaryObjective ?? null,
    feas: ctx.constraints.feasibilityRows,
    reqG: [...ctx.constraints.requiredGoodieIds].sort((a, b) => a - b),
    reqGI: [...(ctx.constraints.requiredIndoorGoodieIds ?? [])].sort((a, b) => a - b),
    reqGO: [...(ctx.constraints.requiredOutdoorGoodieIds ?? [])].sort((a, b) => a - b),
    forbG: [...ctx.constraints.forbiddenGoodieIds].sort((a, b) => a - b),
    ao: ctx.analyzerOptions,
    cc: Object.fromEntries(
      Object.entries(ctx.targetCatStartComeCounts)
        .map(([k, v]) => [Number(k), v] as const)
        .filter(([k, v]) => ctx.targetCatIds.includes(k) && v !== 0)
        .sort(([a], [b]) => a - b)
    ),
    tier: solverTier,
    fxO: fixedOutdoorKey(ctx.fixedOutdoor),
    fxI: fixedIndoorKey(ctx.fixedIndoor),
    cats: [...ctx.targetCatIds].sort((a, b) => a - b),
    yard: yardSignature(y),
  })
}

type FitnessCacheEntry = {
  primary: number
  secondary: number
  requirementPenalty: number
  mementoUnreachableTargets: number
  hardRejectLevel: number
  /** Populated on `full`-tier solves for UI summary reuse. */
  summary?: YardAnalyzerSummary
  /** Slim full-tier analyze output for memento lab / report (same run as summary). */
  fullAnalyze?: FullAnalyzeSnapshot
}

/** LRU-ish Map: repeated layouts in the GA hit this instead of re-running `analyze()`. */
const FITNESS_CACHE_MAX = 2000
const fitnessScoreCache = new Map<string, FitnessCacheEntry>()

function fitnessCachePeek(key: string): FitnessCacheEntry | undefined {
  return fitnessScoreCache.get(key)
}

function fitnessCacheGet(key: string): FitnessCacheEntry | undefined {
  const v = fitnessScoreCache.get(key)
  if (v !== undefined) {
    fitnessScoreCache.delete(key)
    fitnessScoreCache.set(key, v)
  }
  return v
}

function fitnessCacheSet(key: string, value: FitnessCacheEntry): void {
  if (fitnessScoreCache.has(key)) {
    fitnessScoreCache.delete(key)
  } else if (fitnessScoreCache.size >= FITNESS_CACHE_MAX) {
    const first = fitnessScoreCache.keys().next().value as string
    fitnessScoreCache.delete(first)
  }
  fitnessScoreCache.set(key, value)
}

/** Clear cached fitness (e.g. after hot reload in dev). */
export function clearFitnessCache(): void {
  fitnessScoreCache.clear()
}

/**
 * Full analyzer pipeline via `NekoAtsumeAnalyzer` (mean-field solver).
 *
 * **Initialization:** `ctx.staticData` is a singleton (tables loaded once). Each evaluation
 * still constructs a new `NekoAtsumeAnalyzer` when the cache misses, because `args` (foods +
 * items of interest) change per yard — the heavy work is `analyze()`, not the constructor.
 * Cat-vs-food and weather multiplier dicts are memoized inside `staticData.ts` per food/weather.
 *
 * **Cache:** identical (yard + objective + target cats) skips `analyze()` entirely.
 *
 * **Objectives:** `netGoldEquiv` = analyzer converted fish minus both bowls’ gold-equivalent
 * food cost; `netGold`/`netSilver` = native-currency income minus native food spend;
 * `catProbability` = target cats’ on-screen chance; `mementoExpectedDays` = negative slowest
 * per-target estimated memento wait.
 */
export function buildAnalyzerArgs(
  ctx: FitnessContext,
  y: YardState,
  solverTier: SolverTier = "full"
): AnalyzerArgs {
  const o = ctx.analyzerOptions
  const base: AnalyzerArgs = {
    foodTypeIndoor: y.foodTypeIndoor,
    foodTypeOutdoor: y.foodTypeOutdoor,
    itemDamageState: o.itemDamageState,
    weather: o.weather,
    totalDurationMinutes: o.totalDurationMinutes,
    groupDef: "custom" as const,
    itemsOfInterestIndoors: [
      ...y.indoorLarge,
      ...y.indoorSmall,
    ],
    itemsOfInterestOutdoors: [
      ...y.outdoorLarge,
      ...y.outdoorSmall,
      y.foodTypeOutdoor,
    ],
    catId: ctx.targetCatIds,
    interactionMode: o.interactionMode,
    reachMode: o.reachMode,
    openGateMode: o.openGateMode,
    tubbsMode: o.tubbsMode,
    playspaceDataCache: ctx.playspaceDataCache,
  }
  if (solverTier === "mid") {
    // GA evolution path. The mid tier tightens iteration caps and tolerances so
    // each solve returns sooner with a slightly looser fixed point. It also runs
    // the cheap `perPlace` row-win as a search proxy when the user's chosen
    // row-win is the expensive `componentState` (see GA_SEARCH_OPEN_GATE_OVERRIDE):
    // the row-win is the dominant search cost (~5×), and the terminal `full`-tier
    // pool rescore re-ranks survivors under the user's real row-win before display,
    // so only search ranking rides the proxy. interactionMode and reachMode are
    // always honored as-is. If the override is null (or the user already picked
    // perPlace), the user's row-win is searched directly.
    const searchOpenGateMode =
      GA_SEARCH_OPEN_GATE_OVERRIDE != null && o.openGateMode === "componentState"
        ? GA_SEARCH_OPEN_GATE_OVERRIDE
        : o.openGateMode
    return {
      ...base,
      openGateMode: searchOpenGateMode,
      solverMaxIterations: GA_MID_SOLVER_MAX_ITERATIONS,
      solverConvergenceThreshold: GA_MID_SOLVER_CONVERGENCE_THRESHOLD,
      componentInnerMaxIterations: GA_MID_COMPONENT_INNER_MAX_ITERATIONS,
      componentInnerTolerance: GA_MID_COMPONENT_INNER_TOLERANCE,
      componentInnerDamping: GA_MID_COMPONENT_INNER_DAMPING,
    }
  }
  return base
}

const MEMENTO_EXPECTED_MAX_VISITS = 5_000

function expectedVisitsFromDistribution(
  dist: WalkExactDistribution,
  maxVisits: number
): number {
  let expected = 0
  for (let k = 0; k < dist.pmfByVisitIndex.length; k++) {
    expected += (k + 1) * dist.pmfByVisitIndex[k]!
  }
  if (dist.probCensored > 1e-12) expected += maxVisits * dist.probCensored
  return expected
}

function mementoExpectedWaitStats(params: {
  catId: number
  startComeCount: number
  indoorVisitsPerHorizon: number
  outdoorVisitsPerHorizon: number
  totalDurationMinutes: number
  foodMementoRateIndoor: number
  foodMementoRateOutdoor: number
}): {
  expectedVisits: number
  expectedDays: number
  visitsPerDay: number
  probSuccessWithinCap: number
} {
  const visitsPerHorizon =
    params.indoorVisitsPerHorizon + params.outdoorVisitsPerHorizon
  const visitsPerDay = visitsPerDayFromHorizon(
    visitsPerHorizon,
    params.totalDurationMinutes
  )
  if (visitsPerDay <= 1e-12) {
    return {
      expectedVisits: Number.POSITIVE_INFINITY,
      expectedDays: Number.POSITIVE_INFINITY,
      visitsPerDay,
      probSuccessWithinCap: 0,
    }
  }

  const indoorShare =
    visitsPerHorizon > 1e-12 ? params.indoorVisitsPerHorizon / visitsPerHorizon : 0
  const dist = walkUntilSuccessDistributionMixture(
    {
      isRareCat: isRareCatId(params.catId),
      indoorShare,
      foodMementoRateIndoor: params.foodMementoRateIndoor,
      foodMementoRateOutdoor: params.foodMementoRateOutdoor,
    },
    params.startComeCount,
    MEMENTO_EXPECTED_MAX_VISITS
  )
  const expectedVisits = expectedVisitsFromDistribution(
    dist,
    MEMENTO_EXPECTED_MAX_VISITS
  )
  return {
    expectedVisits,
    expectedDays: expectedVisits / visitsPerDay,
    visitsPerDay,
    probSuccessWithinCap: dist.probSuccessWithinCap,
  }
}

export function mementoWaitStatsForMassMap(
  ctx: FitnessContext,
  y: YardState,
  massByCat: Record<number, { indoorMass: number; outdoorMass: number }>
): MementoWaitStatsRow[] {
  const totalTicks = ctx.analyzerOptions.totalDurationMinutes / MINUTES_PER_TICK
  const lotteryIn = foodMementoRateForType(y.foodTypeIndoor)
  const lotteryOut = foodMementoRateForType(y.foodTypeOutdoor)
  return [...ctx.targetCatIds].sort((a, b) => a - b).map((catId) => {
    const m = massByCat[catId] ?? { indoorMass: 0, outdoorMass: 0 }
    const indoorVisits = visitsFromMassOverTicks(m.indoorMass, totalTicks)
    const outdoorVisits = visitsFromMassOverTicks(m.outdoorMass, totalTicks)
    const stats = mementoExpectedWaitStats({
      catId,
      startComeCount:
        ctx.targetCatStartComeCounts[catId] ?? MEMENTO_LOTTERY_START_COME_COUNT,
      indoorVisitsPerHorizon: indoorVisits,
      outdoorVisitsPerHorizon: outdoorVisits,
      totalDurationMinutes: ctx.analyzerOptions.totalDurationMinutes,
      foodMementoRateIndoor: lotteryIn,
      foodMementoRateOutdoor: lotteryOut,
    })
    return {
      catId,
      ...stats,
      indoorVisitsPerHorizon: indoorVisits,
      outdoorVisitsPerHorizon: outdoorVisits,
    }
  })
}

export function mementoWaitStatsForAnalyzer(
  ctx: FitnessContext,
  y: YardState,
  analyzer: NekoAtsumeAnalyzer
): MementoWaitStatsRow[] {
  return mementoWaitStatsForMassMap(ctx, y, analyzer.lastVisitMassByTargetCat ?? {})
}

/** True if `a` should rank above `b` by explicit ranking dimensions, then scores. */
export function yardFitnessBetter(a: YardState, b: YardState): boolean {
  const aReject = yardHardRejectLevel(a)
  const bReject = yardHardRejectLevel(b)
  if (aReject !== bReject) return aReject < bReject
  const aUnreachable = Math.max(0, a.mementoUnreachableTargets ?? 0)
  const bUnreachable = Math.max(0, b.mementoUnreachableTargets ?? 0)
  if (aUnreachable !== bUnreachable) return aUnreachable < bUnreachable
  const aPenalty = Math.max(0, a.requirementPenalty ?? 0)
  const bPenalty = Math.max(0, b.requirementPenalty ?? 0)
  if (aPenalty !== bPenalty) return aPenalty < bPenalty
  if (a.value !== b.value) return a.value > b.value
  return a.valueSecondary > b.valueSecondary
}

export function yardFitnessCompareDesc(a: YardState, b: YardState): number {
  if (yardFitnessBetter(a, b)) return -1
  if (yardFitnessBetter(b, a)) return 1
  return 0
}

/**
 * Best pool member to show after a search step / rescoring: prefer any non-rejected layout
 * so the UI does not settle on a reject when the pool still holds valid yards. If every layout
 * is rejected, returns `pool[0]` (pool is expected to be sorted best-first).
 */
export function pickBestPoolMemberForDisplay(pool: YardState[]): YardState | null {
  if (pool.length === 0) return null
  let bestFeasible: YardState | null = null
  for (const y of pool) {
    if (yardHardRejectLevel(y) > FITNESS_HARD_REJECT_NONE) continue
    if (!bestFeasible || yardFitnessBetter(y, bestFeasible)) bestFeasible = y
  }
  return bestFeasible ?? pool[0]!
}

function scoreExpectedMementoDaysDetails(
  catStats: readonly { expectedDays: number }[]
): { score: number; unreachableTargets: number } {
  if (catStats.length === 0) return { score: 0, unreachableTargets: 1 }

  let unreachable = 0
  let maxFiniteDays = 0
  for (const s of catStats) {
    if (!Number.isFinite(s.expectedDays) || s.expectedDays <= 0) {
      unreachable++
    } else {
      maxFiniteDays = Math.max(maxFiniteDays, s.expectedDays)
    }
  }

  return {
    score: maxFiniteDays > 0 ? -maxFiniteDays : 0,
    unreachableTargets: unreachable,
  }
}

function scoreExpectedMementoDays(
  catStats: readonly { expectedDays: number }[]
): number {
  return scoreExpectedMementoDaysDetails(catStats).score
}

/** Slowest finite expected memento wait among target cats (display). */
export function maxExpectedMementoDays(
  catStats: readonly { expectedDays: number }[]
): number {
  if (catStats.length === 0) return Number.POSITIVE_INFINITY
  let maxDays = 0
  for (const s of catStats) {
    if (!Number.isFinite(s.expectedDays) || s.expectedDays <= 0) {
      return Number.POSITIVE_INFINITY
    }
    maxDays = Math.max(maxDays, s.expectedDays)
  }
  return maxDays
}

export function peekFullAnalyzeSnapshot(
  ctx: FitnessContext,
  y: YardState,
  options: AssignValueOptions = {}
): FullAnalyzeSnapshot | undefined {
  const solverTier: SolverTier = options.solverTier ?? "full"
  const key = assignValueCacheKey(ctx, y, solverTier, options.analyzerArgsOverride)
  return fitnessCachePeek(key)?.fullAnalyze
}

type ScoreContext = {
  results: Record<string, Record<string | number, number>>
  summary?: YardAnalyzerSummary
  waitStats?: MementoWaitStatsRow[]
}

function rawScoreForObjective(
  objective: FitnessObjective,
  ctx: ScoreContext
): number {
  const { results, summary, waitStats } = ctx
  if (objective === "catProbability") {
    return metricTotal(results, "catProbability")
  }
  if (objective === "netGoldEquiv") {
    return summary?.netGoldEquivPerDay ?? 0
  }
  if (objective === "netGold") {
    return summary?.netGoldPerDay ?? 0
  }
  if (objective === "netSilver") {
    return summary?.netSilverPerDay ?? 0
  }
  if (objective === "mementoExpectedDays") {
    return scoreExpectedMementoDays(waitStats ?? [])
  }
  return 0
}

function blendedPrimaryScoreDetails(
  ctx: FitnessContext,
  scoreCtx: ScoreContext
): { score: number; mementoUnreachableTargets: number } {
  let score = 0
  let mementoUnreachableTargets = 0
  const addObjective = (objective: FitnessObjective, weight: number): void => {
    if (objective === "mementoExpectedDays") {
      const details = scoreExpectedMementoDaysDetails(scoreCtx.waitStats ?? [])
      score += weight * details.score
      mementoUnreachableTargets = Math.max(
        mementoUnreachableTargets,
        details.unreachableTargets
      )
      return
    }
    score += weight * rawScoreForObjective(objective, scoreCtx)
  }
  addObjective(ctx.objective, 1)
  for (const term of ctx.objectiveBlendTerms) {
    addObjective(term.objective, term.weight)
  }
  return { score, mementoUnreachableTargets }
}

export type AssignValueOptions = {
  /**
   * `mid` = capped MF iterations. `full` = iterative cat/place solve to default budget
   * (rescoring, UI).
   */
  solverTier?: SolverTier
  /**
   * Merged into analyzer args after tier selection. Used for experiments (e.g. cheaper Standard
   * budgets); included in the fitness cache key when non-empty.
   */
  analyzerArgsOverride?: Partial<AnalyzerArgs>
}

function assignValueCacheKey(
  ctx: FitnessContext,
  y: YardState,
  solverTier: SolverTier,
  analyzerArgsOverride?: Partial<AnalyzerArgs>
): string {
  const base = fitnessCacheKey(ctx, y, solverTier)
  if (analyzerArgsOverride == null || Object.keys(analyzerArgsOverride).length === 0)
    return base
  return `${base}\0args:${JSON.stringify(analyzerArgsOverride)}`
}

export function peekYardAnalyzerSummary(
  ctx: FitnessContext,
  y: YardState,
  options: AssignValueOptions = {}
): YardAnalyzerSummary | undefined {
  const solverTier: SolverTier = options.solverTier ?? "full"
  const key = assignValueCacheKey(ctx, y, solverTier, options.analyzerArgsOverride)
  return fitnessCachePeek(key)?.summary
}

export function assignValue(
  ctx: FitnessContext,
  y: YardState,
  options: AssignValueOptions = {}
): void {
  const solverTier: SolverTier = options.solverTier ?? "full"
  profileAssignValueEnter()
  const key = assignValueCacheKey(ctx, y, solverTier, options.analyzerArgsOverride)
  const cached = fitnessCacheGet(key)
  if (cached) {
    profileAssignValueCacheHit()
    y.value = cached.primary
    y.valueSecondary = cached.secondary
    y.requirementPenalty = cached.requirementPenalty
    y.mementoUnreachableTargets = cached.mementoUnreachableTargets
    y.hardRejectLevel = cached.hardRejectLevel
    return
  }

  if (yardHasInvalidStructure(y)) {
    y.value = 0
    y.valueSecondary = 0
    y.requirementPenalty = 0
    y.mementoUnreachableTargets = 0
    y.hardRejectLevel = FITNESS_HARD_REJECT_LAYOUT
    fitnessCacheSet(key, {
      primary: 0,
      secondary: 0,
      requirementPenalty: 0,
      mementoUnreachableTargets: 0,
      hardRejectLevel: FITNESS_HARD_REJECT_LAYOUT,
    })
    return
  }

  if (
    !passesGoodieConstraints(
      y,
      ctx.constraints.requiredGoodieIds,
      ctx.constraints.forbiddenGoodieIds,
      ctx.constraints.requiredIndoorGoodieIds,
      ctx.constraints.requiredOutdoorGoodieIds
    )
  ) {
    profileAssignValueGoodieReject()
    y.value = 0
    y.valueSecondary = 0
    y.requirementPenalty = 0
    y.mementoUnreachableTargets = 0
    y.hardRejectLevel = FITNESS_HARD_REJECT_RULES
    fitnessCacheSet(key, {
      primary: 0,
      secondary: 0,
      requirementPenalty: 0,
      mementoUnreachableTargets: 0,
      hardRejectLevel: FITNESS_HARD_REJECT_RULES,
    })
    return
  }

  const args = {
    ...buildAnalyzerArgs(ctx, y, solverTier),
    ...options.analyzerArgsOverride,
  }
  const analyzer = new NekoAtsumeAnalyzer(ctx.staticData, args)
  const t0 = yardOptimizerProfilingActive() ? performance.now() : 0
  const results = analyzer.analyze()
  if (yardOptimizerProfilingActive()) {
    profileAssignValueAnalyze(performance.now() - t0)
  }

  const tubbsSurfaces = {
    lastOutdoorBowlCostFactor: analyzer.lastOutdoorBowlCostFactor,
    lastBowlIncomeHaircut: analyzer.lastBowlIncomeHaircut,
  }
  const massByCat = analyzer.lastVisitMassByTargetCat ?? {}
  const waitStats = mementoWaitStatsForMassMap(ctx, y, massByCat)
  const summary = yardAnalyzerNetSummary(results, y, tubbsSurfaces)
  const fullAnalyze =
    solverTier === "full"
      ? {
          results,
          flowchartRuntime: analyzer.getFlowchartRuntime(),
          tubbsSurfaces,
          summary,
          lastMementoProxyByTargetCat: {
            ...(analyzer.lastMementoProxyByTargetCat ?? {}),
          },
          lastVisitMassByTargetCat: massByCat,
          fishVariancePerDay: firstOrderFishVariancePerDay(analyzer),
          waitStats,
        }
      : undefined
  const scoreCtx: ScoreContext = {
    results,
    summary,
    waitStats,
  }

  let goldIncome = summary?.netGoldPerDay ?? 0
  let netGoldEquivIncome = summary?.netGoldEquivPerDay ?? 0
  if (ctx.constraints.feasibilityRows.length > 0) {
    const adj = tubbsAdjustedGrosses(results, tubbsSurfaces)
    const pen = tubbsGoldEquivFoodPenalty(y, tubbsSurfaces.lastOutdoorBowlCostFactor)
    goldIncome = adj.gold - pen
    netGoldEquivIncome = summary?.netGoldEquivPerDay ?? adj.goldEquiv - pen
  }

  const feasibilityViolation =
    ctx.constraints.feasibilityRows.length > 0
      ? feasibilityViolationScore(
          ctx.constraints.feasibilityRows,
          results,
          goldIncome,
          tubbsGoldEquivFoodPenalty(y, tubbsSurfaces.lastOutdoorBowlCostFactor),
          netGoldEquivIncome
        )
      : 0
  const primaryDetails = blendedPrimaryScoreDetails(ctx, scoreCtx)
  const primary = primaryDetails.score
  const requirementPenalty =
    feasibilityViolation > 0 ? feasibilityViolation : 0
  const secondary = ctx.secondaryObjective
    ? rawScoreForObjective(ctx.secondaryObjective, scoreCtx)
    : 0

  y.value = primary
  y.valueSecondary = secondary
  y.requirementPenalty = requirementPenalty
  y.mementoUnreachableTargets = primaryDetails.mementoUnreachableTargets
  y.hardRejectLevel = FITNESS_HARD_REJECT_NONE
  fitnessCacheSet(key, {
    primary,
    secondary,
    requirementPenalty,
    mementoUnreachableTargets: primaryDetails.mementoUnreachableTargets,
    hardRejectLevel: FITNESS_HARD_REJECT_NONE,
    summary,
    fullAnalyze,
  })
}

export type { SolverTier } from "./fitnessContext"
