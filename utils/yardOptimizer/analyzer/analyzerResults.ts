import { YARD_TOTAL_KEY } from "./constants"

export type AnalyzerMetricKey =
  | "silver"
  | "gold"
  | "silverEquiv"
  | "goldEquiv"
  | "catProbability"
  | "mementoProxy"
  | "stayRate"

export type AnalyzerResults = Record<
  AnalyzerMetricKey,
  Record<string | number, number>
>

export function emptyAnalyzerResults(): AnalyzerResults {
  return {
    silver: {},
    gold: {},
    silverEquiv: {},
    goldEquiv: {},
    catProbability: {},
    mementoProxy: {},
    stayRate: {},
  }
}

/** Yard-total row for one analyzer metric (`results[key]["Your Yard Total"]`). */
export function metricTotal(
  results: Record<string, Record<string | number, number>>,
  metricKey: AnalyzerMetricKey
): number {
  const row = results[metricKey]
  if (!row) return 0
  return row[YARD_TOTAL_KEY] ?? 0
}
