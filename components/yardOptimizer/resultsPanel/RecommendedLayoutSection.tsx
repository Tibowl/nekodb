import {
  FITNESS_HARD_REJECT_LAYOUT,
  FITNESS_HARD_REJECT_NONE,
  FITNESS_HARD_REJECT_RULES,
} from "../../../utils/yardOptimizer/fitness"
import {
  formatFeasibilitySummary,
  isDefaultFeasibilityRows,
} from "../../../utils/yardOptimizer/fitnessConstraints"
import { useLanguage } from "../../../hooks/useLanguage"
import { translate as translateTable } from "../../../utils/localization/translate"
import FormattedLink from "../../FormattedLink"
import DisplayImage from "../../DisplayImage"
import FoodIcon from "../../FoodIcon"
import {
  UnitChip,
  formatFoodDayCost,
  formatRawScore,
  formatRequirementValue,
  goalPriorityFormulaTerm,
  objectiveHelpText,
  objectiveLabelShort,
  objectiveUnitLabel,
  scoreHasDisplayUnit,
} from "../../yardOptimizerDisplay"
import { GoodieFilterChip } from "../goodieShopDisplay"
import { goodieIconImageMeta } from "../../../utils/yardOptimizer/clientAssets"
import { YARD_PREVIEW_OPTIONS, YardPreviewView } from "../YardPreviewView"
import {
  RESULT_BUBBLE_CLASS,
  RESULT_BUBBLE_LOOSE_CLASS,
} from "./styles"
import { searchChangesLabel } from "../optimizerRunSnapshot"
import type { ResultsPanelChildProps } from "./types"

