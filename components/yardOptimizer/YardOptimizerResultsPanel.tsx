import { RecommendedLayoutSection } from "./resultsPanel/RecommendedLayoutSection"
import { buildEffectiveRunConfig } from "./optimizerRunSnapshot"
import { YardStatsFold } from "./resultsPanel/YardStatsFold"
import type { YardOptimizerResultsPanelProps } from "./resultsPanel/types"

export type {
  CopyToGameRow,
  FinalPoolSummary,
  MissedMinimumRow,
  ResultsConfigSlice,
  ResultsLayoutSlice,
  ResultsRunSlice,
  ResultsScoreSlice,
  YardOptimizerResultsPanelProps,
} from "./resultsPanel/types"
export type { MementoAnalysisResult } from "../../utils/yardOptimizer/fitness"

export function YardOptimizerResultsPanel({
  layout,
  scores,
  config,
  run,
}: YardOptimizerResultsPanelProps) {
  const effective = buildEffectiveRunConfig(run.runMeta, config)
  const childProps = { layout, scores, run, effective }

  return (
    <>
      <RecommendedLayoutSection {...childProps} />
      <YardStatsFold {...childProps} />
    </>
  )
}
