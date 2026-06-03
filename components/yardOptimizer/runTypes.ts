import type { OffspringScoreMode } from "../../utils/yardOptimizer/config"
import type { FeasibilityRow } from "../../utils/yardOptimizer/fitnessConstraints"
import type { YardPreset } from "../../utils/yardOptimizer/layoutDrafts"
import type {
  FitnessAnalyzerOptions,
  FitnessContext,
  FitnessObjective,
  FitnessObjectiveTerm,
  SolverTier,
  YardAnalyzerSummary,
} from "../../utils/yardOptimizer/fitness"
import type { YardState } from "../../utils/yardOptimizer/types"
import type { CatStartComeCounts } from "../yardOptimizerSessionConfig"

export const DEFAULT_GENERATIONS = 50
export const CONTINUE_BATCH = 50

export type RunMeta = {
  yardPreset: YardPreset
  pinIndoor: boolean
  pinOutdoor: boolean
  objective: FitnessObjective
  objectiveBlendTerms: FitnessObjectiveTerm[]
  secondaryObjective: FitnessObjective | null
  catIds: number[]
  catStartComeCounts: CatStartComeCounts
  feasibilityRowsApplied: FeasibilityRow[]
  requiredGoodieIds: number[]
  requiredIndoorGoodieIds: number[]
  requiredOutdoorGoodieIds: number[]
  forbiddenGoodieIds: number[]
  allowedFoodsIndoor: number[]
  allowedFoodsOutdoor: number[]
  fixedFoodTypes: number[]
  fixedItemIds: number[]
  largeItemCount: number
  smallItemCount: number
  poolSize: number
  offspringScoreMode: OffspringScoreMode
  currentLayoutSummary: string
  analyzerOptions: FitnessAnalyzerOptions
}

export type ContinuationState = {
  ctx: FitnessContext
  pool: YardState[]
  lastGeneration: number
}

export type RunStats = {
  totalGenerations: number
  searchMode: "genetic"
  evolutionTierUsed: SolverTier
} & YardAnalyzerSummary

export type GenerationChunkResult =
  | {
      kind: "paused"
      pool: YardState[]
      ctx: FitnessContext
      lastGeneration: number
      remainingGenerations: number
      best: YardState | null
      // Mirror the `completed` fields so the paused branch can populate the
      // same scorecard / finalists panel after the pause-time `full`-tier
      // rescore. `totalGenerations` here is the number of generations the user
      // *has* run (i.e. `lastGeneration`), not the configured target.
      totalGenerations: number
      evolutionTierUsed: SolverTier
    }
  | {
      kind: "completed"
      pool: YardState[]
      ctx: FitnessContext
      lastGeneration: number
      best: YardState | null
      totalGenerations: number
      evolutionTierUsed: SolverTier
      searchStrengthAutoBumped: boolean
    }
  | { kind: "aborted" }
