/**
 * Memento yard simulator: drives `runFlowchartSim` on a real yard, runs the **discrete LotMemento**
 * lottery on every visit by the target cat, and reports `{ visits, days } | null` per run — same
 * shape `MixtureDaySample` the lab UI already consumes from the Poisson sim.
 *
 * Uses the same visit lottery threshold shape as the lab UI:
 * `foodMementoRate × placement × come-count gate`.
 *
 * The food memento rate per visit is the bowl rate for the side the visit happened on
 * (`isIndoor`) — already scaled by the user's `foodMementoRateScale` knob upstream.
 */

import {
  drawPermyriad,
  mementoPermyriadThreshold,
  type MementoLotteryParams,
} from "../mementoLottery"
import { MINUTES_PER_TICK, TICKS_PER_DAY } from "./analyzer/constants"
import type { TubbsMode } from "./tubbsMode"
import { isTubbsSimActive, tubbsKickTiming } from "./tubbsMode"
import {
  SILVER_FISH_PER_GOLD_FISH,
  bowlDailySpendNativeBulkTriplet,
  perRefillGoldEquivBulkTriplet,
} from "./foodBowlEconomy"
import type { NekoAtsumeAnalyzer } from "./analyzer/nekoAtsumeAnalyzer"
import {
  runFlowchartSim,
  type FlowchartSimRuntime,
  type PlayspaceRuntime,
  type RefillInfo,
  type VisitInfo,
} from "./yardFlowchartSim"
import { rollVisitGiftFish } from "./visitGiftSim"
import { COMPANION_VISIT_RULES, isFoodItemId } from "./visitRules"

const MINUTES_PER_DAY = 24 * 60

/**
 * Build a `FlowchartSimRuntime` from a fully-analyzed `NekoAtsumeAnalyzer`. Pure read of
 * `allData` + `staticData.catVsCatAll`; does not mutate the analyzer.
 *
 * `isFoodPlayspace` is true for every food item id (1-7).
 */
export function buildFlowchartRuntimeFromAnalyzer(
  analyzer: NekoAtsumeAnalyzer
): FlowchartSimRuntime {
  const playspaces: PlayspaceRuntime[] = []
  const byItem: Record<number, number[]> = {}
  const conflictByPlace: Record<number, Set<number>> = {}

  for (const itemIdStr of Object.keys(analyzer.allData)) {
    const itemId = Number(itemIdStr)
    const psMap = analyzer.allData[itemId]!
    if (!byItem[itemId]) byItem[itemId] = []
    for (const psIdStr of Object.keys(psMap)) {
      const playspaceId = Number(psIdStr)
      const data = psMap[playspaceId]!
      const isIndoor = analyzer.groupingStrategy.getIsIndoors(playspaceId)
      const companionVisits: PlayspaceRuntime["companionVisits"] = []
      for (const rule of COMPANION_VISIT_RULES) {
        if (!data.catIds.includes(rule.triggerCatId)) continue
        const companionSilverMul =
          analyzer.sd.catToSilverMul[rule.companionCatId] ?? 0
        const playspaceSilverMul =
          analyzer.sd.playspaceMappings.silverMul[playspaceId] ?? 0
        companionVisits.push({
          triggerCatId: rule.triggerCatId,
          catId: rule.companionCatId,
          silverPayoutBase: (companionSilverMul * playspaceSilverMul) / 100 / 250,
          giftNiboshi: companionSilverMul,
        })
      }
      const playspaceSilverMul =
        analyzer.sd.playspaceMappings.silverMul[playspaceId] ?? 0
      playspaces.push({
        playspaceId,
        itemId,
        catIds: data.catIds.slice(),
        drawWeights: data.drawWeights.slice(),
        catVisitProbPermyriad: data.catVisitProbPermyriad.slice(),
        perCatSilverPayoutBase: data.catIds.map(
          (catId) =>
            ((analyzer.sd.catToSilverMul[catId] ?? 0) * playspaceSilverMul) / 100 / 250
        ),
        perCatGiftNiboshi: data.catIds.map(
          (catId) => analyzer.sd.catToSilverMul[catId] ?? 0
        ),
        ...(companionVisits.length > 0 ? { companionVisits } : {}),
        isIndoor,
        isFoodPlayspace: isFoodItemId(itemId),
      })
      byItem[itemId]!.push(playspaceId)
    }
  }
  playspaces.sort((a, b) => a.playspaceId - b.playspaceId)
  for (const k of Object.keys(byItem)) byItem[Number(k)]!.sort((a, b) => a - b)
  for (const constraint of analyzer.constraints) {
    if (constraint.groups.length !== 2) continue
    const ps1 = new Set<number>()
    const ps2 = new Set<number>()
    for (const entry of constraint.groups[0]!.entries) ps1.add(entry.playspaceId)
    for (const entry of constraint.groups[1]!.entries) ps2.add(entry.playspaceId)
    for (const a of ps1) {
      if (!conflictByPlace[a]) conflictByPlace[a] = new Set()
      for (const b of ps2) {
        if (a === b) continue
        conflictByPlace[a]!.add(b)
        if (!conflictByPlace[b]) conflictByPlace[b] = new Set()
        conflictByPlace[b]!.add(a)
      }
    }
  }

  return {
    playspaces,
    weather: analyzer.args.weather,
    byItem,
    catVsCat: analyzer.sd.catVsCatAll,
    conflictByPlace: Object.fromEntries(
      Object.entries(conflictByPlace).map(([pid, conflicts]) => [
        Number(pid),
        [...conflicts].sort((a, b) => a - b),
      ])
    ),
  }
}

