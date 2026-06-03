import { SILVER_FISH_PER_GOLD_FISH } from "../../../utils/yardOptimizer/foodBowlEconomy"
import { MINUTES_PER_DAY } from "../../yardOptimizerDisplay"
import {
  formatExpectedMementoTime,
  formatAnalyzerWeather,
  formatFitnessObjectiveDisplay,
  formatPercent,
  formatRawScore,
  formatStatNumber,
  mementoDisplayUnitLabel,
  objectiveLabelShort,
  objectiveUnitLabel,
} from "../../yardOptimizerDisplay"
import { useLanguage } from "../../../hooks/useLanguage"
import { translate as translateTable } from "../../../utils/localization/translate"
import {
  searchChangesLabel,
  yardPresetDisplayLabel,
} from "../optimizerRunSnapshot"
import { MementoFoodRateInline } from "./MementoFoodRateSummary"
import {
  geneticSearchModeLabel,
  goodieConditionLabel,
  optimizerRunLabel,
} from "../clientHelpers"
import {
  RESULT_STAT_LABEL_CLASS,
  RESULT_STAT_PANEL_CLASS,
  RESULT_STAT_ROW_CLASS,
  RESULT_STAT_VALUE_CLASS,
} from "./styles"
import type { ResultsPanelChildProps } from "./types"

