import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  cumulativeProbSuccessByDay,
  empiricalCdfSuccessWithinDay,
  walkUntilSuccessDistributionMixture,
} from "../../../utils/mementoLottery"
import {
  simulateYardMementoUntilSuccess,
  type YardMementoSample,
} from "../../../utils/yardOptimizer/yardMementoSim"
import {
  simulateYardMementoBatchParallel,
  terminateMementoYardSimWorkerPool,
} from "../../../utils/yardOptimizer/mementoYardSimParallel"
import CatFaceName from "../../CatFaceName"
import {
  foodIconImageMeta,
} from "../../../utils/yardOptimizer/clientAssets"
import { useLanguage } from "../../../hooks/useLanguage"
import { translate as translateTable } from "../../../utils/localization/translate"
import { MINUTES_PER_TICK } from "../../../utils/yardOptimizer/analyzer/constants"
import { isTubbsSimActive } from "../../../utils/yardOptimizer/tubbsMode"
import {
  mementoTimeDisplayScale,
  priciestShopFoodIdByRefillGoldEquivBulk,
  type MementoTimeDisplayBasis,
} from "../../../utils/yardOptimizer/foodBowlEconomy"
import {
  clampComeCountInput,
  type CatStartComeCounts,
} from "../../yardOptimizerSessionConfig"
import {
  CI_Z,
  CONTROL_ROW_CLASS,
  DAYS_GRID_POINTS,
  FISH_PLOT_GRID_POINTS,
  FISH_PLOT_RUNS_CHUNK,
  JOINT_MEMENTO_CURVE_COLOR,
  MEMENTO_CAT_CURVE_COLORS,
  MINUTES_PER_DAY,
  SIM_CI_REFRESH_MS,
  SIM_RUNS_CHUNK,
  visitsPerDayFromHorizon,
} from "../../../utils/yardOptimizer/mementoLab/constants"
import {
  pct,
  interpCumulative,
} from "../../../utils/yardOptimizer/mementoLab/chartFormatters"
import {
  buildVisitCumulativeSeries,
  catCurveId,
  compactBatchMementoSample,
  sampleDayForCurve,
} from "../../../utils/yardOptimizer/mementoLab/curveHelpers"
import {
  addSampleToFishPlotBinnedStats,
  buildAnalyticFishCurve,
  cloneFishPlotBinnedStats,
  emptyFishPlotBinnedStats,
  simulationBatchModeActionLabel,
  summarizeFishPlotBinnedStats,
  type FishPlotBinnedStats,
  type FishPlotMetric,
} from "../../../utils/yardOptimizer/mementoLab/fishPlotStats"
import type {
  BatchMementoSample,
  MementoCurveId,
  MementoCurveOption,
  MementoLabAnalysisCat,
  MementoLabAnalysisContext,
  SimulationBatchMode,
} from "../../../utils/yardOptimizer/mementoLab/types"
export type { MementoLabAnalysisCat, MementoLabAnalysisContext } from "../../../utils/yardOptimizer/mementoLab/types"
import FishPlotPanel from "./FishPlotPanel"
import MementoTimingCharts from "./MementoTimingCharts"
import SingleYardTrial from "./SingleYardTrial"


