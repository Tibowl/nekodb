/**
 * Tick-level visit logic using the same data the analyzer uses:
 *
 * - **Visit chance** (permyriad): food × charm × weather (already on
 *   `analyzer.allData[itemId][playspaceId].catVisitProbPermyriad`).
 * - **Cat selection**: damage-state drawWeights × `(100 + cap(Σ cat-vs-cat))/100`
 *   with cap in [-70, 300] (same as client `InitCompatibility`); pairs with weight < 1
 *   are dropped (`Trim`).
 * - **Gates**: empty playspace, indoor food bowl skip, per-cat post-leave cooldown,
 *   "cat not already elsewhere".
 * - Each tick advances existing timers first, then runs visit attempts. **Stay** is
 *   uniform on `STAY_TICK_RANGE` (5..14). **Cooldown** is uniform on
 *   `CAT_COOLDOWN_TICK_RANGE` (8..23).
 *
 * - **Cross-playspace conflicts**: playspaces marked mutually exclusive in the analyzer
 *   cannot both be occupied at once.
 *
 * Conventions
 * - State is plain mutable objects (no `Map`) — runs in a hot loop, allocations matter.
 * - Tick is 5 minutes (`MINUTES_PER_TICK`); 288 ticks/day at 24h.
 *
 * The driver `runFlowchartSim` is generic: pass `onVisit(visitInfo)` to be notified at
 * each successful visit, and return `true` from it to stop the simulation early
 * (used by the memento "stop at first hit" mode). The decompiled client shuffles yard
 * places before visit attempts; this flat runtime shuffles playspaces per tick as the
 * nearest available equivalent.
 */

import {
  CAT_COOLDOWN_TICK_MAX,
  CAT_COOLDOWN_TICK_MIN,
  MINUTES_PER_TICK,
  STAY_TICK_RANGE,
  TICKS_PER_DAY,
} from "./analyzer/constants"
import type { TubbsMode } from "./tubbsMode"
import { isTubbsSimActive } from "./tubbsMode"
import { canCatAppearOnPlayspace } from "./visitRules"
import {
  advanceYardFoodClocks,
  initYardFoodState,
  outdoorVisitBlockedByEmptyBowl,
  runOutdoorBowlRefillPolicy,
  tubbsClearsOutdoorBowl,
  tubbsKickSightAfterOutdoorBowlVisit,
  type RefillInfo,
  type YardFoodState,
} from "./yardFoodDepletion"

const STAY_MIN = STAY_TICK_RANGE[0]!
const STAY_MAX = STAY_TICK_RANGE[STAY_TICK_RANGE.length - 1]!
const COOLDOWN_MIN = CAT_COOLDOWN_TICK_MIN
const COOLDOWN_MAX = CAT_COOLDOWN_TICK_MAX
export const EMPTY_CAT_ID = -1

/** Cap for cat-vs-cat sum before the +100 / 100 factor (mirrors `InitCompatibility`). */
export const PLAYSPACE_COMPAT_SUM_MIN = -70
export const PLAYSPACE_COMPAT_SUM_MAX = 300

export type PlayspaceRuntime = {
  playspaceId: number
  itemId: number
  catIds: number[]
  drawWeights: number[]
  catVisitProbPermyriad: number[]
  /** Base multiplier in `floor(base × stay_ticks × silverMul)` for silver payouts. */
  perCatSilverPayoutBase: number[]
  /** Cat `Niboshi` value used by the gift/payout economy. */
  perCatGiftNiboshi?: number[]
  companionVisits?: Array<{
    triggerCatId: number
    catId: number
    silverPayoutBase: number
    giftNiboshi?: number
  }>
  isIndoor: boolean
  /** Skip rolls for indoor food playspaces. */
  isFoodPlayspace: boolean
}

export type { YardFoodState, RefillInfo }

/**
 * One simulator timeline. `occupant[pid] = catId` (`EMPTY_CAT_ID` = empty),
 * `stay[pid]` ticks left,
 * `catCooldown[catId]` ticks left.
 *
 * `food` is present only under an active Tubbs mode; the `off` / Tubbs-free path leaves it
 * `undefined` so no new branch runs and behavior is byte-identical to the pre-Tubbs simulator.
 */
