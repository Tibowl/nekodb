import { getAnalyzerStaticData, type AnalyzerStaticData } from "./analyzer/staticData"
import type { InteractionMode, OpenGateMode, ReachMode } from "./analyzer/catPlaceSolver"
import {
  DEFAULT_TUBBS_MODE,
  normalizeTubbsMode,
  type TubbsMode,
} from "./tubbsMode"
import type { PlaySpaceData } from "./analyzer/nekoAtsumeAnalyzer"
import {
  defaultFitnessConstraints,
  type FitnessConstraints,
  type YardGenerationConstraints,
} from "./fitnessConstraints"

/**
 * What to maximize after optional minimum-requirement comparison (see `yardFitnessBetter`).
 * `mementoExpectedDays` folds target-cat visits through the memento lottery and scores the
 * slowest selected target cat's expected wait as lower-is-better.
 */
export type FitnessObjective =
  /** Gold + silver as gold units, minus `FOOD_PENALTY` for both bowls (daily profit). */
  | "netGoldEquiv"
  /** Gold fish income minus native gold bowl spend (daily profit). */
  | "netGold"
  /** Silver fish income minus native silver bowl spend (daily profit). */
  | "netSilver"
  | "catProbability"
  | "mementoExpectedDays"

export type FitnessObjectiveTerm = {
  objective: FitnessObjective
  /** User-facing goal priority: multiplier applied to this goal's raw score. */
  weight: number
}

/** Optimize the whole yard, or hold one side fixed while searching the other. */
export type FixedOutdoorHalf = {
  foodTypeOutdoor: number
  outdoorLarge: Set<number>
  outdoorSmall: Set<number>
}

export type FixedIndoorHalf = {
  foodTypeIndoor: number
  indoorLarge: Set<number>
  indoorSmall: Set<number>
}

/** Shared simulation settings for `NekoAtsumeAnalyzer`. */
export type FitnessAnalyzerOptions = {
  itemDamageState: 0 | 1 | 2
  weather: string
  totalDurationMinutes: number
  interactionMode: InteractionMode
  reachMode: ReachMode
  openGateMode: OpenGateMode
  /**
   * How the player handles Tubbs (cat 108): `off` (today's identity), `helper`, `kickSight`,
   * `kickRefill`, or `graze`. Each mode applies an OUTDOOR-only food-cost factor plus an income
   * adjustment to the outdoor portion of gross — the analyzer derives both per mode and surfaces
   * them as `lastOutdoorBowlCostFactor` / `lastBowlIncomeHaircut`, which scoring reads directly.
   * Unknown/legacy values normalize to {@link DEFAULT_TUBBS_MODE}.
   */
  tubbsMode: TubbsMode
}

/** Same set as `WeatherTypes` in `analyze.py`. */
export const ANALYZER_WEATHER_CHOICES: readonly string[] = [
  "None",
  "Spring",
  "Summer",
  "Autum",
  "Winter",
  "Snow",
  "Burning",
]

const REPEATING_SNOW_DATES = new Set([
  "12-15",
  "12-17",
  "12-18",
  "12-22",
  "12-24",
  "12-25",
  "12-28",
  "12-30",
  "12-31",
  "1-1",
  "1-2",
  "1-6",
  "1-7",
  "1-8",
  "1-15",
  "1-26",
  "1-27",
  "1-31",
  "2-3",
  "2-12",
  "2-21",
  "3-14",
])

function isRepeatingSnowDate(date: Date): boolean {
  return REPEATING_SNOW_DATES.has(`${date.getMonth() + 1}-${date.getDate()}`)
}

/**
 * Default for the analyzer's weather/season knob, matching the decompiled
 * `App_WeatherJudge` calendar predicates as closely as the current single
 * weather-column analyzer can represent.
 */
export function currentSeasonAnalyzerWeather(date = new Date()): string {
  if (isRepeatingSnowDate(date)) return "Snow"

  const month = date.getMonth() + 1
  if (month === 4 || month === 5) return "Spring"
  if (month === 7 || month === 8) return "Summer"
  if (month === 9 || month === 10) return "Autum"
  if (month === 12 || month === 1 || month === 2) return "Winter"
  return "None"
}

