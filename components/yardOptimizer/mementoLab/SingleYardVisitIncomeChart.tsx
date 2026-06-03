import {
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  YardMementoTargetHit,
  YardMementoVisitTimeline,
} from "../../../utils/yardOptimizer/yardMementoSim"
import {
  bowlDailySpendNativeBulkTriplet,
  bowlRefillsPerDay,
  SILVER_FISH_PER_GOLD_FISH,
  type MementoTimeDisplayScale,
} from "../../../utils/yardOptimizer/foodBowlEconomy"
import { catIconImageMeta, foodIconImageMeta } from "../../../utils/yardOptimizer/clientAssets"
import { MINUTES_PER_TICK } from "../../../utils/yardOptimizer/analyzer/constants"
import {
  SINGLE_YARD_INCOME_MIN_W,
  SINGLE_YARD_INCOME_VB_H,
  VISIT_MARKER_LINE_CAP,
} from "../../../utils/yardOptimizer/mementoLab/constants"
import { fmtFishAxisTick, pickXTicks } from "../../../utils/yardOptimizer/mementoLab/chartFormatters"
import {
  visitCatColor,
  visitCatLabel,
  evenlySpacedIndices,
} from "../../../utils/yardOptimizer/mementoLab/visitIncomeHelpers"
import type { SingleYardIncomePlotMode, VisitCatStat } from "../../../utils/yardOptimizer/mementoLab/types"
import {
  SVG_CHART_BOTTOM_PAD,
  SVG_CHART_PLOT_TOP,
  SVG_CHART_TITLE_Y,
  chartLayout,
  MeasuredChartSvg,
  SvgChartText,
  useMeasuredChartWidth,
} from "./chartPrimitives"
import { FoodRefillInline, SvgFoodAxisLabel } from "./foodDisplayComponents"
import VisitCatChipRow from "./VisitCatChipRow"

const SINGLE_YARD_INCOME_PAD = {
  l: 66,
  r: 14,
  t: SVG_CHART_PLOT_TOP,
  b: SVG_CHART_BOTTOM_PAD,
} as const

