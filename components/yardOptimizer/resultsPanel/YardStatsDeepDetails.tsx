import { cloneYard, yardSignature } from "../../../utils/yardOptimizer/yardCore"
import {
  formatExpectedMementoTime,
  formatRawScore,
  formatStatNumber,
  formatAnalyzerWeather,
} from "../../yardOptimizerDisplay"
import { formatRawIdList, goodieConditionLabel } from "../clientHelpers"
import { RESULT_STAT_PANEL_CLASS } from "./styles"
import { MementoFoodRateDetailRow } from "./MementoFoodRateSummary"
import type { ResultsLayoutSlice, ResultsPanelChildProps, ResultsScoreSlice } from "./types"

type YardStatsDeepDetailsProps = Pick<ResultsPanelChildProps, "run" | "effective"> & {
  layout: Pick<ResultsLayoutSlice, "best" | "setBest">
  scores: Pick<
    ResultsScoreSlice,
    "displaySecondaryObjective" | "displayPrimaryScore" | "displayBlendTerms"
  >
}

export function YardStatsDeepDetails({
  layout,
  scores,
  run,
  effective,
}: YardStatsDeepDetailsProps) {
  const { best, setBest } = layout
  const { displaySecondaryObjective, displayPrimaryScore, displayBlendTerms } = scores
  const {
    finalPoolSummary,
    finalPool,
    selectedPoolSignature,
    mementoAnalysis,
    mementoDisplayScale,
  } = run

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      {finalPoolSummary ? (
        <details
          className={`${RESULT_STAT_PANEL_CLASS} group/final-pool min-w-0 self-start [&_summary::-webkit-details-marker]:hidden`}
        >
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                Other finalist layouts
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Nearby layouts the search finished with.
              </span>
            </span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/final-pool:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="mt-3 border-t border-slate-200/70 pt-3 dark:border-slate-700/70">
            <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              {[
                ["Best", finalPoolSummary.bestScore],
                ["Q3", finalPoolSummary.q3 ?? finalPoolSummary.bestScore],
                ["Median", finalPoolSummary.median ?? finalPoolSummary.bestScore],
                ["Q1", finalPoolSummary.q1 ?? finalPoolSummary.worstScore],
                ["Worst", finalPoolSummary.worstScore],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                  <dd className="font-mono text-slate-800 dark:text-slate-100">
                    {formatRawScore(value as number)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Food pairs:{" "}
              {finalPoolSummary.topFoods.map(([food, count]) => `${food} (${count})`).join(", ")}
            </p>
            <div className="mt-3 max-w-full overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-1.5 pr-2 text-left font-medium">Pick</th>
                    <th className="py-1.5 px-2 text-right font-medium">Rank</th>
                    <th className="py-1.5 px-2 text-left font-medium">Rank key</th>
                    <th className="py-1.5 px-2 text-left font-medium">Food</th>
                    <th className="py-1.5 pl-2 text-left font-medium">Toys</th>
                  </tr>
                </thead>
                <tbody>
                  {finalPool.slice(0, 12).map((yard, idx) => {
                    const sig = yardSignature(yard)
                    const selected = sig === selectedPoolSignature
                    return (
                      <tr
                        key={`${sig}-${idx}`}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-700/70"
                      >
                        <td className="py-1.5 pr-2">
                          <button
                            type="button"
                            onClick={() => setBest(cloneYard(yard))}
                            className={`rounded border px-2 py-1 text-xs font-medium ${
                              selected
                                ? "border-blue-400 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950/40 dark:text-blue-200"
                                : "border-slate-300 text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                            }`}
                          >
                            {selected ? "Selected" : "Inspect"}
                          </button>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">{idx + 1}</td>
                        <td className="py-1.5 px-2">
                          <span className="font-mono text-slate-800 dark:text-slate-100">
                            {yard.mementoUnreachableTargets ?? 0} ·{" "}
                            {formatRawScore(yard.requirementPenalty ?? 0)} ·{" "}
                            {formatRawScore(yard.value)}
                            {displaySecondaryObjective != null
                              ? ` · ${formatRawScore(yard.valueSecondary)}`
                              : ""}
                          </span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            missing · shortfall · objective
                            {displaySecondaryObjective != null ? " · tiebreaker" : ""}
                          </span>
                        </td>
                        <td className="py-1.5 px-2">
                          {yard.foodTypeIndoor}/{yard.foodTypeOutdoor}
                        </td>
                        <td className="py-1.5 pl-2 text-xs text-slate-600 dark:text-slate-300">
                          In{" "}
                          {[...yard.indoorLarge, ...yard.indoorSmall].join(", ") || "none"} · Out{" "}
                          {[...yard.outdoorLarge, ...yard.outdoorSmall].join(", ") || "none"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      ) : null}

      <details
        className={`${RESULT_STAT_PANEL_CLASS} group/run-details min-w-0 self-start [&_summary::-webkit-details-marker]:hidden`}
      >
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              Advanced run snapshot
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Exact foods, cats, and goodie rules used for this search.
            </span>
          </span>
          <span
            className="text-slate-400 text-xs shrink-0 transition-transform group-open/run-details:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </summary>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-slate-200/70 pt-3 text-sm font-mono dark:border-slate-700/70">
          <dt className="text-slate-500 dark:text-slate-400">yardPreset</dt>
          <dd>{effective.yardPreset}</dd>
          <dt className="text-slate-500 dark:text-slate-400">pinIndoor</dt>
          <dd>{String(effective.pinIndoor)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">pinOutdoor</dt>
          <dd>{String(effective.pinOutdoor)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">objective</dt>
          <dd>{effective.objective}</dd>
          <dt className="text-slate-500 dark:text-slate-400">extraObjectives</dt>
          <dd>
            {displayBlendTerms.length > 0
              ? displayBlendTerms.map((term) => `${term.weight}*${term.objective}`).join(" + ")
              : "[]"}
          </dd>
          <dt className="text-slate-500 dark:text-slate-400">tiebreaker</dt>
          <dd>{effective.secondaryObjective ?? "null"}</dd>
          <dt className="text-slate-500 dark:text-slate-400">targetCatIds</dt>
          <dd>{formatRawIdList(effective.catIds)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">foodsIndoor</dt>
          <dd>{formatRawIdList(effective.allowedFoodsIndoor)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">foodsOutdoor</dt>
          <dd>{formatRawIdList(effective.allowedFoodsOutdoor)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">fixedItems</dt>
          <dd>{formatRawIdList(effective.fixedItemIds)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">mustIncludeAnywhere</dt>
          <dd>{formatRawIdList(effective.requiredGoodieIds)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">forbiddenGoodies</dt>
          <dd>{formatRawIdList(effective.forbiddenGoodieIds)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">condition</dt>
          <dd>{goodieConditionLabel(effective.analyzerOptions.itemDamageState)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">weather</dt>
          <dd>{formatAnalyzerWeather(effective.analyzerOptions.weather)}</dd>
          <dt className="text-slate-500 dark:text-slate-400">horizonMinutes</dt>
          <dd>{effective.analyzerOptions.totalDurationMinutes}</dd>
          <dt className="text-slate-500 dark:text-slate-400">interactionMode</dt>
          <dd>{effective.analyzerOptions.interactionMode}</dd>
        </dl>
      </details>

      <details
        className={`${RESULT_STAT_PANEL_CLASS} group/scoring-details min-w-0 self-start [&_summary::-webkit-details-marker]:hidden lg:col-span-2`}
      >
        <summary className="cursor-pointer list-none flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
              Scoring details
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              How score, requirements, and memento estimates fit together.
            </span>
          </span>
          <span
            className="text-slate-400 text-xs shrink-0 transition-transform group-open/scoring-details:rotate-180"
            aria-hidden
          >
            ▼
          </span>
        </summary>
        <div className="mt-3 grid gap-4 border-t border-slate-200/70 pt-3 dark:border-slate-700/70 sm:grid-cols-2">
          <div>
            <h5 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Ranking vector
            </h5>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Layouts are sorted by this vector from top to bottom.
            </p>
            <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-sm">
              <dt className="text-slate-500 dark:text-slate-400">1</dt>
              <dt className="text-slate-500 dark:text-slate-400">Unreachable mementos</dt>
              <dd className="font-mono text-slate-800 dark:text-slate-100">
                {best.mementoUnreachableTargets ?? 0}
              </dd>
              <dt className="text-slate-500 dark:text-slate-400">2</dt>
              <dt className="text-slate-500 dark:text-slate-400">Minimum shortfall</dt>
              <dd className="font-mono text-slate-800 dark:text-slate-100">
                {formatRawScore(best.requirementPenalty ?? 0)}
              </dd>
              {displayPrimaryScore != null ? (
                <>
                  <dt className="text-slate-500 dark:text-slate-400">3</dt>
                  <dt className="text-slate-500 dark:text-slate-400">Main objective</dt>
                  <dd className="font-mono text-slate-800 dark:text-slate-100">
                    {formatRawScore(displayPrimaryScore)}
                  </dd>
                </>
              ) : null}
              <dt className="text-slate-500 dark:text-slate-400">
                {displayPrimaryScore != null ? 4 : 3}
              </dt>
              <dt className="text-slate-500 dark:text-slate-400">Tiebreaker</dt>
              <dd className="font-mono text-slate-800 dark:text-slate-100">
                {displaySecondaryObjective != null
                  ? formatRawScore(best.valueSecondary)
                  : "none"}
              </dd>
            </dl>
          </div>
          {mementoAnalysis ? (
            <div>
              <h5 className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                Memento estimate
              </h5>
              <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-sm">
                <dt className="text-slate-500 dark:text-slate-400">Whole-yard proxy</dt>
                <dd className="font-mono text-slate-800 dark:text-slate-100">
                  {mementoAnalysis.yardTotalMementoProxy.toFixed(4)}
                </dd>
                <dt className="text-slate-500 dark:text-slate-400">Selected-cat proxy</dt>
                <dd className="font-mono text-slate-800 dark:text-slate-100">
                  {mementoAnalysis.sumTargetCats.toFixed(4)}
                </dd>
                <dt className="text-slate-500 dark:text-slate-400">Slowest expected wait</dt>
                <dd className="font-mono text-slate-800 dark:text-slate-100">
                  {formatExpectedMementoTime(
                    mementoAnalysis.expectedMaxTargetMementoDays,
                    mementoDisplayScale?.displayMul ?? mementoAnalysis.timeDisplayMul,
                    mementoDisplayScale?.basis ?? "shortestBowlRefill"
                  )}
                </dd>
                <MementoFoodRateDetailRow
                  indoorRate={mementoAnalysis.lotteryFoodMementoRateIndoor}
                  outdoorRate={mementoAnalysis.lotteryFoodMementoRateOutdoor}
                />
              </dl>
            </div>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          The first different value in this vector decides the winner: fewer unreachable mementos,
          then smaller shortfall, then higher objective score, then higher tiebreaker.
        </p>
      </details>
    </div>
  )
}
