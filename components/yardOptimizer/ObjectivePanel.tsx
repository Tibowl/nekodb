import type { Dispatch, SetStateAction } from "react"

import type {
  FitnessObjective,
  FitnessObjectiveTerm,
} from "../../utils/yardOptimizer/fitness"
import type { GoalMode } from "../yardOptimizerSessionConfig"
import {
  BLEND_OBJECTIVE_OPTIONS,
  NET_FISH_CURRENCY_OPTIONS,
  PRIMARY_OBJECTIVE_OPTION_ROWS,
  blendObjectiveHint,
  goalPriorityFormulaTerm,
  isNetFishObjective,
} from "../yardOptimizerDisplay"
import CatFaceName from "../CatFaceName"
import { CatPickerTile, ConfigSection, SettingsChoice } from "./primitives"

export type CatPickerOption = { id: number; label: string }
export type CatVisitConfig = {
  id: number
  name: string
  isRare: boolean
  startComeCount: number
}

export function ObjectivePanel({
  goalMode,
  fitnessObjective,
  showMultiGoalOption,
  objectiveBlendTerms,
  chooseGuidedObjective,
  chooseMultiGoal,
  setObjectiveBlendTerms,
}: {
  goalMode: GoalMode
  fitnessObjective: FitnessObjective
  showMultiGoalOption: boolean
  objectiveBlendTerms: FitnessObjectiveTerm[]
  chooseGuidedObjective: (objective: FitnessObjective) => void
  chooseMultiGoal: () => void
  setObjectiveBlendTerms: Dispatch<SetStateAction<FitnessObjectiveTerm[]>>
}) {
  return (
    <ConfigSection
      title="Objective"
      description="The result the optimizer ranks first."
    >
      <div className="flex flex-col gap-3">
        {PRIMARY_OBJECTIVE_OPTION_ROWS.map(({ id, title, description }) => {
          const isFishIncomeRow = id === "netGoldEquiv"
          const checked =
            goalMode !== "multi" &&
            (isFishIncomeRow
              ? isNetFishObjective(fitnessObjective)
              : fitnessObjective === id)
          return (
            <div key={id} className="space-y-2">
              <SettingsChoice>
                <input
                  type="radio"
                  name="fitnessObjective"
                  checked={checked}
                  onChange={() => chooseGuidedObjective(id)}
                  className="mt-1"
                />
                <span>
                  <strong>{title}:</strong> {description}
                </span>
              </SettingsChoice>
              {isFishIncomeRow && checked ? (
                <div
                  className="ml-7 flex flex-wrap items-center gap-2 text-sm"
                  role="radiogroup"
                  aria-label="Net fish income currency"
                >
                  <span className="text-slate-600 dark:text-slate-400">
                    Currency:
                  </span>
                  {NET_FISH_CURRENCY_OPTIONS.map((option) => (
                    <label
                      key={option.id}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-slate-700 dark:text-slate-200 has-checked:border-blue-500 has-checked:bg-blue-50 has-checked:text-blue-700 dark:has-checked:bg-blue-950/40 dark:has-checked:text-blue-200"
                    >
                      <input
                        type="radio"
                        name="netFishCurrency"
                        checked={fitnessObjective === option.id}
                        onChange={() => chooseGuidedObjective(option.id)}
                      />
                      <span>{option.title}</span>
                    </label>
                  ))}
                  <span className="basis-full text-xs text-slate-500 dark:text-slate-400">
                    Gold equiv = gold fish + silver fish/50.
                  </span>
                </div>
              ) : null}
            </div>
          )
        })}
        {showMultiGoalOption || goalMode === "multi" ? (
          <div className="space-y-2">
            <SettingsChoice>
              <input
                type="radio"
                name="fitnessObjective"
                checked={goalMode === "multi"}
                onChange={chooseMultiGoal}
                className="mt-1"
              />
              <span>
                <strong>Combine several objectives</strong>{" "}
                <span className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Advanced
                </span>
                : Weights say how much each objective counts.
              </span>
            </SettingsChoice>
            {goalMode === "multi" ? (
              <>
                <div className="ml-7 rounded-md border border-blue-200 dark:border-blue-800/70 bg-blue-50/70 dark:bg-blue-950/20 px-3 py-2 text-sm text-blue-950 dark:text-blue-100">
                  <div>
                    {objectiveBlendTerms.length > 0
                      ? objectiveBlendTerms
                          .map((term) => goalPriorityFormulaTerm(term))
                          .join(" + ")
                      : "No objectives added yet"}
                  </div>
                </div>
                <div className="ml-7 space-y-2 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="inline-flex flex-wrap items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/50 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
                      <span>Multi-objective score</span>
                      <span>=</span>
                      <span>weight × objective</span>
                      <span>+</span>
                      <span>weight × objective</span>
                    </p>
                    <p className="basis-full text-xs text-slate-500 dark:text-slate-400">
                      Weight is the multiplier. A weight of 2 gives that objective twice the pull
                      of 1 before the objectives are added together. Memento wait is flipped so a
                      higher multi-objective score still wins.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setObjectiveBlendTerms((prev) => [
                          ...prev,
                          { objective: "catProbability", weight: 1 },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <span className="text-lg leading-none">+</span>
                      Add objective
                    </button>
                  </div>
                  {objectiveBlendTerms.length > 0 ? (
                    <div className="space-y-2">
                      {objectiveBlendTerms.map((term, idx) => (
                        <div
                          key={`${term.objective}-${idx}`}
                          className="flex flex-wrap items-end gap-2 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-2"
                        >
                          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                            Objective
                            <select
                              className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                              value={term.objective}
                              onChange={(e) => {
                                const objective = e.target.value as FitnessObjective
                                setObjectiveBlendTerms((prev) =>
                                  prev.map((t, i) =>
                                    i === idx ? { ...t, objective } : t
                                  )
                                )
                              }}
                            >
                              {BLEND_OBJECTIVE_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>
                                  {option.title}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
                            Weight
                            <input
                              type="number"
                              step={0.1}
                              value={term.weight}
                              onChange={(e) => {
                                const weight = Number(e.target.value)
                                setObjectiveBlendTerms((prev) =>
                                  prev.map((t, i) =>
                                    i === idx ? { ...t, weight } : t
                                  )
                                )
                              }}
                              className="w-24 border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100"
                            />
                          </label>
                          <p className="basis-full text-xs text-slate-500 dark:text-slate-400">
                            {blendObjectiveHint(term.objective)}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              setObjectiveBlendTerms((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Remove objective"
                            aria-label="Remove objective"
                          >
                            -
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Add at least one objective to rank layouts.
                    </p>
                  )}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </ConfigSection>
  )
}

export function TargetCatsPickerSection({
  id,
  className,
  title,
  description,
  selectedCatNames,
  selectedCatVisitConfigs,
  selectedCats,
  byGroup,
  showMementoMultiCatHint,
  showVisitConfig,
  emptySelectionHint,
  onClear,
  onResetStartComeCounts,
  onSetStartComeCount,
  onToggleCat,
  location,
  variant = "section",
}: {
  id?: string
  className?: string
  title: string
  description: string
  selectedCatNames: string[]
  selectedCatVisitConfigs: CatVisitConfig[]
  selectedCats: number[]
  byGroup: {
    normal: CatPickerOption[]
    rare: CatPickerOption[]
    other: CatPickerOption[]
  }
  showMementoMultiCatHint: boolean
  showVisitConfig: boolean
  emptySelectionHint: string
  onClear: () => void
  onResetStartComeCounts: () => void
  onSetStartComeCount: (catId: number, next: number) => void
  onToggleCat: (catId: number) => void
  location: string
  variant?: "section" | "inline"
}) {
  const content = (
    <>
      <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 px-3 py-2 mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="text-sm text-slate-700 dark:text-slate-300">
          <strong>{selectedCatNames.length}</strong>{" "}
          {selectedCatNames.length === 1 ? "cat selected" : "cats selected"}
          {selectedCatNames.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedCatVisitConfigs.slice(0, 6).map((cat) => (
                <span
                  key={cat.id}
                  className="inline-flex items-center gap-1 rounded-md bg-white/80 dark:bg-slate-950/40 px-1.5 py-1"
                >
                  <CatFaceName catId={cat.id} name={cat.name} size="compact" />
                  <button
                    type="button"
                    onClick={() => onToggleCat(cat.id)}
                    aria-label={`Remove ${cat.name}`}
                    title={`Remove ${cat.name}`}
                    className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded text-sm leading-none text-slate-400 hover:bg-rose-100 hover:text-rose-600 dark:hover:bg-rose-950/40"
                  >
                    &times;
                  </button>
                </span>
              ))}
              {selectedCatNames.length > 6
                ? (
                  <span className="inline-flex items-center rounded-md bg-white/80 dark:bg-slate-950/40 px-2 py-1 text-slate-500 dark:text-slate-400">
                    +{selectedCatNames.length - 6} more
                  </span>
                )
                : ""}
            </div>
          ) : (
            <span className="text-slate-500 dark:text-slate-400">
              {" "}
              {": "}
              {emptySelectionHint}
            </span>
          )}
        </div>
        {selectedCatNames.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="self-start sm:self-auto text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
          >
            Clear
          </button>
        ) : null}
      </div>

      <h4 className="text-lg font-bold">Normal cats</h4>
      <div className="flex flex-row flex-wrap mb-6">
        {byGroup.normal.map((c) => (
          <CatPickerTile
            key={c.id}
            id={c.id}
            label={c.label}
            selected={selectedCats.includes(c.id)}
            onToggle={() => onToggleCat(c.id)}
          />
        ))}
      </div>

      <h4 className="text-lg font-bold">Rare cats</h4>
      <div className="flex flex-row flex-wrap mb-6">
        {byGroup.rare.map((c) => (
          <CatPickerTile
            key={c.id}
            id={c.id}
            label={c.label}
            selected={selectedCats.includes(c.id)}
            onToggle={() => onToggleCat(c.id)}
          />
        ))}
      </div>

      {byGroup.other.length > 0 ? (
        <details className="group/other-cats rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 mb-6 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer px-3 py-2.5 list-none flex items-center justify-between gap-3">
            <span className="text-lg font-bold">Other cats</span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/other-cats:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-600 px-3 py-3">
            <div className="flex flex-row flex-wrap">
              {byGroup.other.map((c) => (
                <CatPickerTile
                  key={c.id}
                  id={c.id}
                  label={c.label}
                  selected={selectedCats.includes(c.id)}
                  onToggle={() => onToggleCat(c.id)}
                />
              ))}
            </div>
          </div>
        </details>
      ) : null}

      {showVisitConfig ? (
        <details className="group/visit-config rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/30 mb-4 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer px-3 py-2.5 list-none flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                Already have visits?
              </span>
              <span className="block text-xs text-slate-600 dark:text-slate-400">
                Leave these at 0 unless the cats already have visit counts in your game.
              </span>
            </span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/visit-config:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-600 px-3 py-3 space-y-2">
            {selectedCatVisitConfigs.length > 0 ? (
              <>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Starting visits affect memento expected-wait optimization, Yard stats, and
                    the chance curve.
                  </p>
                  <button
                    type="button"
                    onClick={onResetStartComeCounts}
                    className="self-start text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2"
                  >
                    Reset visits
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-600">
                        <th className="text-left font-semibold px-2 py-1.5">Cat</th>
                        <th className="text-right font-semibold px-2 py-1.5 font-mono">
                          Starting visits
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCatVisitConfigs.map((cat) => (
                        <tr
                          key={cat.id}
                          className="border-b border-slate-100 dark:border-slate-700 last:border-0"
                        >
                          <td className="px-2 py-1.5">
                            <CatFaceName catId={cat.id} name={cat.name} size="compact" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="number"
                              min={0}
                              max={5000}
                              value={cat.startComeCount}
                              onChange={(e) =>
                                onSetStartComeCount(cat.id, Number(e.target.value))
                              }
                              className="w-24 rounded border bg-white px-2 py-1 text-right font-mono dark:bg-slate-800"
                              aria-label={`Starting visits for ${cat.name}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select cats above to enter their current memento visit counts.
              </p>
            )}
          </div>
        </details>
      ) : null}

      {showMementoMultiCatHint ? (
        <div className="rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/90 dark:bg-amber-950/30 px-3 py-3 mt-4">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            Consider different options
          </h4>
          <p className="mt-1 text-xs text-amber-900/80 dark:text-amber-100/80">
            A combined memento run is a compromise across all selected cats. If the
            target cats prefer different foods or goodies, try separate runs with
            different food and goodie options, then compare the resulting layouts. For
            example, Snyap may prefer Indoor Deluxe Tuna Bitz, while Whiteshadow may
            prefer Outdoor Sashimi.
          </p>
        </div>
      ) : null}
    </>
  )

  if (variant === "inline") {
    return (
      <div id={id} className={className}>
        <div className="mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
          {description ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{description}</p>
          ) : null}
        </div>
        {content}
      </div>
    )
  }

  return (
    <ConfigSection
      id={id}
      className={className}
      title={title}
      description={description}
    >
      {content}
    </ConfigSection>
  )
}
