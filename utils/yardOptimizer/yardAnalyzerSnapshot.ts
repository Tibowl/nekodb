import type { FlowchartSimRuntime } from "./yardFlowchartSim"
import type { TubbsAnalyzerSurfaces } from "./tubbsEconomy"
import {
  CAT_STAY_TICK_AVG,
  MINUTES_PER_DAY,
  MINUTES_PER_TICK,
  STAY_TICK_RANGE,
} from "./analyzer/constants"
import type { NekoAtsumeAnalyzer } from "./analyzer/nekoAtsumeAnalyzer"
import { SILVER_FISH_PER_GOLD_FISH } from "./foodBowlEconomy"
import {
  GOLD_GIFT_PROBABILITY_INDOOR,
  GOLD_GIFT_PROBABILITY_OUTDOOR,
} from "./visitEconomy"

/** Tubbs-adjusted net fish rates per food day (one naming scheme everywhere). */
export type FishRatesPerDay = {
  netGoldPerDay: number
  netSilverPerDay: number
  netGoldEquivPerDay: number
}

export type FishVariancePerDay = FishRatesPerDay

/** Analyzer yard totals for UI (same run as fitness; uses the fitness LRU cache when hot). */
export type YardAnalyzerSummary = FishRatesPerDay & {
  grossSilverPerDay: number
  grossGoldPerDay: number
  grossGoldEquivModelPerDay: number
  grossGoldEquivNaivePerDay: number
  netGoldEquivNaivePerDay: number
  catProbabilityYardTotal: number
  stayRateYardTotal: number
}

export type MementoWaitStatsRow = {
  catId: number
  expectedVisits: number
  expectedDays: number
  visitsPerDay: number
  probSuccessWithinCap: number
  indoorVisitsPerHorizon: number
  outdoorVisitsPerHorizon: number
}

/** Cached full-tier analyze output (no live `NekoAtsumeAnalyzer` instance). */
export type FullAnalyzeSnapshot = {
  results: Record<string, Record<string | number, number>>
  flowchartRuntime: FlowchartSimRuntime
  tubbsSurfaces: TubbsAnalyzerSurfaces
  summary: YardAnalyzerSummary
  lastMementoProxyByTargetCat: Record<number, number>
  lastVisitMassByTargetCat: Record<
    number,
    { indoorMass: number; outdoorMass: number }
  >
  fishVariancePerDay: FishVariancePerDay
  waitStats: MementoWaitStatsRow[]
}

export function fishRatesFromSummary(summary: YardAnalyzerSummary): FishRatesPerDay {
  return {
    netGoldPerDay: summary.netGoldPerDay,
    netSilverPerDay: summary.netSilverPerDay,
    netGoldEquivPerDay: summary.netGoldEquivPerDay,
  }
}

const SILVER_PAYOUT_MULT_MEAN = 1.25
const SILVER_PAYOUT_MULT_VARIANCE = (0.5 * 0.5) / 12
const SILVER_PAYOUT_MULT_SECOND_MOMENT =
  SILVER_PAYOUT_MULT_MEAN * SILVER_PAYOUT_MULT_MEAN +
  SILVER_PAYOUT_MULT_VARIANCE
const STAY_TICK_SECOND_MOMENT =
  STAY_TICK_RANGE.reduce((acc, s) => acc + s * s, 0) / STAY_TICK_RANGE.length
const GOLD_PAYOUT_SECOND_MOMENT =
  STAY_TICK_RANGE.reduce((acc, s) => acc + Math.floor(s / 2) ** 2, 0) /
  STAY_TICK_RANGE.length

/** First-order fish income variance per food day from analyzer calc space. */
export function firstOrderFishVariancePerDay(
  analyzer: NekoAtsumeAnalyzer
): FishVariancePerDay {
  const totalTicksPerDay = MINUTES_PER_DAY / MINUTES_PER_TICK
  const out: FishVariancePerDay = {
    netGoldPerDay: 0,
    netGoldEquivPerDay: 0,
    netSilverPerDay: 0,
  }
  for (const catDict of Object.values(analyzer.sameCatInteractionTermCalcSpace)) {
    for (const catData of Object.values(catDict)) {
      for (const [stayRatePerTick, silverRatePerTick, playspaceId] of catData) {
        if (stayRatePerTick <= 0) continue
        const visitRatePerDay =
          (stayRatePerTick * totalTicksPerDay) / CAT_STAY_TICK_AVG
        const goldP = analyzer.groupingStrategy.getIsIndoors(playspaceId)
          ? GOLD_GIFT_PROBABILITY_INDOOR
          : GOLD_GIFT_PROBABILITY_OUTDOOR
        const baseSilverRate = silverRatePerTick / SILVER_PAYOUT_MULT_MEAN
        const silverSecond =
          baseSilverRate *
          baseSilverRate *
          STAY_TICK_SECOND_MOMENT *
          SILVER_PAYOUT_MULT_SECOND_MOMENT
        const goldSecond = GOLD_PAYOUT_SECOND_MOMENT
        out.netGoldPerDay += visitRatePerDay * goldP * goldSecond
        out.netSilverPerDay += visitRatePerDay * (1 - goldP) * silverSecond
        out.netGoldEquivPerDay +=
          visitRatePerDay *
          (goldP * goldSecond +
            (1 - goldP) *
              silverSecond /
              (SILVER_FISH_PER_GOLD_FISH * SILVER_FISH_PER_GOLD_FISH))
      }
    }
  }
  return out
}
