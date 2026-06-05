import type { Dispatch, SetStateAction } from "react"
import type { ImageMetaData } from "../../DisplayImage"
import type {
  MementoTimeDisplayBasis,
  MementoTimeDisplayScale,
} from "../../../utils/yardOptimizer/foodBowlEconomy"
import {
  CONTROL_BUBBLE_CLASS,
  FISH_PLOT_MIN_W,
  FISH_PLOT_VB_H,
} from "../../../utils/yardOptimizer/mementoLab/constants"
import {
  fmtAxisTick,
  fmtDisplayTick,
  fmtFishAxisTick,
  formatDisplayTimeText,
  pickXTicks,
} from "../../../utils/yardOptimizer/mementoLab/chartFormatters"
import {
  fishPlotMetricLabel,
  fishPlotTitle,
  fishPlotYAxisLabel,
  type AnalyticFishCurve,
  type FishPlotMetric,
  type FishPlotSummary,
} from "../../../utils/yardOptimizer/mementoLab/fishPlotStats"
import {
  SVG_CHART_BOTTOM_PAD,
  SVG_CHART_PLOT_TOP,
  SVG_CHART_TITLE_Y,
  chartLayout,
  MeasuredChartSvg,
  SvgChartText,
  useMeasuredChartWidth,
} from "./chartPrimitives"
import { SvgFoodAxisLabel } from "./foodDisplayComponents"

const FISH_PLOT_PAD = { l: 62, r: 18, t: SVG_CHART_PLOT_TOP, b: SVG_CHART_BOTTOM_PAD } as const

