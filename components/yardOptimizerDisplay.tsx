import type { ReactNode } from "react"
import {
  bowlDailySpendNativeBulkTriplet,
  type MementoTimeDisplayBasis,
} from "../utils/yardOptimizer/foodBowlEconomy"
import type { FeasibilityRow } from "../utils/yardOptimizer/fitnessConstraints"
import type {
  FitnessObjective,
  FitnessObjectiveTerm,
  YardAnalyzerSummary,
} from "../utils/yardOptimizer/fitness"

const ANALYZER_WEATHER_LABELS: Record<string, string> = {
  Autum: "Autumn",
}

export function formatAnalyzerWeather(weather: string) {
  return ANALYZER_WEATHER_LABELS[weather] ?? weather
}

export function objectiveLabelShort(o: FitnessObjective): string {
  switch (o) {
    case "netGoldEquiv":
      return "Net fish income (gold equiv)"
    case "netGold":
      return "Net gold income"
    case "netSilver":
      return "Net silver income"
    case "catProbability":
      return "On-screen chance for chosen cats"
    case "mementoExpectedDays":
      return "Mementos sooner"
    default:
      return o
  }
}

export function objectiveLabelLong(o: FitnessObjective): string {
  switch (o) {
    case "netGoldEquiv":
      return "Net fish income: gold fish equivalent after food cost"
    case "netGold":
      return "Net fish income: gold fish after food cost"
    case "netSilver":
      return "Net fish income: silver fish after food cost"
    case "catProbability":
      return "On-screen chance for chosen cats"
    case "mementoExpectedDays":
      return "Mementos sooner (shortest wait for the slowest cat)"
    default:
      return objectiveLabelShort(o)
  }
}

export function objectiveUnitLabel(o?: FitnessObjective | null): string {
  switch (o) {
    case "netGoldEquiv":
      return "gold equiv/food day"
    case "netGold":
      return "gold fish/food day"
    case "netSilver":
      return "silver fish/food day"
    case "catProbability":
      return "on-screen chance"
    case "mementoExpectedDays":
      return "estimated wait"
    default:
      return "score"
  }
}

export function objectiveHelpText(o?: FitnessObjective | null): string {
  switch (o) {
    case "netGoldEquiv":
      return "Income per food day after subtracting food cost. Gold equiv means gold fish plus silver fish divided by 50."
    case "netGold":
      return "Gold fish income per food day after subtracting gold food cost only."
    case "netSilver":
      return "Silver fish income per food day after subtracting silver food cost only."
    case "catProbability":
      return "Estimated chance the selected cat is on screen at a random moment. With multiple selected cats, this sums their on-screen chances."
    case "mementoExpectedDays":
      return "Largest per-cat expected wait among the selected cats. This is a comparison estimate, not a full all-cats completion simulation. Lower is better."
    default:
      return "Optimizer score."
  }
}

export function blendObjectiveHint(o: FitnessObjective): string {
  switch (o) {
    case "catProbability":
      return "Try 100 first; cat chances are small numbers."
    case "mementoExpectedDays":
      return "Higher weight means the search gives up more fish to shorten the wait."
    default:
      return "Higher weight gives this objective more pull in the multi-objective score."
  }
}

export function goalPriorityFormulaTerm(term: FitnessObjectiveTerm): string {
  return `${term.weight} weight × ${objectiveLabelShort(term.objective)}`
}

export function multiGoalScoringContextParts(
  terms: readonly FitnessObjectiveTerm[],
  fallbackObjective: FitnessObjective
): {
  objective: FitnessObjective
  blendTerms: FitnessObjectiveTerm[]
} {
  const first = terms[0] ?? { objective: fallbackObjective, weight: 0 }
  return {
    objective: first.objective,
    blendTerms: [
      { objective: first.objective, weight: first.weight - 1 },
      ...terms.slice(1),
    ],
  }
}

export function scoreHasDisplayUnit(
  score: number,
  objective?: FitnessObjective | null
): boolean {
  return Number.isFinite(score) && objective !== "mementoExpectedDays"
}

export function formatExpectedMementoTime(
  days: number,
  displayMul: number,
  basis: MementoTimeDisplayBasis
): string {
  if (!Number.isFinite(days)) return "—"
  const units = days * (displayMul > 0 ? displayMul : 1)
  const value =
    units >= 100 ? units.toFixed(0) : units >= 10 ? units.toFixed(1) : units.toFixed(2)
  if (basis === "gameDay") return `${value} food ${Math.abs(Number(value)) === 1 ? "day" : "days"}`
  return `${value} food refills`
}

export function mementoDisplayUnitLabel(basis: MementoTimeDisplayBasis): string {
  return basis === "gameDay" ? "food days" : "food refills"
}

export const MINUTES_PER_DAY = 24 * 60

export function formatStatNumber(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : "—"
}

export function formatPercent(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : "—"
}

export function formatFoodDayCost(foodId: number): string {
  const spend = bowlDailySpendNativeBulkTriplet(foodId)
  const parts: string[] = []
  if (spend.gold > 0) parts.push(`${spend.gold.toFixed(1)} gold`)
  if (spend.silver > 0) parts.push(`${spend.silver.toFixed(0)} silver`)
  const native = parts.length > 0 ? parts.join(" + ") : "free"
  return `${spend.goldEquiv.toFixed(1)} gold equiv (${native})`
}

export function UnitChip({
  unit,
  help,
}: {
  unit: string
  help: string
}) {
  return (
    <span
      className="inline-flex items-center rounded border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/50 px-1.5 py-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400 align-middle"
      title={help}
      aria-label={`${unit}: ${help}`}
      tabIndex={0}
    >
      {unit}
    </span>
  )
}

