import { ConfigFold } from "../primitives"
import { YardStatsDeepDetails } from "./YardStatsDeepDetails"
import { YardStatsPrimaryGrid } from "./YardStatsPrimaryGrid"
import type { ResultsPanelChildProps } from "./types"

export function YardStatsFold({ layout, scores, run, effective }: ResultsPanelChildProps) {
  return (
    <ConfigFold
      title="Yard stats"
      description="A compact scorecard for the currently displayed yard."
    >
      <div className="space-y-4">
        <YardStatsPrimaryGrid scores={scores} run={run} effective={effective} />
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Deeper details
          </h4>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Open these when you want finalists, exact inputs, or scoring internals.
          </p>
        </div>
        <YardStatsDeepDetails
          layout={layout}
          scores={scores}
          run={run}
          effective={effective}
        />
      </div>
    </ConfigFold>
  )
}
