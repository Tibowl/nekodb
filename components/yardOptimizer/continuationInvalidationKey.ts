import type { OffspringScoreMode } from "../../utils/yardOptimizer/config"
import type {
  FitnessAnalyzerOptions,
  FitnessObjective,
  FitnessObjectiveTerm,
  SolverTier,
} from "../../utils/yardOptimizer/fitness"
import type { FeasibilityRow } from "../../utils/yardOptimizer/fitnessConstraints"
import type {
  FixedIndoorDraft,
  FixedOutdoorDraft,
  YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import type { CatStartComeCounts } from "../yardOptimizerSessionConfig"

/** Inputs that invalidate a paused GA continuation when changed. */
export type ContinuationInvalidationSlice = {
  poolSize: number
  tournamentK: number
  mutationRate: number
  mutationOffspringRate: number
  foodMutationOffspringRate: number
  openSlotExplorationRate: number
  offspringScoreMode: OffspringScoreMode
  survivorSelectionEnabled: boolean
  survivorExploratoryRate: number
  survivorInitialRankTemperature: number
  survivorFinalRankTemperature: number
  generations: number
  yardPreset: YardPreset
  fixedIndoorDraft: FixedIndoorDraft
  fixedOutdoorDraft: FixedOutdoorDraft
  fitnessObjective: FitnessObjective
  activeObjectiveBlendTerms: FitnessObjectiveTerm[]
  activeSecondaryObjective: FitnessObjective | null
  applyFeasibilityGate: boolean
  feasibilityRows: FeasibilityRow[]
  requiredGoodieIds: number[]
  requiredIndoorGoodieIds: number[]
  requiredOutdoorGoodieIds: number[]
  forbiddenGoodieIds: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
  analyzerOptions: FitnessAnalyzerOptions
  seasonalPoolOnly: boolean
  evolutionSolverTier: SolverTier
  catStartComeCounts: CatStartComeCounts
  cats: number[]
}

export function continuationInvalidationKey(
  slice: ContinuationInvalidationSlice
): string {
  return JSON.stringify(slice)
}