export type YardVisitState = {
  occupant: Record<number, number>
  stay: Record<number, number>
  catCooldown: Record<number, number>
  food?: YardFoodState
  /** Gift payout waits until leave; keyed by playspace id. */
  pendingGift: Record<number, PendingVisitGift>
}

/** Visit metadata held until the cat leaves; gift uses planned stay minus remaining occupancy. */
type PendingVisitGift = {
  catId: number
  itemId: number
  isIndoor: boolean
  startTick: number
  /** Stay roll at arrival (before any shoo). Gift pays `plannedStay − remainingOccupancy` at leave. */
  plannedStay: number
  silverPayoutBase: number
  giftNiboshi: number
}

export function newYardVisitState(): YardVisitState {
  return { occupant: {}, stay: {}, catCooldown: {}, pendingGift: {} }
}

export type VisitInfo = {
  playspaceId: number
  itemId: number
  isIndoor: boolean
  catId: number
  /** Tick at which the visit started, 0 = first tick of the run. */
  tick: number
  /** Stay duration in ticks at gift settlement (`plannedStay − remaining occupancy`). */
  stay: number
  /** Stay roll at arrival, before player actions such as shooing cut the visit short. */
  plannedStay?: number
  /** Base multiplier in `floor(base × stay_ticks × silverMul)` for silver payouts. */
  silverPayoutBase: number
  /** Cat `Niboshi` value used by the gift/payout economy. */
  giftNiboshi: number
}

export type FlowchartSimRuntime = {
  /** All playspaces; visit attempt order is controlled by `FlowchartSimOptions.playspaceOrder`. */
  playspaces: PlayspaceRuntime[]
  /** Analyzer weather / season column used by client-side appearance vetoes. */
  weather?: string
  /** `itemId -> playspaceIds` for "cats currently on item" lookups during cat selection. */
  byItem: Record<number, number[]>
  /** `catId -> { otherCatIdString -> compatibility int }` (raw analyzer table). */
  catVsCat: Record<number, Record<string, number>>
  /** `playspaceId -> conflicting playspaceIds` for place-level mutual exclusion. */
  conflictByPlace: Record<number, number[]>
}

export type FlowchartSimOptions = {
  totalTicks: number
  rand01: () => number
  /** Called at every successful visit (memento lottery, companion visits); gift pays on {@link onLeave}. */
  onVisit?: (info: VisitInfo) => boolean | void
  /** Called when a cat leaves a playspace; `stay` is ticks actually camped. */
  onLeave?: (info: VisitInfo) => void
  /** Skip post-leave lockout. */
  useCooldown?: boolean
  /**
   * Per-tick visit attempt order. `shuffled` mirrors the decompiled client more closely
   * (client shuffles place configs, then enumerates playspaces within each place).
   */
  playspaceOrder?: "shuffled" | "sorted"
  /**
   * Tubbs handling for the food-depletion model. `undefined` / `"off"` runs the pre-Tubbs path
   * with NO food state and is byte-identical to the prior simulator. Any other mode attaches
   * per-bowl food state and applies the per-mode refill + empty-bowl policy described on
   * {@link YardFoodState}.
   */
  tubbsMode?: TubbsMode
  /** Item id of the single OUTDOOR food bowl playspace (== `foodTypeOutdoor`). */
  outdoorBowlItemId?: number
  /** Outdoor bowl duration in ticks (`D_outdoor / MINUTES_PER_TICK`); 0/undefined ⇒ no bowl model. */
  outdoorBowlDurationTicks?: number
  /** Indoor bowl duration in ticks (`D_indoor / MINUTES_PER_TICK`); the indoor refill clock period. */
  indoorBowlDurationTicks?: number
  /** Cat id that empties the whole outdoor bowl on each visit. Defaults to 108 (Tubbs). */
  tubbsCatId?: number
  /** Fired on each discrete OUTDOOR bowl refill so the caller can count refills → food spend. */
  onRefill?: (info: RefillInfo) => void
}

function capCompatSum(s: number): number {
  if (s < PLAYSPACE_COMPAT_SUM_MIN) return PLAYSPACE_COMPAT_SUM_MIN
  if (s > PLAYSPACE_COMPAT_SUM_MAX) return PLAYSPACE_COMPAT_SUM_MAX
  return s
}