export default function MementoLotteryLab({
  hideBlurb = false,
  embedded = false,
  initialTab = "chance",
  emptyMementoTargetPicker = null,
  mementoTargetPicker = null,
  analysis,
  catStartComeCounts: controlledCatStartComeCounts,
  onCatStartComeCountsChange,
  timeDisplayBasis: controlledTimeDisplayBasis,
  onTimeDisplayBasisChange,
}: {
  hideBlurb?: boolean
  embedded?: boolean
  initialTab?: "chance" | "fish"
  emptyMementoTargetPicker?: ReactNode
  mementoTargetPicker?: ReactNode
  analysis: MementoLabAnalysisContext
  catStartComeCounts?: CatStartComeCounts
  onCatStartComeCountsChange?: (next: CatStartComeCounts) => void
  timeDisplayBasis?: MementoTimeDisplayBasis
  onTimeDisplayBasisChange?: (next: MementoTimeDisplayBasis) => void
}) {
  const { translate } = useLanguage()
  const {
    lotteryFoodMementoRateIndoor: foodMementoRateIndoor,
    lotteryFoodMementoRateOutdoor: foodMementoRateOutdoor,
  } = analysis
  const catsWithVisits = useMemo(
    () => analysis.cats.filter((c) => c.visitsPerHorizon > 1e-9),
    [analysis.cats]
  )
  const targetCatIds = useMemo(
    () => catsWithVisits.map((cat) => cat.catId),
    [catsWithVisits]
  )
  const hasMultipleTargets = catsWithVisits.length > 1
  const catLabelForId = useCallback(
    (catId: number) => translate(translateTable("Cat", `CatName${catId}`)),
    [translate]
  )

  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)
  const [statsCurveId, setStatsCurveId] = useState<MementoCurveId | null>(null)
  const [visibleCurveIds, setVisibleCurveIds] = useState<Record<string, boolean>>({})
  const activeCat = useMemo<MementoLabAnalysisCat | null>(() => {
    if (catsWithVisits.length === 0) return null
    const found =
      selectedCatId !== null
        ? catsWithVisits.find((c) => c.catId === selectedCatId)
        : null
    return found ?? catsWithVisits[0]!
  }, [catsWithVisits, selectedCatId])

  useEffect(() => {
    if (
      activeCat &&
      (selectedCatId === null ||
        !catsWithVisits.some((c) => c.catId === selectedCatId))
    ) {
      setSelectedCatId(activeCat.catId)
    }
  }, [activeCat, catsWithVisits, selectedCatId])

  useEffect(() => {
    const validIds = new Set<string>(targetCatIds.map((id) => catCurveId(id)))
    if (targetCatIds.length > 1) validIds.add("joint")
    setVisibleCurveIds((prev) => {
      const next: Record<string, boolean> = {}
      for (const id of validIds) next[id] = prev[id] ?? true
      if (Object.values(next).every((visible) => !visible)) {
        const first = validIds.values().next().value as string | undefined
        if (first) next[first] = true
      }
      return next
    })
    setStatsCurveId((prev) => {
      if (prev && validIds.has(prev)) return prev
      if (targetCatIds.length > 1) return "joint"
      return targetCatIds[0] ? catCurveId(targetCatIds[0]) : null
    })
  }, [targetCatIds])

  /** Per-target starting `comeCount`; rolls are unwinnable until each cat's gate. */
  const [localCatStartComeCounts, setLocalCatStartComeCounts] =
    useState<CatStartComeCounts>({})
  const catStartComeCounts = controlledCatStartComeCounts ?? localCatStartComeCounts

  const [plotMaxVisits, setPlotMaxVisits] = useState(150)

  const [simRuns, setSimRuns] = useState(200)
  const [samples, setSamples] = useState<BatchMementoSample[] | null>(null)
  const [simBusy, setSimBusy] = useState(false)
  const [simProgress, setSimProgress] = useState<{ done: number; total: number } | null>(
    null
  )
  const [simError, setSimError] = useState<string | null>(null)
  /** Bumped when lab inputs change (abort in-flight MC) or a new Simulate starts. */
  const simAbortGenRef = useRef(0)
  const [showCiOnChart, setShowCiOnChart] = useState(true)
  const [ciConfidence, setCiConfidence] = useState<90 | 95 | 99>(95)
  const [showRunTrajectories, setShowRunTrajectories] = useState(false)
  const [useCooldown, setUseCooldown] = useState(true)

  /**
   * Result of the most recent **single-yard** simulation (the "Simulate one yard" button).
   * Independent of the batch MC; visible to the player as a "what if I ran this yard
   * once, what would the journey look like?" preview, including silver/gold fish along
   * the way. Cleared whenever lab inputs change.
   */
  const [singleRun, setSingleRun] = useState<YardMementoSample | null>(null)
  const [singleRunBusy, setSingleRunBusy] = useState(false)
  const [activeTab, setActiveTab] = useState<"chance" | "fish">(initialTab)
  const [showMementoTargetPicker, setShowMementoTargetPicker] = useState(false)
  const [simulationBatchMode, setSimulationBatchMode] =
    useState<SimulationBatchMode>("timing")
  const [fishMetric, setFishMetric] = useState<FishPlotMetric>(
    analysis.defaultFishMetric ?? "netGoldCum"
  )
  const [fishPlotHorizonDays, setFishPlotHorizonDays] = useState(7)
  const [fishBinnedStats, setFishBinnedStats] = useState<FishPlotBinnedStats | null>(
    null
  )

  const [xAxisUnit, setXAxisUnit] = useState<"visits" | "days">("days")

  const getCatStartComeCount = useCallback(
    (catId: number) => clampComeCountInput(catStartComeCounts[catId] ?? 0),
    [catStartComeCounts]
  )
  const setCatStartComeCount = useCallback((catId: number, next: number) => {
    const nextCounts = {
      ...catStartComeCounts,
      [catId]: clampComeCountInput(next),
    }
    if (onCatStartComeCountsChange) {
      onCatStartComeCountsChange(nextCounts)
    } else {
      setLocalCatStartComeCounts(nextCounts)
    }
  }, [catStartComeCounts, onCatStartComeCountsChange])
  const startComeCount = activeCat ? getCatStartComeCount(activeCat.catId) : 0

  const visitsPerHorizon = activeCat?.visitsPerHorizon ?? 0
  const indoorShare =
    activeCat && activeCat.visitsPerHorizon > 1e-9
      ? activeCat.indoorVisitsPerHorizon / activeCat.visitsPerHorizon
      : 0

  const visitsPerDay = visitsPerDayFromHorizon(
    visitsPerHorizon,
    analysis.totalDurationMinutes
  )

  const [localTimeDisplayBasis, setLocalTimeDisplayBasis] =
    useState<MementoTimeDisplayBasis>("shortestBowlRefill")
  const timeDisplayBasis = controlledTimeDisplayBasis ?? localTimeDisplayBasis
  const setTimeDisplayBasis = useCallback(
    (next: MementoTimeDisplayBasis) => {
      if (onTimeDisplayBasisChange) onTimeDisplayBasisChange(next)
      else setLocalTimeDisplayBasis(next)
    },
    [onTimeDisplayBasisChange]
  )
  const availableDisplayFoodIds = useMemo(
    () => [analysis.foodTypeIndoor, analysis.foodTypeOutdoor],
    [analysis.foodTypeIndoor, analysis.foodTypeOutdoor]
  )
  const availablePriciestFoodId = useMemo(
    () => priciestShopFoodIdByRefillGoldEquivBulk(availableDisplayFoodIds),
    [availableDisplayFoodIds]
  )
  const timeDisplay = useMemo(
    () =>
      mementoTimeDisplayScale(
        timeDisplayBasis,
        analysis.foodTypeIndoor,
        analysis.foodTypeOutdoor,
        availableDisplayFoodIds
      ),
    [
      timeDisplayBasis,
      analysis.foodTypeIndoor,
      analysis.foodTypeOutdoor,
      availableDisplayFoodIds,
    ]
  )
  const tdMul = timeDisplay.displayMul
  const foodUnitMeta = useMemo(
    () => foodIconImageMeta(timeDisplay.referenceFoodId ?? 1),
    [timeDisplay.referenceFoodId]
  )
  const usesFoodUnit = timeDisplay.basis !== "gameDay"

  const mixtureBase = useMemo(
    () => ({
      isRareCat: activeCat?.isRareCat ?? false,
      indoorShare,
      foodMementoRateIndoor,
      foodMementoRateOutdoor,
    }),
    [
      activeCat?.isRareCat,
      indoorShare,
      foodMementoRateIndoor,
      foodMementoRateOutdoor,
    ]
  )

  const cappedMaxVisits = Math.max(50, Math.min(50_000, Math.floor(plotMaxVisits)))

  const walkDist = useMemo(
    () =>
      walkUntilSuccessDistributionMixture(
        mixtureBase,
        startComeCount,
        cappedMaxVisits
      ),
    [mixtureBase, startComeCount, cappedMaxVisits]
  )

  const activeDayHorizon =
    visitsPerDay > 1e-9 ? cappedMaxVisits / visitsPerDay : cappedMaxVisits

  const jointDayHorizon = useMemo(() => {
    let h = 0
    for (const cat of catsWithVisits) {
      const vpd =
        cat.visitsPerHorizon *
        (MINUTES_PER_DAY / Math.max(analysis.totalDurationMinutes, 1))
      if (vpd > 1e-9) h = Math.max(h, cappedMaxVisits / vpd)
    }
    return h > 0 ? h : cappedMaxVisits
  }, [catsWithVisits, analysis.totalDurationMinutes, cappedMaxVisits])

  const dayHorizon =
    catsWithVisits.length > 1
      ? Math.max(activeDayHorizon, jointDayHorizon)
      : activeDayHorizon

  const daysGrid = useMemo(() => {
    const grid: number[] = []
    const points = DAYS_GRID_POINTS
    for (let i = 0; i <= points; i++) {
      grid.push((dayHorizon * i) / points)
    }
    return grid
  }, [dayHorizon])

  const exactDayCdf = useMemo(() => {
    if (visitsPerDay <= 1e-9) return [] as { x: number; cum: number }[]
    return cumulativeProbSuccessByDay(
      walkDist.pmfByVisitIndex,
      daysGrid,
      visitsPerDay
    ).map((p) => ({ x: p.day, cum: p.cum }))
  }, [walkDist.pmfByVisitIndex, daysGrid, visitsPerDay])

  const perCatDayCurves = useMemo(() => {
    const out = new Map<number, { x: number; cum: number }[]>()
    for (const cat of catsWithVisits) {
      const totalVisits = cat.visitsPerHorizon
      const vpd =
        totalVisits * (MINUTES_PER_DAY / Math.max(analysis.totalDurationMinutes, 1))
      const indoor =
        totalVisits > 1e-9 ? cat.indoorVisitsPerHorizon / totalVisits : 0
      const dist = walkUntilSuccessDistributionMixture(
        {
          isRareCat: cat.isRareCat,
          indoorShare: indoor,
          foodMementoRateIndoor: foodMementoRateIndoor,
          foodMementoRateOutdoor: foodMementoRateOutdoor,
        },
        getCatStartComeCount(cat.catId),
        cappedMaxVisits
      )
      out.set(
        cat.catId,
        cumulativeProbSuccessByDay(dist.pmfByVisitIndex, daysGrid, vpd).map(
          (p) => ({ x: p.day, cum: p.cum })
        )
      )
    }
    return out
  }, [
    catsWithVisits,
    analysis.totalDurationMinutes,
    foodMementoRateIndoor,
    foodMementoRateOutdoor,
    getCatStartComeCount,
    cappedMaxVisits,
    daysGrid,
  ])

  const perCatVisitCurves = useMemo(() => {
    const out = new Map<number, { x: number; cum: number }[]>()
    for (const cat of catsWithVisits) {
      const totalVisits = cat.visitsPerHorizon
      const indoor =
        totalVisits > 1e-9 ? cat.indoorVisitsPerHorizon / totalVisits : 0
      const dist = walkUntilSuccessDistributionMixture(
        {
          isRareCat: cat.isRareCat,
          indoorShare: indoor,
          foodMementoRateIndoor: foodMementoRateIndoor,
          foodMementoRateOutdoor: foodMementoRateOutdoor,
        },
        getCatStartComeCount(cat.catId),
        cappedMaxVisits
      )
      out.set(cat.catId, buildVisitCumulativeSeries(dist, cappedMaxVisits))
    }
    return out
  }, [
    catsWithVisits,
    foodMementoRateIndoor,
    foodMementoRateOutdoor,
    getCatStartComeCount,
    cappedMaxVisits,
  ])

  const jointDayCdf = useMemo(() => {
    if (catsWithVisits.length === 0) return [] as { x: number; cum: number }[]
    const curves = catsWithVisits.map((cat) => perCatDayCurves.get(cat.catId) ?? [])
    return daysGrid.map((day, i) => {
      let cum = 1
      for (const curve of curves) cum *= curve[i]?.cum ?? 0
      return { x: day, cum }
    })
  }, [catsWithVisits, daysGrid, perCatDayCurves])

  useEffect(() => {
    simAbortGenRef.current += 1
    setSamples(null)
    setSimProgress(null)
    setSimBusy(false)
    setFishBinnedStats(null)
    setSingleRun(null)
  }, [
    mixtureBase,
    startComeCount,
    catStartComeCounts,
    cappedMaxVisits,
    visitsPerDay,
    activeCat?.catId,
    activeTab,
    fishPlotHorizonDays,
    useCooldown,
    analysis.flowchartRuntime,
  ])

  useEffect(() => {
    return () => {
      terminateMementoYardSimWorkerPool()
    }
  }, [])

  useEffect(() => {
    simAbortGenRef.current += 1
    setFishBinnedStats(null)
    setSimProgress(null)
    setSimBusy(false)
  }, [fishPlotHorizonDays])

  useEffect(() => {
    if (analysis.defaultFishMetric) setFishMetric(analysis.defaultFishMetric)
  }, [analysis.defaultFishMetric])

  useEffect(() => {
    if (simBusy) return
    setSimulationBatchMode(activeTab === "fish" ? "fish" : "timing")
  }, [activeTab, simBusy])

  const yieldToBrowser = useCallback(
    () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
    []
  )

  const isDaysAxis = xAxisUnit === "days" && visitsPerDay > 1e-9

  useEffect(() => {
    if (isDaysAxis || statsCurveId !== "joint") return
    const catId = activeCat?.catId ?? catsWithVisits[0]?.catId
    setStatsCurveId(catId ? catCurveId(catId) : null)
  }, [activeCat?.catId, catsWithVisits, isDaysAxis, statsCurveId])

  const curveOptions = useMemo(() => {
    const options: MementoCurveOption[] = []
    if (isDaysAxis && catsWithVisits.length > 1) {
      options.push({
        id: "joint",
        label: "Joint: all target mementos",
        color: JOINT_MEMENTO_CURVE_COLOR,
        curve: jointDayCdf,
      })
    }
    catsWithVisits.forEach((cat, i) => {
      options.push({
        id: catCurveId(cat.catId),
        label: cat.catName,
        color: MEMENTO_CAT_CURVE_COLORS[i % MEMENTO_CAT_CURVE_COLORS.length],
        curve: isDaysAxis
          ? perCatDayCurves.get(cat.catId) ?? []
          : perCatVisitCurves.get(cat.catId) ?? [],
      })
    })
    return options
  }, [
    catsWithVisits,
    isDaysAxis,
    jointDayCdf,
    perCatDayCurves,
    perCatVisitCurves,
  ])

  const visibleCurveOptions = useMemo(() => {
    const visible = curveOptions.filter((opt) => visibleCurveIds[opt.id] !== false)
    return visible.length > 0 ? visible : curveOptions.slice(0, 1)
  }, [curveOptions, visibleCurveIds])

  const setCurveVisible = useCallback(
    (id: MementoCurveId, checked: boolean) => {
      setVisibleCurveIds((prev) => {
        if (!checked && id === statsCurveId) return prev
        if (!checked) {
          const currentVisible = curveOptions.filter(
            (opt) => prev[opt.id] !== false
          ).length
          if (currentVisible <= 1) return prev
        }
        return { ...prev, [id]: checked }
      })
    },
    [curveOptions, statsCurveId]
  )

  const referenceCurveOption =
    (statsCurveId
      ? visibleCurveOptions.find((opt) => opt.id === statsCurveId) ??
        curveOptions.find((opt) => opt.id === statsCurveId)
      : undefined) ??
    visibleCurveOptions[0] ??
    curveOptions[0]
  const referenceCurve = referenceCurveOption?.curve ?? exactDayCdf
  const referenceCurveId =
    referenceCurveOption?.id ?? catCurveId(activeCat?.catId ?? 0)
  const referenceCurveLabel = referenceCurveOption?.label ?? activeCat?.catName ?? "selected cat"

  const trajectoryHits = useMemo(() => {
    if (!isDaysAxis || !samples || samples.length === 0) return [] as BatchMementoSample[]
    return samples.filter(
      (s) =>
        Number.isFinite(sampleDayForCurve(s, referenceCurveId))
    )
  }, [isDaysAxis, referenceCurveId, samples])

  const exactCurve = referenceCurve

  const empiricalCurves = useMemo(() => {
    if (!samples || samples.length === 0 || !isDaysAxis) {
      return [] as Array<{
        id: MementoCurveId
        color: string
        points: Array<{ x: number; mean: number; low: number; high: number }>
      }>
    }
    return visibleCurveOptions.map((opt) => ({
      id: opt.id,
      color: opt.color,
      points: empiricalCdfSuccessWithinDay(
        samples.map((s) => sampleDayForCurve(s, opt.id)),
        daysGrid,
        CI_Z[ciConfidence]
      ).map((r) => ({ x: r.day, mean: r.mean, low: r.low, high: r.high })),
    }))
  }, [ciConfidence, daysGrid, isDaysAxis, samples, visibleCurveOptions])

  const xDomain = useMemo(() => {
    const curves = visibleCurveOptions.map((opt) => opt.curve).filter((c) => c.length > 0)
    if (curves.length === 0) return { lo: 0, hi: 1 }
    const hi = Math.max(...curves.map((curve) => curve[curve.length - 1]!.x))
    return {
      lo: 0,
      hi,
    }
  }, [visibleCurveOptions])

  /** Right edge of the analytic **day** CDF grid (`exactDayCdf`) — stable; does not flip with visits/days axis toggle. */
  const lotteryDayHorizon = useMemo(() => {
    if (!isDaysAxis || exactCurve.length === 0) return null
    return exactCurve[exactCurve.length - 1]!.x
  }, [exactCurve, isDaysAxis])

  /** P(memento by end of analytic day horizon); used to link income chart to blue day curve. */
  const lotteryCdfAtHorizon = useMemo(() => {
    if (lotteryDayHorizon === null || exactCurve.length === 0) return null
    return interpCumulative(exactCurve, lotteryDayHorizon)
  }, [exactCurve, lotteryDayHorizon])

  /**
   * Single-yard roll vs **day** analytic CDF only (λ from analyzer). Same interp as hovering
   * the chart on the days axis.
   */
  const singleRunModelCdf = useMemo(() => {
    if (!singleRun || exactCurve.length === 0 || !isDaysAxis) return null
    const day =
      singleRun.hitMemento && singleRun.days != null
        ? singleRun.days
        : singleRun.endDays
    return { day, p: interpCumulative(exactCurve, day) }
  }, [singleRun, exactCurve, isDaysAxis])

  /**
   * Build the same `YardMementoSimParams` the batch MC uses, so the single-run
   * preview is *exactly* a slice from the same distribution as the batch summary
   * (same yard, same cooldown, same lottery cap, same horizon).
   */
  const buildSimOpts = useCallback(() => {
    if (visitsPerDay <= 0 && simulationBatchMode !== "fish") return null
    if (!activeCat && simulationBatchMode !== "fish") return null
    const days =
      activeTab === "fish"
        ? Math.max(1, fishPlotHorizonDays)
        : Math.max(1, dayHorizon * 1.5)
    const ticksPerDay = (24 * 60) / MINUTES_PER_TICK
    const maxTicks = Math.ceil(days * ticksPerDay)
    // Under a non-off Tubbs mode, drive the sim's outdoor-bowl depletion so simulated income
    // reflects the same Tubbs effect the analytic net rate assumes. Omitted under off (byte-identical).
    const tubbsSimParams = isTubbsSimActive(analysis.tubbsMode)
        ? {
            tubbsMode: analysis.tubbsMode,
            outdoorBowlItemId: analysis.foodTypeOutdoor,
            outdoorBowlDurationTicks: analysis.outdoorBowlDurationTicks,
            indoorBowlDurationTicks: analysis.indoorBowlDurationTicks,
            outdoorFoodId: analysis.foodTypeOutdoor,
            indoorFoodId: analysis.foodTypeIndoor,
          }
        : {}
    return {
      runtime: analysis.flowchartRuntime,
      targetCatId: activeCat?.catId ?? 0,
      isRareCat: activeCat?.isRareCat ?? false,
      targetCatConfigs: catsWithVisits.map((cat) => ({
        catId: cat.catId,
        isRareCat: cat.isRareCat,
        startComeCount: getCatStartComeCount(cat.catId),
      })),
      foodMementoRateIndoor: foodMementoRateIndoor,
      foodMementoRateOutdoor: foodMementoRateOutdoor,
      startComeCount,
      maxLotteryRolls: cappedMaxVisits,
      maxTicks,
      useCooldown,
      ...tubbsSimParams,
    }
  }, [
    activeCat,
    activeTab,
    catsWithVisits,
    visitsPerDay,
    simulationBatchMode,
    fishPlotHorizonDays,
    dayHorizon,
    analysis.flowchartRuntime,
    foodMementoRateIndoor,
    foodMementoRateOutdoor,
    analysis.tubbsMode,
    analysis.foodTypeIndoor,
    analysis.foodTypeOutdoor,
    analysis.outdoorBowlDurationTicks,
    analysis.indoorBowlDurationTicks,
    startComeCount,
    getCatStartComeCount,
    cappedMaxVisits,
    useCooldown,
  ])

  /**
   * Run one full yard simulation in the main thread (one run is fast — the
   * flowchart engine costs a few ms even on a horizon of years). We yield to
   * the browser via `setTimeout(0)` first so the busy state can paint before
   * the synchronous loop blocks. Cleared / re-run every click; no seed (the
   * point is a fresh draw).
   */
  const runOneYardSim = useCallback(() => {
    const opts = buildSimOpts()
    if (!opts) return
    setSingleRunBusy(true)
    setTimeout(() => {
      try {
        const out = simulateYardMementoUntilSuccess(
          {
            ...opts,
            recordVisitTimeline: true,
            continueAfterTerminal: true,
          },
          Math.random
        )
        setSingleRun(out)
      } finally {
        setSingleRunBusy(false)
      }
    }, 0)
  }, [buildSimOpts])

  const runSimulation = async () => {
    if (simulationBatchMode !== "fish" && (!activeCat || visitsPerDay <= 0)) return
    simAbortGenRef.current += 1
    const runGen = simAbortGenRef.current

    const nRuns = Math.max(50, Math.min(5_000, Math.floor(simRuns)))
    const opts = buildSimOpts()
    if (!opts) return

    setSimBusy(true)
    setSimProgress({ done: 0, total: nRuns })
    setSimError(null)
    setSamples(null)
    setFishBinnedStats(null)

    const masterSeed = crypto.getRandomValues(new Uint32Array(1))[0] >>> 0

    const acc: BatchMementoSample[] = []
    const collectFishStats = simulationBatchMode === "fish"
    const fishStats = collectFishStats
      ? emptyFishPlotBinnedStats(fishGridDays)
      : null
    let lastCiFlushMs = performance.now()
    const fishGridHorizonDays =
      fishGridDays[fishGridDays.length - 1] ?? dayHorizon
    const ticksPerDay = (24 * 60) / MINUTES_PER_TICK
    const batchOpts = {
      ...opts,
      maxTicks: Math.ceil(Math.max(1, fishGridHorizonDays) * ticksPerDay),
      continueAfterTerminal: true,
      fishPlotGridDays: fishGridDays,
    }

    try {
      for (let completed = 0; completed < nRuns; ) {
        if (simAbortGenRef.current !== runGen) return

        const chunk = Math.min(
          collectFishStats ? FISH_PLOT_RUNS_CHUNK : SIM_RUNS_CHUNK,
          nRuns - completed
        )
        const slice = await simulateYardMementoBatchParallel(
          collectFishStats ? batchOpts : opts,
          chunk,
          {
            masterSeed,
            globalStart: completed,
          }
        )
        if (simAbortGenRef.current !== runGen) return
        if (collectFishStats && fishStats) {
          for (const sample of slice) {
            addSampleToFishPlotBinnedStats(
              fishStats,
              sample,
              analysis.foodTypeIndoor,
              analysis.foodTypeOutdoor
            )
            acc.push(compactBatchMementoSample(sample))
          }
        } else {
          acc.push(...slice.map(compactBatchMementoSample))
        }
        completed += chunk

        setSimProgress({ done: completed, total: nRuns })

        const elapsed = performance.now() - lastCiFlushMs
        const shouldFlushCi =
          completed === nRuns ||
          completed <= (collectFishStats ? FISH_PLOT_RUNS_CHUNK : SIM_RUNS_CHUNK) ||
          elapsed >= SIM_CI_REFRESH_MS

        if (shouldFlushCi) {
          if (simAbortGenRef.current === runGen) {
            setSamples([...acc])
            if (fishStats) {
              setFishBinnedStats(cloneFishPlotBinnedStats(fishStats))
            }
          }
          lastCiFlushMs = performance.now()
        }

        await yieldToBrowser()
      }
    } catch (e) {
      if (simAbortGenRef.current === runGen) {
        setSimError(e instanceof Error ? e.message : String(e))
      }
    } finally {
      if (simAbortGenRef.current === runGen) {
        setSimBusy(false)
        setSimProgress(null)
      }
    }
  }

  const pauseSimulation = useCallback(() => {
    simAbortGenRef.current += 1
    setSimBusy(false)
    setSimProgress(null)
    setSimError(null)
  }, [])

  const fishGridDays = useMemo(() => {
    const hi = Math.max(0.1, fishPlotHorizonDays)
    return Array.from(
      { length: FISH_PLOT_GRID_POINTS + 1 },
      (_, i) => (hi * i) / FISH_PLOT_GRID_POINTS
    )
  }, [fishPlotHorizonDays])

  const fishPlotSummary = useMemo(
    () =>
      fishBinnedStats
        ? summarizeFishPlotBinnedStats(
            fishBinnedStats,
            fishMetric,
            CI_Z[ciConfidence]
          )
        : null,
    [ciConfidence, fishBinnedStats, fishMetric]
  )
  const analyticFishRatePerDay = useMemo(() => {
    const rates = analysis.fishRatesPerDay
    if (!rates) return null
    if (fishMetric === "netGoldEquivCum") return rates.netGoldEquivPerDay
    if (fishMetric === "netSilverCum") return rates.netSilverPerDay
    return rates.netGoldPerDay
  }, [analysis.fishRatesPerDay, fishMetric])
  const analyticFishVariancePerDay = useMemo(() => {
    const variance = analysis.fishVariancePerDay
    if (!variance) return null
    if (fishMetric === "netGoldEquivCum") return variance.netGoldEquivPerDay
    if (fishMetric === "netSilverCum") return variance.netSilverPerDay
    return variance.netGoldPerDay
  }, [analysis.fishVariancePerDay, fishMetric])
  const analyticFishCurve = useMemo(
    () =>
      buildAnalyticFishCurve(
        fishGridDays,
        analyticFishRatePerDay,
        analyticFishVariancePerDay,
        CI_Z[ciConfidence]
      ),
    [
      analyticFishRatePerDay,
      analyticFishVariancePerDay,
      ciConfidence,
      fishGridDays,
    ]
  )
  const selectedSimulationActionLabel =
    simulationBatchMode === "fish" && catsWithVisits.length === 0
      ? "Simulate fish income"
      : simulationBatchModeActionLabel(simulationBatchMode)

  const simulationControls = (
    <div className="order-[90] space-y-4">
      {catsWithVisits.length > 0 || activeTab === "fish" ? (
        <SingleYardTrial
          singleRun={singleRun}
          singleRunBusy={singleRunBusy}
          canRun={activeTab === "fish" || (!!activeCat && visitsPerDay > 0)}
          onRun={runOneYardSim}
          activeCatLabel={activeCat?.catName ?? "(no target)"}
          activeCatId={activeCat?.catId ?? null}
          targetCatIds={targetCatIds}
          catLabelForId={catLabelForId}
          visitsPerDay={visitsPerDay}
          maxLotteryRolls={cappedMaxVisits}
          horizonDays={
            activeTab === "fish"
              ? fishPlotHorizonDays
              : dayHorizon * 1.5
          }
          hasMementoTargets={catsWithVisits.length > 0}
          foodTypeIndoor={analysis.foodTypeIndoor}
          foodTypeOutdoor={analysis.foodTypeOutdoor}
          lotteryChartXMaxDays={
            activeTab === "fish" ? fishPlotHorizonDays : lotteryDayHorizon
          }
          lotteryCdfAtHorizon={lotteryCdfAtHorizon}
          singleRunModelCdf={singleRunModelCdf}
          timeDisplay={timeDisplay}
          focusOnMementoDrop={activeTab !== "fish"}
        />
      ) : null}

      <details className="group/extra-sim rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50/40 dark:bg-slate-900/30">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 list-none flex flex-wrap items-center gap-2 [&::-webkit-details-marker]:hidden">
          <span className="inline-block w-3 text-center transition-transform group-open/extra-sim:rotate-90">
            ▸
          </span>
          Run extra simulations
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
            {simulationBatchMode === "fish"
              ? catsWithVisits.length > 0
                ? "— full ledger updates both graphs."
                : "— full ledger validates fish income."
              : "— fast timing batch."}
          </span>
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-3">
          <div className={CONTROL_ROW_CLASS}>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Yards to roll</span>
              <input
                type="number"
                min={50}
                max={5000}
                step={50}
                value={simRuns}
                onChange={(e) => setSimRuns(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800 w-28"
              />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {simulationBatchMode === "fish"
                  ? catsWithVisits.length > 0
                    ? "This batch updates both the memento timing and fish income graphs."
                    : "This batch updates the fish income graph."
                  : "This batch updates memento timing only."}
              </span>
            </label>
            {simulationBatchMode === "fish" ? (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Fish sim horizon</span>
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
                  className="border rounded px-2 py-1 bg-white dark:bg-slate-800 w-28 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Defaults to 7 food days. Shorter is faster and usually enough for near-term earnings.
                </span>
              </label>
            ) : null}
            <button
              type="button"
              className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 font-medium disabled:bg-slate-400"
              onClick={() => {
                void runSimulation()
              }}
              disabled={(simulationBatchMode !== "fish" && visitsPerDay <= 0) || simBusy}
            >
              {simBusy && simProgress
                ? `${selectedSimulationActionLabel.replace("Simulate", "Running")}... (${simProgress.done.toLocaleString()}/${simProgress.total.toLocaleString()})`
                : simBusy
                  ? `${selectedSimulationActionLabel.replace("Simulate", "Running")}...`
                  : selectedSimulationActionLabel}
            </button>
            {simBusy ? (
              <button
                type="button"
                className="text-sm px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 font-medium text-amber-900 dark:text-amber-200"
                onClick={pauseSimulation}
              >
                Pause
              </button>
            ) : null}
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={useCooldown}
                onChange={(e) => setUseCooldown(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">Include visit spacing</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showRunTrajectories}
                onChange={(e) => setShowRunTrajectories(e.target.checked)}
                disabled={!isDaysAxis || !samples || samples.length === 0}
                className="accent-amber-600"
              />
              <span className="text-sm font-medium">Show memento timing bars</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCiOnChart}
                onChange={(e) => setShowCiOnChart(e.target.checked)}
                className="accent-blue-600"
              />
              <span className="text-sm font-medium">Show estimate range on chart</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Range</span>
              <select
                value={ciConfidence}
                onChange={(e) =>
                  setCiConfidence(Number(e.target.value) as 90 | 95 | 99)
                }
                className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800 text-sm w-28"
              >
                <option value={90}>90%</option>
                <option value={95}>95%</option>
                <option value={99}>99%</option>
              </select>
            </label>
          </div>

          {simProgress ? (
            <div className="w-full max-w-md space-y-1.5">
              <progress
                className="w-full h-2 rounded-full accent-blue-600 [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-200 dark:[&::-webkit-progress-bar]:bg-slate-700 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-600 [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-blue-600"
                max={simProgress.total}
                value={simProgress.done}
                aria-valuenow={simProgress.done}
                aria-valuemax={simProgress.total}
                aria-label={`Yard simulation progress: ${simProgress.done} of ${simProgress.total} runs`}
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {simProgress.done.toLocaleString()} /{" "}
                  {simProgress.total.toLocaleString()}
                </span>{" "}
                yards rolled.{" "}
                {simulationBatchMode === "fish"
                  ? catsWithVisits.length > 0
                    ? "Fish and timing figures update from this full-ledger batch."
                    : "Fish figures update from this full-ledger batch."
                  : "Timing updates from this fast batch."}
              </p>
            </div>
          ) : null}

          {simError ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800/70 dark:bg-red-950/30 dark:text-red-200">
              {simError}
            </p>
          ) : null}

          {samples ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Last batch: {samples.length.toLocaleString()} yards
              {catsWithVisits.length > 0 ? (
                <>
                  {" · "}unfinished{" "}
                  {pct(samples.filter((s) => !s.hitMemento).length / samples.length)}{" "}
                  before cap
                </>
              ) : null}
              {fishBinnedStats ? " · fish CI updated" : ""}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {simulationBatchMode === "fish"
                ? catsWithVisits.length > 0
                  ? "Click Simulate to validate both graphs with full-ledger yards."
                  : "Click Simulate to validate fish income with full-ledger yards."
                : "Click Simulate to validate memento timing with rolled yards."}
            </p>
          )}
        </div>
      </details>
    </div>
  )

  return (
    <div className={embedded ? "space-y-5" : "space-y-8"}>
      {hideBlurb ? null : (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Estimate how long one target cat may take to bring a memento in this yard.
        </p>
      )}

      <section
        id="memento-lottery-cdf"
        className={
          embedded
            ? "flex flex-col gap-4"
            : "rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-800/50 flex flex-col gap-4"
        }
      >
        {embedded ? null : (
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Yard analysis
          </h2>
        )}

        <div
          className="inline-flex w-fit rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100/80 dark:bg-slate-900/60 p-1 text-sm"
          role="tablist"
          aria-label="Yard analysis views"
        >
          {[
            ["chance", "Memento timing"],
            ["fish", "Fish income"],
          ].map(([id, label]) => {
            const active = activeTab === id
            const tabId = `yard-analysis-tab-${id}`
            const panelId = `yard-analysis-panel-${id}`
            return (
              <button
                key={id}
                id={tabId}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls={panelId}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  active
                    ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                    : "text-slate-600 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                }`}
                onClick={() => setActiveTab(id as "chance" | "fish")}
              >
                {label}
              </button>
            )
          })}
        </div>

        {activeTab === "chance" && catsWithVisits.length === 0 ? (
          <div
            id="yard-analysis-panel-chance"
            role="tabpanel"
            aria-labelledby="yard-analysis-tab-chance"
            className="flex flex-col gap-4"
          >
            <div className="rounded-lg border border-amber-200 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
              Pick one or more target cats with non-zero visit mass to estimate
              memento timing for this yard. Visits per food day are calculated
              from the current layout.
            </div>
            {emptyMementoTargetPicker}
          </div>
        ) : activeTab === "chance" ? (
          <div
            id="yard-analysis-panel-chance"
            role="tabpanel"
            aria-labelledby="yard-analysis-tab-chance"
            className="flex flex-col gap-4"
          >
        <details className="group/target-legend max-w-5xl rounded-lg border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/30 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer px-3 py-2.5 list-none flex items-center justify-between gap-3">
            <span>
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">
                Targets, legend, and starting visits
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                Open this if you want to change which curve is shown or adjust existing visit counts.
              </span>
            </span>
            <span
              className="text-slate-400 text-xs shrink-0 transition-transform group-open/target-legend:rotate-180"
              aria-hidden
            >
              ▼
            </span>
          </summary>
          <div className="border-t border-slate-200 dark:border-slate-600">
            {mementoTargetPicker ? (
              <div className="border-b border-slate-200 dark:border-slate-600 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setShowMementoTargetPicker((v) => !v)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  aria-expanded={showMementoTargetPicker}
                >
                  {showMementoTargetPicker ? "Hide target picker" : "Change targets"}
                </button>
                {showMementoTargetPicker ? (
                  <div className="mt-3">
                    {mementoTargetPicker}
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/50">
                    <th className="text-left font-semibold px-3 py-2">Cat</th>
                    {hasMultipleTargets ? (
                      <th className="text-left font-semibold px-3 py-2">
                        Which odds to show
                      </th>
                    ) : null}
                    <th className="text-left font-semibold px-3 py-2">
                      Curve
                    </th>
                    <th className="text-right font-semibold px-3 py-2 font-mono">
                      Starting visits
                    </th>
                    <th className="text-right font-semibold px-3 py-2 font-mono">
                      Visits/food day
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hasMultipleTargets ? (
                    <tr
                      className={`border-b border-slate-100 dark:border-slate-700 ${
                        statsCurveId === "joint"
                          ? "bg-violet-50/70 dark:bg-violet-950/25"
                          : ""
                      }`}
                    >
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-2">
                          <span
                            className="inline-block h-0.5 w-6 rounded"
                            style={{ backgroundColor: JOINT_MEMENTO_CURVE_COLOR }}
                          />
                          <span className="font-medium">All target mementos</span>
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => {
                            setStatsCurveId("joint")
                            setCurveVisible("joint", true)
                          }}
                          disabled={!isDaysAxis}
                          className={`rounded border px-2 py-1 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            statsCurveId === "joint"
                              ? "border-violet-700 bg-violet-700 text-white dark:border-violet-200 dark:bg-violet-200 dark:text-violet-950"
                              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          }`}
                          aria-pressed={statsCurveId === "joint"}
                        >
                          {statsCurveId === "joint"
                            ? "Showing all"
                            : "Show all odds"}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <label className="inline-flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={isDaysAxis && visibleCurveIds.joint !== false}
                            disabled={!isDaysAxis || statsCurveId === "joint"}
                            onChange={(e) => setCurveVisible("joint", e.target.checked)}
                            className="disabled:opacity-60"
                            style={{ accentColor: JOINT_MEMENTO_CURVE_COLOR }}
                            aria-label="Show joint all-target curve"
                          />
                          <span
                            className="inline-block h-0.5 w-5 rounded"
                            style={{ backgroundColor: JOINT_MEMENTO_CURVE_COLOR }}
                          />
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                        —
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 dark:text-slate-400">
                        —
                      </td>
                    </tr>
                  ) : null}
                  {catsWithVisits.map((cat) => {
                    const start = getCatStartComeCount(cat.catId)
                    const catVisitsPerDay =
                      cat.visitsPerHorizon *
                      (MINUTES_PER_DAY / Math.max(analysis.totalDurationMinutes, 1))
                    const curveId = catCurveId(cat.catId)
                    const statsSelected = statsCurveId === curveId
                    const curveColor =
                      curveOptions.find((opt) => opt.id === curveId)?.color ??
                      MEMENTO_CAT_CURVE_COLORS[0]
                    return (
                      <tr
                        key={cat.catId}
                        className={`border-b border-slate-100 dark:border-slate-700 last:border-0 ${
                          statsSelected
                            ? "bg-blue-50/70 dark:bg-blue-950/30"
                            : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2">
                            <CatFaceName
                              catId={cat.catId}
                              name={cat.catName}
                              size="compact"
                            />
                            <span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {cat.isRareCat ? "rare" : "normal"}
                              </span>
                            </span>
                          </span>
                        </td>
                        {hasMultipleTargets ? (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCatId(cat.catId)
                                setStatsCurveId(curveId)
                                setCurveVisible(curveId, true)
                              }}
                              className={`rounded border px-2 py-1 text-[11px] font-medium transition ${
                                statsSelected
                                  ? "border-slate-700 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-100 dark:text-slate-900"
                                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                              }`}
                              aria-pressed={statsSelected}
                            >
                              {statsSelected ? "Showing this" : "Show odds"}
                            </button>
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          <label className="inline-flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={visibleCurveIds[curveId] !== false}
                              disabled={statsSelected}
                              onChange={(e) => setCurveVisible(curveId, e.target.checked)}
                              className="disabled:opacity-60"
                              style={{ accentColor: curveColor }}
                              aria-label={`Show ${cat.catName} curve`}
                            />
                            <span
                              className="inline-block h-0.5 w-5 rounded"
                              style={{ backgroundColor: curveColor }}
                            />
                          </label>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={5000}
                            value={start}
                            onChange={(e) =>
                              setCatStartComeCount(cat.catId, Number(e.target.value))
                            }
                            className="w-24 rounded border bg-white px-2 py-1 text-right font-mono dark:bg-slate-800"
                            aria-label={`Starting visits for ${cat.catName}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {catVisitsPerDay.toFixed(3)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <MementoTimingCharts
          xAxisUnit={xAxisUnit}
          setXAxisUnit={setXAxisUnit}
          visitsPerDay={visitsPerDay}
          plotMaxVisits={plotMaxVisits}
          setPlotMaxVisits={setPlotMaxVisits}
          timeDisplayBasis={timeDisplayBasis}
          setTimeDisplayBasis={setTimeDisplayBasis}
          isDaysAxis={isDaysAxis}
          visibleCurveOptions={visibleCurveOptions}
          exactCurve={exactCurve}
          empiricalCurves={empiricalCurves}
          xDomain={xDomain}
          referenceCurveId={referenceCurveId}
          referenceCurveLabel={referenceCurveLabel}
          samples={samples}
          showCiOnChart={showCiOnChart}
          showRunTrajectories={showRunTrajectories}
          ciConfidence={ciConfidence}
          trajectoryHits={trajectoryHits}
          timeDisplay={timeDisplay}
          foodUnitMeta={foodUnitMeta}
          tdMul={tdMul}
          usesFoodUnit={usesFoodUnit}
          probSuccessWithinCapFallback={walkDist.probSuccessWithinCap}
          measureWidthDeps={[activeTab, catsWithVisits.length]}
        />

          </div>
        ) : (
          <div
            id="yard-analysis-panel-fish"
            role="tabpanel"
            aria-labelledby="yard-analysis-tab-fish"
          >
            <FishPlotPanel
              fishMetric={fishMetric}
              setFishMetric={setFishMetric}
              xAxisUnit={xAxisUnit}
              setXAxisUnit={setXAxisUnit}
              visitsPerDay={visitsPerDay}
              fishSummary={fishPlotSummary}
              analyticRatePerDay={analyticFishRatePerDay}
              analyticVariancePerDay={analyticFishVariancePerDay}
              analyticLabel={
                useCooldown
                  ? "cooldown-averaged analytic expected value"
                  : "analytic expected value"
              }
              analyticCurve={analyticFishCurve}
              ciConfidence={ciConfidence}
              canRunSimulation
              hasMementoTargets={catsWithVisits.length > 0}
              simBusy={simBusy}
              simProgress={simProgress}
              timeDisplay={timeDisplay}
              foodUnitMeta={foodUnitMeta}
              timeDisplayBasis={timeDisplayBasis}
              setTimeDisplayBasis={setTimeDisplayBasis}
              fishPlotHorizonDays={fishPlotHorizonDays}
              setFishPlotHorizonDays={setFishPlotHorizonDays}
            />
          </div>
        )}
        {activeTab === "fish" || catsWithVisits.length > 0 ? simulationControls : null}
      </section>
    </div>
  )
}
