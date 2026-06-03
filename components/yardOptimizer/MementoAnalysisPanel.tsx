import type { Dispatch, SetStateAction } from "react"

import type { MementoTimeDisplayBasis } from "../../utils/yardOptimizer/foodBowlEconomy"
import type { MementoAnalysisResult } from "../../utils/yardOptimizer/fitness"
import { toMementoLabAnalysisContext } from "../../utils/yardOptimizer/yardAnalyzerReport"
import { isRareCatId } from "../../utils/cat/getCatType"
import { useLanguage } from "../../hooks/useLanguage"
import { translate as translateTable } from "../../utils/localization/translate"
import MementoLotteryLab from "./mementoLab/MementoLotteryLab"
import type { CatStartComeCounts } from "../yardOptimizerSessionConfig"
import { ConfigFold } from "./primitives"
import {
  TargetCatsPickerSection,
  type CatPickerOption,
  type CatVisitConfig,
} from "./ObjectivePanel"

type CatGroups = {
  normal: CatPickerOption[]
  rare: CatPickerOption[]
  other: CatPickerOption[]
}

function MementoTargetPicker({
  title,
  description,
  selectedCatNames,
  selectedCatVisitConfigs,
  selectedCats,
  byGroup,
  showVisitConfig,
  onClear,
  onResetStartComeCounts,
  onSetStartComeCount,
  onToggleCat,
  location,
  variant = "section",
}: {
  title: string
  description: string
  selectedCatNames: string[]
  selectedCatVisitConfigs: CatVisitConfig[]
  selectedCats: number[]
  byGroup: CatGroups
  showVisitConfig: boolean
  onClear: () => void
  onResetStartComeCounts: () => void
  onSetStartComeCount: (catId: number, next: number) => void
  onToggleCat: (catId: number) => void
  location: string
  variant?: "section" | "inline"
}) {
  return (
    <TargetCatsPickerSection
      title={title}
      description={description}
      selectedCatNames={selectedCatNames}
      selectedCatVisitConfigs={selectedCatVisitConfigs}
      selectedCats={selectedCats}
      byGroup={byGroup}
      showMementoMultiCatHint={selectedCatNames.length > 1}
      showVisitConfig={showVisitConfig}
      emptySelectionHint="choose at least one to show memento waits."
      onClear={onClear}
      onResetStartComeCounts={onResetStartComeCounts}
      onSetStartComeCount={onSetStartComeCount}
      onToggleCat={onToggleCat}
      location={location}
      variant={variant}
    />
  )
}

export function MementoAnalysisPanel({
  ranCatObjective,
  ranFishObjective,
  showFishMementoAnalysis,
  onToggleFishMementoAnalysis,
  mementoAnalysis,
  selectedCatNames,
  selectedCatVisitConfigs,
  selectedCats,
  byGroup,
  onClearSelectedCats,
  onResetStartComeCounts,
  onSetStartComeCount,
  onToggleCat,
  location,
  catStartComeCounts,
  setCatStartComeCounts,
  mementoTimeDisplayBasis,
  setMementoTimeDisplayBasis,
}: {
  ranCatObjective: boolean
  ranFishObjective: boolean
  showFishMementoAnalysis: boolean
  onToggleFishMementoAnalysis: () => void
  mementoAnalysis: MementoAnalysisResult | null
  selectedCatNames: string[]
  selectedCatVisitConfigs: CatVisitConfig[]
  selectedCats: number[]
  byGroup: CatGroups
  onClearSelectedCats: () => void
  onResetStartComeCounts: () => void
  onSetStartComeCount: (catId: number, next: number) => void
  onToggleCat: (catId: number) => void
  location: string
  catStartComeCounts: CatStartComeCounts
  setCatStartComeCounts: Dispatch<SetStateAction<CatStartComeCounts>>
  mementoTimeDisplayBasis: MementoTimeDisplayBasis
  setMementoTimeDisplayBasis: (basis: MementoTimeDisplayBasis) => void
}) {
  const { translate } = useLanguage()

  return (
    <>
      {!ranCatObjective && !ranFishObjective ? (
        <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Memento timing is optional for fish-income runs. Pick target cats if you want to
            check memento waits for this layout.
          </p>
          <button
            type="button"
            className="self-start sm:self-auto rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            onClick={onToggleFishMementoAnalysis}
          >
            {showFishMementoAnalysis ? "Hide yard analysis" : "Show yard analysis"}
          </button>
        </div>
      ) : null}
      {!ranCatObjective && !ranFishObjective && showFishMementoAnalysis ? (
        <MementoTargetPicker
          title="Memento target cats"
          description="Choose cats to evaluate memento timing and fish earned while waiting."
          selectedCatNames={selectedCatNames}
          selectedCatVisitConfigs={selectedCatVisitConfigs}
          selectedCats={selectedCats}
          byGroup={byGroup}
          showVisitConfig={true}
          onClear={onClearSelectedCats}
          onResetStartComeCounts={onResetStartComeCounts}
          onSetStartComeCount={onSetStartComeCount}
          onToggleCat={onToggleCat}
          location={location}
        />
      ) : null}
      {mementoAnalysis && (mementoAnalysis.byCat.length > 0 || ranFishObjective) ? (
        <ConfigFold
          title="Yard analysis"
          description={
            <>
              Analytic expectations and simulation validation for the same yard shown above.
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This panel starts from the analyzer&apos;s expected memento and fish models,
              then lets you roll the actual yard simulator to sanity-check the shape.
            </p>
            <MementoLotteryLab
              hideBlurb
              embedded
              catStartComeCounts={catStartComeCounts}
              onCatStartComeCountsChange={setCatStartComeCounts}
              timeDisplayBasis={mementoTimeDisplayBasis}
              onTimeDisplayBasisChange={setMementoTimeDisplayBasis}
              initialTab={ranFishObjective && !ranCatObjective ? "fish" : "chance"}
              emptyMementoTargetPicker={
                ranFishObjective && !ranCatObjective ? (
                  <MementoTargetPicker
                    title="Memento target cats"
                    description="Choose cats to evaluate memento timing for this layout."
                    selectedCatNames={selectedCatNames}
                    selectedCatVisitConfigs={selectedCatVisitConfigs}
                    selectedCats={selectedCats}
                    byGroup={byGroup}
                    showVisitConfig={true}
                    onClear={onClearSelectedCats}
                    onResetStartComeCounts={onResetStartComeCounts}
                    onSetStartComeCount={onSetStartComeCount}
                    onToggleCat={onToggleCat}
                    location={location}
                  />
                ) : null
              }
              mementoTargetPicker={
                <MementoTargetPicker
                  title="Change memento targets"
                  description="Choose which cats this analysis should use for memento timing."
                  selectedCatNames={selectedCatNames}
                  selectedCatVisitConfigs={selectedCatVisitConfigs}
                  selectedCats={selectedCats}
                  byGroup={byGroup}
                  showVisitConfig={false}
                  onClear={onClearSelectedCats}
                  onResetStartComeCounts={onResetStartComeCounts}
                  onSetStartComeCount={onSetStartComeCount}
                  onToggleCat={onToggleCat}
                  location={location}
                  variant="inline"
                />
              }
              analysis={toMementoLabAnalysisContext(
                mementoAnalysis,
                (catId) => translate(translateTable("Cat", `CatName${catId}`)),
                isRareCatId
              )}
            />
          </div>
        </ConfigFold>
      ) : null}
    </>
  )
}
