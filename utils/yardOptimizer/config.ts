/** Default yard layout and scoring tuning (places, food lists, genetic search). */
import type { OpenGateMode } from "./analyzer/catPlaceSolver"

export const PLACES_INDOOR = 5
export const PLACES_OUTDOOR = 5

/**
 * Base memento rate by food type id (1–7). Index 0 unused.
 * Same values as `NekoAtsume2Data/tables/FoodRecordTable.json` (`MementoRate`).
 * Used in `NekoAtsumeAnalyzer` `mementoProxy` (visit-mass proxy only — no LotMemento visit-count math).
 */
export const FOOD_MEMENTO_RATE: readonly number[] = [
  0, 0.2, 1, 1.2, 1.2, 2, 1.2, 1.2,
]

/** Fallback when a food id is missing from {@link FOOD_MEMENTO_RATE}. Matches ids 3–7 in the shipped table. */
export const DEFAULT_FOOD_MEMENTO_RATE = 1.2

/** Base memento lottery rate for a bowl food type (before placement multipliers). */
export function foodMementoRateForType(foodTypeId: number): number {
  return FOOD_MEMENTO_RATE[foodTypeId] ?? DEFAULT_FOOD_MEMENTO_RATE
}

/**
 * Indoor-only multiplier on food memento rate (`LotMemento` scaling).
 * Outdoor uses unity.
 */
export const MEMENTO_INDOOR_PLACEMENT_MULT = 1.15
export const MEMENTO_OUTDOOR_PLACEMENT_MULT = 1.0

/** LotMemento start come-count for expected-wait estimates (currently always 0). */
export const MEMENTO_LOTTERY_START_COME_COUNT = 0

/** Full food-type list for both bowls (all snack types). */
export const DEFAULT_ALLOWED_FOODS_INDOOR = [1, 2, 3, 4, 5, 6, 7] as const
export const DEFAULT_ALLOWED_FOODS_OUTDOOR = DEFAULT_ALLOWED_FOODS_INDOOR

export type GeneticConfig = {
  poolSize: number
  tournamentK: number
  mutationRate: number
  mutationOffspringRate: number
  foodMutationOffspringRate: number
  openSlotExplorationRate: number
  offspringScoreMode: OffspringScoreMode
  survivorSelection: GeneticSurvivorSelectionConfig
}

export type OffspringScoreMode = "fast" | "balanced" | "thorough"
export type OffspringExplorationPreset = "fast" | "balanced" | "thorough"

export type OffspringExplorationPresetConfig = {
  label: string
  mutationOffspringRate: number
  foodMutationOffspringRate: number
  openSlotExplorationRate: number
  offspringScoreMode: OffspringScoreMode
}

export const OFFSPRING_EXPLORATION_PRESETS: Record<
  OffspringExplorationPreset,
  OffspringExplorationPresetConfig
> = {
  fast: {
    label: "Fast",
    mutationOffspringRate: 0.25,
    foodMutationOffspringRate: 0.25,
    openSlotExplorationRate: 0.35,
    offspringScoreMode: "fast",
  },
  balanced: {
    label: "Balanced",
    mutationOffspringRate: 0.5,
    foodMutationOffspringRate: 0.5,
    openSlotExplorationRate: 0.65,
    offspringScoreMode: "balanced",
  },
  thorough: {
    label: "Thorough",
    mutationOffspringRate: 0.5,
    foodMutationOffspringRate: 0.9,
    openSlotExplorationRate: 0.9,
    offspringScoreMode: "thorough",
  },
}

const DEFAULT_OFFSPRING_EXPLORATION = OFFSPRING_EXPLORATION_PRESETS.balanced

export type GeneticSurvivorSelectionConfig = {
  enabled: boolean
  exploratoryRate: number
  initialRankTemperature: number
  finalRankTemperature: number
  annealGenerations: number
}

export const DEFAULT_GENETIC: GeneticConfig = {
  poolSize: 80,
  tournamentK: 5,
  mutationRate: 0.05,
  mutationOffspringRate: DEFAULT_OFFSPRING_EXPLORATION.mutationOffspringRate,
  foodMutationOffspringRate: DEFAULT_OFFSPRING_EXPLORATION.foodMutationOffspringRate,
  openSlotExplorationRate: DEFAULT_OFFSPRING_EXPLORATION.openSlotExplorationRate,
  offspringScoreMode: DEFAULT_OFFSPRING_EXPLORATION.offspringScoreMode,
  survivorSelection: {
    enabled: true,
    exploratoryRate: 0.25,
    initialRankTemperature: 30,
    finalRankTemperature: 2,
    annealGenerations: 50,
  },
}

export function tournamentSelectionSize(poolSize: number): number {
  return Math.round(poolSize * 0.5)
}

export function repopulationSize(poolSize: number): number {
  return Math.round(poolSize * 0.25)
}

/**
 * **Standard** tier (`"mid"`): same global cat/place mean-field as Full, with a reduced outer budget
 * and relaxed outer stop, plus a lighter **per-component inner** loop inside each outer step (see
 * `solveComponentForTargetOccupancy` in `catPlaceSolver.ts`). Full tier keeps inner defaults 80 /
 * 1e-12 / 0.7 via the analyzer. Aggressive speed tuned;
 * if the test fails, back off slightly.
 */
export const GA_MID_SOLVER_MAX_ITERATIONS = 60
export const GA_MID_SOLVER_CONVERGENCE_THRESHOLD = 2e-4

/** Inner loop per conflict component per outer MF iteration (Standard tier only). */
export const GA_MID_COMPONENT_INNER_MAX_ITERATIONS = 10
/**
 * Occupancy-vs-target stop in `solveComponentForTargetOccupancy` (not the outer MF threshold).
 * Full tier uses 1e-12; Standard can be much looser for speed — still far below ~1e-3 layout noise.
 */
export const GA_MID_COMPONENT_INNER_TOLERANCE = 1e-5
export const GA_MID_COMPONENT_INNER_DAMPING = 0.78

/**
 * Default evolution tier: **Standard** (`"mid"`). Standard runs end with a full pool rescoring pass
 * so headings match the converged mean-field solve.
 */
export const GA_EVOLUTION_SOLVER_TIER = "mid" as const

/**
 * Row-win (`openGateMode`) the **search** (Standard/`mid`) tier runs while the user's chosen
 * row-win is the expensive `componentState`. The per-goodie proxy is ~5× cheaper search-wide (one solve is ~2× cheaper; it compounds over the run);
 * the terminal `full`-tier pool rescore (all `poolSize` members) re-ranks the survivors under the
 * user's real row-win before anything is displayed, so accuracy is restored where it matters and
 * only search ranking rides the proxy. Set to `null` to search the user's chosen row-win directly
 * (the older, slower behavior). If the user already picked `perPlace`, search and display match and
 * this is a no-op.
 */
export const GA_SEARCH_OPEN_GATE_OVERRIDE: OpenGateMode | null = "perPlace"
