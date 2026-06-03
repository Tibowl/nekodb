import type { FlowchartSimRuntime } from "../yardFlowchartSim"
import type { TubbsMode } from "../tubbsMode"
import type { FishPlotMetric } from "./fishPlotStats"
import type { FishRatesPerDay, FishVariancePerDay } from "../yardAnalyzerSnapshot"

/** Per–target-cat data the analyzer already produces (visits/horizon and mass split). */
export type MementoLabAnalysisCat = {
  catId: number
  catName: string
  /**
   * `App_CatRecord__get_IsRareCat` (`Type == 1`); used to pick the LotMemento offset
   * (−8 rare vs −30 normal). Drives the rare-cat checkbox default in the lab.
   */
  isRareCat: boolean
  /** Total expected visits over `totalDurationMinutes` (e.g. 1 day at 1440min). */
  visitsPerHorizon: number
  indoorVisitsPerHorizon: number
  outdoorVisitsPerHorizon: number
}

/** Inputs the lab needs from the optimizer (so days, food rates, and indoor share are derived). */
export type MementoLabAnalysisContext = {
  cats: MementoLabAnalysisCat[]
  /** Table `MementoRate` for each bowl (LotMemento input, before placement mult). */
  lotteryFoodMementoRateIndoor: number
  lotteryFoodMementoRateOutdoor: number
  foodTypeIndoor: number
  foodTypeOutdoor: number
  /** Analyzer horizon (minutes); used to convert visits to days. */
  totalDurationMinutes: number
  /** Whole-yard analytic net fish rates from the analyzer, in fish per food day. */
  fishRatesPerDay?: FishRatesPerDay
  fishVariancePerDay?: FishVariancePerDay
  defaultFishMetric?: FishPlotMetric
  /**
   * Snapshot the lab uses for actual game-logic Monte Carlo. Driven through `runFlowchartSim`
   * (port of `visit_flowchart_engine`) — visit attempts, post-leave cooldown, cat-vs-cat compat.
   */
  flowchartRuntime: FlowchartSimRuntime
  /**
   * Tubbs mode this analysis ran under. The lab passes it (with the bowl ids/durations below) to the
   * fish sim so simulated income reflects the same outdoor-bowl depletion the analytic net assumes.
   */
  tubbsMode?: TubbsMode
  /** Outdoor / indoor bowl duration in ticks; the sim's outdoor-depletion and indoor refill clocks. */
  outdoorBowlDurationTicks?: number
  indoorBowlDurationTicks?: number
}

export type MementoCurveId = "joint" | `cat-${number}`

export type MementoCurveOption = {
  id: MementoCurveId
  label: string
  color: string
  curve: { x: number; cum: number }[]
}

export type BatchMementoSample = {
  hitMemento: boolean
  days: number | null
  targetDaysByCat: Record<number, number>
}

export type SimulationBatchMode = "timing" | "fish"

export type SingleYardIncomePlotMode =
  | "netGoldCum"
  | "netGoldEquivCum"
  | "netSilverCum"
  | "netGoldEquivPerDay"
  | "netGoldPerDay"

export type VisitCatStat = {
  catId: number
  count: number
  color: string
  label: string
  isTargetCat: boolean
}
