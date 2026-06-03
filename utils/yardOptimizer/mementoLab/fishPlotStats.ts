import {
  SILVER_FISH_PER_GOLD_FISH,
  yardFoodSpendForRunNative,
} from "../foodBowlEconomy"
import type { YardMementoSample } from "../yardMementoSim"
import type { SimulationBatchMode } from "./types"

export type FishPlotMetric = "netGoldCum" | "netGoldEquivCum" | "netSilverCum"

export function simulationBatchModeActionLabel(mode: SimulationBatchMode): string {
  return mode === "fish" ? "Simulate timing + fish" : "Simulate timing only"
}

export type FishPlotSummary = {
  xDays: number[]
  mean: number[]
  low: number[]
  high: number[]
  n: number
  hitCount: number
  endDayMean: number
  yMin: number
  yMax: number
}

export type FishPlotMetricStats = {
  sum: Float64Array
  sumSq: Float64Array
}

export type FishPlotBinnedStats = {
  xDays: number[]
  n: number
  hitCount: number
  endDaySum: number
  netGoldCum: FishPlotMetricStats
  netGoldEquivCum: FishPlotMetricStats
  netSilverCum: FishPlotMetricStats
}

export type AnalyticFishCurve = {
  xDays: number[]
  mean: number[]
  low: number[]
  high: number[]
}

export function fishPlotMetricLabel(metric: FishPlotMetric): string {
  switch (metric) {
    case "netGoldEquivCum":
      return "Net value in gold fish"
    case "netSilverCum":
      return "Net silver fish"
    case "netGoldCum":
    default:
      return "Net gold fish"
  }
}

export function fishPlotTitle(metric: FishPlotMetric): string {
  switch (metric) {
    case "netGoldEquivCum":
      return "Cumulative net value"
    case "netSilverCum":
      return "Cumulative net silver"
    case "netGoldCum":
    default:
      return "Cumulative net gold"
  }
}

export function fishPlotYAxisLabel(metric: FishPlotMetric): string {
  switch (metric) {
    case "netGoldEquivCum":
      return "net gold equiv"
    case "netSilverCum":
      return "net silver fish"
    case "netGoldCum":
    default:
      return "net gold fish"
  }
}

export function fishPlotValueAt(
  sample: YardMementoSample,
  gridDay: number,
  metric: FishPlotMetric,
  foodTypeIndoor: number,
  foodTypeOutdoor: number,
  outdoorRefills?: number
): number {
  const effectiveDay = Math.min(Math.max(0, gridDay), Math.max(0, sample.endDays))
  const spend = yardFoodSpendForRunNative(
    foodTypeIndoor,
    foodTypeOutdoor,
    effectiveDay,
    outdoorRefills
  )
  const timeline = sample.visitTimeline
  if (!timeline || timeline.length === 0 || effectiveDay <= 0) {
    if (metric === "netSilverCum") return -spend.silver
    if (metric === "netGoldEquivCum") return -spend.goldEquiv
    return -spend.gold
  }

  let lo = 0
  let hi = timeline.length - 1
  if (timeline.day[0]! > effectiveDay) {
    if (metric === "netSilverCum") return -spend.silver
    if (metric === "netGoldEquivCum") return -spend.goldEquiv
    return -spend.gold
  }
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (timeline.day[mid]! <= effectiveDay) lo = mid
    else hi = mid - 1
  }

  if (metric === "netSilverCum") {
    return timeline.silverCumulative[lo]! - spend.silver
  }
  if (metric === "netGoldEquivCum") {
    return (
      timeline.goldCumulative[lo]! +
      timeline.silverCumulative[lo]! / SILVER_FISH_PER_GOLD_FISH -
      spend.goldEquiv
    )
  }
  return timeline.goldCumulative[lo]! - spend.gold
}

export function emptyFishPlotMetricStats(n: number): FishPlotMetricStats {
  return {
    sum: new Float64Array(n),
    sumSq: new Float64Array(n),
  }
}

export function emptyFishPlotBinnedStats(xDays: number[]): FishPlotBinnedStats {
  const n = xDays.length
  return {
    xDays,
    n: 0,
    hitCount: 0,
    endDaySum: 0,
    netGoldCum: emptyFishPlotMetricStats(n),
    netGoldEquivCum: emptyFishPlotMetricStats(n),
    netSilverCum: emptyFishPlotMetricStats(n),
  }
}

export function cloneFishPlotMetricStats(stats: FishPlotMetricStats): FishPlotMetricStats {
  return {
    sum: stats.sum.slice(),
    sumSq: stats.sumSq.slice(),
  }
}

