import {
  useMemo,
  useState,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from "react"
import type { ImageMetaData } from "../../DisplayImage"
import type {
  MementoTimeDisplayBasis,
  MementoTimeDisplayScale,
} from "../../../utils/yardOptimizer/foodBowlEconomy"
import {
  BAR_BINS,
  CDF_AVG_MARKER_COLOR,
  CDF_QUANTILE_MARKER_COLOR,
  CONTROL_BUBBLE_CLASS,
  HAZARD_WINDOWS,
  QUANTILE_TARGETS,
  type HazardWindow,
} from "../../../utils/yardOptimizer/mementoLab/constants"
import {
  pct,
  fmtAxisTick,
  fmtDisplayTick,
  displayUnitWords,
  formatDisplayTimeText,
  pickXTicks,
  interpCumulative,
} from "../../../utils/yardOptimizer/mementoLab/chartFormatters"
import {
  findCurveCrossing,
  sampleDayForCurve,
} from "../../../utils/yardOptimizer/mementoLab/curveHelpers"
import type {
  BatchMementoSample,
  MementoCurveId,
  MementoCurveOption,
} from "../../../utils/yardOptimizer/mementoLab/types"
import {
  CHART_MIN_W,
  CHART_VB_H,
  CH_PAD,
  HAZARD_CHART_VB_H,
  HAZARD_PAD,
  SVG_CHART_TITLE_Y,
  chartLayout,
  MeasuredChartSvg,
  SvgChartText,
  useMeasuredChartWidth,
} from "./chartPrimitives"
import {
  DisplayTimeValue,
  FoodRefillUnit,
  SvgFoodAxisLabel,
  SvgFoodInlineLabel,
} from "./foodDisplayComponents"

export default function MementoTimingCharts({
  xAxisUnit,
  setXAxisUnit,
  visitsPerDay,
  plotMaxVisits,
  setPlotMaxVisits,
  timeDisplayBasis,
  setTimeDisplayBasis,
  isDaysAxis,
  visibleCurveOptions,
  exactCurve,
  empiricalCurves,
  xDomain,
  referenceCurveId,
  referenceCurveLabel,
  samples,
  showCiOnChart,
  showRunTrajectories,
  ciConfidence,
  trajectoryHits,
  timeDisplay,
  foodUnitMeta,
  tdMul,
  usesFoodUnit,
  probSuccessWithinCapFallback,
  measureWidthDeps,
}: {
  xAxisUnit: "visits" | "days"
  setXAxisUnit: (next: "visits" | "days") => void
  visitsPerDay: number
  plotMaxVisits: number
  setPlotMaxVisits: Dispatch<SetStateAction<number>>
  timeDisplayBasis: MementoTimeDisplayBasis
  setTimeDisplayBasis: (next: MementoTimeDisplayBasis) => void
  isDaysAxis: boolean
  visibleCurveOptions: MementoCurveOption[]
  exactCurve: { x: number; cum: number }[]
  empiricalCurves: Array<{
    id: MementoCurveId
    color: string
    points: Array<{ x: number; mean: number; low: number; high: number }>
  }>
  xDomain: { lo: number; hi: number }
  referenceCurveId: MementoCurveId
  referenceCurveLabel: string
  samples: BatchMementoSample[] | null
  showCiOnChart: boolean
  showRunTrajectories: boolean
  ciConfidence: 90 | 95 | 99
  trajectoryHits: BatchMementoSample[]
  timeDisplay: MementoTimeDisplayScale
  foodUnitMeta: ImageMetaData
  tdMul: number
  usesFoodUnit: boolean
  probSuccessWithinCapFallback: number
  measureWidthDeps: unknown[]
}) {
  const {
    frameRef: cdfChartFrameRef,
    width: chartWidth,
    isMeasured: isCdfChartMeasured,
  } = useMeasuredChartWidth(CHART_MIN_W, measureWidthDeps)

  const [daysWaited, setDaysWaited] = useState(0)
  const [hazardWindow, setHazardWindow] = useState<HazardWindow>(7)
  const [chartHover, setChartHover] = useState<{
    x: number
    exact: number
    empMean?: number
    low?: number
    high?: number
  } | null>(null)

  const empiricalCurve = empiricalCurves[0]?.points ?? []

  const dayHitBars = useMemo(() => {
    if (!isDaysAxis || !samples || samples.length === 0) return null
    const dHi = xDomain.hi
    if (dHi <= 0) return null
    const successDays: number[] = []
    for (const s of samples) {
      const sampleDay = sampleDayForCurve(s, referenceCurveId)
      if (sampleDay !== null && Number.isFinite(sampleDay) && sampleDay >= 0 && sampleDay <= dHi) {
        successDays.push(sampleDay)
      }
    }
    if (successDays.length === 0) return null
    const N = BAR_BINS
    const binWidth = dHi / N
    const counts = new Uint32Array(N)
    for (const d of successDays) {
      const i = Math.min(N - 1, Math.max(0, Math.floor(d / binWidth)))
      counts[i]! += 1
    }
    const heights = new Float64Array(N)
    let maxHeight = 0
    for (let i = 0; i < N; i++) {
      heights[i] = counts[i]! / samples.length
      if (heights[i]! > maxHeight) maxHeight = heights[i]!
    }
    return {
      binWidth,
      heights,
      maxHeight,
      successCount: successDays.length,
      totalSamples: samples.length,
      dHi,
    }
  }, [isDaysAxis, referenceCurveId, samples, xDomain.hi])

  const daysQuantileMarkers = useMemo(() => {
    if (!isDaysAxis) return [] as Array<{ p: number; day: number | null }>
    return QUANTILE_TARGETS.map((p) => ({
      p,
      day: findCurveCrossing(exactCurve, p),
    }))
  }, [isDaysAxis, exactCurve])

  const expectedDayMarker = useMemo(() => {
    if (!isDaysAxis || exactCurve.length < 2) return null
    const finalCum = exactCurve[exactCurve.length - 1]?.cum ?? 0
    if (finalCum <= 1e-12) return null
    let weighted = 0
    for (let i = 1; i < exactCurve.length; i++) {
      const a = exactCurve[i - 1]!
      const b = exactCurve[i]!
      const mass = Math.max(0, b.cum - a.cum)
      if (mass > 0) weighted += ((a.x + b.x) / 2) * mass
    }
    const day = weighted / finalCum
    return Number.isFinite(day) && day >= 0 ? day : null
  }, [exactCurve, isDaysAxis])

  const displayDayCdf = useMemo(
    () => (isDaysAxis ? exactCurve : []),
    [isDaysAxis, exactCurve]
  )
  const displayProbSuccessWithinCap = useMemo(
    () =>
      exactCurve.length > 0
        ? exactCurve[exactCurve.length - 1]!.cum
        : probSuccessWithinCapFallback,
    [exactCurve, probSuccessWithinCapFallback]
  )

  const safeDaysWaited = useMemo(() => {
    if (!isDaysAxis) return 0
    return Math.max(0, Math.min(xDomain.hi, daysWaited))
  }, [isDaysAxis, daysWaited, xDomain.hi])

  const hazardCurveSeries = useMemo(() => {
    if (!isDaysAxis) {
      return [] as Array<{
        id: MementoCurveId
        label: string
        color: string
        points: Array<{ x: number; p: number }>
      }>
    }
    return visibleCurveOptions
      .filter((opt) => opt.curve.length >= 2)
      .map((opt) => ({
        id: opt.id,
        label: opt.label,
        color: opt.color,
        points: opt.curve.map(({ x, cum }) => {
          const Fd = Math.max(0, Math.min(1, cum))
          const Fdk = Math.max(0, Math.min(1, interpCumulative(opt.curve, x + hazardWindow)))
          const survival = Math.max(0, 1 - Fd)
          const p = survival > 1e-9
            ? Math.max(0, Math.min(1, (Fdk - Fd) / survival))
            : 0
          return { x, p }
        }),
      }))
  }, [hazardWindow, isDaysAxis, visibleCurveOptions])

  const anxiousStats = useMemo(() => {
    if (!isDaysAxis) return null
    const W = safeDaysWaited
    const Fw = Math.max(0, Math.min(1, interpCumulative(displayDayCdf, W)))
    if (Fw >= 1 - 1e-9) return null
    const xMax = Math.max(0, xDomain.hi - W)
    const cond = (k: number): number => {
      const Fwk = Math.max(0, Math.min(1, interpCumulative(displayDayCdf, W + k)))
      const surv = Math.max(1e-12, 1 - Fw)
      return Math.max(0, Math.min(1, (Fwk - Fw) / surv))
    }
    const findRemaining = (target: number): number | null => {
      if (xMax <= 0) return null
      if (cond(xMax) < target - 1e-9) return null
      let lo = 0
      let hi = xMax
      for (let it = 0; it < 60; it++) {
        const mid = (lo + hi) / 2
        if (cond(mid) >= target) hi = mid
        else lo = mid
      }
      return hi
    }
    return {
      waited: W,
      todayP: cond(1),
      threeDayP: cond(3),
      weekP: cond(7),
      medianRem: findRemaining(0.5),
      p75Rem: findRemaining(0.75),
      p90Rem: findRemaining(0.9),
      asymptoteSuccess: displayProbSuccessWithinCap,
    }
  }, [isDaysAxis, displayDayCdf, displayProbSuccessWithinCap, safeDaysWaited, xDomain.hi])

  const hazardYMax = useMemo(() => {
    if (hazardCurveSeries.length === 0) return 1
    const m = hazardCurveSeries.reduce(
      (acc, series) =>
        Math.max(acc, series.points.reduce((a, p) => Math.max(a, p.p), 0)),
      0
    )
    if (m <= 0) return 0.1
    return Math.min(1, Math.max(0.1, m * 1.1))
  }, [hazardCurveSeries])

  const xTicks = useMemo(
    () => pickXTicks(xDomain.lo, xDomain.hi, 8),
    [xDomain.lo, xDomain.hi]
  )

  const cdfLayout = chartLayout(chartWidth, CHART_VB_H, CH_PAD)
  const { iw, ih } = cdfLayout

  const xScale = (x: number) => {
    const { lo, hi } = xDomain
    if (hi <= lo) return CH_PAD.l
    return CH_PAD.l + ((x - lo) / (hi - lo)) * iw
  }
  const yScale = (prob: number) => CH_PAD.t + ih - prob * ih
  const plottedCurvePts = visibleCurveOptions.map((opt) => ({
    id: opt.id,
    label: opt.label,
    color: opt.color,
    points: opt.curve.map((d) => `${xScale(d.x)},${yScale(d.cum)}`).join(" "),
  }))
  const empiricalCurvePts = empiricalCurves.map((curve) => ({
    ...curve,
    pointsAttr: curve.points
      .map((d) => `${xScale(d.x)},${yScale(d.mean)}`)
      .join(" "),
  }))
  const ciPolygonPts =
    empiricalCurve.length > 0 && showCiOnChart
      ? [
          ...empiricalCurve.map((d) => `${xScale(d.x)},${yScale(d.low)}`),
          ...[...empiricalCurve]
            .reverse()
            .map((d) => `${xScale(d.x)},${yScale(d.high)}`),
        ].join(" ")
      : ""

  const pointerToHoverX = (clientX: number, svg: SVGSVGElement): number => {
    const r = svg.getBoundingClientRect()
    const vx =
      ((clientX - r.left) / Math.max(r.width, 1e-6)) * chartWidth
    const t = (vx - CH_PAD.l) / Math.max(iw, 1e-6)
    const { lo, hi } = xDomain
    return Math.min(hi, Math.max(lo, lo + Math.min(1, Math.max(0, t)) * (hi - lo)))
  }

  const findNearest = <T extends { x: number }>(arr: T[], x: number): T | null => {
    if (arr.length === 0) return null
    let lo = 0
    let hi = arr.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (arr[mid]!.x < x) lo = mid + 1
      else hi = mid
    }
    const cand = arr[lo]!
    if (lo > 0 && Math.abs(arr[lo - 1]!.x - x) < Math.abs(cand.x - x)) {
      return arr[lo - 1]!
    }
    return cand
  }

  const onChartMove = (e: MouseEvent<SVGSVGElement>) => {
    const xv = pointerToHoverX(e.clientX, e.currentTarget)
    const emp = findNearest(empiricalCurve, xv)
    setChartHover({
      x: xv,
      exact: interpCumulative(exactCurve, xv),
      empMean: emp?.mean,
      low: emp?.low,
      high: emp?.high,
    })
  }

  const onChartLeave = () => setChartHover(null)

  return (
    <>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        Memento timing
      </h3>
      <p className="max-w-3xl text-sm leading-snug text-slate-600 dark:text-slate-400">
        This chart is a running total curve, officially called a CDF
        (cumulative distribution function). Pick a point on the bottom axis:
        the curve height tells you the chance the memento has happened by
        then. So 75% means about 75 out of 100 similar yards would already
        have the memento. For “Joint,” it means every target cat has dropped
        one.
      </p>

      <div className={`${CONTROL_BUBBLE_CLASS} grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(14rem,1fr)_minmax(14rem,1fr)_minmax(12rem,14rem)]`}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            X-axis
          </span>
          <select
            value={xAxisUnit}
            onChange={(e) => setXAxisUnit(e.target.value as "visits" | "days")}
            className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
          >
            <option value="days" disabled={visitsPerDay <= 1e-9}>
              Food days ({visitsPerDay.toFixed(2)} visits/food day)
            </option>
            <option value="visits">Visits from start</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Show time as
          </span>
          <select
            className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
            value={timeDisplayBasis}
            onChange={(e) =>
              setTimeDisplayBasis(e.target.value as MementoTimeDisplayBasis)
            }
          >
            <option value="gameDay">Food days (1∶1)</option>
            <option value="shortestBowlRefill">
              Food refills (shortest bowl)
            </option>
            <option value="priciestCanRefill">
              Food refills (priciest can)
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            Max target-cat visits
          </span>
          <input
            type="number"
            min={20}
            max={50000}
            step={10}
            value={plotMaxVisits}
            onChange={(e) => setPlotMaxVisits(Number(e.target.value))}
            className="w-full rounded border bg-white px-2 py-1.5 text-sm dark:bg-slate-800"
          />
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2 lg:col-span-3">
          Axis display is shared across both charts. The memento chart stops
          drawing each target cat&apos;s curve after this many of that cat&apos;s visits.
        </span>
      </div>

      {isDaysAxis && anxiousStats ? (
        <div
          className="order-[60] rounded-lg border border-emerald-200 dark:border-emerald-700/60 bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-3 space-y-2"
          aria-label="Patience-o-meter: chances given you have already waited some days"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-emerald-900 dark:text-emerald-200 font-semibold text-sm">
              Where am I now?
            </span>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-emerald-800 dark:text-emerald-300">
                {timeDisplay.basis === "gameDay"
                  ? "Food days waited so far:"
                  : "Food refills waited so far:"}
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(0.01, xDomain.hi * tdMul)}
                step={Math.max(0.05 * tdMul, (xDomain.hi * tdMul) / 400)}
                value={Math.min(daysWaited * tdMul, xDomain.hi * tdMul)}
                onChange={(e) =>
                  setDaysWaited(Number(e.target.value) / tdMul)
                }
                className="accent-emerald-600 w-44"
                aria-label="Time already waited without a memento (display units)"
              />
              <input
                type="number"
                min={0}
                max={xDomain.hi * tdMul}
                step={0.1}
                value={Number((daysWaited * tdMul).toFixed(2))}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setDaysWaited(
                    Number.isFinite(v) ? v / tdMul : 0
                  )
                }}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800 w-20 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setDaysWaited(0)}
                className="text-[11px] underline text-emerald-800/80 dark:text-emerald-300/80 hover:text-emerald-900 dark:hover:text-emerald-200"
              >
                reset
              </button>
            </label>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-1 text-sm font-mono">
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                Next{" "}
                <DisplayTimeValue
                  gameDays={1}
                  timeDisplay={timeDisplay}
                  foodMeta={foodUnitMeta}
                />
                :
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {pct(anxiousStats.todayP)}
              </span>
            </div>
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                Next{" "}
                <DisplayTimeValue
                  gameDays={3}
                  timeDisplay={timeDisplay}
                  foodMeta={foodUnitMeta}
                />
                :
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {pct(anxiousStats.threeDayP)}
              </span>
            </div>
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                Next{" "}
                <DisplayTimeValue
                  gameDays={7}
                  timeDisplay={timeDisplay}
                  foodMeta={foodUnitMeta}
                />
                :
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {pct(anxiousStats.weekP)}
              </span>
            </div>
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                50% in:
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {anxiousStats.medianRem !== null ? (
                  <DisplayTimeValue
                    gameDays={anxiousStats.medianRem}
                    timeDisplay={timeDisplay}
                    foodMeta={foodUnitMeta}
                    suffix=" more"
                  />
                ) : (
                  "≥ horizon"
                )}
              </span>
            </div>
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                75% in:
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {anxiousStats.p75Rem !== null ? (
                  <DisplayTimeValue
                    gameDays={anxiousStats.p75Rem}
                    timeDisplay={timeDisplay}
                    foodMeta={foodUnitMeta}
                    suffix=" more"
                  />
                ) : (
                  "≥ horizon"
                )}
              </span>
            </div>
            <div>
              <span className="text-emerald-800/80 dark:text-emerald-300/80">
                90% in:
              </span>{" "}
              <span className="text-emerald-900 dark:text-emerald-100 font-semibold">
                {anxiousStats.p90Rem !== null ? (
                  <DisplayTimeValue
                    gameDays={anxiousStats.p90Rem}
                    timeDisplay={timeDisplay}
                    foodMeta={foodUnitMeta}
                    suffix=" more"
                  />
                ) : (
                  "≥ horizon"
                )}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 leading-snug">
            Patience pays: every visit raises the per-visit lottery threshold, so
            your chance from this point can climb even on quiet days. That
            chance from this point is called the hazard. This uses the full timing
            curve, so the chart horizon does not create a fake certainty spike.
          </p>
        </div>
      ) : null}

      <div className="order-[20] flex min-h-12 flex-wrap gap-x-4 gap-y-2 items-center text-xs text-slate-600 dark:text-slate-400 font-mono">
        {isDaysAxis && expectedDayMarker !== null ? (
          <span
            className="flex items-center gap-1.5"
            style={{ color: CDF_AVG_MARKER_COLOR }}
            aria-label="Dotted line: average wait"
          >
            <span
              className="inline-block w-6 h-0.5 border-t-2 border-dotted"
              style={{ borderColor: CDF_AVG_MARKER_COLOR }}
            />
            avg wait ~
            <DisplayTimeValue
              gameDays={expectedDayMarker}
              timeDisplay={timeDisplay}
              foodMeta={foodUnitMeta}
            />
          </span>
        ) : null}
        {isDaysAxis
          ? daysQuantileMarkers.map((q) =>
              q.day === null ? null : (
                <span
                  key={`q-label-${q.p}`}
                  className="flex items-center gap-1.5"
                  style={{ color: CDF_QUANTILE_MARKER_COLOR }}
                  aria-label={`Dashed line: ${(q.p * 100).toFixed(0)}% chance marker`}
                >
                  <span
                    className="inline-block w-6 h-0.5 border-t-2 border-dashed"
                    style={{ borderColor: CDF_QUANTILE_MARKER_COLOR }}
                  />
                  {(q.p * 100).toFixed(0)}% chance by{" "}
                  <DisplayTimeValue
                    gameDays={q.day}
                    timeDisplay={timeDisplay}
                    foodMeta={foodUnitMeta}
                  />
                </span>
              )
            )
          : null}
        {samples ? (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-6 h-0.5 border-t-2 border-dashed border-stone-500" />
            simulated yards
          </span>
        ) : null}
        {showRunTrajectories && isDaysAxis && trajectoryHits.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-3 rounded-sm border border-amber-700/70"
              style={{ background: "rgba(217 119 6 / 0.45)" }}
            />
            memento hits per {displayUnitWords(timeDisplay)} bin
          </span>
        ) : null}
        {samples && showCiOnChart ? (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-6 h-3 rounded-sm opacity-80"
              style={{ background: "rgba(34, 197, 94, 0.35)" }}
            />
            estimate range ({ciConfidence}%)
          </span>
        ) : null}
        {chartHover ? (
          <span className="text-slate-800 dark:text-slate-200">
            {isDaysAxis
              ? timeDisplay.basis === "gameDay"
                ? `t = ${formatDisplayTimeText(chartHover.x, timeDisplay)}`
                : (
                  <>
                    time = {fmtDisplayTick(chartHover.x, tdMul)}
                    <FoodRefillUnit foodMeta={foodUnitMeta} className="ml-1" />
                  </>
                )
              : `visit ${chartHover.x.toFixed(0)}`}
            {" · "}
            <span className="text-slate-600 dark:text-slate-400">
              estimated chance
            </span>{" "}
            {(chartHover.exact * 100).toFixed(2)}%
            {chartHover.empMean !== undefined ? (
              <>
                {" · "}
                <span className="text-slate-600 dark:text-slate-400">
                  simulated yards
                </span>{" "}
                {samples && samples.length > 0 ? (
                  <>
                    {Math.round(chartHover.empMean * samples.length)} /{" "}
                    {samples.length} runs (
                    {(chartHover.empMean * 100).toFixed(2)}
                    %)
                  </>
                ) : (
                  <>{(chartHover.empMean * 100).toFixed(2)}%</>
                )}
                {chartHover.low !== undefined &&
                chartHover.high !== undefined ? (
                  <>
                    {" "}
                    <span className="text-slate-500 dark:text-slate-500">
                      {ciConfidence}% estimate range{" "}
                      {[
                        (chartHover.low * 100).toFixed(2),
                        (chartHover.high * 100).toFixed(2),
                      ].join("–")}
                      %
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </span>
        ) : (
          <span className="opacity-70">hover chart…</span>
        )}
        {showRunTrajectories && trajectoryHits.length > 0 ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xl">
            Bars: {trajectoryHits.length.toLocaleString()} memento hits grouped into{" "}
            {BAR_BINS} {displayUnitWords(timeDisplay)} time bins over [0,{" "}
            <DisplayTimeValue
              gameDays={xDomain.hi}
              timeDisplay={timeDisplay}
              foodMeta={foodUnitMeta}
            />
            ]; bin width ≈{" "}
            <DisplayTimeValue
              gameDays={xDomain.hi / BAR_BINS}
              timeDisplay={timeDisplay}
              foodMeta={foodUnitMeta}
            />
            .
          </span>
        ) : null}
      </div>

      <MeasuredChartSvg
        frameRef={cdfChartFrameRef}
        isMeasured={isCdfChartMeasured}
        width={chartWidth}
        height={CHART_VB_H}
        minWidth={CHART_MIN_W}
        frameClassName="order-[30] w-full overflow-x-auto"
        svgClassName="block w-full touch-none overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900"
        id="memento-lottery-cdf-svg"
        role="img"
        aria-label={
          isDaysAxis
            ? "Chance the memento has happened by each time on the chart"
            : "Chance the memento has happened by each visit count on the chart"
        }
        onMouseMove={onChartMove}
        onMouseLeave={onChartLeave}
      >
        <rect
          width={chartWidth}
          height={CHART_VB_H}
          className="fill-slate-50 dark:fill-slate-900"
          rx={8}
        />
        <SvgChartText
          variant="title"
          x={CH_PAD.l}
          y={SVG_CHART_TITLE_Y}
        >
          chance by this time (CDF)
        </SvgChartText>
        {isDaysAxis && timeDisplay.basis !== "gameDay" ? (
          <SvgFoodAxisLabel
            x={CH_PAD.l + iw / 2}
            y={cdfLayout.xLabelY}
            text="time in food refills"
            suffix={`at ${tdMul.toFixed(2)} refills/food day`}
            variant="axis"
            foodMeta={foodUnitMeta}
          />
        ) : (
          <SvgChartText
            variant="axis"
            x={CH_PAD.l + iw / 2}
            y={cdfLayout.xLabelY}
            textAnchor="middle"
          >
            {isDaysAxis
              ? `time in food days · ${visitsPerDay.toFixed(2)} visits/food day`
              : "visits from start (n)"}
          </SvgChartText>
        )}
        {xTicks.map((xt) => {
          const xspan = Math.max(xDomain.hi - xDomain.lo, 1e-9)
          const px = CH_PAD.l + ((xt - xDomain.lo) / xspan) * iw
          return (
            <g key={`gx-${xt}`}>
              <line
                x1={px}
                x2={px}
                y1={CH_PAD.t}
                y2={CH_PAD.t + ih}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth={1}
              />
              <SvgChartText
                variant="tick"
                x={px}
                y={cdfLayout.xTickY}
                textAnchor="middle"
              >
                {isDaysAxis
                  ? fmtDisplayTick(xt, tdMul)
                  : fmtAxisTick(xt, false)}
              </SvgChartText>
            </g>
          )
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1={CH_PAD.l}
              x2={CH_PAD.l + iw}
              y1={yScale(t)}
              y2={yScale(t)}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth={1}
            />
            <SvgChartText
              variant="tick"
              x={CH_PAD.l - 6}
              y={yScale(t) + 4}
              textAnchor="end"
            >
              {(100 * t).toFixed(0)}%
            </SvgChartText>
          </g>
        ))}
        {ciPolygonPts ? (
          <polygon
            points={ciPolygonPts}
            fill="rgba(34, 197, 94, 0.28)"
            stroke="rgba(22, 163, 74, 0.45)"
            strokeWidth={1}
          />
        ) : null}
        {empiricalCurvePts.map((curve) => (
          <polyline
            key={`mc-${curve.id}`}
            fill="none"
            stroke={curve.color}
            strokeWidth={1.25}
            strokeDasharray="5 4"
            opacity={0.75}
            points={curve.pointsAttr}
          />
        ))}
        {showRunTrajectories &&
        isDaysAxis &&
        dayHitBars &&
        dayHitBars.maxHeight > 0 ? (
          <g aria-label="Empirical hit-mass per food-day bin">
            {Array.from({ length: BAR_BINS }).map((_, i) => {
              const h = dayHitBars.heights[i]!
              if (h <= 0) return null
              const x0 = xScale(i * dayHitBars.binWidth)
              const x1 = xScale((i + 1) * dayHitBars.binWidth)
              const w = Math.max(0.5, x1 - x0 - 0.4)
              const yTop = yScale(h)
              const yBot = yScale(0)
              return (
                <rect
                  key={`bar-${i}`}
                  x={x0 + 0.2}
                  y={yTop}
                  width={w}
                  height={Math.max(0, yBot - yTop)}
                  fill="rgba(217 119 6 / 0.45)"
                  stroke="rgba(146 64 14 / 0.75)"
                  strokeWidth={0.4}
                />
              )
            })}
          </g>
        ) : null}
        {isDaysAxis &&
          daysQuantileMarkers.map((q) => {
            if (q.day === null) return null
            const x = xScale(q.day)
            return (
              <g
                key={`q-${q.p}`}
                aria-label={`P=${(q.p * 100).toFixed(0)}% reached at ${fmtDisplayTick(q.day!, tdMul)} display units`}
              >
                <line
                  x1={x}
                  x2={x}
                  y1={CH_PAD.t}
                  y2={CH_PAD.t + ih}
                  stroke={CDF_QUANTILE_MARKER_COLOR}
                  strokeOpacity={0.55}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
              </g>
            )
          })}
        {isDaysAxis && expectedDayMarker !== null ? (() => {
          const x = xScale(expectedDayMarker)
          return (
            <g
              aria-label={`Expected memento time ${fmtDisplayTick(expectedDayMarker, tdMul)} display units`}
            >
              <line
                x1={x}
                x2={x}
                y1={CH_PAD.t}
                y2={CH_PAD.t + ih}
                stroke={CDF_AVG_MARKER_COLOR}
                strokeOpacity={0.65}
                strokeDasharray="1 4"
                strokeWidth={1.2}
              />
            </g>
          )
        })() : null}
        {plottedCurvePts.map((curve, i) => (
          <polyline
            key={curve.id}
            fill="none"
            stroke={curve.color}
            strokeWidth={i === 0 ? 2.25 : 1.8}
            strokeOpacity={0.95}
            points={curve.points}
          />
        ))}
        {isDaysAxis ? (() => {
          const markerItems = [
            ...(expectedDayMarker !== null
              ? [
                  {
                    key: "avg",
                    day: expectedDayMarker,
                    label: usesFoodUnit
                      ? `avg ${fmtDisplayTick(expectedDayMarker, tdMul)}`
                      : `avg ${formatDisplayTimeText(
                          expectedDayMarker,
                          timeDisplay
                        )}`,
                    color: CDF_AVG_MARKER_COLOR,
                    strokeDasharray: "1 4",
                  },
                ]
              : []),
            ...daysQuantileMarkers
              .filter((q): q is { p: number; day: number } => q.day !== null)
              .map((q) => ({
                key: `q-${q.p}`,
                day: q.day,
                label: usesFoodUnit
                  ? `${(q.p * 100).toFixed(0)}% ${fmtDisplayTick(
                      q.day,
                      tdMul
                    )}`
                  : `${(q.p * 100).toFixed(0)}% ${formatDisplayTimeText(
                      q.day,
                      timeDisplay
                    )}`,
                color: CDF_QUANTILE_MARKER_COLOR,
                strokeDasharray: "3 3",
              })),
          ].sort((a, b) => a.day - b.day)
          const rowRightEdges: number[] = []
          return markerItems.map((item) => {
            const x = xScale(item.day)
            const labelW = Math.min(
              usesFoodUnit ? 68 : 128,
              item.label.length * 5.2 + (usesFoodUnit ? 24 : 10)
            )
            const labelX = Math.max(
              CH_PAD.l + labelW / 2 + 2,
              Math.min(CH_PAD.l + iw - labelW / 2 - 2, x)
            )
            const left = labelX - labelW / 2
            let row = 0
            while (
              rowRightEdges[row] !== undefined &&
              left < rowRightEdges[row]! + 4
            ) {
              row += 1
            }
            rowRightEdges[row] = labelX + labelW / 2
            const labelY = CH_PAD.t + 13 + row * 14
            return (
              <g key={`cdf-marker-label-${item.key}`} pointerEvents="none">
                <line
                  x1={x}
                  x2={x}
                  y1={CH_PAD.t}
                  y2={CH_PAD.t + ih}
                  stroke={item.color}
                  strokeOpacity={0.22}
                  strokeDasharray={item.strokeDasharray}
                  strokeWidth={1}
                />
                <rect
                  x={labelX - labelW / 2}
                  y={labelY - 10}
                  width={labelW}
                  height={13}
                  rx={3}
                  className="fill-slate-50/95 dark:fill-slate-900/95"
                  stroke={item.color}
                  strokeOpacity={0.75}
                  strokeWidth={0.7}
                />
                <SvgChartText
                  variant="marker"
                  x={usesFoodUnit ? labelX - 7 : labelX}
                  y={labelY}
                  textAnchor="middle"
                  fill={item.color}
                >
                  {item.label}
                </SvgChartText>
                {usesFoodUnit ? (
                  <image
                    href={foodUnitMeta.url}
                    x={labelX + labelW / 2 - 18}
                    y={labelY - 9.5}
                    width={15}
                    height={11}
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : null}
              </g>
            )
          })
        })() : null}
        {isDaysAxis && safeDaysWaited > 0 ? (() => {
          const x = xScale(safeDaysWaited)
          const cdfHere = interpCumulative(exactCurve, safeDaysWaited)
          const yBand = CH_PAD.t + ih - 10 - (Math.floor(safeDaysWaited) % 3) * 12
          const waitedText = fmtDisplayTick(safeDaysWaited, tdMul)
          const waitedSuffix = `· P≤${(cdfHere * 100).toFixed(0)}%`
          return (
            <g aria-label={`You are here: ${fmtDisplayTick(safeDaysWaited, tdMul)} display units`}>
              <line
                x1={x}
                x2={x}
                y1={CH_PAD.t}
                y2={CH_PAD.t + ih}
                stroke="rgb(5 150 105)"
                strokeWidth={1.25}
                strokeDasharray="4 3"
                strokeOpacity={0.85}
              />
              {usesFoodUnit ? (
                <SvgFoodInlineLabel
                  x={x + 5}
                  y={yBand}
                  text={waitedText}
                  suffix={waitedSuffix}
                  foodMeta={foodUnitMeta}
                  width={120}
                />
              ) : (
                <SvgChartText
                  variant="axis"
                  x={x + 5}
                  y={yBand}
                  className="fill-emerald-700 dark:fill-emerald-300 font-medium"
                >
                  {`${waitedText} food days ${waitedSuffix}`}
                </SvgChartText>
              )}
            </g>
          )
        })() : null}
      </MeasuredChartSvg>

      {isDaysAxis && hazardCurveSeries.length > 0 ? (() => {
        const hazardLayout = chartLayout(chartWidth, HAZARD_CHART_VB_H, HAZARD_PAD)
        const { iw: iwHz, ih: ihHz } = hazardLayout
        const xScaleHz = (x: number) => {
          const span = Math.max(xDomain.hi - xDomain.lo, 1e-9)
          return HAZARD_PAD.l + ((x - xDomain.lo) / span) * iwHz
        }
        const yMaxHz = Math.max(hazardYMax, 1e-9)
        const yScaleHz = (p: number) =>
          HAZARD_PAD.t + ihHz - (Math.min(p, yMaxHz) / yMaxHz) * ihHz
        const primaryHazardSeries =
          hazardCurveSeries.find((series) => series.id === referenceCurveId) ??
          hazardCurveSeries[0]
        const primaryHazard = primaryHazardSeries?.points ?? []
        const fillSegs: string[] = [
          `M ${xScaleHz(xDomain.lo)} ${yScaleHz(0)}`,
        ]
        for (const pt of primaryHazard) {
          fillSegs.push(`L ${xScaleHz(pt.x)} ${yScaleHz(pt.p)}`)
        }
        fillSegs.push(`L ${xScaleHz(xDomain.hi)} ${yScaleHz(0)}`, "Z")
        const yTicks = [0, 0.25, 0.5, 0.75, 1].map((q) =>
          Number((q * yMaxHz).toFixed(4))
        )
        const hereP = primaryHazard.length
          ? Math.max(
              0,
              Math.min(
                yMaxHz,
                primaryHazard.reduce((acc, cur) =>
                  Math.abs(cur.x - safeDaysWaited) <
                  Math.abs(acc.x - safeDaysWaited)
                    ? cur
                    : acc
                ).p
              )
            )
          : 0
        return (
          <div className="order-[40] space-y-2 mt-2 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                From this point for {referenceCurveLabel} (hazard):{" "}
                <span className="text-amber-800 dark:text-amber-300">
                  chance in the next{" "}
                  <DisplayTimeValue
                    gameDays={hazardWindow}
                    timeDisplay={timeDisplay}
                    foodMeta={foodUnitMeta}
                  />
                </span>{" "}
                if you are still waiting then
              </span>
              <fieldset
                className="flex flex-wrap gap-2 text-xs border border-slate-200 dark:border-slate-600 rounded px-2 py-1"
                aria-label="Chance window"
              >
                {HAZARD_WINDOWS.map((w) => (
                  <label
                    key={w}
                    className="inline-flex items-center gap-1 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="hazard-window"
                      checked={hazardWindow === w}
                      onChange={() => setHazardWindow(w)}
                      className="accent-amber-600"
                    />
                    next{" "}
                    <DisplayTimeValue
                      gameDays={w}
                      timeDisplay={timeDisplay}
                      foodMeta={foodUnitMeta}
                    />
                  </label>
                ))}
              </fieldset>
            </div>
            <MeasuredChartSvg
              isMeasured={isCdfChartMeasured}
              width={chartWidth}
              height={HAZARD_CHART_VB_H}
              minWidth={CHART_MIN_W}
              role="img"
              aria-label={`Chance of getting the memento within the next ${fmtDisplayTick(
                hazardWindow,
                tdMul
              )} ${displayUnitWords(timeDisplay)} if still waiting at that point`}
            >
              <rect
                width={chartWidth}
                height={HAZARD_CHART_VB_H}
                className="fill-slate-50 dark:fill-slate-900"
                rx={8}
              />
              <SvgChartText
                variant="title"
                x={HAZARD_PAD.l}
                y={SVG_CHART_TITLE_Y}
              >
                chance from this point (hazard)
              </SvgChartText>
              {timeDisplay.basis === "gameDay" ? (
                <SvgChartText
                  variant="axis"
                  x={HAZARD_PAD.l + iwHz / 2}
                  y={hazardLayout.xLabelY}
                  textAnchor="middle"
                >
                  time waited in food days
                </SvgChartText>
              ) : (
                <SvgFoodAxisLabel
                  x={HAZARD_PAD.l + iwHz / 2}
                  y={hazardLayout.xLabelY}
                  text="time waited in food refills"
                  variant="axis"
                  foodMeta={foodUnitMeta}
                />
              )}
              {yTicks.map((tv) => (
                <g key={`hzy-${tv}`}>
                  <line
                    x1={HAZARD_PAD.l}
                    x2={HAZARD_PAD.l + iwHz}
                    y1={yScaleHz(tv)}
                    y2={yScaleHz(tv)}
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-700"
                    strokeWidth={1}
                  />
                  <SvgChartText
                    variant="tick"
                    x={HAZARD_PAD.l - 6}
                    y={yScaleHz(tv) + 3}
                    textAnchor="end"
                  >
                    {`${(tv * 100).toFixed(0)}%`}
                  </SvgChartText>
                </g>
              ))}
              {xTicks.map((xt) => {
                const xspan = Math.max(xDomain.hi - xDomain.lo, 1e-9)
                const px =
                  HAZARD_PAD.l + ((xt - xDomain.lo) / xspan) * iwHz
                return (
                  <g key={`hzx-${xt}`}>
                    <line
                      x1={px}
                      x2={px}
                      y1={HAZARD_PAD.t}
                      y2={HAZARD_PAD.t + ihHz}
                      stroke="currentColor"
                      className="text-slate-100 dark:text-slate-800"
                      strokeWidth={1}
                    />
                    <SvgChartText
                      variant="tick"
                      x={px}
                      y={hazardLayout.xTickY}
                      textAnchor="middle"
                    >
                      {fmtDisplayTick(xt, tdMul)}
                    </SvgChartText>
                  </g>
                )
              })}
              <path
                d={fillSegs.join(" ")}
                fill={`${primaryHazardSeries?.color ?? CDF_QUANTILE_MARKER_COLOR}33`}
                stroke="none"
              />
              {hazardCurveSeries.map((series) => (
                <polyline
                  key={`hazard-${series.id}`}
                  fill="none"
                  stroke={series.color}
                  strokeWidth={series.id === referenceCurveId ? 1.9 : 1.45}
                  strokeOpacity={series.id === referenceCurveId ? 0.98 : 0.78}
                  points={series.points
                    .map((pt) => `${xScaleHz(pt.x)},${yScaleHz(pt.p)}`)
                    .join(" ")}
                />
              ))}
              {safeDaysWaited > 0 ? (() => {
                const xHere = xScaleHz(safeDaysWaited)
                const waitedText = `waited ${fmtDisplayTick(safeDaysWaited, tdMul)}`
                const waitedSuffix = `· ${(hereP * 100).toFixed(1)}%`
                return (
                  <g
                    aria-label={`Hazard chart: waited ${fmtDisplayTick(safeDaysWaited, tdMul)} display units`}
                  >
                    <line
                      x1={xHere}
                      x2={xHere}
                      y1={HAZARD_PAD.t}
                      y2={HAZARD_PAD.t + ihHz}
                      stroke="rgb(5 150 105)"
                      strokeWidth={1.25}
                      strokeDasharray="4 3"
                      strokeOpacity={0.85}
                    />
                    {usesFoodUnit ? (
                      <SvgFoodInlineLabel
                        x={xHere + 5}
                        y={HAZARD_PAD.t + 14}
                        text={waitedText}
                        suffix={waitedSuffix}
                        foodMeta={foodUnitMeta}
                        width={150}
                      />
                    ) : (
                      <SvgChartText
                        variant="axis"
                        x={xHere + 5}
                        y={HAZARD_PAD.t + 14}
                        className="fill-emerald-700 dark:fill-emerald-300 font-medium"
                      >
                        {`${waitedText} food days ${waitedSuffix}`}
                      </SvgChartText>
                    )}
                  </g>
                )
              })() : null}
            </MeasuredChartSvg>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
              Read the hazard chart as “from here, what are my odds?” Choose
              a spot on the bottom axis: that means you have already waited
              that long with no memento. The height shows your chance of
              getting it in the next{" "}
              <DisplayTimeValue
                gameDays={hazardWindow}
                timeDisplay={timeDisplay}
                foodMeta={foodUnitMeta}
              />
              . The far right edge is still honest: it uses the full
              model, so the chart does not pretend the chance becomes 100%
              just because the picture stops there.
            </p>
          </div>
        )
      })() : null}
    </>
  )
}