export const DEFAULT_FITNESS_ANALYZER_OPTIONS: FitnessAnalyzerOptions = {
  itemDamageState: 2,
  weather: currentSeasonAnalyzerWeather(),
  totalDurationMinutes: 1440,
  // `meanField + componentAware + componentState` lands within ~0.41% of MC
  // across the 5-yard GA-realistic benchmark (perPlace is ~0.61%), below the
  // simulator's own ~0.6-0.7% run-to-run noise floor, and converges reliably in
  // ~30 outer iterations (~10-25ms per solve). The errors are higher on this bed
  // than on hand-curated yards because GA-found high-yield yards are adversarial
  // (the optimizer keeps yards where the solver overshoots). See
  // `reachAudit/solverVsSim.bench.parity.test.ts` for the per-axis numbers.
  interactionMode: "meanField",
  reachMode: "componentAware",
  openGateMode: "componentState",
  // Default to `graze` — the realistic baseline play: never shoo Tubbs (keep his gift) and top up
  // the outdoor bowl on your next food round. Tubbs-free foods short-circuit to identity, so this
  // only moves scores on yards whose outdoor food (2/3/6) actually draws him.
  tubbsMode: DEFAULT_TUBBS_MODE,
}

export function defaultFitnessAnalyzerOptions(
  date = new Date()
): FitnessAnalyzerOptions {
  return {
    ...DEFAULT_FITNESS_ANALYZER_OPTIONS,
    weather: currentSeasonAnalyzerWeather(date),
  }
}

export const SOLVER_INTERACTION_MODES: readonly InteractionMode[] = [
  "meanField",
  "stateAverage",
  "sampled",
  "sampledUnique",
]

export const SOLVER_REACH_MODES: readonly ReachMode[] = [
  "shared",
  "renormalized",
  "componentAware",
]
export const SOLVER_OPEN_GATE_MODES: readonly OpenGateMode[] = [
  "perPlace",
  "componentState",
]
export { SOLVER_TUBBS_MODES, isSolverTubbsMode, normalizeTubbsMode } from "./tubbsMode"
export type { TubbsMode } from "./tubbsMode"

export function isSolverInteractionMode(x: unknown): x is InteractionMode {
  return typeof x === "string" && (SOLVER_INTERACTION_MODES as readonly string[]).includes(x)
}

export function isSolverReachMode(x: unknown): x is ReachMode {
  return typeof x === "string" && (SOLVER_REACH_MODES as readonly string[]).includes(x)
}

export function isSolverOpenGateMode(x: unknown): x is OpenGateMode {
  return typeof x === "string" && (SOLVER_OPEN_GATE_MODES as readonly string[]).includes(x)
}

function normalizeSolverReachMode(x: unknown): ReachMode {
  return isSolverReachMode(x) ? x : DEFAULT_FITNESS_ANALYZER_OPTIONS.reachMode
}

function normalizeSolverOpenGateMode(x: unknown): OpenGateMode {
  return isSolverOpenGateMode(x) ? x : DEFAULT_FITNESS_ANALYZER_OPTIONS.openGateMode
}

/** Parse stored session analyzer block (camelCase keys only). */
export function normalizeFitnessAnalyzerOptions(
  raw: Record<string, unknown>
): FitnessAnalyzerOptions | null {
  if (![0, 1, 2].includes(raw.itemDamageState as number)) return null
  if (typeof raw.weather !== "string") return null
  if (
    typeof raw.totalDurationMinutes !== "number" ||
    !Number.isFinite(raw.totalDurationMinutes)
  ) {
    return null
  }
  return {
    itemDamageState: raw.itemDamageState as 0 | 1 | 2,
    weather: raw.weather,
    totalDurationMinutes: raw.totalDurationMinutes,
    interactionMode: isSolverInteractionMode(raw.interactionMode)
      ? raw.interactionMode
      : DEFAULT_FITNESS_ANALYZER_OPTIONS.interactionMode,
    reachMode: normalizeSolverReachMode(raw.reachMode),
    openGateMode: normalizeSolverOpenGateMode(raw.openGateMode),
    tubbsMode: normalizeTubbsMode(raw.tubbsMode),
  }
}

