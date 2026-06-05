import type { OffspringScoreMode } from "../../utils/yardOptimizer/config"
import type { FeasibilityRow } from "../../utils/yardOptimizer/fitnessConstraints"
import {
  buildFitnessContext,
  type FitnessAnalyzerOptions,
  type FitnessContext,
  type FitnessObjective,
  type FitnessObjectiveTerm,
} from "../../utils/yardOptimizer/fitness"
import type { YardGenerationConstraints } from "../../utils/yardOptimizer/fitnessConstraints"
import {
  draftPinFlagsFromDrafts,
  fixedHalvesFromDrafts,
  type FixedIndoorDraft,
  type FixedOutdoorDraft,
  type YardDraftPinFlags,
  type YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import type { ItemPools } from "../../utils/yardOptimizer/yardCore"
import type { CatStartComeCounts } from "../yardOptimizerSessionConfig"
import type { RunMeta } from "./runTypes"
import { mergeFeasibilityRowsApplied } from "./optimizerRunSnapshot"

export type OptimizerFitnessLiveSlice = {
  yardPreset: YardPreset
  draftPinFlags: YardDraftPinFlags
  fixedIndoorDraft: FixedIndoorDraft
  fixedOutdoorDraft: FixedOutdoorDraft
  objective: FitnessObjective
  objectiveBlendTerms: FitnessObjectiveTerm[]
  secondaryObjective: FitnessObjective | null
  selectedCats: number[]
  catStartComeCounts: CatStartComeCounts
  applyFeasibilityGate: boolean
  feasibilityRows: FitnessContext["constraints"]["feasibilityRows"]
  requiredGoodieIds: number[]
  fixedIndoorGoodieIds: number[]
  fixedOutdoorGoodieIds: number[]
  forbiddenGoodieIds: number[]
  analyzerOptions: FitnessAnalyzerOptions
  pools: ItemPools
  yardGenerationConstraints?: YardGenerationConstraints
  sortCatIds: (ids: number[]) => number[]
  sortGoodieIds: (ids: number[]) => number[]
}

export type BuildOptimizerFitnessContextOptions = {
  /** Override objective; defaults to merged run/live objective. */
  objective?: FitnessObjective
  objectiveBlendTerms?: FitnessObjectiveTerm[]
  catIds?: number[]
  includeMementoComeCounts?: boolean
}

function needsMementoComeCounts(
  objective: FitnessObjective,
  blendTerms: FitnessObjectiveTerm[]
): boolean {
  return (
    objective === "mementoExpectedDays" ||
    blendTerms.some((term) => term.objective === "mementoExpectedDays")
  )
}

/** Single merge primitive for runMeta ?? live when building a mean-field fitness context. */
export function buildOptimizerFitnessContext(
  runMeta: RunMeta | null,
  live: OptimizerFitnessLiveSlice,
  options: BuildOptimizerFitnessContextOptions = {}
): FitnessContext {
  const objective =
    options.objective ?? runMeta?.objective ?? live.objective
  const objectiveBlendTerms =
    options.objectiveBlendTerms ??
    runMeta?.objectiveBlendTerms ??
    live.objectiveBlendTerms
  const catIds =
    options.catIds ??
    live.sortCatIds(runMeta?.catIds ?? live.selectedCats)
  const rowsApplied = mergeFeasibilityRowsApplied(runMeta, live)
  const includeComeCounts =
    options.includeMementoComeCounts ??
    needsMementoComeCounts(objective, objectiveBlendTerms)
  const fixedHalves = fixedHalvesFromDrafts(
    live.fixedIndoorDraft,
    live.fixedOutdoorDraft
  )

  return buildFitnessContext(
    catIds,
    objective,
    {
      feasibilityRows: rowsApplied,
      requiredGoodieIds: live.sortGoodieIds(
        runMeta?.requiredGoodieIds ?? live.requiredGoodieIds
      ),
      requiredIndoorGoodieIds: live.sortGoodieIds(
        runMeta?.requiredIndoorGoodieIds ?? live.fixedIndoorGoodieIds
      ),
      requiredOutdoorGoodieIds: live.sortGoodieIds(
        runMeta?.requiredOutdoorGoodieIds ?? live.fixedOutdoorGoodieIds
      ),
      forbiddenGoodieIds: live.sortGoodieIds(
        runMeta?.forbiddenGoodieIds ?? live.forbiddenGoodieIds
      ),
    },
    fixedHalves,
    runMeta?.analyzerOptions ?? live.analyzerOptions,
    runMeta?.secondaryObjective ?? live.secondaryObjective,
    includeComeCounts
      ? (runMeta?.catStartComeCounts ?? live.catStartComeCounts)
      : {},
    objectiveBlendTerms,
    live.yardGenerationConstraints
  )
}

/** Display/run snapshot fields not stored on `FitnessContext`. */
export type RunMetaStartExtras = {
  yardPreset: YardPreset
  pinIndoor: boolean
  pinOutdoor: boolean
  objective: FitnessObjective
  catStartComeCounts: CatStartComeCounts
  feasibilityRowsApplied: FeasibilityRow[]
  allowedFoodsIndoor: number[]
  allowedFoodsOutdoor: number[]
  fixedFoodTypes: number[]
  fixedItemIds: number[]
  largeItemCount: number
  smallItemCount: number
  poolSize: number
  offspringScoreMode: OffspringScoreMode
  currentLayoutSummary: string
}

/** Build frozen run metadata from a fitness context at search start — single source for `RunMeta`. */
export function buildRunMetaFromFitnessStart(
  ctx: FitnessContext,
  extras: RunMetaStartExtras
): RunMeta {
  return {
    yardPreset: extras.yardPreset,
    pinIndoor: extras.pinIndoor,
    pinOutdoor: extras.pinOutdoor,
    objective: extras.objective,
    objectiveBlendTerms: ctx.objectiveBlendTerms,
    secondaryObjective: ctx.secondaryObjective,
    catIds: [...ctx.targetCatIds],
    catStartComeCounts: extras.catStartComeCounts,
    feasibilityRowsApplied: extras.feasibilityRowsApplied,
    requiredGoodieIds: [...ctx.constraints.requiredGoodieIds],
    requiredIndoorGoodieIds: [...(ctx.constraints.requiredIndoorGoodieIds ?? [])],
    requiredOutdoorGoodieIds: [...(ctx.constraints.requiredOutdoorGoodieIds ?? [])],
    forbiddenGoodieIds: [...ctx.constraints.forbiddenGoodieIds],
    allowedFoodsIndoor: [...extras.allowedFoodsIndoor],
    allowedFoodsOutdoor: [...extras.allowedFoodsOutdoor],
    fixedFoodTypes: [...extras.fixedFoodTypes],
    fixedItemIds: [...extras.fixedItemIds],
    largeItemCount: extras.largeItemCount,
    smallItemCount: extras.smallItemCount,
    poolSize: extras.poolSize,
    offspringScoreMode: extras.offspringScoreMode,
    currentLayoutSummary: extras.currentLayoutSummary,
    analyzerOptions: ctx.analyzerOptions,
  }
}
