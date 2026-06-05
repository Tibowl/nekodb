import { metricTotal as yardMetricTotal } from "./analyzer/analyzerResults"
import type { YardState } from "./types"

/** Yard-total metrics from `NekoAtsumeAnalyzer.analyze()` (custom grouping). */
export type FeasibilityMetric =
  | "netGoldPerDay"
  | "netGoldEquivPerDay"
  | "goldYardTotal"
  | "goldEquivYardTotal"
  | "silverYardTotal"
  | "silverEquivYardTotal"
  | "stayRateYardTotal"
  | "catProbabilityYardTotal"

export const FEASIBILITY_METRIC_LABELS: Record<FeasibilityMetric, string> = {
  netGoldPerDay: "Daily gold fish income (after food cost)",
  netGoldEquivPerDay: "Daily gold equiv income (after food cost)",
  goldYardTotal: "Gold fish (whole yard)",
  goldEquivYardTotal: "Gold equiv total (whole yard)",
  silverYardTotal: "Silver fish (whole yard)",
  silverEquivYardTotal: "Silver fish equivalent income (whole yard)",
  stayRateYardTotal: "Stay rate (whole yard)",
  catProbabilityYardTotal: "On-screen chance (whole yard)",
}

/** Stable UI / iteration order for metric dropdowns. */
export const FEASIBILITY_METRIC_ORDER: FeasibilityMetric[] = [
  "netGoldPerDay",
  "netGoldEquivPerDay",
  "goldYardTotal",
  "goldEquivYardTotal",
  "silverYardTotal",
  "silverEquivYardTotal",
  "stayRateYardTotal",
  "catProbabilityYardTotal",
]

export type FeasibilityRule =
  | { op: ">=" | "<=" | ">" | "<"; value: number }
  | { op: "between"; min: number; max: number }

export type FeasibilityRow = {
  id: string
  metric: FeasibilityMetric
  rule: FeasibilityRule
}

export type FitnessConstraints = {
  /**
   * Minimum-requirement rows. Empty = no minimum-requirement comparison penalty.
   */
  feasibilityRows: FeasibilityRow[]
  /** Goodie IDs that must appear in the yard (any slot). Empty = no requirement. */
  requiredGoodieIds: number[]
  /** Goodie IDs that must appear on the indoor side. Empty = no side-specific requirement. */
  requiredIndoorGoodieIds?: number[]
  /** Goodie IDs that must appear on the outdoor side. Empty = no side-specific requirement. */
  requiredOutdoorGoodieIds?: number[]
  /** Goodie IDs that must not appear in the yard. Empty = no ban. */
  forbiddenGoodieIds: number[]
}

export type GenerationSlotValue = number | "open" | null

export type YardGenerationConstraints = {
  foodIndoor: GenerationSlotValue
  foodOutdoor: GenerationSlotValue
  indoorLarge: GenerationSlotValue
  indoorSmallSlots: GenerationSlotValue[]
  outdoorLarge: GenerationSlotValue
  outdoorSmallSlots: GenerationSlotValue[]
}

export const defaultFitnessConstraints: FitnessConstraints = {
  feasibilityRows: [
    {
      id: "default-gold-equiv-profit",
      metric: "netGoldEquivPerDay",
      rule: { op: ">=", value: 0 },
    },
    {
      id: "default-gold-fish-profit",
      metric: "netGoldPerDay",
      rule: { op: ">=", value: 0 },
    },
  ],
  requiredGoodieIds: [],
  requiredIndoorGoodieIds: [],
  requiredOutdoorGoodieIds: [],
  forbiddenGoodieIds: [],
}

function newFeasibilityRowId(): string {
  return `r-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function defaultFeasibilityRow(): FeasibilityRow {
  return {
    id: newFeasibilityRowId(),
    metric: "netGoldEquivPerDay",
    rule: { op: ">=", value: 0 },
  }
}

/** Default gate: gold fish equivalent profit and expected gold fish both stay non-negative. */
export function defaultFeasibilityRows(): FeasibilityRow[] {
  return defaultFitnessConstraints.feasibilityRows.map((row) => ({
    ...row,
    rule: { ...row.rule },
  }))
}

export function isDefaultFeasibilityRows(rows: readonly FeasibilityRow[]): boolean {
  if (rows.length !== 2) return false
  return (
    rows.some(
      (row) =>
        row.metric === "netGoldEquivPerDay" &&
        row.rule.op === ">=" &&
        row.rule.value === 0
    ) &&
    rows.some(
      (row) =>
        row.metric === "netGoldPerDay" &&
        row.rule.op === ">=" &&
        row.rule.value === 0
    )
  )
}

export function formatFeasibilityRule(rule: FeasibilityRule): string {
  if (rule.op === "between") return `between ${rule.min} and ${rule.max}`
  return `${rule.op} ${rule.value}`
}

export function formatFeasibilityRow(row: FeasibilityRow): string {
  return `${FEASIBILITY_METRIC_LABELS[row.metric]} ${formatFeasibilityRule(row.rule)}`
}

export function formatFeasibilitySummary(rows: FeasibilityRow[]): string {
  if (rows.length === 0) return "none"
  return rows.map(formatFeasibilityRow).join("; ")
}

export function formatGoodieConstraintsSummary(
  required: readonly number[],
  forbidden: readonly number[]
): string {
  if (required.length === 0 && forbidden.length === 0) return "none"
  const parts: string[] = []
  if (required.length > 0) {
    parts.push(`must include goodies #${required.join(", #")}`)
  }
  if (forbidden.length > 0) {
    parts.push(`must not include goodies #${forbidden.join(", #")}`)
  }
  return parts.join("; ")
}