export type YardMementoSimParams = {
  runtime: FlowchartSimRuntime
  /** Legacy/single selected target. Used when `targetCatConfigs` is omitted. */
  targetCatId: number
  isRareCat: boolean
  /** Food memento rate (raw, unscaled) for the **indoor** bowl — used when visit is indoor. */
  foodMementoRateIndoor: number
  /** Food memento rate (raw, unscaled) for the **outdoor** bowl — used when visit is outdoor. */
  foodMementoRateOutdoor: number
  /**
   * Come-count at start of run for the target cat. Lottery threshold uses
   * `n = comeCount + offset` where `offset` is `-8` (rare) or `-30` (normal); below threshold
   * the lottery is unwinnable.
   */
  startComeCount: number
  /**
   * Optional multi-target mode. The run succeeds only after every listed cat has
   * dropped; each target keeps its own come-count and lottery-roll counter.
   * Pass an empty array for fish-income-only batches with no memento target.
   */
  targetCatConfigs?: Array<{
    catId: number
    isRareCat: boolean
    startComeCount: number
  }>
  /**
   * Hard cap on **target-cat visits** (lottery rolls). Censor at this point. Mirrors the
   * lab's `cappedMaxVisits`.
   */
  maxLotteryRolls: number
  /** Tick budget (e.g. 365 days × 288 ticks/day). The driver stops at first hit anyway. */
  maxTicks: number
  /** `true` to model post-leave cooldown (game default); `false` for immediate revisit. */
  useCooldown?: boolean
  /**
   * When `true` (single-run / lab only), records every yard visit for charting —
   * **not** used for batch Monte Carlo (keeps workers light).
   */
  recordVisitTimeline?: boolean
  /**
   * Continue the yard ledger to `maxTicks` after the memento goal is complete or
   * the lottery cap is reached. Useful for full-horizon fish-income validation.
   */
  continueAfterTerminal?: boolean
  /**
   * Optional compact fish-income sampling grid. When provided, the simulator records
   * cumulative gross gold/silver at these food-day x positions without storing the
   * full visit timeline.
   */
  fishPlotGridDays?: number[]
  /**
   * Tubbs food-depletion model (stage-1 ground-truth validator). `undefined` / `"off"` attaches no
   * food state, refill counting, or gift omission, so the analyzer + scoring surface this feeds is
   * byte-identical to the pre-feature output. NOTE: the seeded per-run sample is NOT guaranteed
   * bit-for-bit identical to the old sampler — primary-cat gift fish now settle at departure
   * (`onLeave`) instead of arrival, which reorders draws on the shared `rand01` stream; aggregate
   * distributions are unchanged. Any other mode enables the per-bowl depletion + per-mode refill/kick
   * policy in {@link runFlowchartSim} and the emergent metrics below. Outdoor-only.
   */
  tubbsMode?: TubbsMode
  /** Item id of the single OUTDOOR food bowl playspace (== `foodTypeOutdoor`). */
  outdoorBowlItemId?: number
  /** Outdoor bowl duration in ticks (`D_outdoor / MINUTES_PER_TICK`). */
  outdoorBowlDurationTicks?: number
  /** Indoor bowl duration in ticks (`D_indoor / MINUTES_PER_TICK`); the indoor refill clock period. */
  indoorBowlDurationTicks?: number
  /** Cat id that empties the outdoor bowl per visit. Defaults to 108 (Tubbs). */
  tubbsCatId?: number
  /** Outdoor food id, used to price each counted refill (bulk-triplet gold-equiv). */
  outdoorFoodId?: number
  /** Indoor food id, used for the deterministic indoor daily spend (clock, Tubbs-independent). */
  indoorFoodId?: number
}

