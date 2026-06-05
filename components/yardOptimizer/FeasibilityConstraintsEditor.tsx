import type { Dispatch, SetStateAction } from "react"
import {
  FEASIBILITY_METRIC_LABELS,
  FEASIBILITY_METRIC_ORDER,
  defaultFeasibilityRow,
  type FeasibilityRow,
} from "../../utils/yardOptimizer/fitnessConstraints"
import { feasibilityMetricHint } from "../yardOptimizerDisplay"
import { SettingsChoice } from "./primitives"

export type FeasibilityConstraintsEditorProps = {
  applyFeasibilityGate: boolean
  setApplyFeasibilityGate: Dispatch<SetStateAction<boolean>>
  feasibilityRows: FeasibilityRow[]
  setFeasibilityRows: Dispatch<SetStateAction<FeasibilityRow[]>>
}

export function FeasibilityConstraintsEditor({
  applyFeasibilityGate,
  setApplyFeasibilityGate,
  feasibilityRows,
  setFeasibilityRows,
}: FeasibilityConstraintsEditorProps) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
          Minimum requirements
        </h4>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
          These rules tell the search what a layout must keep. If no layout fully meets them, the
          search still shows the closest layout it found and explains what is short.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
        Example: if a rule asks for at least 10 visits and the best layout gets 9, that layout is
        one visit short. When several rules are short, layouts with smaller shortfalls rank first.
      </p>
          <SettingsChoice align="center" className="mb-3">
            <input
              type="checkbox"
              checked={applyFeasibilityGate}
              onChange={(e) => setApplyFeasibilityGate(e.target.checked)}
              className="rounded border-slate-300"
            />
            <span className="text-sm font-medium">Apply minimum requirements</span>
          </SettingsChoice>
          {applyFeasibilityGate ? (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-600">
                <table className="w-full text-sm border-collapse min-w-[36rem]">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40">
                      <th className="text-left py-2 px-2 font-medium">Metric</th>
                      <th className="text-left py-2 px-2 font-medium w-[9rem]">Rule</th>
                      <th className="text-left py-2 px-2 font-medium">Value</th>
                      <th className="w-10 py-2 px-1" aria-label="Remove row" />
                    </tr>
                  </thead>
                  <tbody>
                    {feasibilityRows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-slate-700/80 last:border-0 align-top"
                      >
                        <td className="py-2 px-2">
                          <div className="space-y-1">
                            <select
                              className="w-full max-w-[22rem] border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-xs sm:text-sm"
                              value={row.metric}
                              onChange={(e) => {
                                const metric = e.target.value as FeasibilityRow["metric"]
                                setFeasibilityRows((prev) =>
                                  prev.map((r) =>
                                    r.id === row.id ? { ...r, metric } : r
                                  )
                                )
                              }}
                            >
                              {FEASIBILITY_METRIC_ORDER.map((m) => (
                                <option key={m} value={m}>
                                  {FEASIBILITY_METRIC_LABELS[m]}
                                </option>
                              ))}
                            </select>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {feasibilityMetricHint(row.metric)}
                            </p>
                          </div>
                        </td>
                        <td className="py-2 px-2">
                          <select
                            className="w-full border rounded px-2 py-1.5 bg-white dark:bg-slate-800"
                            value={
                              row.rule.op === "between" ? "between" : row.rule.op
                            }
                            onChange={(e) => {
                              const v = e.target.value
                              setFeasibilityRows((prev) =>
                                prev.map((r) => {
                                  if (r.id !== row.id) return r
                                  if (v === "between") {
                                    const mid =
                                      r.rule.op === "between"
                                        ? (r.rule.min + r.rule.max) / 2
                                        : r.rule.value
                                    return {
                                      ...r,
                                      rule: {
                                        op: "between",
                                        min: Math.max(0, mid - 1),
                                        max: mid + 1,
                                      },
                                    }
                                  }
                                  const single =
                                    r.rule.op === "between" ? r.rule.min : r.rule.value
                                  return {
                                    ...r,
                                    rule: {
                                      op: v as ">" | "<" | ">=" | "<=",
                                      value: single,
                                    },
                                  }
                                })
                              )
                            }}
                          >
                            <option value=">=">≥ (at least)</option>
                            <option value="<=">≤ (at most)</option>
                            <option value=">">greater than</option>
                            <option value="<">less than</option>
                            <option value="between">between … and …</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          {row.rule.op === "between" ? (
                            <div className="flex flex-wrap items-end gap-2">
                              <label className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-500">Min</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={row.rule.min}
                                  onChange={(e) => {
                                    const min = Number(e.target.value)
                                    setFeasibilityRows((prev) =>
                                      prev.map((r) => {
                                        if (r.id !== row.id || r.rule.op !== "between")
                                          return r
                                        return {
                                          ...r,
                                          rule: {
                                            op: "between",
                                            min,
                                            max: Math.max(min, r.rule.max),
                                          },
                                        }
                                      })
                                    )
                                  }}
                                  className="border rounded px-2 py-1.5 w-24 bg-white dark:bg-slate-800"
                                />
                              </label>
                              <span className="pb-2 text-slate-500 text-xs">and</span>
                              <label className="flex flex-col gap-0.5">
                                <span className="text-xs text-slate-500">Max</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={row.rule.max}
                                  onChange={(e) => {
                                    const max = Number(e.target.value)
                                    setFeasibilityRows((prev) =>
                                      prev.map((r) => {
                                        if (r.id !== row.id || r.rule.op !== "between")
                                          return r
                                        return {
                                          ...r,
                                          rule: {
                                            op: "between",
                                            min: Math.min(r.rule.min, max),
                                            max,
                                          },
                                        }
                                      })
                                    )
                                  }}
                                  className="border rounded px-2 py-1.5 w-24 bg-white dark:bg-slate-800"
                                />
                              </label>
                            </div>
                          ) : (
                            <input
                              type="number"
                              step={0.5}
                              value={row.rule.value}
                              onChange={(e) => {
                                const value = Number(e.target.value)
                                setFeasibilityRows((prev) =>
                                  prev.map((r) => {
                                    if (r.id !== row.id || r.rule.op === "between")
                                      return r
                                    return { ...r, rule: { ...r.rule, value } }
                                  })
                                )
                              }}
                              className="border rounded px-2 py-1.5 w-28 bg-white dark:bg-slate-800"
                            />
                          )}
                        </td>
                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setFeasibilityRows((prev) =>
                                prev.filter((r) => r.id !== row.id)
                              )
                            }
                            className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Remove requirement"
                            aria-label="Remove requirement"
                          >
                            −
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

                {feasibilityRows.length === 0 ? (
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No required rules are being checked. Use + Add requirement or turn off the
                    Apply checkbox above.
                  </p>
                ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFeasibilityRows((prev) => [...prev, defaultFeasibilityRow()])
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <span className="text-lg leading-none">+</span>
                    Add requirement
                  </button>
                {feasibilityRows.some(
                  (r) =>
                    (r.metric === "netGoldPerDay" ||
                      r.metric === "netGoldEquivPerDay") &&
                    r.rule.op !== "between"
                ) ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-slate-500">
                      Quick minimums for gold / gold equiv income
                    </span>
                    {[0, 1, 5, 10].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          setFeasibilityRows((prev) =>
                            prev.map((r) =>
                              (r.metric === "netGoldPerDay" ||
                                r.metric === "netGoldEquivPerDay") &&
                              r.rule.op !== "between"
                                ? { ...r, rule: { op: ">=", value: v } }
                                : r
                            )
                          )
                        }
                        className="px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            ) : (
              <p className="text-sm text-slate-500 italic">
                Minimum requirements are off, so every layout can be scored.
              </p>
            )}
      </div>
  )
}
