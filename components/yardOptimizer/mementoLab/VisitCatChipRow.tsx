import type { Dispatch, SetStateAction } from "react"
import CatFaceName from "../../CatFaceName"
import type { VisitCatStat } from "../../../utils/yardOptimizer/mementoLab/types"

export default function VisitCatChipRow({
  title,
  stats,
  hiddenVisitCatIds,
  setHiddenVisitCatIds,
}: {
  title: string
  stats: VisitCatStat[]
  hiddenVisitCatIds: Record<number, boolean>
  setHiddenVisitCatIds: Dispatch<SetStateAction<Record<number, boolean>>>
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[5.75rem_1fr] sm:items-start">
      <div className="pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {stats.map((stat) => {
          const visible = !hiddenVisitCatIds[stat.catId]
          return (
            <label
              key={stat.catId}
              className={`inline-flex items-center gap-1.5 rounded border px-1.5 py-1 text-[10px] cursor-pointer transition ${
                visible
                  ? "bg-white dark:bg-slate-900/60 text-slate-900 dark:text-slate-100"
                  : "bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 opacity-70"
              }`}
              style={{
                borderColor: visible ? stat.color : undefined,
              }}
            >
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) =>
                  setHiddenVisitCatIds((prev) => ({
                    ...prev,
                    [stat.catId]: !e.target.checked,
                  }))
                }
                className="accent-amber-600"
              />
              <span className="max-w-[8rem] truncate">
                <CatFaceName
                  catId={stat.catId}
                  name={stat.label}
                  size="compact"
                />
              </span>
              <span className="font-mono tabular-nums opacity-70">
                {stat.count.toLocaleString()}
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