export function RecommendedLayoutSection({
  layout,
  scores,
  run,
  effective,
}: ResultsPanelChildProps) {
  const { translate } = useLanguage()
  const {
    best,
    currentLayoutRef,
    manualDraftDirty,
    copyToGameRows,
    indoorTitle,
    outdoorTitle,
    foodDisplayName,
    goodieDisplayName,
    location,
    copyYardViewOpen,
    setCopyYardViewOpen,
    selectedPreviewYardId,
    setSelectedPreviewYardId,
    sortCatIdsByTableOrder,
    playerGoodieConstraintsSummaryFor,
  } = layout
  const {
    scoreLabel,
    displayPrimaryScoreText,
    displayPrimaryScoreHasUnit,
    scoreDisplayObjective,
    displaySecondaryObjective,
    formatObjectiveScore,
    hasMultiGoalScore,
    displayMultiGoalTerms,
    searchStrengthAutoBumped,
    displayObjective,
    displayMementoUnreachableTargets,
    missedMinimumRows,
    ranCatObjective,
  } = scores

  return (
    <div ref={currentLayoutRef} className="order-4 space-y-4 scroll-mt-4">
      <div className="space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2 className="text-xl font-bold leading-snug">Recommended layout</h2>
          {manualDraftDirty ? (
            <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              Draft. Apply updates to refresh scores.
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className={RESULT_BUBBLE_CLASS}>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {scoreLabel}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
              <span>{displayPrimaryScoreText}</span>
              {displayPrimaryScoreHasUnit ? (
                <UnitChip
                  unit={objectiveUnitLabel(scoreDisplayObjective)}
                  help={objectiveHelpText(scoreDisplayObjective)}
                />
              ) : null}
            </p>
          </div>
          {displaySecondaryObjective != null ? (
            <div className={RESULT_BUBBLE_CLASS}>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tiebreaker
              </p>
              <p className="mt-1 flex flex-wrap items-baseline gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                <span>
                  {objectiveLabelShort(displaySecondaryObjective)}:{" "}
                  {formatObjectiveScore(best.valueSecondary, displaySecondaryObjective)}
                </span>
                {scoreHasDisplayUnit(best.valueSecondary, displaySecondaryObjective) ? (
                  <UnitChip
                    unit={objectiveUnitLabel(displaySecondaryObjective)}
                    help={objectiveHelpText(displaySecondaryObjective)}
                  />
                ) : null}
              </p>
            </div>
          ) : null}
        </div>
        {hasMultiGoalScore ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Formula:{" "}
            {displayMultiGoalTerms.length > 0
              ? displayMultiGoalTerms.map(goalPriorityFormulaTerm).join(" + ")
              : "no objectives added"}
            . Weight is the multiplier applied to each objective.
          </p>
        ) : null}
      </div>
      {(best.hardRejectLevel ?? FITNESS_HARD_REJECT_NONE) === FITNESS_HARD_REJECT_RULES ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-snug">
          <strong>Goodie rules not met:</strong> this yard fails <strong>goodie rules</strong>{" "}
          (required/forbidden items). Adjust goodies or toys so the layout can be scored normally.
          {searchStrengthAutoBumped ? (
            <>
              {" "}
              <strong>Search strength</strong> for this session is now set to <strong>Full</strong>{" "}
              (full mean-field every generation). Try <strong>Run</strong> or{" "}
              <strong>Continue</strong> again so the search ranks layouts with the stricter scorer.
            </>
          ) : null}
        </p>
      ) : null}
      {(best.hardRejectLevel ?? FITNESS_HARD_REJECT_NONE) === FITNESS_HARD_REJECT_LAYOUT ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-snug">
          <strong>Infeasible yard shape:</strong> goodie counts do not match placement rules (e.g.
          each side has five play spaces; a <strong>large</strong> goodie uses two, so six
          small-only items cannot fit). Fix play space usage in the editor so indoor/outdoor sets match
          the game layout, then apply or rescore.
        </p>
      ) : null}
      {!hasMultiGoalScore &&
      displayObjective === "mementoExpectedDays" &&
      (best.hardRejectLevel ?? FITNESS_HARD_REJECT_NONE) === FITNESS_HARD_REJECT_NONE &&
      displayMementoUnreachableTargets > 0 ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-snug">
          <strong>Some mementos may be unreachable:</strong> {displayMementoUnreachableTargets}{" "}
          selected target{" "}
          {displayMementoUnreachableTargets === 1 ? "cat may never get" : "cats may never get"} a
          memento with this layout and these settings. The optimizer ranked layouts with fewer
          missing cats first.
        </p>
      ) : null}
      {missedMinimumRows.length > 0 &&
      (best.hardRejectLevel ?? FITNESS_HARD_REJECT_NONE) === FITNESS_HARD_REJECT_NONE ? (
        <p className="text-sm text-amber-800 dark:text-amber-200/90 leading-snug">
          <strong>Minimum requirements missed:</strong> the best ranked yard is still short on{" "}
          {missedMinimumRows.map((row, idx) => (
            <span key={row.id}>
              {idx > 0 ? "; " : ""}
              {row.label} is {formatRequirementValue(row.value)} but needs {row.rule} (short by{" "}
              {formatRawScore(row.miss)})
            </span>
          ))}
          . The search compares requirement shortfalls first, then uses your selected objective.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
        {ranCatObjective ? (
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
            Target cats:{" "}
            {(() => {
              const ids = sortCatIdsByTableOrder(effective.catIds)
              return ids.length
                ? ids.map((id) => translate(translateTable("Cat", `CatName${id}`))).join(", ")
                : "none selected"
            })()}
          </span>
        ) : null}
        <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
          Food: indoor {effective.allowedFoodsIndoor.length} choices, outdoor{" "}
          {effective.allowedFoodsOutdoor.length}
        </span>
        <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
          {isDefaultFeasibilityRows(effective.feasibilityRowsApplied)
            ? "Built-in minimum requirements"
            : `Minimum requirements: ${formatFeasibilitySummary(effective.feasibilityRowsApplied)}`}
        </span>
        <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
          Goodie rules:{" "}
          {playerGoodieConstraintsSummaryFor(
            effective.requiredGoodieIds,
            effective.forbiddenGoodieIds
          )}
        </span>
        <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
          Starting layout: {effective.currentLayoutSummary}
        </span>
        {run.runMeta &&
        (run.runMeta.pinIndoor || run.runMeta.pinOutdoor) ? (
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/30 px-2 py-1">
            Search changes:{" "}
            {searchChangesLabel(run.runMeta.pinIndoor, run.runMeta.pinOutdoor)}
          </span>
        ) : null}
      </div>
      <div className={RESULT_BUBBLE_LOOSE_CLASS}>
        <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
          Place the Indoor list indoors and the Outdoor list outdoors. Use any matching large/small
          play space unless you open the placement preview. The notes under each goodie point to the
          closest in-game shop page or filter.
        </p>
        <div className="grid gap-6 lg:grid-cols-2 text-sm">
          {[
            { side: "Indoor" as const, title: indoorTitle, foodId: best.foodTypeIndoor },
            { side: "Outdoor" as const, title: outdoorTitle, foodId: best.foodTypeOutdoor },
          ].map((section) => (
            <div key={section.side} className="space-y-3">
              <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">
                {section.title}
              </h3>
              <FoodIcon food={String(section.foodId)}>
                <span>
                  {foodDisplayName(section.foodId)}
                  {". "}
                  Food-day cost: {formatFoodDayCost(section.foodId)}
                </span>
              </FoodIcon>
              <ol className="grid gap-1">
                {copyToGameRows
                  .filter((row) => row.side === section.side)
                  .map((row) => {
                    const img = goodieIconImageMeta(row.id)
                    const name = goodieDisplayName(row.id)
                    return (
                      <li key={row.key}>
                        <FormattedLink href={`/goodies/${row.id}`} location={location}>
                          <div className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-700/80">
                            {img ? (
                              <DisplayImage
                                img={img}
                                alt=""
                                className="max-h-8 max-w-12 w-auto object-contain shrink-0"
                              />
                            ) : (
                              <span className="inline-block w-8 h-8 shrink-0 rounded bg-slate-200 dark:bg-slate-600" />
                            )}
                            <span className="min-w-0">
                              <span className="font-medium text-slate-800 dark:text-slate-100">
                                {name}
                              </span>{" "}
                              <span className="text-slate-500 dark:text-slate-400">#{row.id}</span>
                              <span className="block text-slate-500 dark:text-slate-400">
                                {row.slot}; {row.hint}
                              </span>
                            </span>
                          </div>
                        </FormattedLink>
                      </li>
                    )
                  })}
              </ol>
            </div>
          ))}
        </div>
        <details className="group/find-goodies mt-4 rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-950/20 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer px-3 py-2.5 list-none flex items-center justify-between gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span>Find these goodies in-game</span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/find-goodies:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-3">
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 font-semibold dark:border-slate-700">
                      Shop
                    </th>
                    <th className="min-w-48 border-b border-slate-200 px-2 py-2 font-semibold dark:border-slate-700">
                      Goodie
                    </th>
                    <th className="whitespace-nowrap border-b border-slate-200 px-2 py-2 font-semibold dark:border-slate-700">
                      Place
                    </th>
                    <th className="min-w-48 border-b border-slate-200 px-2 py-2 font-semibold dark:border-slate-700">
                      Filter
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...copyToGameRows]
                    .sort(
                      (a, b) =>
                        a.sourceRank - b.sourceRank ||
                        a.sourceIndex - b.sourceIndex ||
                        a.side.localeCompare(b.side) ||
                        a.slot.localeCompare(b.slot)
                    )
                    .map((row) => {
                      const img = goodieIconImageMeta(row.id)
                      return (
                        <tr
                          key={`find-${row.key}`}
                          className="align-middle text-slate-700 dark:text-slate-200"
                        >
                          <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                            {row.sourceLabel}
                          </td>
                          <td className="border-b border-slate-100 px-2 py-2 dark:border-slate-800">
                            <FormattedLink href={`/goodies/${row.id}`} location={location}>
                              <span className="inline-flex min-w-0 items-center gap-2 rounded-md p-1 -m-1 hover:bg-slate-100 dark:hover:bg-slate-800">
                                {img ? (
                                  <DisplayImage
                                    img={img}
                                    alt=""
                                    className="max-h-8 max-w-12 w-auto shrink-0 object-contain"
                                  />
                                ) : (
                                  <span className="inline-block h-8 w-10 shrink-0 rounded bg-slate-200 dark:bg-slate-600" />
                                )}
                                <span className="min-w-0">
                                  <span className="font-medium text-slate-800 dark:text-slate-100">
                                    {goodieDisplayName(row.id)}
                                  </span>
                                  <span className="ml-1 text-slate-500 dark:text-slate-400">
                                    #{row.id}
                                  </span>
                                </span>
                              </span>
                            </FormattedLink>
                          </td>
                          <td className="whitespace-nowrap border-b border-slate-100 px-2 py-2 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                            {row.side.toLowerCase()}, {row.slot}
                          </td>
                          <td className="border-b border-slate-100 px-2 py-2 dark:border-slate-800">
                            {row.filterOptions.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {row.filterOptions.map((filter) => (
                                  <GoodieFilterChip key={`${row.key}-${filter}`} label={filter} />
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">
                                Check game list
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </details>
        <details
          open={copyYardViewOpen}
          onToggle={(event) => setCopyYardViewOpen(event.currentTarget.open)}
          className="group/copy-yard-view mt-4 rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-950/20 [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="cursor-pointer px-3 py-2.5 list-none flex items-center justify-between gap-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <span>Show placement preview</span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/copy-yard-view:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          {copyYardViewOpen ? (
            <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-3 space-y-3">
              <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <span className="font-medium">Yard</span>
                <select
                  value={selectedPreviewYardId}
                  onChange={(event) => setSelectedPreviewYardId(Number(event.target.value))}
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
                >
                  {YARD_PREVIEW_OPTIONS.map((yardId) => (
                    <option key={yardId} value={yardId}>
                      {translate(translateTable("Yard", `YardName${yardId}`))}
                    </option>
                  ))}
                </select>
              </label>
              <YardPreviewView
                yard={best}
                yardId={selectedPreviewYardId}
                itemDamageState={effective.analyzerOptions.itemDamageState}
              />
            </div>
          ) : null}
        </details>
      </div>
    </div>
  )
}