export type FitnessContext = {
  targetCatIds: number[]
  /** Per-target starting memento `comeCount`; omitted cats default to 0. */
  targetCatStartComeCounts: Record<number, number>
  objective: FitnessObjective
  /** Extra goal-priority terms added to the primary objective score. */
  objectiveBlendTerms: FitnessObjectiveTerm[]
  /**
   * Optional second score from the same analyzer run: when two layouts tie on `objective`,
   * the one with higher secondary wins. Omit or null to disable.
   */
  secondaryObjective: FitnessObjective | null
  constraints: FitnessConstraints
  /** Pinned halves are copied onto every layout after crossover/mutation. */
  fixedOutdoor?: FixedOutdoorHalf
  fixedIndoor?: FixedIndoorHalf
  generationConstraints?: YardGenerationConstraints
  staticData: AnalyzerStaticData
  analyzerOptions: FitnessAnalyzerOptions
  /**
   * Lazy per-session cache of `PlaySpaceData` rows keyed by
   * `${playspaceId}|${foodIndoor}|${foodOutdoor}`. The analyzer reads and
   * populates this on each scored yard, skipping the per-yard
   * `calculateNonInteractiveVariables` build when a row is already cached.
   * Safe to share across all yards in one session because the other inputs to
   * that build (itemDamageState, weather, cat tables) are fixed inside
   * `analyzerOptions`. The cache is rebuilt fresh whenever a new
   * `FitnessContext` is constructed (which happens when the user changes
   * weather, damage, or any other analyzer-level setting).
   */
  playspaceDataCache: Map<string, PlaySpaceData>
}

export function buildFitnessContext(
  targetCatIds: number[],
  objective: FitnessObjective = "netGoldEquiv",
  constraints: FitnessConstraints = defaultFitnessConstraints,
  fixed?: { outdoor?: FixedOutdoorHalf; indoor?: FixedIndoorHalf },
  analyzerOptions?: Partial<FitnessAnalyzerOptions>,
  secondaryObjective: FitnessObjective | null = null,
  targetCatStartComeCounts: Record<number, number> = {},
  objectiveBlendTerms: FitnessObjectiveTerm[] = [],
  generationConstraints?: YardGenerationConstraints
): FitnessContext {
  const cloneFixedOutdoor = (f: FixedOutdoorHalf): FixedOutdoorHalf => ({
    foodTypeOutdoor: f.foodTypeOutdoor,
    outdoorLarge: new Set(f.outdoorLarge),
    outdoorSmall: new Set(f.outdoorSmall),
  })
  const cloneFixedIndoor = (f: FixedIndoorHalf): FixedIndoorHalf => ({
    foodTypeIndoor: f.foodTypeIndoor,
    indoorLarge: new Set(f.indoorLarge),
    indoorSmall: new Set(f.indoorSmall),
  })
  const ao: FitnessAnalyzerOptions = {
    ...defaultFitnessAnalyzerOptions(),
    ...analyzerOptions,
  }
  return {
    targetCatIds: [...targetCatIds],
    targetCatStartComeCounts: { ...targetCatStartComeCounts },
    objective,
    objectiveBlendTerms: objectiveBlendTerms
      .filter((t) => Number.isFinite(t.weight) && t.weight !== 0)
      .map((t) => ({ objective: t.objective, weight: t.weight })),
    secondaryObjective,
    constraints: {
      feasibilityRows: constraints.feasibilityRows.map((r) => ({ ...r })),
      requiredGoodieIds: [...constraints.requiredGoodieIds],
      requiredIndoorGoodieIds: [...(constraints.requiredIndoorGoodieIds ?? [])],
      requiredOutdoorGoodieIds: [...(constraints.requiredOutdoorGoodieIds ?? [])],
      forbiddenGoodieIds: [...constraints.forbiddenGoodieIds],
    },
    fixedOutdoor: fixed?.outdoor ? cloneFixedOutdoor(fixed.outdoor) : undefined,
    fixedIndoor: fixed?.indoor ? cloneFixedIndoor(fixed.indoor) : undefined,
    generationConstraints: generationConstraints
      ? {
          foodIndoor: generationConstraints.foodIndoor,
          foodOutdoor: generationConstraints.foodOutdoor,
          indoorLarge: generationConstraints.indoorLarge,
          indoorSmallSlots: [...generationConstraints.indoorSmallSlots],
          outdoorLarge: generationConstraints.outdoorLarge,
          outdoorSmallSlots: [...generationConstraints.outdoorSmallSlots],
        }
      : undefined,
    staticData: getAnalyzerStaticData(),
    analyzerOptions: ao,
    playspaceDataCache: new Map(),
  }
}

/** Mean-field budget during GA: `mid` caps iterations; `full` is the accurate budget. */
export type SolverTier = "mid" | "full"

/**
 * Standard evolution needs a terminal **`full`** rescoring pass on the pool so displayed numbers
 * match the converged mean-field solve.
 */
export function evolutionUsesEndFullRescore(tier: SolverTier): boolean {
  return tier === "mid"
}
