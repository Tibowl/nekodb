import type { ReactNode } from "react"
import type { YardMementoSample } from "../../../utils/yardOptimizer/yardMementoSim"
import {
  yardFoodSpendForRunNative,
  type MementoTimeDisplayScale,
} from "../../../utils/yardOptimizer/foodBowlEconomy"
import { TILE_THEMES } from "../../../utils/yardOptimizer/mementoLab/constants"
import SingleYardVisitIncomeChart from "./SingleYardVisitIncomeChart"

export default function SingleYardTrial({
  singleRun,
  singleRunBusy,
  canRun,
  onRun,
  activeCatLabel,
  activeCatId,
  targetCatIds,
  catLabelForId,
  visitsPerDay,
  maxLotteryRolls,
  horizonDays,
  hasMementoTargets,
  foodTypeIndoor,
  foodTypeOutdoor,
  lotteryChartXMaxDays,
  lotteryCdfAtHorizon,
  singleRunModelCdf,
  timeDisplay,
  focusOnMementoDrop,
}: {
  singleRun: YardMementoSample | null
  singleRunBusy: boolean
  canRun: boolean
  onRun: () => void
  activeCatLabel: string
  activeCatId: number | null
  targetCatIds: number[]
  catLabelForId: (catId: number) => string
  visitsPerDay: number
  maxLotteryRolls: number
  horizonDays: number
  hasMementoTargets: boolean
  foodTypeIndoor: number
  foodTypeOutdoor: number
  /**
   * When the main plot uses **days**, same right edge as the P(success) CDF / hazard strip
   * (clips the income chart so its x-axis matches).
   */
  lotteryChartXMaxDays: number | null
  /**
   * Analytic CDF value at the lottery day horizon (see `lotteryChartXMaxDays`) — links the income
   * plot to the blue curve in `memento-lottery-cdf`.
   */
  lotteryCdfAtHorizon: number | null
  /**
   * Blue-curve P by **day** at the stopping time of the latest single-yard run (same math as days-axis hover).
   */
  singleRunModelCdf: { day: number; p: number } | null
  timeDisplay: MementoTimeDisplayScale
  focusOnMementoDrop: boolean
}) {
  const fmtInt = (x: number) => Math.round(x).toLocaleString()
  const tdMul = timeDisplay.displayMul > 0 ? timeDisplay.displayMul : 1
  const netEq = singleRun !== null ? singleRun.netGoldEquivalent : 0
  const canRate =
    singleRun !== null &&
    singleRun.totalVisits > 0 &&
    singleRun.endDays > 1e-9
  const dSim = singleRun?.endDays ?? 0
  const silverTotal = singleRun?.silverFish ?? 0
  const goldTotal = singleRun?.goldFish ?? 0
  const goldEquivTotal = netEq
  /** Bowl restock cost: indoor base clock + the outdoor refills the sim actually spent this run. */
  const outdoorRefills =
    singleRun !== null && singleRun.outdoorRefillsPerDay != null
      ? singleRun.outdoorRefillsPerDay * singleRun.endDays
      : undefined
  const foodSpend =
    singleRun !== null
      ? yardFoodSpendForRunNative(
          foodTypeIndoor,
          foodTypeOutdoor,
          singleRun.endDays,
          outdoorRefills
        )
      : { silver: 0, gold: 0, goldEquiv: 0 }
  const silverNet = silverTotal - foodSpend.silver
  const goldNet = goldTotal - foodSpend.gold
  const goldEquivNet = goldEquivTotal - foodSpend.goldEquiv
  const silverNetPerDay =
    canRate && singleRun ? silverNet / dSim : null
  const goldNetPerDay = canRate && singleRun ? goldNet / dSim : null
  const goldEquivNetPerDay =
    canRate && singleRun ? goldEquivNet / dSim : null
  const fmtPerDay = (x: number) =>
    x < 0 ? x.toFixed(1) : x >= 100 ? x.toFixed(0) : x.toFixed(1)
  const fmtEquiv = (x: number) =>
    x < 0 ? x.toFixed(1) : x >= 100 ? x.toFixed(0) : x.toFixed(1)
  const fmtEquivPerDay = (x: number | null) =>
    x === null ? "—" : x < 0 ? x.toFixed(2) : x >= 100 ? x.toFixed(0) : x.toFixed(2)
  const pg = singleRun?.fishGoldPayoutVisits ?? 0
  const ps = singleRun?.fishSilverPayoutVisits ?? 0
  const pct = (n: number, d: number) =>
    d <= 0 ? "0" : ((100 * n) / d).toFixed(2)
  const targetNames = targetCatIds.map((catId) => catLabelForId(catId))
  const targetCount = targetNames.length
  const targetLabel =
    !hasMementoTargets
      ? "the whole yard"
      : targetCount > 1
        ? targetNames.join(" + ")
        : activeCatLabel
  const targetDropCount = singleRun?.targetMementos.length ?? 0
  const targetMementoSummary =
    singleRun?.targetMementos
      .map((hit) => {
        const when =
          timeDisplay.basis === "gameDay"
            ? `${hit.days.toFixed(2)} food days`
            : `${(hit.days * tdMul).toFixed(1)} food refills`
        return `${catLabelForId(hit.catId)}: ${when} (${fmtInt(hit.visits)} rolls)`
      })
      .join(" · ") ?? ""
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/45 p-4 space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div className="min-w-0 space-y-0.5">
          <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
            Simulate one yard
          </span>
          <span className="block max-w-3xl text-[11px] text-slate-500 dark:text-slate-400">
            {hasMementoTargets
              ? `One yard playthrough with ${targetLabel} ${
                  targetCount > 1 ? "memento drops" : "memento drop"
                } marked. It stops when the target memento completes or the roll cap runs out.`
              : "One yard playthrough for whole-yard fish income over the plotted horizon."}
          </span>
        </div>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
          onClick={onRun}
          disabled={!canRun || singleRunBusy}
        >
          {singleRunBusy ? "Rolling…" : singleRun ? "Roll again" : "Roll a yard"}
        </button>
      </div>

      {singleRun !== null ? (
        <div className="space-y-5">
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Run outcome
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {hasMementoTargets ? (
                <>
                  <StatTile
                    theme={singleRun.hitMemento ? "amber" : "slate"}
                    label={targetCount > 1 ? "Mementos" : "Memento"}
                    value={
                      singleRun.hitMemento
                        ? targetCount > 1
                          ? "ALL GOT IT!"
                          : "GOT IT!"
                        : "no hit"
                    }
                    sub={
                      singleRun.hitMemento
                        ? `${targetDropCount}/${targetCount} target drops`
                        : `cap = ${fmtInt(maxLotteryRolls)} rolls`
                    }
                  />
                  <StatTile
                    theme="rose"
                    label="Final target rolls"
                    value={
                      singleRun.hitMemento
                        ? `${fmtInt(singleRun.visits ?? 0)}`
                        : "—"
                    }
                    sub={
                      singleRun.hitMemento
                        ? "last memento cat"
                        : "not all targets won"
                    }
                  />
                </>
              ) : (
                <>
                  <StatTile
                    theme="amber"
                    label="Yard ledger"
                    value="rolled"
                    sub="fish income only"
                  />
                  <StatTile
                    theme="rose"
                    label="Yard visits"
                    value={fmtInt(singleRun.totalVisits)}
                    sub="any cat"
                  />
                </>
              )}
              <StatTile
                theme="rose"
                label={
                  timeDisplay.basis === "gameDay"
                    ? "Food days (sim)"
                    : "Food refills (sim)"
                }
                value={
                  singleRun.hitMemento
                    ? timeDisplay.basis === "gameDay"
                      ? (singleRun.days ?? 0).toFixed(2)
                      : ((singleRun.days ?? 0) * tdMul).toFixed(1)
                    : timeDisplay.basis === "gameDay"
                      ? `${horizonDays.toFixed(0)}+`
                      : `${(horizonDays * tdMul).toFixed(0)}+`
                }
                sub={
                  timeDisplay.basis === "gameDay"
                    ? `display = food days; ${fmtInt(singleRun.totalVisits)} yard visits (any cat)`
                    : `display = food refills; ${fmtInt(singleRun.totalVisits)} yard visits (any cat)`
                }
              />
            </div>
            {targetMementoSummary ? (
              <p className="text-[11px] text-slate-700 dark:text-slate-200 rounded-md border border-slate-200/80 dark:border-slate-700 bg-white/65 dark:bg-slate-950/30 px-2.5 py-1.5">
                <span className="font-semibold">
                  Target drops:
                </span>{" "}
                <span className="font-mono text-slate-900 dark:text-slate-100">{targetMementoSummary}</span>
              </p>
            ) : null}
            {singleRunModelCdf ? (
              <p className="text-[11px] text-slate-800 dark:text-slate-200 rounded-md border border-blue-200/80 dark:border-blue-800/50 bg-blue-50/60 dark:bg-blue-950/20 px-2.5 py-1.5">
                <span className="font-mono font-semibold tabular-nums">
                  {(100 * singleRunModelCdf.p).toFixed(1)}%
                </span>
                {" "}
                <span className="text-slate-600 dark:text-slate-400">
                  estimated chance by{" "}
                  {timeDisplay.basis === "gameDay"
                    ? `${singleRunModelCdf.day.toFixed(2)} food days`
                    : `${(singleRunModelCdf.day * tdMul).toFixed(1)} food refills`}{" "}
                  for this yard
                </span>
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Fish earned
              </h4>
              <details className="group text-[10px] text-slate-500 dark:text-slate-400">
                <summary className="cursor-pointer list-none rounded-md border border-slate-200 px-2 py-1 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/70">
                  Cost math
                </summary>
                <p className="mt-1 max-w-5xl rounded-md border border-slate-200 bg-white/80 px-2 py-1.5 leading-snug dark:border-slate-700 dark:bg-slate-950/40">
                  <strong>Total</strong> is fish from cat visits only. <strong>Net</strong>{" "}
                  subtracts estimated restocks for the selected indoor and outdoor food;
                  dual-price foods use the cheaper gold-value option.
                  <strong> Net / food day</strong> is net divided by simulated food days.
                </p>
              </details>
            </div>
            <div className="overflow-x-auto rounded-md border border-slate-200/80 dark:border-slate-700">
              <table className="w-full min-w-[300px] text-left text-xs sm:text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-950/50">
                    <th className="py-1.5 px-2 font-semibold text-slate-900 dark:text-slate-100">
                      Currency
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-slate-900 dark:text-slate-100 text-right">
                      Net
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-slate-900 dark:text-slate-100 text-right">
                      Net / food day
                    </th>
                    <th className="py-1.5 px-2 font-semibold text-slate-900 dark:text-slate-100 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono text-slate-900 dark:text-slate-100">
                  <tr className="border-b border-slate-200/70 bg-sky-50/45 dark:border-slate-700 dark:bg-sky-950/15">
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                      <span className="block">Silver fish</span>
                      <span className="block text-[10px] font-normal opacity-70">
                        visit payouts (silver-branch)
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {fmtInt(silverNet)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {silverNetPerDay === null
                        ? "—"
                        : fmtPerDay(silverNetPerDay)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {fmtInt(silverTotal)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200/70 bg-amber-50/35 dark:border-slate-700 dark:bg-amber-950/15">
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                      <span className="block">Gold fish</span>
                      <span className="block text-[10px] font-normal opacity-70">
                        visit payouts (gold-branch)
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {fmtInt(goldNet)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {goldNetPerDay === null ? "—" : fmtPerDay(goldNetPerDay)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums">
                      {fmtInt(goldTotal)}
                    </td>
                  </tr>
                  <tr className="bg-white/70 dark:bg-slate-950/25">
                    <td className="py-1.5 px-2 font-sans font-medium text-slate-800 dark:text-slate-200">
                      <span className="block">Gold-value total</span>
                      <span className="block text-[10px] font-normal opacity-70 font-sans">
                        gold + silver ÷ 50
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums align-top">
                      {fmtEquiv(goldEquivNet)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums align-top">
                      {fmtEquivPerDay(goldEquivNetPerDay)}
                    </td>
                    <td className="py-1.5 px-2 text-right tabular-nums align-top">
                      {fmtEquiv(goldEquivTotal)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Payout branches this run:{" "}
              <span className="font-mono">{fmtInt(ps)}</span> silver-branch,{" "}
              <span className="font-mono">{fmtInt(pg)}</span> gold-branch visits.
              {" · "}
              Bowl spend estimate:{" "}
              <span className="font-mono">{fmtInt(foodSpend.silver)}</span>{" "}
              silver,{" "}
              <span className="font-mono">{fmtInt(foodSpend.gold)}</span> gold (
	              {foodSpend.goldEquiv.toFixed(1)} gold-value).
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Income vs simulated time (
              {timeDisplay.basis === "gameDay" ? "food days" : "food refills"}
              )
            </h4>
            <SingleYardVisitIncomeChart
              visitTimeline={singleRun.visitTimeline}
              endDays={singleRun.endDays}
              focusEndDays={focusOnMementoDrop ? singleRun.days ?? null : null}
              activeCatLabel={activeCatLabel}
              activeCatId={activeCatId}
              targetCatIds={targetCatIds}
              catLabelForId={catLabelForId}
              foodTypeIndoor={foodTypeIndoor}
              foodTypeOutdoor={foodTypeOutdoor}
              outdoorRefillsPerDay={singleRun?.outdoorRefillsPerDay}
              timeDisplay={timeDisplay}
              alignXMaxDays={lotteryChartXMaxDays}
              lotteryCdfAtHorizon={lotteryCdfAtHorizon}
              mementoHits={singleRun.targetMementos}
            />
            {lotteryChartXMaxDays != null &&
            singleRun.endDays > lotteryChartXMaxDays + 1e-3 ? (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                The fish table uses the full run (
                {timeDisplay.basis === "gameDay"
                  ? `${singleRun.endDays.toFixed(1)} food days`
                  : `${(singleRun.endDays * tdMul).toFixed(1)} food refills`}
                ). The chart stops at the chance-curve limit (
                {timeDisplay.basis === "gameDay"
                  ? `${lotteryChartXMaxDays.toFixed(1)} food days`
                  : `${(lotteryChartXMaxDays * tdMul).toFixed(1)} food refills`}
                ).
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
          Click <strong>Roll a yard</strong> to simulate a fresh playthrough at{" "}
          {hasMementoTargets ? `${visitsPerDay.toFixed(2)} visits/food day` : "the current yard rates"}.
          {" "}
          {hasMementoTargets
            ? `The run stops when ${targetLabel} ${
                targetCount > 1 ? "all earn mementos" : "earns the memento"
              } or the ${fmtInt(maxLotteryRolls)}-roll cap runs out.`
            : "The fish ledger runs through the plotted horizon without requiring a memento target."}
        </p>
      )}
      {singleRun !== null ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-700">
          <p className="min-w-0 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
            {hasMementoTargets
              ? `This run's fish came from every cat visit, not only ${activeCatLabel}.`
              : "This run's fish came from every cat visit."}{" "}
            Payouts were{" "}
            <span className="font-mono text-slate-800 dark:text-slate-100">
              {pct(pg, pg + ps)}% gold-branch
            </span>
            ,{" "}
            <span className="font-mono text-slate-800 dark:text-slate-100">
              {pct(ps, pg + ps)}% silver-branch
            </span>
            .
          </p>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-400 dark:bg-amber-500 dark:text-slate-950 dark:hover:bg-amber-400"
            onClick={onRun}
            disabled={!canRun || singleRunBusy}
          >
            {singleRunBusy ? "Rolling…" : "Roll again"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function StatTile({
  theme,
  label,
  value,
  sub,
}: {
  theme: keyof typeof TILE_THEMES
  label: string
  value: string
  sub?: ReactNode
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${TILE_THEMES[theme]}`}
    >
      <div className="text-[10px] uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
      {sub ? (
        <div className="text-[10px] opacity-70 leading-snug mt-0.5">{sub}</div>
      ) : null}
    </div>
  )
}