export function YardStatsPrimaryGrid({
  scores,
  run,
  effective,
}: Pick<ResultsPanelChildProps, "scores" | "run" | "effective">) {
  const { translate } = useLanguage()
  const {
    displayPrimaryScoreText,
    displaySecondaryObjective,
    hasMultiGoalScore,
    displayObjective,
    rankingScoreBreakdown,
    ranCatObjective,
  } = scores
  const { displayRunStats, mementoAnalysis, mementoDisplayScale } = run

  return (
    <div className="grid items-start gap-3 lg:grid-cols-2">
      <div className="order-0 lg:col-span-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Results</h4>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Score, fish income, and memento wait for the displayed yard.
        </p>
      </div>

      <section className={`${RESULT_STAT_PANEL_CLASS} order-1`}>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Score</h4>
        <dl className="mt-2">
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>
              {hasMultiGoalScore ? "Multi-objective score" : "Objective"}
              {!hasMultiGoalScore ? (
                <span className="block text-xs">{objectiveUnitLabel(displayObjective)}</span>
              ) : null}
            </dt>
            <dd className="text-right font-mono text-lg font-semibold text-slate-900 dark:text-slate-50">
              {displayPrimaryScoreText}
            </dd>
          </div>
          {rankingScoreBreakdown ? (
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Ranking check</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                <span>shortfall {formatRawScore(rankingScoreBreakdown.requirementPenalty)}</span>
                {rankingScoreBreakdown.mementoUnreachableTargets > 0 ? (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {rankingScoreBreakdown.mementoUnreachableTargets} unreachable
                  </span>
                ) : null}
              </dd>
            </div>
          ) : null}
          {displayRunStats && ranCatObjective ? (
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>On-screen chance</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {formatFitnessObjectiveDisplay(
                  displayRunStats.catProbabilityYardTotal,
                  "catProbability"
                )}
              </dd>
            </div>
          ) : null}
          {mementoAnalysis ? (
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>
                Mementos sooner
                <span className="block text-xs">
                  {mementoDisplayScale
                    ? mementoDisplayUnitLabel(mementoDisplayScale.basis)
                    : "memento wait"}
                </span>
              </dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {formatExpectedMementoTime(
                  mementoAnalysis.expectedMaxTargetMementoDays,
                  mementoDisplayScale?.displayMul ?? mementoAnalysis.timeDisplayMul,
                  mementoDisplayScale?.basis ?? "shortestBowlRefill"
                )}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section className={`${RESULT_STAT_PANEL_CLASS} order-5`}>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Optimizer snapshot
        </h4>
        <dl className="mt-2">
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Layout</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {yardPresetDisplayLabel(effective.yardPreset)}
              {!effective.pinIndoor || !effective.pinOutdoor ? (
                <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                  Search: {searchChangesLabel(effective.pinIndoor, effective.pinOutdoor)}
                </span>
              ) : null}
            </dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Objective</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {hasMultiGoalScore ? "Multi-objective" : objectiveLabelShort(effective.objective)}
            </dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Target cats</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>{effective.catIds.length}</dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Food choices</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {effective.allowedFoodsIndoor.length} in / {effective.allowedFoodsOutdoor.length} out
            </dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Goodie pool</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {effective.largeItemCount} large / {effective.smallItemCount} small
            </dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Scoring assumptions</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {goodieConditionLabel(effective.analyzerOptions.itemDamageState)}
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {formatAnalyzerWeather(effective.analyzerOptions.weather)} ·{" "}
                {formatStatNumber(
                  effective.analyzerOptions.totalDurationMinutes / MINUTES_PER_DAY,
                  2
                )}{" "}
                food days
              </span>
            </dd>
          </div>
          <div className={RESULT_STAT_ROW_CLASS}>
            <dt className={RESULT_STAT_LABEL_CLASS}>Rules / fixed</dt>
            <dd className={RESULT_STAT_VALUE_CLASS}>
              {effective.feasibilityRowsApplied.length +
                effective.requiredGoodieIds.length +
                effective.forbiddenGoodieIds.length}{" "}
              rules
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {effective.fixedFoodTypes.length + effective.fixedItemIds.length} fixed
              </span>
            </dd>
          </div>
        </dl>
      </section>

      {displayRunStats ? (
        <section className={`${RESULT_STAT_PANEL_CLASS} order-6`}>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Search run</h4>
          <dl className="mt-2">
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Mode</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {geneticSearchModeLabel(displayRunStats.evolutionTierUsed)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>State</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {run.running
                  ? optimizerRunLabel(
                      run.running,
                      run.progress,
                      run.progressTotal,
                      run.runPhase,
                      run.pauseRequested
                    )
                  : run.hasContinuation
                    ? "Ready to continue"
                    : "Complete"}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Generations</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>{displayRunStats.totalGenerations}</dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Candidate pool</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {effective.poolSize}
                {run.finalPool.length > 0 ? (
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {run.finalPool.length} finalists
                  </span>
                ) : null}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Child scoring</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>{effective.offspringScoreMode}</dd>
            </div>
          </dl>
        </section>
      ) : null}

      {displayRunStats ? (
        <section className={`${RESULT_STAT_PANEL_CLASS} order-2`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Fish income
            </h4>
            <p
              className="text-xs text-slate-500 dark:text-slate-400"
              title="One food day = 1,440 minutes (one in-game day) of the estimate window set in Scoring assumptions."
            >
              per food day
            </p>
          </div>
          <dl className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Gross silver fish</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.grossSilverPerDay.toFixed(1)}
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {(displayRunStats.grossSilverPerDay / SILVER_FISH_PER_GOLD_FISH).toFixed(2)} gold
                  equiv
                </span>
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Gross gold fish</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.grossGoldPerDay.toFixed(1)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Gross gold equiv</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.grossGoldEquivNaivePerDay.toFixed(2)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Net gold</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.netGoldPerDay.toFixed(2)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Net silver</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.netSilverPerDay.toFixed(1)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>Net gold equiv (naive)</dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.netGoldEquivNaivePerDay.toFixed(2)}
              </dd>
            </div>
            <div className={RESULT_STAT_ROW_CLASS}>
              <dt className={RESULT_STAT_LABEL_CLASS}>
                Net gold equiv (ranked)
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  what the search optimized
                </span>
              </dt>
              <dd className={RESULT_STAT_VALUE_CLASS}>
                {displayRunStats.netGoldEquivPerDay.toFixed(2)}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      {mementoAnalysis ? (
        <section className={`${RESULT_STAT_PANEL_CLASS} order-3 lg:col-span-2`}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              Memento wait estimate
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">target cats</p>
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-200/70 pt-2 text-xs text-slate-500 dark:border-slate-700/70 dark:text-slate-400">
            <div className="flex gap-1.5">
              <dt>Window</dt>
              <dd className="font-mono text-slate-700 dark:text-slate-200">
                {formatStatNumber(mementoAnalysis.totalDurationMinutes / MINUTES_PER_DAY, 2)} food
                days
              </dd>
            </div>
            <MementoFoodRateInline
              indoorRate={mementoAnalysis.lotteryFoodMementoRateIndoor}
              outdoorRate={mementoAnalysis.lotteryFoodMementoRateOutdoor}
              foodTypeIndoor={mementoAnalysis.foodTypeIndoor}
              foodTypeOutdoor={mementoAnalysis.foodTypeOutdoor}
            />
          </dl>
          {mementoAnalysis.byCat.length === 0 ? (
            <p className="mt-3 border-t border-slate-200/70 pt-3 text-sm text-slate-600 dark:border-slate-700/70 dark:text-slate-400">
              Pick one or more target cats under Objective to estimate memento waits.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white/50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/20 dark:text-slate-400">
                    <th className="px-3 py-2 text-left font-medium">Cat</th>
                    <th className="px-3 py-2 text-right font-medium">On-screen</th>
                    <th className="px-3 py-2 text-right font-medium">Visits/day</th>
                    <th className="px-3 py-2 text-right font-medium">Indoor</th>
                    <th className="px-3 py-2 text-right font-medium">
                      {mementoDisplayScale
                        ? mementoDisplayUnitLabel(mementoDisplayScale.basis)
                        : "Wait"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {mementoAnalysis.byCat.map((row) => {
                    const indoorShare =
                      row.visitsPerHorizon > 0
                        ? row.indoorVisitsPerHorizon / row.visitsPerHorizon
                        : 0
                    return (
                      <tr
                        key={row.catId}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-700/70"
                      >
                        <td className="px-3 py-2">
                          {translate(translateTable("Cat", `CatName${row.catId}`))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPercent(row.onScreenChance, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatStatNumber(row.mementoVisitsPerDay, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatPercent(indoorShare, 3)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatExpectedMementoTime(
                            row.expectedMementoDays,
                            mementoDisplayScale?.displayMul ?? mementoAnalysis.timeDisplayMul,
                            mementoDisplayScale?.basis ?? "shortestBowlRefill"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      <div className="order-4 lg:col-span-2">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Run details</h4>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Inputs and search settings behind this result.
        </p>
      </div>
    </div>
  )
}