/** Compact visit ledger for one run (batch runs omit it). Index `i` across arrays = one visit. */
export type YardMementoVisitTimeline = {
  length: number
  /** In-game day at visit start (`tick × minutes_per_tick / 1440`). */
  day: Float64Array
  tick: Int32Array
  catId: Int32Array
  /** 1 when `catId` is the selected target cat, else 0. */
  isTargetCat: Uint8Array
  /** Cat id whose memento dropped on this visit, or -1 when no target memento dropped. */
  mementoHitCatId: Int32Array
  silverDelta: Int32Array
  goldDelta: Int32Array
  silverCumulative: Int32Array
  goldCumulative: Int32Array
}

export type YardMementoTargetHit = {
  catId: number
  visits: number
  days: number
}

export type YardMementoFishPlotTimeline = {
  goldCumulative: Float64Array
  silverCumulative: Float64Array
  /**
   * Cumulative OUTDOOR bowl refills counted by the sim at each grid index. Present only under an
   * active Tubbs mode; lets the fish plot charge the outdoor food the sim ACTUALLY spent (refills ×
   * per-refill price) instead of borrowing the analyzer's cost factor. Absent under off, where the
   * plot falls back to the deterministic base bowl spend.
   */
  outdoorRefillsCumulative?: Float64Array
}

export type YardMementoSample = {
  /** True iff every target cat got a memento before any target hit the visit cap. */
  hitMemento: boolean
  /**
   * Number of lottery rolls by the target whose visit ended the run. In multi-target
   * mode this is the final cat to drop; `null` for censored runs.
   */
  visits: number | null
  /**
   * In-game time at the terminal hit (all targets complete in multi-target mode).
   * `null` for censored runs.
   */
  days: number | null
  /**
   * Total simulated time for this run in days. Equals `days` when the memento
   * was hit; equals the cap day (last visit's day or the lottery-roll cap point)
   * when censored. Lets the UI report "fish per real day", among other things.
   */
  endDays: number
  /** Silver fish accumulated by **all** cats over the run (game-realistic). */
  silverFish: number
  /** Gold fish accumulated by **all** cats over the run (game-realistic). */
  goldFish: number
  /** Total visits by ANY cat during the run (denominator for fish/visit). */
  totalVisits: number
  /**
   * Count of visits that rolled the **gold payout** branch (8% indoor / 4% outdoor
   * Bernoulli per visit — same marginal as `nekoAtsumeAnalyzer.generateResults`).
   */
  fishGoldPayoutVisits: number
  /**
   * Visits that rolled the **silver payout** branch (complements
   * `fishGoldPayoutVisits` for the same RNG draws).
   */
  fishSilverPayoutVisits: number
  /** Gold fish + silver/50; single number for “net worth” in gold units. */
  netGoldEquivalent: number
  /** Per-target memento drops observed before the run stopped. */
  targetMementos: YardMementoTargetHit[]
  /** Present when `recordVisitTimeline` was set on the sim params. */
  visitTimeline?: YardMementoVisitTimeline
  /** Present when `fishPlotGridDays` was passed; same indexes as that grid. */
  fishPlotTimeline?: YardMementoFishPlotTimeline
  // --- Emergent Tubbs-model metrics (present only when `tubbsMode` is active) ---------------------
  /** Discrete OUTDOOR bowl refills counted over the run, divided by `endDays`. */
  outdoorRefillsPerDay?: number
  /** Outdoor food spend per day: `outdoorRefillsPerDay × perRefillGoldEquivBulkTriplet(outdoorFoodId)`. */
  outdoorFoodSpendGoldEquivPerDay?: number
  /** Gross gift gold-equiv/day minus outdoor + indoor food spend/day. Kicked Tubbs leaves silver
   * (stay-based) but no gold (conversion 0); kickSight's stay is a sliver. */
  netGoldEquivPerDayAfterFood?: number
  /** Sum of gift gold-equiv from NON-Tubbs cats on the outdoor bowl, per day (the availability proxy). */
  otherCatOutdoorGoldEquivPerDay?: number
  /** Gift gold-equiv from Tubbs on the outdoor bowl, per day. Silver-only under kick modes. */
  tubbsOutdoorGoldEquivPerDay?: number
  /** Emergent count of Tubbs visits on the outdoor bowl, per day (cross-check on the analyzer Rt). */
  tubbsOutdoorVisitsPerDay?: number
}