export function MetricLabel({
  children,
  unit,
  help,
}: {
  children: ReactNode
  unit: string
  help: string
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span>{children}</span>
      <UnitChip unit={unit} help={help} />
    </span>
  )
}

export function formatFitnessObjectiveDisplay(
  score: number,
  objective?: FitnessObjective | null
): string {
  if (!Number.isFinite(score)) return "—"
  if (objective === "catProbability") {
    return `${(score * 100).toFixed(3)}%`
  }
  if (objective === "mementoExpectedDays") {
    return Number.isFinite(score) ? (-score).toFixed(2) : "—"
  }
  return score.toFixed(2)
}

export const FOOD_TYPE_IDS = [1, 2, 3, 4, 5, 6, 7] as const

export const NET_FISH_OBJECTIVES = [
  "netGoldEquiv",
  "netGold",
  "netSilver",
] as const satisfies readonly FitnessObjective[]

export function isNetFishObjective(o: FitnessObjective): boolean {
  return (NET_FISH_OBJECTIVES as readonly FitnessObjective[]).includes(o)
}

export function objectiveNeedsTargetCats(o: FitnessObjective | null): boolean {
  return (
    o === "catProbability" ||
    o === "mementoExpectedDays"
  )
}

/** Fish primary → no tiebreaker; cat/memento primary → default net fish income. */
export function defaultSecondaryForPrimaryObjective(
  primary: FitnessObjective
): FitnessObjective | null {
  return objectiveNeedsTargetCats(primary) ? "netGoldEquiv" : null
}

export const NET_FISH_CURRENCY_OPTIONS: {
  id: (typeof NET_FISH_OBJECTIVES)[number]
  title: string
}[] = [
  { id: "netGoldEquiv", title: "Gold equiv" },
  { id: "netGold", title: "Gold" },
  { id: "netSilver", title: "Silver" },
]

export const OBJECTIVE_OPTION_ROWS: {
  id: FitnessObjective
  title: string
  description: ReactNode
}[] = [
  {
    id: "netGoldEquiv",
    title: "Maximize net fish income (after food cost)",
    description: (
      <>
        <strong>Default.</strong> Total fish income per food day from both yards, minus food cost.
      </>
    ),
  },
  {
    id: "catProbability",
    title: "Attract specific cats (on-screen chance)",
    description: (
      <>
        Help your chosen cats show up more often in the yard.
      </>
    ),
  },
  {
    id: "mementoExpectedDays",
    title: "Collect mementos sooner",
    description: <>Minimize the largest per-cat expected wait among the chosen cats.</>,
  },
]

export const PRIMARY_OBJECTIVE_OPTION_ROWS = OBJECTIVE_OPTION_ROWS

export const TIEBREAKER_OBJECTIVE_OPTION_ROWS = OBJECTIVE_OPTION_ROWS.filter(
  (row) => row.id !== "mementoExpectedDays"
)

export const BLEND_OBJECTIVE_OPTIONS: { id: FitnessObjective; title: string }[] = [
  ...NET_FISH_CURRENCY_OPTIONS,
  { id: "catProbability", title: "On-screen chance" },
  { id: "mementoExpectedDays", title: "Mementos sooner" },
]

export function feasibilityMetricHint(metric: FeasibilityRow["metric"]): string {
  switch (metric) {
    case "netGoldPerDay":
      return "Gold fish income per food day after food cost."
    case "netGoldEquivPerDay":
      return "Income per food day counted as gold equiv, after food cost."
    case "goldYardTotal":
      return "Gross gold fish per food day before food cost."
    case "goldEquivYardTotal":
      return "Gross fish per food day counted as gold equiv."
    case "silverYardTotal":
      return "Gross silver fish per food day before food cost."
    case "silverEquivYardTotal":
      return "Gross silver-value fish per food day, using gold as 50 silver."
    case "stayRateYardTotal":
      return "How much of the yard is occupied over time; higher means cats are using more play spaces."
    case "catProbabilityYardTotal":
      return "0-1 chance that cats are on screen; 0.05 means 5%."
    default:
      return "Requirement value for this metric."
  }
}

export function feasibilityMetricDisplayValue(
  metric: FeasibilityRow["metric"],
  stats: YardAnalyzerSummary
): number | null {
  switch (metric) {
    case "netGoldPerDay":
      return stats.netGoldPerDay
    case "netGoldEquivPerDay":
      return stats.netGoldEquivPerDay
    case "goldYardTotal":
      return stats.grossGoldPerDay
    case "goldEquivYardTotal":
      return stats.grossGoldEquivModelPerDay
    case "silverYardTotal":
      return stats.grossSilverPerDay
    case "silverEquivYardTotal":
      return stats.grossSilverPerDay / 50
    case "catProbabilityYardTotal":
      return stats.catProbabilityYardTotal
    case "stayRateYardTotal":
      return stats.stayRateYardTotal
    default:
      return null
  }
}

export function feasibilityRulePasses(value: number, rule: FeasibilityRow["rule"]): boolean {
  if (rule.op === "between") return value >= rule.min && value <= rule.max
  if (rule.op === ">=") return value >= rule.value
  if (rule.op === ">") return value > rule.value
  if (rule.op === "<=") return value <= rule.value
  if (rule.op === "<") return value < rule.value
  return true
}

export function feasibilityRuleMiss(value: number, rule: FeasibilityRow["rule"]): number {
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

export function formatRequirementValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0)
  if (Math.abs(value) >= 10) return value.toFixed(1)
  return value.toFixed(2)
}

export function formatRawScore(value: number): string {
  if (!Number.isFinite(value)) return String(value)
  if (Math.abs(value) >= 100) return value.toFixed(3)
  return value.toFixed(4)
}

export function percentileSorted(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((sorted.length - 1) * p))
  )
  return sorted[idx]!
}