export function cloneFishPlotBinnedStats(stats: FishPlotBinnedStats): FishPlotBinnedStats {
  return {
    xDays: stats.xDays,
    n: stats.n,
    hitCount: stats.hitCount,
    endDaySum: stats.endDaySum,
    netGoldCum: cloneFishPlotMetricStats(stats.netGoldCum),
    netGoldEquivCum: cloneFishPlotMetricStats(stats.netGoldEquivCum),
    netSilverCum: cloneFishPlotMetricStats(stats.netSilverCum),
  }
}

export function addFishPlotValue(stats: FishPlotMetricStats, i: number, value: number): void {
  stats.sum[i] += value
  stats.sumSq[i] += value * value
}

export function addSampleToFishPlotBinnedStats(
  stats: FishPlotBinnedStats,
  sample: YardMementoSample,
  foodTypeIndoor: number,
  foodTypeOutdoor: number
): void {
  stats.n += 1
  if (sample.hitMemento) stats.hitCount += 1
  stats.endDaySum += sample.days ?? sample.endDays

  const xDays = stats.xDays
  const compact = sample.fishPlotTimeline
  for (let i = 0; i < xDays.length; i++) {
    const xDay = xDays[i]!
    let netGold: number
    let netGoldEquiv: number
    let netSilver: number

    if (compact) {
      // Charge the outdoor bowl by the refills the SIM actually spent up to this grid point (present
      // only under an active Tubbs mode); off leaves it absent and falls back to the base spend.
      const refills = compact.outdoorRefillsCumulative?.[i]
      const spend = yardFoodSpendForRunNative(
        foodTypeIndoor,
        foodTypeOutdoor,
        xDay,
        refills
      )
      const gold = compact.goldCumulative[i] ?? 0
      const silver = compact.silverCumulative[i] ?? 0
      netGold = gold - spend.gold
      netGoldEquiv =
        gold + silver / SILVER_FISH_PER_GOLD_FISH - spend.goldEquiv
      netSilver = silver - spend.silver
    } else {
      netGold = fishPlotValueAt(sample, xDay, "netGoldCum", foodTypeIndoor, foodTypeOutdoor)
      netGoldEquiv = fishPlotValueAt(sample, xDay, "netGoldEquivCum", foodTypeIndoor, foodTypeOutdoor)
      netSilver = fishPlotValueAt(sample, xDay, "netSilverCum", foodTypeIndoor, foodTypeOutdoor)
    }

    addFishPlotValue(stats.netGoldCum, i, netGold)
    addFishPlotValue(stats.netGoldEquivCum, i, netGoldEquiv)
    addFishPlotValue(stats.netSilverCum, i, netSilver)
  }
}

export function summarizeFishPlotBinnedStats(
  stats: FishPlotBinnedStats,
  metric: FishPlotMetric,
  z: number
): FishPlotSummary | null {
  const { xDays, n } = stats
  if (n === 0 || xDays.length === 0) return null
  const metricStats = stats[metric]
  const mean = xDays.map((_, i) => metricStats.sum[i]! / n)
  const low: number[] = []
  const high: number[] = []
  let yMin = Math.min(0, ...mean)
  let yMax = Math.max(1e-9, ...mean)
  for (let i = 0; i < xDays.length; i++) {
    const ss = Math.max(0, metricStats.sumSq[i]! - n * mean[i]! * mean[i]!)
    const sd = n > 1 ? Math.sqrt(ss / (n - 1)) : 0
    const half = z * sd
    const lo = mean[i]! - half
    const hi = mean[i]! + half
    low.push(lo)
    high.push(hi)
    yMin = Math.min(yMin, lo)
    yMax = Math.max(yMax, hi)
  }
  if (yMin === yMax) yMax = yMin + 1e-9
  return {
    xDays,
    mean,
    low,
    high,
    n,
    hitCount: stats.hitCount,
    endDayMean: stats.endDaySum / n,
    yMin,
    yMax,
  }
}

export function buildAnalyticFishCurve(
  xDays: number[],
  ratePerDay: number | null,
  variancePerDay: number | null,
  z: number
): AnalyticFishCurve | null {
  if (ratePerDay === null || xDays.length === 0) return null
  const mean: number[] = []
  const low: number[] = []
  const high: number[] = []

  for (let i = 0; i < xDays.length; i++) {
    const x = xDays[i]!
    const m = ratePerDay * x
    const totalVariance =
      variancePerDay !== null ? Math.max(0, variancePerDay) * x : 0
    const half = z * Math.sqrt(totalVariance)
    mean.push(m)
    low.push(m - half)
    high.push(m + half)
  }

  return { xDays, mean, low, high }
}
