import { metricTotal } from "./analyzer/analyzerResults"
import {
  foodMementoRateForType,
  MEMENTO_INDOOR_PLACEMENT_MULT,
  MEMENTO_LOTTERY_START_COME_COUNT,
  MEMENTO_OUTDOOR_PLACEMENT_MULT,
} from "./config"
import {
  bowlDurationTicks,
  mementoTimeDisplayScale,
} from "./foodBowlEconomy"
import type { TubbsMode } from "./tubbsMode"
import type { YardState } from "./types"
import type { FlowchartSimRuntime } from "./yardFlowchartSim"
import type { FitnessContext } from "./fitnessContext"
import type {
  FishRatesPerDay,
  FishVariancePerDay,
  FullAnalyzeSnapshot,
  YardAnalyzerSummary,
} from "./yardAnalyzerSnapshot"
import { fishRatesFromSummary } from "./yardAnalyzerSnapshot"
import {
  assignValue,
  maxExpectedMementoDays,
  peekFullAnalyzeSnapshot,
  peekYardAnalyzerSummary,
} from "./fitnessScore"
import type { MementoLabAnalysisContext } from "./mementoLab/types"

export type { YardAnalyzerSummary } from "./yardAnalyzerSnapshot"

export type MementoAnalysisResult = {
  yardTotalMementoProxy: number
  flowchartRuntime: FlowchartSimRuntime
  sumTargetCats: number
  byCat: {
    catId: number
    proxy: number
    shareOfTargets: number
    expectedMementoVisits: number
    expectedMementoDays: number
    mementoVisitsPerDay: number
    mementoProbSuccessWithinCap: number
    onScreenChance: number
    visitsPerHorizon: number
    indoorVisitsPerHorizon: number
    outdoorVisitsPerHorizon: number
  }[]
  foodTypeIndoor: number
  foodTypeOutdoor: number
  /** Table `MementoRate` for the indoor bowl (LotMemento input, before placement mult). */
  lotteryFoodMementoRateIndoor: number
  /** Table `MementoRate` for the outdoor bowl (LotMemento input, before placement mult). */
  lotteryFoodMementoRateOutdoor: number
  totalDurationMinutes: number
  fishRatesPerDay: FishRatesPerDay
  fishVariancePerDay: FishVariancePerDay
  coefficients: { label: string; value: string }[]
  expectedMaxTargetMementoDays: number
  expectedMaxTargetMementoFoodUnits: number
  timeDisplayMul: number
  timeDisplayReferenceFoodId: number | null
  tubbsMode: TubbsMode
  outdoorBowlDurationTicks: number
  indoorBowlDurationTicks: number
}

