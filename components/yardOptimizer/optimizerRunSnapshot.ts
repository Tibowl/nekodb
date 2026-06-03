import {
  formatCurrentLayoutSummary,
  type YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import type { FeasibilityRow } from "../../utils/yardOptimizer/fitnessConstraints"
import type { RunMeta } from "./runTypes"
import type { ResultsConfigSlice } from "./resultsPanel/types"

export function mergeFeasibilityRowsApplied(
  runMeta: RunMeta | null,
  live: Pick<ResultsConfigSlice, "applyFeasibilityGate" | "feasibilityRows">
): FeasibilityRow[] {
  return (
    runMeta?.feasibilityRowsApplied ??
    (live.applyFeasibilityGate ? live.feasibilityRows : [])
  )
}

/** Display config merge — parallel to {@link buildOptimizerFitnessContext} for scoring context. */
export function buildEffectiveRunConfig(
  runMeta: RunMeta | null,
  live: ResultsConfigSlice
) {
  const feasibilityRowsApplied = mergeFeasibilityRowsApplied(runMeta, live)

  return {
    yardPreset: runMeta?.yardPreset ?? live.yardPreset,
    pinIndoor: runMeta?.pinIndoor ?? live.draftPinFlags.pinIndoor,
    pinOutdoor: runMeta?.pinOutdoor ?? live.draftPinFlags.pinOutdoor,
    objective: runMeta?.objective ?? live.fitnessObjective,
    secondaryObjective: runMeta?.secondaryObjective ?? live.activeSecondaryObjective,
    catIds: runMeta?.catIds ?? live.selectedCats,
    allowedFoodsIndoor: runMeta?.allowedFoodsIndoor ?? live.selectedFoodsIndoor,
    allowedFoodsOutdoor: runMeta?.allowedFoodsOutdoor ?? live.selectedFoodsOutdoor,
    feasibilityRowsApplied,
    requiredGoodieIds: runMeta?.requiredGoodieIds ?? live.requiredGoodieIds,
    forbiddenGoodieIds: runMeta?.forbiddenGoodieIds ?? live.forbiddenGoodieIds,
    fixedFoodTypes: runMeta?.fixedFoodTypes ?? live.fixedLocationFoodTypes,
    fixedItemIds: runMeta?.fixedItemIds ?? live.fixedLocationGoodieIds,
    analyzerOptions: runMeta?.analyzerOptions ?? live.analyzerOptions,
    currentLayoutSummary:
      runMeta?.currentLayoutSummary ??
      formatCurrentLayoutSummary(live.fixedIndoorDraft, live.fixedOutdoorDraft),
    poolSize: runMeta?.poolSize ?? live.geneticPoolSize,
    offspringScoreMode: runMeta?.offspringScoreMode ?? live.offspringScoreMode,
    largeItemCount: runMeta?.largeItemCount ?? live.pools.largeItems.length,
    smallItemCount: runMeta?.smallItemCount ?? live.pools.smallItems.length,
  }
}

export type EffectiveRunConfig = ReturnType<typeof buildEffectiveRunConfig>

export function searchChangesLabel(
  pinIndoor: boolean,
  pinOutdoor: boolean
): string {
  if (!pinIndoor && !pinOutdoor) return "indoor and outdoor"
  if (pinIndoor && !pinOutdoor) return "outdoor only"
  if (!pinIndoor && pinOutdoor) return "indoor only"
  return "neither (both held fixed)"
}

export function yardPresetDisplayLabel(preset: YardPreset): string {
  if (preset === "full") return "Both yards"
  if (preset === "outdoor_only") return "Outdoor only"
  return "Custom"
}