/** Hard cap so a single run cannot allocate an unbounded timeline in pathological yards. */
const VISIT_TIMELINE_MAX_EVENTS = 100_000
function newVisitTimeline(capacity: number): YardMementoVisitTimeline {
  return {
    length: 0,
    day: new Float64Array(capacity),
    tick: new Int32Array(capacity),
    catId: new Int32Array(capacity),
    isTargetCat: new Uint8Array(capacity),
    mementoHitCatId: new Int32Array(capacity).fill(-1),
    silverDelta: new Int32Array(capacity),
    goldDelta: new Int32Array(capacity),
    silverCumulative: new Int32Array(capacity),
    goldCumulative: new Int32Array(capacity),
  }
}

function trimVisitTimeline(
  timeline: YardMementoVisitTimeline | undefined
): YardMementoVisitTimeline | undefined {
  if (timeline === undefined) return undefined
  const n = timeline.length
  return {
    length: n,
    day: timeline.day.slice(0, n),
    tick: timeline.tick.slice(0, n),
    catId: timeline.catId.slice(0, n),
    isTargetCat: timeline.isTargetCat.slice(0, n),
    mementoHitCatId: timeline.mementoHitCatId.slice(0, n),
    silverDelta: timeline.silverDelta.slice(0, n),
    goldDelta: timeline.goldDelta.slice(0, n),
    silverCumulative: timeline.silverCumulative.slice(0, n),
    goldCumulative: timeline.goldCumulative.slice(0, n),
  }
}

/**
 * One full yard simulation. Drives the flowchart engine until the target cat
 * either obtains a memento (stops early) or the lottery-roll cap is reached
 * (censored). Throughout the run we credit silver / gold fish for every visit
 * — not just the target cat — because the lab's "fish obtained while waiting
 * for the memento" question is naturally about the *whole yard*'s income, not
 * just the target's. Fish income uses the same marginals as the analyzer:
 *
 * - Each visit rolls **independently**: `P(gold payout branch) = 8%` on indoor
 *   playspaces, `4%` on outdoor (per `VisitInfo.isIndoor`), matching
 *   `nekoAtsumeAnalyzer.generateResults` when those probabilities are conditioned
 *   on where the cat appeared. This is a **model** aligned with long-run rates,
 *   not a guarantee of bitwise agreement with one client RNG draw.
 * - Gold-branch visits pay `floor(stay_ticks / 2)` gold fish (game logic).
 * - Silver-branch visits use the decompiled `CalcGiftNormalNiboshi` integer path:
 *   `Niboshi × stay × playSpaceNiboshi`, a `NextInt(raw / 200)` bonus, and a minimum of 1.
 * - Gifts settle on **leave** using actual camped ticks (natural leave, kick-at-sight, or
 *   kick-at-refill eject). Companion visits still pay at arrival (they do not camp).
 */