function buildMementoAnalysisResult(
  ctx: FitnessContext,
  y: YardState,
  snapshot: FullAnalyzeSnapshot
): MementoAnalysisResult {
  const { results } = snapshot
  const yardTotal = metricTotal(results, "mementoProxy")
  const raw = snapshot.lastMementoProxyByTargetCat
  const massByCat = snapshot.lastVisitMassByTargetCat
  const catIds = [...ctx.targetCatIds].sort((a, b) => a - b)
  let sumTargetCats = 0
  for (const id of catIds) sumTargetCats += raw[id] ?? 0

  const denom = sumTargetCats > 0 ? sumTargetCats : yardTotal
  const waitStatsByCat = new Map(
    snapshot.waitStats.map((row) => [row.catId, row])
  )
  const byCat = catIds.map((catId) => {
    const proxy = raw[catId] ?? 0
    const m = massByCat[catId] ?? { indoorMass: 0, outdoorMass: 0 }
    const wait = waitStatsByCat.get(catId)
    const indoorVisits = wait?.indoorVisitsPerHorizon ?? 0
    const outdoorVisits = wait?.outdoorVisitsPerHorizon ?? 0
    return {
      catId,
      proxy,
      shareOfTargets: denom > 0 ? proxy / denom : 0,
      expectedMementoVisits: wait?.expectedVisits ?? Number.POSITIVE_INFINITY,
      expectedMementoDays: wait?.expectedDays ?? Number.POSITIVE_INFINITY,
      mementoVisitsPerDay: wait?.visitsPerDay ?? 0,
      mementoProbSuccessWithinCap: wait?.probSuccessWithinCap ?? 0,
      onScreenChance: m.indoorMass + m.outdoorMass,
      visitsPerHorizon: indoorVisits + outdoorVisits,
      indoorVisitsPerHorizon: indoorVisits,
      outdoorVisitsPerHorizon: outdoorVisits,
    }
  })
  const expectedMaxDays = maxExpectedMementoDays(
    byCat.map((row) => ({ expectedDays: row.expectedMementoDays }))
  )

  const lotteryIn = foodMementoRateForType(y.foodTypeIndoor)
  const lotteryOut = foodMementoRateForType(y.foodTypeOutdoor)
  const timeDisplay = mementoTimeDisplayScale(
    "shortestBowlRefill",
    y.foodTypeIndoor,
    y.foodTypeOutdoor,
    [y.foodTypeIndoor, y.foodTypeOutdoor]
  )
  const coefficients: MementoAnalysisResult["coefficients"] = [
    { label: "Lottery food memento rate (indoor bowl)", value: String(lotteryIn) },
    { label: "Lottery food memento rate (outdoor bowl)", value: String(lotteryOut) },
    {
      label: "Placement multiplier — indoor goodies",
      value: MEMENTO_INDOOR_PLACEMENT_MULT.toFixed(4),
    },
    {
      label: "Placement multiplier — outdoor goodies",
      value: MEMENTO_OUTDOOR_PLACEMENT_MULT.toFixed(4),
    },
    {
      label: "Lottery start come-count assumption",
      value: String(MEMENTO_LOTTERY_START_COME_COUNT),
    },
    {
      label: "Wait display scale",
      value: `shortest-bowl refills (${timeDisplay.displayMul.toFixed(2)}/game-day)`,
    },
  ]

  return {
    yardTotalMementoProxy: yardTotal,
    flowchartRuntime: snapshot.flowchartRuntime,
    sumTargetCats,
    byCat,
    foodTypeIndoor: y.foodTypeIndoor,
    foodTypeOutdoor: y.foodTypeOutdoor,
    lotteryFoodMementoRateIndoor: lotteryIn,
    lotteryFoodMementoRateOutdoor: lotteryOut,
    totalDurationMinutes: ctx.analyzerOptions.totalDurationMinutes,
    fishRatesPerDay: fishRatesFromSummary(snapshot.summary),
    fishVariancePerDay: snapshot.fishVariancePerDay,
    coefficients,
    expectedMaxTargetMementoDays: expectedMaxDays,
    expectedMaxTargetMementoFoodUnits: expectedMaxDays * timeDisplay.displayMul,
    timeDisplayMul: timeDisplay.displayMul,
    timeDisplayReferenceFoodId: timeDisplay.referenceFoodId,
    tubbsMode: ctx.analyzerOptions.tubbsMode,
    outdoorBowlDurationTicks: bowlDurationTicks(y.foodTypeOutdoor),
    indoorBowlDurationTicks: bowlDurationTicks(y.foodTypeIndoor),
  }
}

export function runMementoAnalysis(
  ctx: FitnessContext,
  y: YardState
): MementoAnalysisResult {
  assignValue(ctx, y, { solverTier: "full" })
  const snapshot = peekFullAnalyzeSnapshot(ctx, y, { solverTier: "full" })
  if (!snapshot) {
    throw new Error("runMementoAnalysis: missing cached full analyze after assignValue")
  }
  return buildMementoAnalysisResult(ctx, y, snapshot)
}

export function getYardAnalyzerSummary(
  ctx: FitnessContext,
  y: YardState
): YardAnalyzerSummary {
  assignValue(ctx, y, { solverTier: "full" })
  const summary = peekYardAnalyzerSummary(ctx, y, { solverTier: "full" })
  if (summary) return summary
  throw new Error("getYardAnalyzerSummary: missing cached summary after full assignValue")
}

export function toMementoLabAnalysisContext(
  result: MementoAnalysisResult,
  catNameFor: (catId: number) => string,
  isRareCat: (catId: number) => boolean
): MementoLabAnalysisContext {
  return {
    cats: result.byCat.map((row) => ({
      catId: row.catId,
      catName: catNameFor(row.catId),
      isRareCat: isRareCat(row.catId),
      visitsPerHorizon: row.visitsPerHorizon,
      indoorVisitsPerHorizon: row.indoorVisitsPerHorizon,
      outdoorVisitsPerHorizon: row.outdoorVisitsPerHorizon,
    })),
    foodTypeIndoor: result.foodTypeIndoor,
    foodTypeOutdoor: result.foodTypeOutdoor,
    lotteryFoodMementoRateIndoor: result.lotteryFoodMementoRateIndoor,
    lotteryFoodMementoRateOutdoor: result.lotteryFoodMementoRateOutdoor,
    totalDurationMinutes: result.totalDurationMinutes,
    fishRatesPerDay: result.fishRatesPerDay,
    fishVariancePerDay: result.fishVariancePerDay,
    defaultFishMetric: "netGoldCum",
    flowchartRuntime: result.flowchartRuntime,
    tubbsMode: result.tubbsMode,
    outdoorBowlDurationTicks: result.outdoorBowlDurationTicks,
    indoorBowlDurationTicks: result.indoorBowlDurationTicks,
  }
}
