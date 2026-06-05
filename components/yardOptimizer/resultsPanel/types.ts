import type { Dispatch, RefObject, SetStateAction } from "react"
import type { MementoTimeDisplayBasis } from "../../../utils/yardOptimizer/foodBowlEconomy"
import type { FeasibilityRow } from "../../../utils/yardOptimizer/fitnessConstraints"
import type {
  FitnessAnalyzerOptions,
  FitnessObjective,
  FitnessObjectiveTerm,
  MementoAnalysisResult,
} from "../../../utils/yardOptimizer/fitness"
import type { ItemPools } from "../../../utils/yardOptimizer/yardCore"
import type { YardState } from "../../../utils/yardOptimizer/types"
import type {
  FixedIndoorDraft,
  FixedOutdoorDraft,
  YardDraftPinFlags,
  YardPreset,
} from "../../../utils/yardOptimizer/layoutDrafts"
import type { OptimizerRunPhase } from "../clientHelpers"
import type { RunMeta, RunStats } from "../runTypes"
import type { EffectiveRunConfig } from "../optimizerRunSnapshot"

export type CopyToGameRow = {
  key: string
  side: "Indoor" | "Outdoor"
  slot: string
  id: number
  sourceLabel: string
  filterOptions: string[]
  hint: string
  sourceRank: number
  sourceIndex: number
}

export type MissedMinimumRow = {
  id: string
  label: string
  rule: string
  value: number
  miss: number
}

export type { MementoAnalysisResult }

export type FinalPoolSummary = {
  bestScore: number
  worstScore: number
  q1: number | null
  median: number | null
  q3: number | null
  topFoods: Array<[string, number]>
}

/** Live UI config used when `runMeta` is null or for per-field fallback. */
export type ResultsConfigSlice = {
  yardPreset: YardPreset
  draftPinFlags: YardDraftPinFlags
  fitnessObjective: FitnessObjective
  selectedCats: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
  applyFeasibilityGate: boolean
  feasibilityRows: FeasibilityRow[]
  requiredGoodieIds: number[]
  forbiddenGoodieIds: number[]
  fixedLocationFoodTypes: number[]
  fixedLocationGoodieIds: number[]
  analyzerOptions: FitnessAnalyzerOptions
  fixedIndoorDraft: FixedIndoorDraft
  fixedOutdoorDraft: FixedOutdoorDraft
  activeSecondaryObjective: FitnessObjective | null
  geneticPoolSize: number
  offspringScoreMode: string
  pools: ItemPools
}

export type ResultsScoreSlice = {
  scoreLabel: string
  displayPrimaryScoreText: string
  displayPrimaryScoreHasUnit: boolean
  scoreDisplayObjective: FitnessObjective | null
  displaySecondaryObjective: FitnessObjective | null
  formatObjectiveScore: (score: number, objective?: FitnessObjective | null) => string
  hasMultiGoalScore: boolean
  displayMultiGoalTerms: FitnessObjectiveTerm[]
  displayObjective: FitnessObjective
  displayPrimaryScore: number | null
  displayBlendTerms: FitnessObjectiveTerm[]
  rankingScoreBreakdown: {
    objective: number
    requirementPenalty: number
    mementoUnreachableTargets: number
  } | null
  searchStrengthAutoBumped: boolean
  displayMementoUnreachableTargets: number
  missedMinimumRows: MissedMinimumRow[]
  ranCatObjective: boolean
}

export type ResultsLayoutSlice = {
  best: YardState
  setBest: Dispatch<SetStateAction<YardState | null>>
  currentLayoutRef: RefObject<HTMLDivElement | null>
  manualDraftDirty: boolean
  copyToGameRows: CopyToGameRow[]
  indoorTitle: string
  outdoorTitle: string
  foodDisplayName: (foodTypeId: number) => string
  goodieDisplayName: (goodieId: number) => string
  location: string
  copyYardViewOpen: boolean
  setCopyYardViewOpen: Dispatch<SetStateAction<boolean>>
  selectedPreviewYardId: number
  setSelectedPreviewYardId: Dispatch<SetStateAction<number>>
  sortCatIdsByTableOrder: (ids: number[]) => number[]
  playerGoodieConstraintsSummaryFor: (
    requiredIds: readonly number[],
    forbiddenIds: readonly number[]
  ) => string
}

export type ResultsRunSlice = {
  runMeta: RunMeta | null
  displayRunStats: RunStats | null
  running: boolean
  progress: number
  progressTotal: number
  runPhase: OptimizerRunPhase
  pauseRequested: boolean
  hasContinuation: boolean
  finalPoolSummary: FinalPoolSummary | null
  finalPool: YardState[]
  selectedPoolSignature: string | null
  mementoAnalysis: MementoAnalysisResult | null
  mementoDisplayScale: {
    basis: MementoTimeDisplayBasis
    displayMul: number
  } | null
}

export type YardOptimizerResultsPanelProps = {
  layout: ResultsLayoutSlice
  scores: ResultsScoreSlice
  config: ResultsConfigSlice
  run: ResultsRunSlice
}

/** Props passed to results sub-panels after merging run snapshot + live config once. */
export type ResultsPanelChildProps = {
  layout: ResultsLayoutSlice
  scores: ResultsScoreSlice
  run: ResultsRunSlice
  effective: EffectiveRunConfig
}