/**
 * One visit attempt for one playspace (flowchart: CatSelect → gates → roll). Mutates `state`.
 *
 * Allocations are kept minimal: relationship-weight buffer is reused across calls (passed in via
 * `scratch`) so the inner loop in `runFlowchartSim` doesn't churn the heap.
 */
function giftStayAtLeave(pending: PendingVisitGift, remainingOccupancy: number): number {
  // Gift pays on the time actually camped = the FULL rolled stay minus whatever was still on the
  // timer when the cat left. kickSight zeroes the timer at arrival, so it settles with remaining 0 ⇒
  // full roll; kickRefill ejects at a food round with ticks still on the timer ⇒ partial; a natural
  // leave expires with remaining 0 ⇒ full. (`plannedStay`, captured before any shoo, not the
  // post-shoo `state.stay`, which is what made kickSight pay ~nothing.)
  return Math.max(0, pending.plannedStay - remainingOccupancy)
}

function settleVisitGift(
  pid: number,
  remainingOccupancy: number,
  state: YardVisitState,
  onLeave?: (info: VisitInfo) => void
): void {
  const pending = state.pendingGift[pid]
  if (pending === undefined) return
  delete state.pendingGift[pid]
  if (onLeave === undefined) return
  onLeave({
    playspaceId: pid,
    itemId: pending.itemId,
    isIndoor: pending.isIndoor,
    catId: pending.catId,
    tick: pending.startTick,
    stay: giftStayAtLeave(pending, remainingOccupancy),
    plannedStay: pending.plannedStay,
    silverPayoutBase: pending.silverPayoutBase,
    giftNiboshi: pending.giftNiboshi,
  })
}

function settleAllPendingGifts(
  state: YardVisitState,
  onLeave?: (info: VisitInfo) => void
): void {
  for (const pidStr of Object.keys(state.pendingGift)) {
    const pid = Number(pidStr)
    const pending = state.pendingGift[pid]
    if (pending === undefined) continue
    settleVisitGift(pid, state.stay[pid] ?? 0, state, onLeave)
  }
}