export function simulateYardMementoUntilSuccess(
  opts: YardMementoSimParams,
  rand01: () => number
): YardMementoSample {
  const {
    runtime,
    targetCatId,
    isRareCat,
    foodMementoRateIndoor,
    foodMementoRateOutdoor,
    startComeCount,
    maxLotteryRolls,
    maxTicks,
    useCooldown = true,
    recordVisitTimeline = false,
    targetCatConfigs,
    continueAfterTerminal = false,
    fishPlotGridDays,
    tubbsMode,
    outdoorBowlItemId,
    outdoorBowlDurationTicks,
    indoorBowlDurationTicks,
    tubbsCatId = 108,
    outdoorFoodId,
    indoorFoodId,
  } = opts

  const tubbsActive = isTubbsSimActive(tubbsMode)
  // Measure the bowl income split whenever an outdoor bowl is identified — even under `off` — so a
  // full-bowl (no-depletion) baseline is available for the availability ratio. Read-only: it never
  // changes visits or RNG, and production callers that omit `outdoorBowlItemId` keep the old sample.
  const measureBowl = outdoorBowlItemId !== undefined
  let refillCount = 0
  // Outdoor-bowl gift income split by cat, for the emergent availability proxy.
  let tubbsOutdoorGE = 0
  let otherCatOutdoorGE = 0
  let tubbsOutdoorVisits = 0

  const visitTimeline = recordVisitTimeline
    ? newVisitTimeline(VISIT_TIMELINE_MAX_EVENTS)
    : undefined
  const fishPlotTimeline =
    fishPlotGridDays && fishPlotGridDays.length > 0
      ? {
          goldCumulative: new Float64Array(fishPlotGridDays.length),
          silverCumulative: new Float64Array(fishPlotGridDays.length),
          // Only under an active Tubbs mode does the sim count refills; off leaves this absent so the
          // plot uses the deterministic base bowl spend.
          ...(tubbsActive
            ? { outdoorRefillsCumulative: new Float64Array(fishPlotGridDays.length) }
            : {}),
        }
      : undefined
  let fishPlotGridIndex = 0

  const fillFishPlotGridUntil = (day: number, inclusive: boolean) => {
    if (fishPlotTimeline === undefined || fishPlotGridDays === undefined) return
    while (
      fishPlotGridIndex < fishPlotGridDays.length &&
      (inclusive
        ? fishPlotGridDays[fishPlotGridIndex]! <= day
        : fishPlotGridDays[fishPlotGridIndex]! < day)
    ) {
      fishPlotTimeline.goldCumulative[fishPlotGridIndex] = goldFish
      fishPlotTimeline.silverCumulative[fishPlotGridIndex] = silverFish
      if (fishPlotTimeline.outdoorRefillsCumulative) {
        fishPlotTimeline.outdoorRefillsCumulative[fishPlotGridIndex] = refillCount
      }
      fishPlotGridIndex += 1
    }
  }

  const targets = (
    targetCatConfigs !== undefined
      ? targetCatConfigs
      : [{ catId: targetCatId, isRareCat, startComeCount }]
  ).map((cfg) => ({
    catId: cfg.catId,
    isRareCat: cfg.isRareCat,
    comeCount: cfg.startComeCount,
    rolls: 0,
    hitDays: null as number | null,
    hitVisits: null as number | null,
    capped: false,
  }))
  const targetByCatId = new Map(targets.map((t) => [t.catId, t]))
  let totalVisits = 0
  let silverFish = 0
  let goldFish = 0
  let fishGoldPayoutVisits = 0
  let fishSilverPayoutVisits = 0
  /** Latest visit's tick-days (used for `endDays` on censored runs). */
  let lastTickDays = 0
  let terminalMementoVisits: number | null = null
  let terminalMementoDays: number | null = null
  let censored = false

  type PendingVisitMeta = {
    tickDays: number
    mementoHitCatId: number
    isTargetCat: boolean
    tick: number
    catId: number
    timelineIndex?: number
  }
  const pendingVisitMeta = new Map<number, PendingVisitMeta>()

  const params: MementoLotteryParams = {
    comeCount: startComeCount,
    isRareCat,
    foodMementoRate: foodMementoRateIndoor,
    isIndoor: false,
  }

  const rollGiftFish = (info: VisitInfo) => {
    const isTubbsOutdoorBowlVisit =
      tubbsActive &&
      !info.isIndoor &&
      info.itemId === outdoorBowlItemId &&
      info.catId === tubbsCatId
    const tubbsSilverOnly =
      isTubbsOutdoorBowlVisit &&
      tubbsMode !== undefined &&
      tubbsKickTiming(tubbsMode) !== "none"
    return rollVisitGiftFish(
      {
        isIndoor: info.isIndoor,
        stay: info.stay,
        plannedStay: info.plannedStay,
        silverPayoutBase: info.silverPayoutBase,
        giftNiboshi: info.giftNiboshi,
        tubbsSilverOnly,
      },
      rand01
    )
  }

  const recordVisitTimelineRow = (
    info: VisitInfo,
    meta: PendingVisitMeta,
    silverDelta: number,
    goldDelta: number,
    day: number = meta.tickDays,
    tick: number = meta.tick
  ) => {
    if (
      visitTimeline === undefined ||
      visitTimeline.length >= VISIT_TIMELINE_MAX_EVENTS
    ) {
      return
    }
    const i = visitTimeline.length
    visitTimeline.day[i] = day
    visitTimeline.tick[i] = tick
    visitTimeline.catId[i] = meta.catId
    visitTimeline.isTargetCat[i] = meta.isTargetCat ? 1 : 0
    visitTimeline.mementoHitCatId[i] = meta.mementoHitCatId
    visitTimeline.silverDelta[i] = silverDelta
    visitTimeline.goldDelta[i] = goldDelta
    visitTimeline.silverCumulative[i] = silverFish
    visitTimeline.goldCumulative[i] = goldFish
    visitTimeline.length += 1
  }

  const onVisit = (info: VisitInfo): boolean => {
    totalVisits += 1
    const tickDays = (info.tick * MINUTES_PER_TICK) / MINUTES_PER_DAY
    fillFishPlotGridUntil(tickDays, false)
    lastTickDays = tickDays

    const target = targetByCatId.get(info.catId)
    const isTargetCat = target !== undefined
    let mementoHitCatId = -1

    if (isTargetCat && target.hitDays === null && !target.capped) {
      target.rolls += 1
      params.comeCount = target.comeCount
      params.isRareCat = target.isRareCat
      params.foodMementoRate = info.isIndoor
        ? foodMementoRateIndoor
        : foodMementoRateOutdoor
      params.isIndoor = info.isIndoor
      const t = mementoPermyriadThreshold(params)
      if (t !== null && t > 0) {
        const draw = drawPermyriad(rand01)
        if (draw <= t - 1) {
          target.hitVisits = target.rolls
          target.hitDays = tickDays
          mementoHitCatId = target.catId
        }
      }
      if (target.hitDays === null) {
        target.comeCount += 1
        if (target.rolls >= maxLotteryRolls) {
          target.capped = true
          censored = true
        }
      }
    }

    // Companions pay at arrival; primary cats defer fish to onLeave (actual stay).
    const isCompanionVisit =
      pendingVisitMeta.has(info.playspaceId) &&
      pendingVisitMeta.get(info.playspaceId)!.catId !== info.catId
    if (isCompanionVisit) {
      const { silverDelta, goldDelta, isGoldPayout } = rollGiftFish(info)
      if (isGoldPayout) {
        goldFish += goldDelta
        fishGoldPayoutVisits += 1
      } else {
        silverFish += silverDelta
        fishSilverPayoutVisits += 1
      }
      fillFishPlotGridUntil(tickDays, true)
      if (
        visitTimeline !== undefined &&
        visitTimeline.length < VISIT_TIMELINE_MAX_EVENTS
      ) {
        const i = visitTimeline.length
        visitTimeline.day[i] = tickDays
        visitTimeline.tick[i] = info.tick
        visitTimeline.catId[i] = info.catId
        visitTimeline.isTargetCat[i] = isTargetCat ? 1 : 0
        visitTimeline.mementoHitCatId[i] = mementoHitCatId
        visitTimeline.silverDelta[i] = silverDelta
        visitTimeline.goldDelta[i] = goldDelta
        visitTimeline.silverCumulative[i] = silverFish
        visitTimeline.goldCumulative[i] = goldFish
        visitTimeline.length += 1
      }
    } else {
      let timelineIndex: number | undefined
      if (
        visitTimeline !== undefined &&
        visitTimeline.length < VISIT_TIMELINE_MAX_EVENTS
      ) {
        timelineIndex = visitTimeline.length
        visitTimeline.day[timelineIndex] = tickDays
        visitTimeline.tick[timelineIndex] = info.tick
        visitTimeline.catId[timelineIndex] = info.catId
        visitTimeline.isTargetCat[timelineIndex] = isTargetCat ? 1 : 0
        visitTimeline.mementoHitCatId[timelineIndex] = mementoHitCatId
        visitTimeline.silverDelta[timelineIndex] = 0
        visitTimeline.goldDelta[timelineIndex] = 0
        visitTimeline.silverCumulative[timelineIndex] = silverFish
        visitTimeline.goldCumulative[timelineIndex] = goldFish
        visitTimeline.length += 1
      }
      pendingVisitMeta.set(info.playspaceId, {
        tickDays,
        mementoHitCatId,
        isTargetCat,
        tick: info.tick,
        catId: info.catId,
        timelineIndex,
      })
      if (measureBowl && !info.isIndoor && info.itemId === outdoorBowlItemId) {
        if (info.catId === tubbsCatId) tubbsOutdoorVisits += 1
      }
    }

    if (censored && !continueAfterTerminal) return true
    if (targets.length > 0 && targets.every((t) => t.hitDays !== null)) {
      if (terminalMementoDays === null) {
        terminalMementoVisits = target?.hitVisits ?? null
        terminalMementoDays = tickDays
      }
      return !continueAfterTerminal
    }
    return false
  }

  const onLeave = (info: VisitInfo): void => {
    const meta = pendingVisitMeta.get(info.playspaceId)
    if (meta === undefined) return
    pendingVisitMeta.delete(info.playspaceId)

    const settleTick = info.tick + info.stay
    const settleDays = (settleTick * MINUTES_PER_TICK) / MINUTES_PER_DAY
    fillFishPlotGridUntil(settleDays, false)
    lastTickDays = settleDays

    const { silverDelta, goldDelta, isGoldPayout } = rollGiftFish(info)
    if (isGoldPayout) {
      goldFish += goldDelta
      fishGoldPayoutVisits += 1
    } else {
      silverFish += silverDelta
      fishSilverPayoutVisits += 1
    }
    if (measureBowl && !info.isIndoor && info.itemId === outdoorBowlItemId) {
      const visitGE = goldDelta + silverDelta / SILVER_FISH_PER_GOLD_FISH
      if (info.catId === tubbsCatId) {
        tubbsOutdoorGE += visitGE
      } else {
        otherCatOutdoorGE += visitGE
      }
    }
    fillFishPlotGridUntil(settleDays, true)
    if (meta.timelineIndex !== undefined && visitTimeline !== undefined) {
      const i = meta.timelineIndex
      visitTimeline.day[i] = settleDays
      visitTimeline.tick[i] = settleTick
      visitTimeline.silverDelta[i] = silverDelta
      visitTimeline.goldDelta[i] = goldDelta
      visitTimeline.silverCumulative[i] = silverFish
      visitTimeline.goldCumulative[i] = goldFish
    } else {
      recordVisitTimelineRow(info, meta, silverDelta, goldDelta, settleDays, settleTick)
    }
  }

  const onRefill = tubbsActive
    ? (_info: RefillInfo) => {
        refillCount += 1
      }
    : undefined

  const { ticksRun } = runFlowchartSim(runtime, {
    totalTicks: maxTicks,
    rand01,
    onVisit,
    onLeave,
    useCooldown,
    // Food-depletion options are passed only for an active Tubbs mode; otherwise `tubbsMode` is
    // undefined and runFlowchartSim runs its byte-identical off path (no food state, no onRefill).
    ...(tubbsActive
      ? {
          tubbsMode,
          outdoorBowlItemId,
          outdoorBowlDurationTicks,
          indoorBowlDurationTicks,
          tubbsCatId,
          onRefill,
        }
      : {}),
  })
  fillFishPlotGridUntil(Number.POSITIVE_INFINITY, true)

  const hit = targets.length > 0 && targets.every((t) => t.hitDays !== null)
  const netGoldEquivalent = goldFish + silverFish / SILVER_FISH_PER_GOLD_FISH
  const targetMementos = targets
    .filter((t) => t.hitDays !== null && t.hitVisits !== null)
    .map((t) => ({
      catId: t.catId,
      visits: t.hitVisits!,
      days: t.hitDays!,
    }))
    .sort((a, b) => a.days - b.days || a.catId - b.catId)
  const endDays = continueAfterTerminal
    ? lastTickDays
    : hit
      ? terminalMementoDays!
      : lastTickDays

  // Emergent Tubbs-model metrics. Per-day rates divide by the ACTUAL run duration (`ticksRun`), not
  // the full horizon, so an early-stopped run (continueAfterTerminal=false hitting a memento) is not
  // biased low (B-fix). The income split is emitted whenever an outdoor bowl is measured (incl.
  // `off`, the full-bowl availability baseline); the cost metrics need an active mode (G-fix).
  let tubbsMetrics: Pick<
    YardMementoSample,
    | "outdoorRefillsPerDay"
    | "outdoorFoodSpendGoldEquivPerDay"
    | "netGoldEquivPerDayAfterFood"
    | "otherCatOutdoorGoldEquivPerDay"
    | "tubbsOutdoorGoldEquivPerDay"
    | "tubbsOutdoorVisitsPerDay"
  > = {}
  if (measureBowl) {
    const runDays = (ticksRun * MINUTES_PER_TICK) / MINUTES_PER_DAY
    const denomDays = runDays > 0 ? runDays : 1
    tubbsMetrics = {
      otherCatOutdoorGoldEquivPerDay: otherCatOutdoorGE / denomDays,
      tubbsOutdoorGoldEquivPerDay: tubbsOutdoorGE / denomDays,
      tubbsOutdoorVisitsPerDay: tubbsOutdoorVisits / denomDays,
    }
    if (tubbsActive) {
      const outdoorRefillsPerDay = refillCount / denomDays
      // Per-refill outdoor food price comes from the shipped bulk-triplet economy, NOT any analyzer
      // cost formula — the cost factor must EMERGE from the counted refills.
      const perRefillGE =
        outdoorFoodId !== undefined ? perRefillGoldEquivBulkTriplet(outdoorFoodId) : 0
      const outdoorFoodSpendGoldEquivPerDay = outdoorRefillsPerDay * perRefillGE
      // Indoor bowl is a deterministic clock unaffected by Tubbs → use the continuous daily spend.
      const indoorSpendGEPerDay =
        indoorFoodId !== undefined ? bowlDailySpendNativeBulkTriplet(indoorFoodId).goldEquiv : 0
      const grossGEPerDay = netGoldEquivalent / denomDays
      tubbsMetrics.outdoorRefillsPerDay = outdoorRefillsPerDay
      tubbsMetrics.outdoorFoodSpendGoldEquivPerDay = outdoorFoodSpendGoldEquivPerDay
      tubbsMetrics.netGoldEquivPerDayAfterFood =
        grossGEPerDay - outdoorFoodSpendGoldEquivPerDay - indoorSpendGEPerDay
    }
  }

  return {
    hitMemento: hit,
    visits: hit ? terminalMementoVisits : null,
    days: hit ? terminalMementoDays : null,
    endDays,
    silverFish,
    goldFish,
    totalVisits,
    fishGoldPayoutVisits,
    fishSilverPayoutVisits,
    netGoldEquivalent,
    targetMementos,
    ...(visitTimeline !== undefined
      ? { visitTimeline: trimVisitTimeline(visitTimeline) }
      : {}),
    ...(fishPlotTimeline !== undefined ? { fishPlotTimeline } : {}),
    ...tubbsMetrics,
  }
}