export default function FishPlotPanel({
  fishMetric,
  setFishMetric,
  xAxisUnit,
  setXAxisUnit,
  visitsPerDay,
  fishSummary,
  analyticRatePerDay,
  analyticVariancePerDay,
  analyticLabel,
  analyticCurve,
  ciConfidence,
  canRunSimulation,
  hasMementoTargets,
  simBusy,
  simProgress,
  timeDisplay,
  foodUnitMeta,
  timeDisplayBasis,
  setTimeDisplayBasis,
  fishPlotHorizonDays,
  setFishPlotHorizonDays,
}: {
  fishMetric: FishPlotMetric
  setFishMetric: Dispatch<SetStateAction<FishPlotMetric>>
  xAxisUnit: "visits" | "days"
  setXAxisUnit: (next: "visits" | "days") => void
  visitsPerDay: number
  fishSummary: FishPlotSummary | null
  analyticRatePerDay: number | null
  analyticVariancePerDay: number | null
  analyticLabel: string
  analyticCurve: AnalyticFishCurve | null
  ciConfidence: 90 | 95 | 99
  canRunSimulation: boolean
  hasMementoTargets: boolean
  simBusy: boolean
  simProgress: { done: number; total: number } | null
  timeDisplay: MementoTimeDisplayScale
  foodUnitMeta: ImageMetaData
  timeDisplayBasis: MementoTimeDisplayBasis
  setTimeDisplayBasis: (next: MementoTimeDisplayBasis) => void
  fishPlotHorizonDays: number
  setFishPlotHorizonDays: Dispatch<SetStateAction<number>>
}) {
  const {
    frameRef: fishPlotFrameRef,
    width: fishPlotWidth,
    isMeasured: isFishPlotMeasured,
  } = useMeasuredChartWidth(FISH_PLOT_MIN_W)

  const pad = FISH_PLOT_PAD
  const vbW = fishPlotWidth
  const vbH = FISH_PLOT_VB_H
  const fishLayout = chartLayout(vbW, vbH, pad)
  const { iw, ih } = fishLayout
  const tdMul = timeDisplay.displayMul > 0 ? timeDisplay.displayMul : 1
  const safeVisitsPerDay = Math.max(visitsPerDay, 0)
  const safeXAxisUnit = safeVisitsPerDay > 1e-12 ? xAxisUnit : "days"
  const isXAxisVisits = safeXAxisUnit === "visits"
  const xMaxDays =
    fishSummary?.xDays[fishSummary.xDays.length - 1] ??
    analyticCurve?.xDays[analyticCurve.xDays.length - 1] ??
    1
  const xMaxAxis = isXAxisVisits
    ? Math.max(1e-9, xMaxDays * Math.max(safeVisitsPerDay, 1e-9))
    : xMaxDays
  const toAxisX = (day: number) =>
    isXAxisVisits ? day * safeVisitsPerDay : day
  const yMin = Math.min(
    fishSummary?.yMin ?? 0,
    ...(analyticCurve?.low ?? [0])
  )
  const yMax = Math.max(
    fishSummary?.yMax ?? 1,
    ...(analyticCurve?.high ?? [1])
  )
  const xScaleAxis = (axisX: number) =>
    pad.l + (axisX / Math.max(xMaxAxis, 1e-9)) * iw
  const yScale = (v: number) =>
    pad.t + ih - ((v - yMin) / Math.max(yMax - yMin, 1e-9)) * ih
  const yTicks = pickXTicks(yMin, yMax, 5)
  const xDisplayMax = xMaxDays * tdMul
  const displayTicks =
    fishSummary === null && analyticCurve === null
      ? []
      : pickXTicks(0, xMaxAxis, 7)
  const ciPolygon =
    fishSummary !== null
      ? [
          ...fishSummary.xDays.map((d, i) =>
            `${xScaleAxis(toAxisX(d))},${yScale(fishSummary.low[i]!)}`
          ),
          ...fishSummary.xDays
            .map((d, i) => `${xScaleAxis(toAxisX(d))},${yScale(fishSummary.high[i]!)}`)
            .reverse(),
        ].join(" ")
      : ""
  const meanPoints =
    fishSummary !== null
      ? fishSummary.xDays
          .map((d, i) => `${xScaleAxis(toAxisX(d))},${yScale(fishSummary.mean[i]!)}`)
          .join(" ")
      : ""
  const analyticPoints =
    analyticCurve !== null
      ? analyticCurve.xDays
          .map((d, i) => `${xScaleAxis(toAxisX(d))},${yScale(analyticCurve.mean[i]!)}`)
          .join(" ")
      : ""
  const analyticBandPolygon =
    analyticCurve !== null
      ? [
          ...analyticCurve.xDays.map((d, i) =>
            `${xScaleAxis(toAxisX(d))},${yScale(analyticCurve.low[i]!)}`
          ),
          ...analyticCurve.xDays
            .map((d, i) => `${xScaleAxis(toAxisX(d))},${yScale(analyticCurve.high[i]!)}`)
            .reverse(),
        ].join(" ")
      : ""
  const zeroY = yMin < 0 && yMax > 0 ? yScale(0) : null

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Fish income
        </h3>
        <p className="max-w-3xl text-sm leading-snug text-slate-600 dark:text-slate-400">
          {canRunSimulation
            ? "The extra simulation batch samples cumulative net fish over the same rolled yards used by the memento chart. Runs keep accumulating fish through the plotted horizon after the target memento completes; late-horizon estimates get noisier as cumulative variance grows, so read the amber band as the reliability signal."
            : "The fish-income view can use the analyzer's whole-yard net fish model without selecting a memento target. The dashed line shows expected cumulative income over food days."}
        </p>
      </div>

      <div className={`${CONTROL_BUBBLE_CLASS} flex flex-wrap items-end gap-4`}>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Plot</span>
          <select
            value={fishMetric}
            onChange={(e) => setFishMetric(e.target.value as FishPlotMetric)}
            className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm min-w-56"
          >
            <option value="netGoldCum">Net gold</option>
            <option value="netGoldEquivCum">Net gold equiv</option>
            <option value="netSilverCum">Net silver</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">X-axis</span>
          <select
            value={safeXAxisUnit}
            onChange={(e) =>
              setXAxisUnit(e.target.value as "visits" | "days")
            }
            className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm min-w-56"
          >
            <option value="days">Food days</option>
            <option value="visits" disabled={safeVisitsPerDay <= 1e-12}>
              Visits from start
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Show time as</span>
          <select
            className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm min-w-56"
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
          <span className="text-sm font-medium">Time horizon</span>
          <input
            type="number"
            min={1}
            max={365}
            step={1}
            value={fishPlotHorizonDays}
            disabled={simBusy}
            onChange={(e) =>
              setFishPlotHorizonDays(
                Math.max(1, Math.min(365, Math.floor(Number(e.target.value) || 1)))
              )
            }
            className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm w-28 disabled:opacity-60 disabled:cursor-not-allowed"
          />
        </label>
        <span className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          {simBusy && simProgress
            ? `Extra simulations running: ${simProgress.done.toLocaleString()}/${simProgress.total.toLocaleString()} yards.`
            : fishSummary
              ? "Showing the latest extra-simulation batch."
              : canRunSimulation
                ? "Open Run extra simulations below to draw the amber validation interval."
                : "Showing the analytic fish-income curve."}
        </span>
      </div>

      <div className="flex min-h-12 flex-wrap gap-x-4 gap-y-2 items-center text-xs text-slate-600 dark:text-slate-400 font-mono">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-3 rounded-sm"
            style={{ background: "rgba(14, 165, 233, 0.18)" }}
          />
          first-order {ciConfidence}% analytic band
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 border-t-2 border-dashed border-sky-600 dark:border-sky-300" />
          {analyticLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-6 h-0.5 bg-amber-600 dark:bg-amber-300" />
          simulated mean
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-6 h-3 rounded-sm"
            style={{ background: "rgba(245, 158, 11, 0.25)" }}
          />
          {ciConfidence}% individual-yard band
        </span>
        {fishSummary ? (
          <span className="text-slate-800 dark:text-slate-200">
            {fishSummary.n.toLocaleString()} yards
            {hasMementoTargets ? (
              <>
                {" · "}
                {((100 * fishSummary.hitCount) / fishSummary.n).toFixed(1)}% completed ·
                avg memento/cap {formatDisplayTimeText(fishSummary.endDayMean, timeDisplay)}
              </>
            ) : null}
            {analyticRatePerDay !== null ? (
              <>
                {" · "}mean-field rate {analyticRatePerDay.toFixed(2)}/food day
              </>
            ) : null}
            {analyticVariancePerDay !== null ? (
              <> · raw var {analyticVariancePerDay.toFixed(2)}/food day</>
            ) : null}
          </span>
        ) : (
          <span className="opacity-70">run extra simulations to draw the interval</span>
        )}
      </div>

      <MeasuredChartSvg
        frameRef={fishPlotFrameRef}
        isMeasured={isFishPlotMeasured}
        width={vbW}
        height={vbH}
        minWidth={FISH_PLOT_MIN_W}
        role="img"
        aria-label={`${fishPlotMetricLabel(fishMetric)} over simulated waiting time with an approximate ${ciConfidence}% individual-yard band`}
      >
        <rect
          width={vbW}
          height={vbH}
          className="fill-slate-50 dark:fill-slate-900"
          rx={8}
        />
        <SvgChartText
          variant="title"
          x={pad.l}
          y={SVG_CHART_TITLE_Y}
        >
          {fishPlotTitle(fishMetric)}
        </SvgChartText>
        <SvgChartText
          variant="axis"
          x={12}
          y={fishLayout.yMid}
          transform={`rotate(-90, 12, ${fishLayout.yMid})`}
          textAnchor="middle"
        >
          {fishPlotYAxisLabel(fishMetric)}
        </SvgChartText>
        {displayTicks.map((xt) => {
          const px = xScaleAxis(xt)
          return (
            <g key={`fish-x-${xt}`}>
              <line
                x1={px}
                x2={px}
                y1={pad.t}
                y2={pad.t + ih}
                stroke="currentColor"
                className="text-slate-100 dark:text-slate-800"
                strokeWidth={1}
              />
              <SvgChartText
                variant="tick"
                x={px}
                y={fishLayout.xTickY}
                textAnchor="middle"
              >
                {isXAxisVisits ? fmtAxisTick(xt, false) : fmtDisplayTick(xt, tdMul)}
              </SvgChartText>
            </g>
          )
        })}
        {yTicks.map((yt) => (
          <g key={`fish-y-${yt}`}>
            <line
              x1={pad.l}
              x2={pad.l + iw}
              y1={yScale(yt)}
              y2={yScale(yt)}
              stroke="currentColor"
              className="text-slate-200 dark:text-slate-700"
              strokeWidth={1}
            />
            <SvgChartText
              variant="tick"
              x={pad.l - 6}
              y={yScale(yt) + 3}
              textAnchor="end"
            >
              {fmtFishAxisTick(yt)}
            </SvgChartText>
          </g>
        ))}
        {zeroY !== null ? (
          <line
            x1={pad.l}
            x2={pad.l + iw}
            y1={zeroY}
            y2={zeroY}
            className="stroke-slate-500/40 dark:stroke-slate-400/35"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ) : null}
        {analyticBandPolygon ? (
          <polygon
            points={analyticBandPolygon}
            fill="rgba(14, 165, 233, 0.16)"
            stroke="rgba(2, 132, 199, 0.22)"
            strokeWidth={1}
          />
        ) : null}
        {ciPolygon ? (
          <polygon
            points={ciPolygon}
            fill="rgba(245, 158, 11, 0.24)"
            stroke="rgba(217, 119, 6, 0.45)"
            strokeWidth={1}
          />
        ) : null}
        {analyticPoints ? (
          <polyline
            fill="none"
            stroke="rgb(2 132 199)"
            strokeWidth={1.8}
            strokeDasharray="5 4"
            points={analyticPoints}
          />
        ) : null}
        {meanPoints ? (
          <polyline
            fill="none"
            stroke="rgb(217 119 6)"
            strokeWidth={2.25}
            points={meanPoints}
          />
        ) : null}
        {isXAxisVisits || timeDisplay.basis === "gameDay" ? (
          <SvgChartText
            variant="axis"
            x={pad.l + iw / 2}
            y={fishLayout.xLabelY}
            textAnchor="middle"
          >
            {isXAxisVisits
              ? `visits from start: 0 -> ${xMaxAxis.toFixed(1)}`
              : `time in food days: 0 -> ${xMaxDays.toFixed(1)}`}
          </SvgChartText>
        ) : (
          <SvgFoodAxisLabel
            x={pad.l + iw / 2}
            y={fishLayout.xLabelY}
            text="time in food refills"
            suffix={`0 -> ${xDisplayMax.toFixed(1)}`}
            variant="axis"
            foodMeta={foodUnitMeta}
            width={320}
          />
        )}
      </MeasuredChartSvg>

      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
        The blue band is a first-order analytic outcome interval for the full
        plotted horizon. The amber band is the simulated individual-yard spread,
        so it shows the unlucky/lucky range players may actually see even when
        the expectation is positive. Variance uses analyzer visit rates, the
        relative indoor/outdoor gold-branch probability, silver-branch
        probability, and the silver multiplier.
      </p>
    </div>
  )
}