function tryVisitOnePlayspace(
  ps: PlayspaceRuntime,
  state: YardVisitState,
  byItem: Record<number, number[]>,
  catVsCat: Record<number, Record<string, number>>,
  conflictByPlace: Record<number, number[]>,
  scratchWeights: number[],
  rand01: () => number,
  tick: number,
  weather: string,
  onVisit?: (info: VisitInfo) => boolean | void,
  onLeave?: (info: VisitInfo) => void,
  outdoorBowlItemId?: number,
  tubbsCatId?: number,
  tubbsMode?: TubbsMode,
  useCooldown: boolean = true
): { stop: boolean; visited: boolean; chosen: number | null } {
  const pid = ps.playspaceId
  if (state.occupant[pid] !== undefined && state.occupant[pid] !== EMPTY_CAT_ID) {
    return { stop: false, visited: false, chosen: null }
  }
  if ((state.stay[pid] ?? 0) > 0) {
    return { stop: false, visited: false, chosen: null }
  }
  const conflicting = conflictByPlace[pid]
  if (conflicting) {
    for (let i = 0; i < conflicting.length; i++) {
      if ((state.occupant[conflicting[i]!] ?? EMPTY_CAT_ID) !== EMPTY_CAT_ID) {
        return { stop: false, visited: false, chosen: null }
      }
    }
  }

  const indoorFood = ps.isFoodPlayspace && ps.isIndoor
  if (indoorFood) return { stop: false, visited: false, chosen: null }

  if (outdoorVisitBlockedByEmptyBowl(state.food, ps.isIndoor)) {
    return { stop: false, visited: false, chosen: null }
  }

  const catIds = ps.catIds
  const drawW = ps.drawWeights
  const permyriad = ps.catVisitProbPermyriad
  const n = catIds.length

  const sameItemPlayspaces = byItem[ps.itemId] ?? [pid]
  const playingOnItem: number[] = []
  for (let i = 0; i < sameItemPlayspaces.length; i++) {
    const c = state.occupant[sameItemPlayspaces[i]!] ?? EMPTY_CAT_ID
    if (c !== EMPTY_CAT_ID) playingOnItem.push(c)
  }

  const silverBases = ps.perCatSilverPayoutBase
  const giftNiboshi = ps.perCatGiftNiboshi
  let activeCount = 0
  for (let i = 0; i < n; i++) {
    const baseW = drawW[i]!
    if (baseW === 0) continue
    const cid = catIds[i]!
    let s = 0
    if (playingOnItem.length > 0) {
      const row = catVsCat[cid] ?? {}
      for (let j = 0; j < playingOnItem.length; j++) {
        const oid = playingOnItem[j]!
        if (oid === cid) continue
        const v = row[String(oid)]
        if (v !== undefined) s += v
      }
    }
    const w = baseW * ((100 + capCompatSum(s)) / 100)
    if (w < 1) continue
    scratchWeights[activeCount * 5 + 0] = w
    scratchWeights[activeCount * 5 + 1] = cid
    scratchWeights[activeCount * 5 + 2] = permyriad[i]!
    scratchWeights[activeCount * 5 + 3] = silverBases[i] ?? 0
    scratchWeights[activeCount * 5 + 4] = giftNiboshi?.[i] ?? Number.POSITIVE_INFINITY
    activeCount++
  }
  if (activeCount === 0) return { stop: false, visited: false, chosen: null }

  let totalW = 0
  for (let k = 0; k < activeCount; k++) totalW += scratchWeights[k * 5]!
  const u = rand01() * totalW
  let acc = 0
  let chosenIdx = activeCount - 1
  for (let k = 0; k < activeCount; k++) {
    acc += scratchWeights[k * 5]!
    if (u <= acc) {
      chosenIdx = k
      break
    }
  }
  const chosen = scratchWeights[chosenIdx * 5 + 1]!
  const chosenPermyriad = scratchWeights[chosenIdx * 5 + 2]!
  const chosenSilverPayoutBase = scratchWeights[chosenIdx * 5 + 3]!
  const chosenGiftNiboshi = scratchWeights[chosenIdx * 5 + 4]!

  if (!canCatAppearOnPlayspace(chosen, pid, weather)) {
    return { stop: false, visited: false, chosen }
  }

  if ((state.catCooldown[chosen] ?? 0) > 0) {
    return { stop: false, visited: false, chosen: null }
  }
  for (const otherPidStr of Object.keys(state.occupant)) {
    const otherPid = Number(otherPidStr)
    if (otherPid === pid) continue
    if (state.occupant[otherPid] === chosen) {
      return { stop: false, visited: false, chosen: null }
    }
  }

  if (rand01() >= chosenPermyriad / 10000) {
    return { stop: false, visited: false, chosen: null }
  }

  const rolledStay = STAY_MIN + Math.floor(rand01() * (STAY_MAX - STAY_MIN + 1))
  state.occupant[pid] = chosen
  state.stay[pid] = rolledStay
  tubbsClearsOutdoorBowl(state.food, {
    catId: chosen,
    tubbsCatId,
    itemId: ps.itemId,
    outdoorBowlItemId,
    isIndoor: ps.isIndoor,
  })
  tubbsKickSightAfterOutdoorBowlVisit(
    tubbsMode,
    {
      catId: chosen,
      tubbsCatId,
      itemId: ps.itemId,
      outdoorBowlItemId,
      isIndoor: ps.isIndoor,
      playspaceId: pid,
    },
    state,
    useCooldown,
    () => COOLDOWN_MIN + Math.floor(rand01() * (COOLDOWN_MAX - COOLDOWN_MIN + 1))
  )
  state.pendingGift[pid] = {
    catId: chosen,
    itemId: ps.itemId,
    isIndoor: ps.isIndoor,
    startTick: tick,
    plannedStay: rolledStay,
    silverPayoutBase: chosenSilverPayoutBase,
    giftNiboshi: chosenGiftNiboshi,
  }
  let stop = false
  if (onVisit) {
    const visitBase = {
      playspaceId: pid,
      itemId: ps.itemId,
      isIndoor: ps.isIndoor,
      tick,
      stay: rolledStay,
    }
    stop = !!onVisit({
      ...visitBase,
      catId: chosen,
      silverPayoutBase: chosenSilverPayoutBase,
      giftNiboshi: chosenGiftNiboshi,
    })
    if (!stop && ps.companionVisits) {
      for (const companion of ps.companionVisits) {
        if (companion.triggerCatId !== chosen) continue
        stop = !!onVisit({
          ...visitBase,
          catId: companion.catId,
          silverPayoutBase: companion.silverPayoutBase,
          giftNiboshi: companion.giftNiboshi ?? Number.POSITIVE_INFINITY,
        })
        if (stop) break
      }
    }
  }
  // Shooed on sight (kickSight): the timer was zeroed at arrival, so the cat is already gone — settle
  // the gift now with remaining 0 (⇒ full rolled stay). Other cats settle later when their stay ends.
  if ((state.stay[pid] ?? 0) === 0) {
    settleVisitGift(pid, 0, state, onLeave)
  }
  return { stop, visited: true, chosen }
}