function goodieIdsInYard(y: YardState): Set<number> {
  return new Set([
    ...y.indoorLarge,
    ...y.indoorSmall,
    ...y.outdoorLarge,
    ...y.outdoorSmall,
  ])
}

export function passesGoodieConstraints(
  y: YardState,
  required: readonly number[],
  forbidden: readonly number[],
  requiredIndoor: readonly number[] = [],
  requiredOutdoor: readonly number[] = []
): boolean {
  const used = goodieIdsInYard(y)
  const indoorUsed = new Set([...y.indoorLarge, ...y.indoorSmall])
  const outdoorUsed = new Set([...y.outdoorLarge, ...y.outdoorSmall])
  for (const id of required) {
    if (!used.has(id)) return false
  }
  for (const id of requiredIndoor) {
    if (!indoorUsed.has(id)) return false
  }
  for (const id of requiredOutdoor) {
    if (!outdoorUsed.has(id)) return false
  }
  for (const id of forbidden) {
    if (used.has(id)) return false
  }
  return true
}

function yardTotal(
  results: Record<string, Record<string | number, number>>,
  metricKey: string
): number {
  return yardMetricTotal(
    results,
    metricKey as Parameters<typeof yardMetricTotal>[1]
  )
}

function feasibilityMetricValue(
  metric: FeasibilityMetric,
  results: Record<string, Record<string | number, number>>,
  goldIncome: number,
  pen: number,
  netGoldEquivPerDay: number
): number {
  switch (metric) {
    case "netGoldPerDay":
      return goldIncome
    case "netGoldEquivPerDay":
      // Tubbs-adjusted net threaded from the caller (matches the net objective under all modes;
      // equals yardTotal(results,'goldEquiv') - pen under off / Rt<=0).
      return netGoldEquivPerDay
    case "goldYardTotal":
      return yardTotal(results, "gold")
    case "goldEquivYardTotal":
      return yardTotal(results, "goldEquiv")
    case "silverYardTotal":
      return yardTotal(results, "silver")
    case "silverEquivYardTotal":
      return yardTotal(results, "silverEquiv")
    case "stayRateYardTotal":
      return yardTotal(results, "stayRate")
    case "catProbabilityYardTotal":
      return yardTotal(results, "catProbability")
    default:
      return 0
  }
}

function feasibilityRuleViolation(value: number, rule: FeasibilityRule): number {
  if (!Number.isFinite(value)) return 1
  if (rule.op === "between") {
    if (value >= rule.min && value <= rule.max) return 0
    const distance = value < rule.min ? rule.min - value : value - rule.max
    const scale = Math.max(Math.abs(rule.min), Math.abs(rule.max), rule.max - rule.min, 1)
    return distance / scale
  }
  if (rule.op === ">=") {
    if (value >= rule.value) return 0
    return (rule.value - value) / Math.max(Math.abs(rule.value), 1)
  }
  if (rule.op === ">") {
    if (value > rule.value) return 0
    return (rule.value - value + 1e-9) / Math.max(Math.abs(rule.value), 1)
  }
  if (rule.op === "<=") {
    if (value <= rule.value) return 0
    return (value - rule.value) / Math.max(Math.abs(rule.value), 1)
  }
  if (rule.op === "<") {
    if (value < rule.value) return 0
    return (value - rule.value + 1e-9) / Math.max(Math.abs(rule.value), 1)
  }
  return 0
}

/**
 * Normalized amount by which the layout misses the minimum rows.
 *
 * A passing row contributes 0. A miss contributes roughly "fraction of the rule target missed",
 * so `Net gold / day >= 10` with value 9 contributes 0.1. Minimum rows stay out of
 * the objective score and are compared directly by this normalized miss.
 */
export function feasibilityViolationScore(
  rows: FeasibilityRow[],
  results: Record<string, Record<string | number, number>>,
  goldIncome: number,
  pen: number,
  netGoldEquivPerDay: number
): number {
  let total = 0
  for (const row of rows) {
    const v = feasibilityMetricValue(
      row.metric,
      results,
      goldIncome,
      pen,
      netGoldEquivPerDay
    )
    total += feasibilityRuleViolation(v, row.rule)
  }
  return total
}