export default function SingleYardVisitIncomeChart({
  visitTimeline,
  endDays,
  focusEndDays,
  activeCatLabel,
  activeCatId,
  targetCatIds,
  catLabelForId,
  foodTypeIndoor,
  foodTypeOutdoor,
  outdoorRefillsPerDay,
  timeDisplay,
  /** When set (main chart = days), x-axis matches the lottery CDF panel and timeline is clipped. */
  alignXMaxDays,
  /** Same analytic P(memento by horizon) as the blue line in #memento-lottery-cdf when days. */
  lotteryCdfAtHorizon,
  /** Per-target memento drops from this single run. */
  mementoHits,
}: {
  visitTimeline: YardMementoVisitTimeline | undefined
  endDays: number
  focusEndDays?: number | null
  activeCatLabel: string
  activeCatId: number | null
  targetCatIds: number[]
  catLabelForId: (catId: number) => string
  foodTypeIndoor: number
  foodTypeOutdoor: number
  /** Outdoor refills/day the sim measured this run (off / absent → base bowl spend). */
  outdoorRefillsPerDay?: number
  timeDisplay: MementoTimeDisplayScale
  alignXMaxDays?: number | null
  lotteryCdfAtHorizon?: number | null
  mementoHits?: YardMementoTargetHit[]
}) {
  const [yMode, setYMode] = useState<SingleYardIncomePlotMode>("netGoldCum")
  const [hiddenVisitCatIds, setHiddenVisitCatIds] = useState<Record<number, boolean>>(
    {}
  )
  const {
    frameRef: singleYardFrameRef,
    width: singleYardChartWidth,
    isMeasured: isSingleYardChartMeasured,
  } = useMeasuredChartWidth(SINGLE_YARD_INCOME_MIN_W, [
    visitTimeline?.length,
    activeCatId,
    targetCatIds.length,
  ])

  const pad = SINGLE_YARD_INCOME_PAD
  const vbW = singleYardChartWidth
  const vbH = SINGLE_YARD_INCOME_VB_H
  const singleYardLayout = chartLayout(vbW, vbH, pad)
  const { iw, ih } = singleYardLayout

  const targetVisitCatIds = useMemo(() => {
    const ids = new Set(targetCatIds)
    if (activeCatId !== null) ids.add(activeCatId)
    return ids
  }, [activeCatId, targetCatIds])

  const visitCatStats = useMemo(() => {
    if (!visitTimeline || visitTimeline.length === 0) {
      return [] as VisitCatStat[]
    }
    const counts = new Map<number, number>()
    for (let i = 0; i < visitTimeline.length; i++) {
      const catId = visitTimeline.catId[i]!
      counts.set(catId, (counts.get(catId) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([catId, count]) => ({
        catId,
        count,
        color: visitCatColor(catId, activeCatId),
        label: visitCatLabel(catId, activeCatId, activeCatLabel, catLabelForId),
        isTargetCat: targetVisitCatIds.has(catId),
      }))
      .sort((a, b) => {
        if (a.isTargetCat !== b.isTargetCat) return a.isTargetCat ? -1 : 1
        if (activeCatId !== null && a.isTargetCat && b.isTargetCat) {
          if (a.catId === activeCatId && b.catId !== activeCatId) return -1
          if (b.catId === activeCatId && a.catId !== activeCatId) return 1
        }
        return b.count - a.count || a.catId - b.catId
      })
  }, [activeCatId, activeCatLabel, catLabelForId, targetVisitCatIds, visitTimeline])

  useEffect(() => {
    if (!visitTimeline || visitTimeline.length === 0) {
      setHiddenVisitCatIds({})
      return
    }
    const next: Record<number, boolean> = {}
    for (let i = 0; i < visitTimeline.length; i++) {
      const catId = visitTimeline.catId[i]!
      if (!targetVisitCatIds.has(catId)) next[catId] = true
    }
    setHiddenVisitCatIds(next)
  }, [targetVisitCatIds, visitTimeline])

  const targetVisitCatStats = useMemo(
    () => visitCatStats.filter((stat) => stat.isTargetCat),
    [visitCatStats]
  )
  const otherVisitCatStats = useMemo(
    () => visitCatStats.filter((stat) => !stat.isTargetCat),
    [visitCatStats]
  )

  const visibleVisitCatIds = useMemo(() => {
    const ids = new Set<number>()
    for (const stat of visitCatStats) {
      if (!hiddenVisitCatIds[stat.catId]) ids.add(stat.catId)
    }
    return ids
  }, [hiddenVisitCatIds, visitCatStats])

  const plot = useMemo(() => {
    const inB = bowlDailySpendNativeBulkTriplet(foodTypeIndoor)
    const outB = bowlDailySpendNativeBulkTriplet(foodTypeOutdoor)
    // Outdoor daily spend from the sim's measured refill rate (refills/day ÷ base refills/day);
    // off / no Tubbs leaves outdoorRefillsPerDay undefined and falls back to the base daily spend.
    const Ro = bowlRefillsPerDay(foodTypeOutdoor)
    const outScale =
      outdoorRefillsPerDay !== undefined && Ro > 0 ? outdoorRefillsPerDay / Ro : 1
    const dailySilver = inB.silver + outB.silver * outScale
    const dailyGold = inB.gold + outB.gold * outScale
    const dailyGoldEquiv = inB.goldEquiv + outB.goldEquiv * outScale

    const foodXScale =
      timeDisplay.displayMul > 0 ? timeDisplay.displayMul : 1
    const referenceFoodId = timeDisplay.referenceFoodId
    const timeBasis = timeDisplay.basis

    const raw = visitTimeline
    const cap =
      alignXMaxDays != null &&
      alignXMaxDays > 0 &&
      Number.isFinite(alignXMaxDays)
        ? alignXMaxDays
        : null
    const rawLen = raw?.length ?? 0
    let cappedTimelineLen = rawLen
    if (raw && cap !== null) {
      while (
        cappedTimelineLen > 0 &&
        raw.day[cappedTimelineLen - 1]! > cap + 1e-9
      ) {
        cappedTimelineLen--
      }
    }
    const tickMin = MINUTES_PER_TICK / (24 * 60)
    const lastCappedDay =
      raw && cappedTimelineLen > 0 ? raw.day[cappedTimelineLen - 1]! : 0
    const runExtent =
      focusEndDays != null &&
      focusEndDays > 0 &&
      Number.isFinite(focusEndDays)
        ? focusEndDays
        : Math.max(endDays, lastCappedDay)
    const dataExtent = Math.max(runExtent, tickMin)
    const runPad = Math.max(0.35, dataExtent * 0.12)
    const zoomMax = dataExtent + runPad
    const xMax = cap === null ? zoomMax : Math.min(cap, zoomMax)
    const cdfHorizonDays = cap
    const xAxisZoomedToRun =
      cdfHorizonDays !== null && xMax + 0.02 < cdfHorizonDays
    const xDisplayMax = xMax * foodXScale
    let timelineLen = cappedTimelineLen
    if (raw) {
      while (timelineLen > 0 && raw.day[timelineLen - 1]! > xMax + 1e-9) {
        timelineLen--
      }
    }

    const sx = (dDays: number) =>
      pad.l + ((dDays * foodXScale) / Math.max(xDisplayMax, 1e-9)) * iw

    const empty = {
      xMax,
      xDisplayMax,
      foodXScale,
      referenceFoodId,
      timeBasis,
      displayMul: timeDisplay.displayMul,
      cdfHorizonDays,
      xAxisZoomedToRun,
      pathD: "",
      barRects: [] as { x: number; w: number; h: number; y: number }[],
      yMin: 0,
      yMax: 1,
      yTitle: "",
      yAxisLabel: "",
      zeroLineY: null as number | null,
      markerLines: [] as {
        x: number
        catId: number
        isTarget: boolean
        color: string
      }[],
      markerNote: null as string | null,
      mementoMarkers: [] as Array<{
        catId: number
        x: number
        badgeX: number
        badgeY: number
        iconUrl: string
        label: string
      }>,
      xTicks: [] as number[],
      yTicks: [] as number[],
    }

    if (!raw || timelineLen === 0) return empty

    const markerSource: number[] = []
    for (let i = 0; i < timelineLen; i++) {
      if (visibleVisitCatIds.has(raw.catId[i]!)) markerSource.push(i)
    }
    const markerSourceCount = markerSource.length

    const idxs = evenlySpacedIndices(markerSourceCount, VISIT_MARKER_LINE_CAP)
    const markerLines: {
      x: number
      catId: number
      isTarget: boolean
      color: string
    }[] = []
    for (const ii of idxs) {
      const eventIdx = markerSource[ii]!
      const catId = raw.catId[eventIdx]!
      markerLines.push({
        x: sx(raw.day[eventIdx]!),
        catId,
        isTarget: raw.isTargetCat[eventIdx] === 1,
        color: visitCatColor(catId, activeCatId),
      })
    }
    let markerNote: string | null = null
    if (visibleVisitCatIds.size === 0) {
      markerNote = "No visit bars selected."
    } else if (markerSourceCount > VISIT_MARKER_LINE_CAP) {
      markerNote = `Drawing ${VISIT_MARKER_LINE_CAP} of ${markerSourceCount.toLocaleString()} visit markers (evenly spaced for performance, not a subsample of probability).`
    }
    const mementoHitsInView = (mementoHits ?? []).filter(
      (hit) => Number.isFinite(hit.days) && hit.days <= xMax + 1e-9
    )
    const mementoMarkers = mementoHitsInView.map((hit, i) => {
      const baseX = sx(hit.days)
      const offset =
        mementoHitsInView.length > 1
          ? (i - (mementoHitsInView.length - 1) / 2) * 22
          : 0
      return {
        catId: hit.catId,
        x: baseX,
        badgeX: Math.max(pad.l + 12, Math.min(pad.l + iw - 12, baseX + offset)),
        badgeY: pad.t - 3 + (i % 2) * 17,
        iconUrl: catIconImageMeta(hit.catId).url,
        label: catLabelForId(hit.catId),
      }
    })

    const isBarMode =
      yMode === "netGoldEquivPerDay" || yMode === "netGoldPerDay"

    if (isBarMode) {
      const nDays = Math.max(1, Math.ceil(xMax))
      const bins = new Float64Array(nDays)
      for (let i = 0; i < timelineLen; i++) {
        const di = Math.min(nDays - 1, Math.max(0, Math.floor(raw.day[i]!)))
        if (yMode === "netGoldPerDay") bins[di] += raw.goldDelta[i]!
        else
          bins[di] +=
            raw.goldDelta[i]! + raw.silverDelta[i]! / SILVER_FISH_PER_GOLD_FISH
      }
      for (let i = 0; i < nDays; i++) {
        if (yMode === "netGoldPerDay") bins[i]! -= dailyGold
        else bins[i]! -= dailyGoldEquiv
      }
      let yLo = bins[0]!
      let yHi = bins[0]!
      for (let i = 1; i < nDays; i++) {
        const v = bins[i]!
        yLo = Math.min(yLo, v)
        yHi = Math.max(yHi, v)
      }
      yLo = Math.min(yLo, 0)
      yHi = Math.max(yHi, 0)
      if (yLo === yHi) yHi = yLo + 1e-9
      const syBar = (v: number) => pad.t + ih - ((v - yLo) / (yHi - yLo)) * ih
      const y0Px = syBar(0)
      const dayW = (foodXScale / Math.max(xDisplayMax, 1e-9)) * iw
      const barRects: { x: number; w: number; h: number; y: number }[] = []
      for (let i = 0; i < nDays; i++) {
        const v = bins[i]!
        if (Math.abs(v) < 1e-12) continue
        const top = syBar(Math.max(0, v))
        const bot = syBar(Math.min(0, v))
        barRects.push({
          x: pad.l + i * dayW,
          w: Math.max(0.5, dayW - 0.25),
          h: Math.abs(top - bot),
          y: Math.min(top, bot),
        })
      }
      const yAxisLabel =
        yMode === "netGoldPerDay"
          ? "Net gold / food day"
          : "Net gold equiv / food day"
      const yTitle =
        yMode === "netGoldPerDay"
          ? "Net gold per food day (visits minus bowl cost)"
          : "Net gold equiv per food day (visits minus bowl cost)"
      const zeroLineY = yLo < 0 && yHi > 0 ? y0Px : null
      const xTicks = pickXTicks(0, xDisplayMax, 6)
      const yTicks = pickXTicks(yLo, yHi, 5)
      return {
        xMax,
        xDisplayMax,
        foodXScale,
        referenceFoodId,
        timeBasis,
        displayMul: timeDisplay.displayMul,
        cdfHorizonDays,
        xAxisZoomedToRun,
        pathD: "",
        barRects,
        yMin: yLo,
        yMax: yHi,
        yTitle,
        yAxisLabel,
        zeroLineY,
        markerLines,
        markerNote,
        mementoMarkers,
        xTicks,
        yTicks,
      }
    }

    const cumulativeYValue = (day: number, gold: number, silver: number) => {
      if (yMode === "netGoldEquivCum") {
        return gold + silver / SILVER_FISH_PER_GOLD_FISH - dailyGoldEquiv * day
      }
      if (yMode === "netSilverCum") {
        return silver - dailySilver * day
      }
      return gold - dailyGold * day
    }
    let yAxisLabel: string
    let yTitle: string
    if (yMode === "netGoldEquivCum") {
      yAxisLabel = "net gold equiv"
      yTitle = "Cumulative net value"
    } else if (yMode === "netSilverCum") {
      yAxisLabel = "net silver"
      yTitle = "Cumulative net silver"
    } else {
      yAxisLabel = "net gold"
      yTitle = "Cumulative net gold"
    }

    const yValueAt = (i: number) =>
      cumulativeYValue(
        raw.day[i]!,
        raw.goldCumulative[i]!,
        raw.silverCumulative[i]!
      )

    let yLo = 0
    let yHi = 1e-9
    for (let i = 0; i < timelineLen; i++) {
      const y = yValueAt(i)
      yLo = Math.min(yLo, y)
      yHi = Math.max(yHi, y)
    }
    const lastIdx = timelineLen - 1
    const endY = cumulativeYValue(
      xMax,
      raw.goldCumulative[lastIdx]!,
      raw.silverCumulative[lastIdx]!
    )
    yLo = Math.min(yLo, endY)
    yHi = Math.max(yHi, endY)
    if (yLo === yHi) yHi = yLo + 1e-9

    const sy = (v: number) => pad.t + ih - ((v - yLo) / (yHi - yLo)) * ih
    const zeroLineY = yLo < 0 && yHi > 0 ? sy(0) : null

    let d = `M ${sx(0)} ${sy(0)}`
    let prevYVal = 0
    for (let i = 0; i < timelineLen; i++) {
      const y = yValueAt(i)
      const xi = sx(raw.day[i]!)
      const yi = sy(y)
      d += ` L ${xi} ${sy(prevYVal)} L ${xi} ${yi}`
      prevYVal = y
    }
    d += ` L ${sx(xMax)} ${sy(prevYVal)} L ${sx(xMax)} ${sy(endY)}`

    const xTicks = pickXTicks(0, xDisplayMax, 6)
    const yTicks = pickXTicks(yLo, yHi, 5)

    return {
      xMax,
      xDisplayMax,
      foodXScale,
      referenceFoodId,
      timeBasis,
      displayMul: timeDisplay.displayMul,
      cdfHorizonDays,
      xAxisZoomedToRun,
      pathD: d,
      barRects: [] as { x: number; w: number; h: number; y: number }[],
      yMin: yLo,
      yMax: yHi,
      yTitle,
      yAxisLabel,
      zeroLineY,
      markerLines,
      markerNote,
      mementoMarkers,
      xTicks,
      yTicks,
    }
  }, [
    visitTimeline,
    endDays,
    focusEndDays,
    alignXMaxDays,
    yMode,
    visibleVisitCatIds,
    activeCatId,
    mementoHits,
    catLabelForId,
    foodTypeIndoor,
    foodTypeOutdoor,
    outdoorRefillsPerDay,
    timeDisplay,
    iw,
    ih,
    pad.l,
    pad.t,
  ])

  if (!visitTimeline || visitTimeline.length === 0) {
    return (
      <div className="rounded-md border border-amber-200/70 dark:border-amber-800/50 bg-white/50 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
        No visit timeline on this sample — click{" "}
        <strong>Roll a yard</strong> / <strong>Roll again</strong> to record one
        (single-run only).
      </div>
    )
  }

  const barMode =
    yMode === "netGoldEquivPerDay" || yMode === "netGoldPerDay"
  const yMid = singleYardLayout.yMid
  const chartFoodUnitMeta = foodIconImageMeta(timeDisplay.referenceFoodId ?? 1)
  const visitBarsAllVisible =
    visitCatStats.length > 0 && visitCatStats.every((stat) => !hiddenVisitCatIds[stat.catId])
  const visitBarsNoneVisible =
    visitCatStats.length > 0 && visitCatStats.every((stat) => hiddenVisitCatIds[stat.catId])
  const visitBarsTargetsOnly =
    visitCatStats.length > 0 &&
    visitCatStats.every((stat) =>
      stat.isTargetCat ? !hiddenVisitCatIds[stat.catId] : hiddenVisitCatIds[stat.catId]
    )
  const visitBarButtonClass = (active: boolean) =>
    `rounded-md border px-2 py-1 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-800 ${
      active
        ? "border-blue-500 bg-blue-500 text-white dark:border-blue-400 dark:bg-blue-500 dark:text-white"
        : "border-slate-300 dark:border-slate-600 bg-white/80 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200"
    }`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/35 px-2 py-2 text-[11px]">
        <label className="flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
          <span className="font-medium">Plot</span>
          <select
            className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 font-mono text-[11px]"
            value={yMode}
            onChange={(e) =>
              setYMode(e.target.value as SingleYardIncomePlotMode)
            }
          >
            <option value="netGoldCum">Net gold (cumulative)</option>
            <option value="netGoldEquivCum">Net gold equiv (cumulative)</option>
            <option value="netSilverCum">Net silver (cumulative)</option>
            <option value="netGoldEquivPerDay">Net gold equiv / food day (bars)</option>
            <option value="netGoldPerDay">Net gold / food day (bars)</option>
          </select>
        </label>
        <span className="ml-1 text-slate-500 dark:text-slate-400">
          Visit bars
        </span>
        <button
          type="button"
          className={visitBarButtonClass(visitBarsTargetsOnly)}
          onClick={() => {
            const next: Record<number, boolean> = {}
            for (const stat of visitCatStats) {
              if (!targetVisitCatIds.has(stat.catId)) next[stat.catId] = true
            }
            setHiddenVisitCatIds(next)
          }}
        >
          Targets
        </button>
        <button
          type="button"
          className={`${visitBarButtonClass(visitBarsAllVisible)} disabled:opacity-50 disabled:cursor-not-allowed`}
          onClick={() => setHiddenVisitCatIds({})}
          disabled={visitCatStats.length === 0}
        >
          All
        </button>
        <button
          type="button"
          className={visitBarButtonClass(visitBarsNoneVisible)}
          onClick={() =>
            setHiddenVisitCatIds(
              Object.fromEntries(visitCatStats.map((stat) => [stat.catId, true]))
            )
          }
        >
          None
        </button>
        {plot.markerNote ? (
          <span className="text-slate-500 dark:text-slate-400">
            {plot.markerNote}
          </span>
        ) : null}
      </div>
      {visitCatStats.length > 0 ? (
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-950/30 p-2 space-y-2">
          {targetVisitCatStats.length > 0 ? (
            <VisitCatChipRow
              title="Target cats"
              stats={targetVisitCatStats}
              hiddenVisitCatIds={hiddenVisitCatIds}
              setHiddenVisitCatIds={setHiddenVisitCatIds}
            />
          ) : null}
          {otherVisitCatStats.length > 0 ? (
            <details className="group/other-visitors">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <span>
                  Other visitors ({otherVisitCatStats.length})
                </span>
                <span className="normal-case tracking-normal text-slate-400 group-open/other-visitors:hidden">
                  hidden until expanded
                </span>
                <span className="hidden normal-case tracking-normal text-slate-400 group-open/other-visitors:inline">
                  collapse
                </span>
              </summary>
              <div className="mt-2 max-h-28 overflow-y-auto">
                <VisitCatChipRow
                  title="Other"
                  stats={otherVisitCatStats}
                  hiddenVisitCatIds={hiddenVisitCatIds}
                  setHiddenVisitCatIds={setHiddenVisitCatIds}
                />
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
      <MeasuredChartSvg
        frameRef={singleYardFrameRef}
        id="memento-single-yard-income"
        isMeasured={isSingleYardChartMeasured}
        width={vbW}
        height={vbH}
        minWidth={SINGLE_YARD_INCOME_MIN_W}
        svgClassName="block w-full overflow-hidden rounded-md border border-slate-200/80 bg-white/75 dark:border-slate-700 dark:bg-slate-950/35"
        placeholderClassName="rounded-md border border-slate-200/80 bg-white/75 dark:border-slate-700 dark:bg-slate-950/35"
        role="img"
        aria-label="Yard net fish versus simulated time (display axis; sim unchanged)"
      >
          <SvgChartText
            variant="title"
            x={pad.l}
            y={SVG_CHART_TITLE_Y}
          >
            {plot.yTitle}
          </SvgChartText>
          {lotteryCdfAtHorizon != null &&
          plot.cdfHorizonDays != null &&
          plot.cdfHorizonDays > 0 ? (
            plot.timeBasis === "gameDay" ? (
              <SvgChartText
                variant="marker"
                x={pad.l}
                y={29}
              >
                {`CDF cap ${plot.cdfHorizonDays.toFixed(1)} food days · chance by cap ${(
                  100 * lotteryCdfAtHorizon
                ).toFixed(0)}%`}
              </SvgChartText>
            ) : (
              <SvgFoodAxisLabel
                variant="marker"
                x={pad.l}
                y={29}
                text={`CDF cap ${(plot.cdfHorizonDays * plot.foodXScale).toFixed(0)} refills`}
                suffix={`· chance by cap ${(100 * lotteryCdfAtHorizon).toFixed(0)}%`}
                foodMeta={chartFoodUnitMeta}
                width={420}
                align="start"
              />
            )
          ) : null}
          <SvgChartText
            variant="axis"
            x={12}
            y={yMid}
            transform={`rotate(-90, 12, ${yMid})`}
            textAnchor="middle"
          >
            {plot.yAxisLabel}
          </SvgChartText>
          {plot.yTicks.map((yt, i) => {
            const yPx =
              pad.t +
              ih -
              ((yt - plot.yMin) / Math.max(plot.yMax - plot.yMin, 1e-9)) * ih
            return (
              <g key={`ytk-${i}-${yt}`}>
                <line
                  x1={pad.l}
                  y1={yPx}
                  x2={pad.l + iw}
                  y2={yPx}
                  className="stroke-slate-200/70 dark:stroke-slate-700/60"
                  strokeWidth={0.75}
                />
                <SvgChartText
                  variant="tick"
                  x={pad.l - 6}
                  y={yPx + 3}
                  textAnchor="end"
                >
                  {fmtFishAxisTick(yt)}
                </SvgChartText>
              </g>
            )
          })}
          <line
            x1={pad.l}
            y1={pad.t + ih}
            x2={pad.l + iw}
            y2={pad.t + ih}
            className="stroke-slate-400/70 dark:stroke-slate-500/70"
            strokeWidth={1}
          />
          <line
            x1={pad.l}
            y1={pad.t}
            x2={pad.l}
            y2={pad.t + ih}
            className="stroke-slate-400/70 dark:stroke-slate-500/70"
            strokeWidth={1}
          />
          {plot.xTicks.map((xf, i) => {
            const xPx =
              pad.l +
              (xf / Math.max(plot.xDisplayMax, 1e-9)) * iw
            return (
              <g key={`xtk-${i}-${xf}`}>
                <line
                  x1={xPx}
                  x2={xPx}
                  y1={pad.t + ih}
                  y2={pad.t + ih + 4}
                  className="stroke-slate-400/70 dark:stroke-slate-500/70"
                  strokeWidth={1}
                />
                <SvgChartText
                  variant="tick"
                  x={xPx}
                  y={singleYardLayout.xTickY}
                  textAnchor="middle"
                >
                  {xf >= 10 ? xf.toFixed(0) : xf.toFixed(1)}
                </SvgChartText>
              </g>
            )
          })}
          {plot.zeroLineY != null ? (
            <line
              x1={pad.l}
              y1={plot.zeroLineY}
              x2={pad.l + iw}
              y2={plot.zeroLineY}
              className="stroke-slate-500/35 dark:stroke-slate-400/35"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
          ) : null}
          {plot.markerLines.map((m, i) => (
            <line
              key={i}
              x1={m.x}
              x2={m.x}
              y1={pad.t}
              y2={pad.t + ih}
              stroke={m.color}
              strokeOpacity={m.isTarget ? 0.42 : 0.28}
              strokeWidth={m.isTarget ? 1.2 : 0.9}
            />
          ))}
          {barMode
            ? plot.barRects.map((r, i) => (
                <rect
                  key={i}
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  className="fill-amber-500/55 dark:fill-amber-300/45"
                />
              ))
            : null}
          {!barMode && plot.pathD ? (
            <path
              d={plot.pathD}
              fill="none"
              className="stroke-amber-700 dark:stroke-amber-300"
              strokeWidth={1.75}
            />
          ) : null}
          {plot.mementoMarkers.map((marker) => (
            <g key={`memento-${marker.catId}`}>
              <line
                x1={marker.x}
                x2={marker.x}
                y1={pad.t - 6}
                y2={pad.t + ih}
                className="stroke-yellow-500 dark:stroke-yellow-300"
                strokeWidth={1.6}
                strokeDasharray="3 2"
              />
              <g transform={`translate(${marker.badgeX}, ${marker.badgeY})`}>
                <circle
                  r={12}
                  className="fill-white dark:fill-amber-950 stroke-yellow-500 dark:stroke-yellow-300"
                  strokeWidth={1.4}
                />
                <image
                  href={marker.iconUrl}
                  x={-9}
                  y={-9}
                  width={18}
                  height={18}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
              <SvgChartText
                variant="badge"
                x={marker.badgeX}
                y={marker.badgeY + 22}
                textAnchor="middle"
              >
                {marker.label}
              </SvgChartText>
            </g>
          ))}
        {plot.timeBasis === "gameDay" ? (
          <SvgChartText
            variant="axis"
            x={pad.l + iw / 2}
            y={singleYardLayout.xLabelY}
            textAnchor="middle"
          >
            {`time in food days: 0 -> ${plot.xMax.toFixed(1)}${
              plot.xAxisZoomedToRun && plot.cdfHorizonDays != null
                ? ` · chart cap ${plot.cdfHorizonDays.toFixed(0)}`
                : ""
            }`}
          </SvgChartText>
        ) : (
          <SvgFoodAxisLabel
            x={pad.l + iw / 2}
            y={singleYardLayout.xLabelY}
            text="time in food refills"
            suffix={
              plot.xAxisZoomedToRun && plot.cdfHorizonDays != null
                ? `0 -> ${plot.xDisplayMax.toFixed(1)} · chart cap ${(
                    plot.cdfHorizonDays * plot.foodXScale
                  ).toFixed(0)}`
                : `0 -> ${plot.xDisplayMax.toFixed(1)}`
            }
            variant="axis"
            foodMeta={chartFoodUnitMeta}
            width={plot.xAxisZoomedToRun ? 520 : 360}
          />
        )}
      </MeasuredChartSvg>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
        The yard roll is simulated in <strong>food days</strong>.
        {plot.timeBasis === "gameDay" ? (
          <> This chart shows the same elapsed time in food days.</>
        ) : (
          <>
            {" "}
            This chart converts that time to{" "}
            <FoodRefillInline
              foodMeta={chartFoodUnitMeta}
              prefix={<strong>food refills</strong>}
              suffix={`at ${plot.displayMul.toFixed(2)} refills per food day,`}
            />
            {" "}
            matching the lottery panel (
            <a
              href="#memento-lottery-cdf"
              className="underline font-medium text-slate-800 dark:text-slate-100"
            >
              chance curve
            </a>
            ).
          </>
        )}{" "}
        Net is visit payouts minus two-bowl restock. Vertical bars are selected
        cat visits; badges mark target memento drops.
      </p>
    </div>
  )
}