/**
 * Advance existing timers at the start of a tick. This mirrors the decompiled client:
 * finished playing cats enter cooldown before the tick's visit lottery runs.
 *
 * When food state is present (active Tubbs mode), this also drives the deterministic food clocks:
 * the indoor refill countdown and the outdoor bowl's time-depletion run at the START; the per-mode
 * outdoor refill policy runs at the END (after stays/cooldowns), firing `onRefill` per refill. All
 * food bookkeeping is RNG-free, so the off path (food undefined) executes exactly today's logic.
 */
function advanceTick(
  state: YardVisitState,
  playspaceIds: number[],
  rand01: () => number,
  useCooldown: boolean,
  tick: number,
  tubbsMode?: TubbsMode,
  outdoorBowlItemId?: number,
  outdoorBowlDurationTicks?: number,
  indoorBowlDurationTicks?: number,
  onRefill?: (info: RefillInfo) => void,
  bowlPlayspaceIds?: number[],
  tubbsCatId?: number,
  onLeave?: (info: VisitInfo) => void
): void {
  let indoorRefilledThisTick = false
  if (state.food !== undefined) {
    indoorRefilledThisTick = advanceYardFoodClocks(
      state.food,
      indoorBowlDurationTicks
    ).indoorRefilledThisTick
  }
  if (useCooldown) {
    for (const cidStr of Object.keys(state.catCooldown)) {
      const cid = Number(cidStr)
      const left = state.catCooldown[cid]! - 1
      if (left <= 0) delete state.catCooldown[cid]
      else state.catCooldown[cid] = left
    }
  }
  for (let i = 0; i < playspaceIds.length; i++) {
    const pid = playspaceIds[i]!
    const rem = state.stay[pid] ?? 0
    if (rem <= 0) continue
    const next = rem - 1
    state.stay[pid] = next
    if (next === 0) {
      const cat = state.occupant[pid] ?? EMPTY_CAT_ID
      settleVisitGift(pid, 0, state, onLeave)
      state.occupant[pid] = EMPTY_CAT_ID
      if (cat !== EMPTY_CAT_ID && useCooldown) {
        const cd =
          COOLDOWN_MIN + Math.floor(rand01() * (COOLDOWN_MAX - COOLDOWN_MIN + 1))
        state.catCooldown[cat] = cd
      }
    }
  }

  if (
    state.food !== undefined &&
    tubbsMode !== undefined &&
    tubbsMode !== "off" &&
    outdoorBowlDurationTicks &&
    outdoorBowlDurationTicks > 0
  ) {
    runOutdoorBowlRefillPolicy(state.food, tubbsMode, {
      tick,
      indoorRefilledThisTick,
      outdoorBowlDurationTicks,
      outdoorBowlItemId,
      bowlPlayspaceIds,
      tubbsCatId,
      occupant: state.occupant,
      stay: state.stay,
      catCooldown: state.catCooldown,
      useCooldown,
      randomCooldownTicks: () =>
        COOLDOWN_MIN + Math.floor(rand01() * (COOLDOWN_MAX - COOLDOWN_MIN + 1)),
      onRefill,
      onTubbsEject: (playspaceId, remainingStay) => {
        if (state.pendingGift[playspaceId] === undefined) return
        settleVisitGift(playspaceId, remainingStay, state, onLeave)
      },
    })
  }
}

function shuffleIndicesInPlace(indices: number[], rand01: () => number): void {
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand01() * (i + 1))
    const tmp = indices[i]!
    indices[i] = indices[j]!
    indices[j] = tmp
  }
}

/**
 * Run `totalTicks` of flowchart visits over `runtime.playspaces`.
 * Existing timers advance before each tick's visit attempts.
 * Calls `onVisit` for every successful visit; if it returns `true`, the run stops early.
 * Gift payout runs in `onLeave` using actual camped ticks; any still-pending gifts flush at exit.
 */
export function runFlowchartSim(
  runtime: FlowchartSimRuntime,
  opts: FlowchartSimOptions
): { ticksRun: number; visits: number } {
  const { totalTicks, rand01, onVisit, onLeave, useCooldown = true, playspaceOrder = "shuffled" } = opts
  const weather = runtime.weather ?? "None"
  const playspaceIds: number[] = runtime.playspaces.map((p) => p.playspaceId)
  const sortedVisitOrder = runtime.playspaces
    .map((ps, i) => ({ i, playspaceId: ps.playspaceId }))
    .sort((a, b) => a.playspaceId - b.playspaceId)
    .map((entry) => entry.i)
  const visitOrder = [...sortedVisitOrder]

  let maxCats = 0
  for (const ps of runtime.playspaces) {
    if (ps.catIds.length > maxCats) maxCats = ps.catIds.length
  }
  const scratch = new Array<number>(Math.max(1, maxCats) * 5).fill(0)

  const state = newYardVisitState()
  for (const pid of playspaceIds) state.occupant[pid] = EMPTY_CAT_ID

  const hasOutdoorBowlPlayspace = runtime.playspaces.some(
    (p) => p.isFoodPlayspace && !p.isIndoor && p.itemId === opts.outdoorBowlItemId
  )
  if (isTubbsSimActive(opts.tubbsMode, hasOutdoorBowlPlayspace)) {
    const food = initYardFoodState(opts)
    if (food !== undefined) state.food = food
  }
  const foodActive = state.food !== undefined
  const tubbsMode = foodActive ? opts.tubbsMode : undefined
  const outdoorBowlItemId = foodActive ? opts.outdoorBowlItemId : undefined
  const outdoorBowlDurationTicks = foodActive ? opts.outdoorBowlDurationTicks : undefined
  const indoorBowlDurationTicks = foodActive ? opts.indoorBowlDurationTicks : undefined
  const tubbsCatId = foodActive ? (opts.tubbsCatId ?? 108) : undefined
  const onRefill = foodActive ? opts.onRefill : undefined
  const bowlPlayspaceIds = foodActive
    ? runtime.playspaces
        .filter((p) => p.isFoodPlayspace && !p.isIndoor && p.itemId === outdoorBowlItemId)
        .map((p) => p.playspaceId)
    : undefined

  let visits = 0
  for (let t = 0; t < totalTicks; t++) {
    advanceTick(
      state,
      playspaceIds,
      rand01,
      useCooldown,
      t,
      tubbsMode,
      outdoorBowlItemId,
      outdoorBowlDurationTicks,
      indoorBowlDurationTicks,
      onRefill,
      bowlPlayspaceIds,
      tubbsCatId,
      onLeave
    )
    if (playspaceOrder === "shuffled") shuffleIndicesInPlace(visitOrder, rand01)
    for (let oi = 0; oi < visitOrder.length; oi++) {
      const i = playspaceOrder === "sorted" ? sortedVisitOrder[oi]! : visitOrder[oi]!
      const r = tryVisitOnePlayspace(
        runtime.playspaces[i]!,
        state,
        runtime.byItem,
        runtime.catVsCat,
        runtime.conflictByPlace,
        scratch,
        rand01,
        t,
        weather,
        onVisit,
        onLeave,
        outdoorBowlItemId,
        tubbsCatId,
        tubbsMode,
        useCooldown
      )
      if (r.visited) visits++
      if (r.stop) {
        settleAllPendingGifts(state, onLeave)
        return { ticksRun: t, visits }
      }
    }
  }
  settleAllPendingGifts(state, onLeave)
  return { ticksRun: totalTicks, visits }
}

export { TICKS_PER_DAY }
