/**
 * Mean-field cat/place occupancy solver used by the yard optimizer.
 */
import {
  recordSolverSection,
  yardOptimizerProfilingActive,
  type SolverProfileSection,
} from "../optimizerProfile"
import { CAT_COOLDOWN_TICK_AVG, CAT_STAY_TICK_AVG } from "./constants"

export type InteractionMode = "meanField" | "sampled" | "sampledUnique" | "stateAverage"
export type ReachMode = "shared" | "renormalized" | "componentAware"
export type OpenGateMode = "perPlace" | "componentState"
/** Re-exported here so solver callers can import Tubbs alongside other solver option unions. */
export type { TubbsMode } from "../tubbsMode"

export type SolveCatPlaceOptions = {
  mutualExclusivity?: ReadonlyArray<ReadonlyArray<number>> | null
  catVsCat?: number[][] | null
  itemPlaceGroups?: ReadonlyArray<ReadonlyArray<number>> | null
  conflictAdjacency?: number[][] | null
  stayDuration?: number
  cooldownDuration?: number
  cooldownDurations?: number[]
  interactionMode?: InteractionMode
  reachMode?: ReachMode
  openGateMode?: OpenGateMode
  interactionSamples?: number
  interactionTopCats?: number
  interactionSeed?: number
  maxIterations?: number
  convergenceThreshold?: number
  dampingFactor?: number
  /**
   * Per outer MF iteration: `solveComponentForTargetOccupancy` inner loop for each conflict
   * component. Defaults match historical Full-tier behavior (80 / 1e-12 / 0.7).
   */
  componentInnerMaxIterations?: number
  componentInnerTolerance?: number
  componentInnerDamping?: number
  verbose?: boolean
}

export type SolveCatPlaceResult = {
  placeOccupancy: Record<string, number>
  betaValues: number[][]
  drawProbabilities: number[][]
  attemptProbabilities: number[][]
  scaledAttemptProbabilities: number[][]
  interactionValues: number[][]
  iterations: number
  converged: boolean
  maxDelta: number
  alphaValues: number[]
  piValues: number[]
  componentOccupancy: number[]
  componentOpenChance: number[]
  placeToComponent: number[]
  cooldownDuration: number
  stayDuration: number
}

type ComponentSpec = {
  places: number[]
  stateMasks: number[]
  maskToState: Map<number, number>
  occupancy: number[][]
  conflictMasks: number[]
  fullRemainingMask: number
}

type ComponentSummary = {
  distribution: number[]
  transitionMatrix: number[][]
  placeOccupancy: number[]
  placeOpenChance: number[]
  placeFills: number[]
  openByState: number[][]
  qLocal?: number[]
}

function isCliqueComponent(spec: ComponentSpec): boolean {
  const n = spec.places.length
  return spec.stateMasks.length === n + 1
}

function zeros2D(rows: number, cols: number): number[][] {
  return Array.from({ length: rows }, () => new Array(cols).fill(0))
}

function clip(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}

function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = a.length
  const m = a[0]!.length
  if (n !== m || b.length !== n) return null
  const aug: number[][] = a.map((row, i) => [...row, b[i]!])

  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(aug[r]![col]!) > Math.abs(aug[pivot]![col]!)) pivot = r
    }
    if (Math.abs(aug[pivot]![col]!) < 1e-14) return null
    if (pivot !== col) {
      ;[aug[col], aug[pivot]] = [aug[pivot]!, aug[col]!]
    }
    const div = aug[col]![col]!
    for (let j = col; j <= n; j++) aug[col]![j]! /= div
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = aug[r]![col]!
      if (f === 0) continue
      for (let j = col; j <= n; j++) aug[r]![j]! -= f * aug[col]![j]!
    }
  }

  return aug.map((row) => row[n]!)
}

function buildConflictComponents(
  numPlaces: number,
  mutualExclusivity: ReadonlyArray<ReadonlyArray<number>> | null | undefined,
  conflictAdjacency: number[][] | null | undefined
): {
  components: number[][]
  placeToComponent: number[]
  combinedAdj: boolean[][]
} {
  const combinedAdj: boolean[][] = Array.from({ length: numPlaces }, () =>
    new Array(numPlaces).fill(false)
  )

  if (conflictAdjacency) {
    if (
      conflictAdjacency.length !== numPlaces ||
      conflictAdjacency[0]!.length !== numPlaces
    ) {
      throw new Error(
        `conflictAdjacency must be ${numPlaces}x${numPlaces}, got ${conflictAdjacency.length}x${conflictAdjacency[0]?.length}`
      )
    }
    for (let i = 0; i < numPlaces; i++) {
      for (let j = 0; j < numPlaces; j++) {
        if (conflictAdjacency[i]![j]! > 0) combinedAdj[i]![j] = true
      }
    }
  }

  if (mutualExclusivity?.length) {
    for (const group of mutualExclusivity) {
      const groupList = [...new Set(group.map((idx) => idx | 0))].sort((a, b) => a - b)
      for (const idx of groupList) {
        if (idx < 0 || idx >= numPlaces) {
          throw new Error(`mutual exclusivity place index ${idx} out of range [0, ${numPlaces})`)
        }
      }
      for (let i = 0; i < groupList.length; i++) {
        const left = groupList[i]!
        for (let j = i + 1; j < groupList.length; j++) {
          const right = groupList[j]!
          combinedAdj[left]![right] = true
          combinedAdj[right]![left] = true
        }
      }
    }
  }

  for (let i = 0; i < numPlaces; i++) combinedAdj[i]![i] = false
  for (let i = 0; i < numPlaces; i++) {
    for (let j = 0; j < numPlaces; j++) {
      if (combinedAdj[i]![j]) combinedAdj[j]![i] = true
    }
  }

  const visited = new Array(numPlaces).fill(false)
  const components: number[][] = []
  for (let start = 0; start < numPlaces; start++) {
    if (visited[start]) continue
    const queue = [start]
    visited[start] = true
    const comp: number[] = []
    while (queue.length) {
      const node = queue.pop()!
      comp.push(node)
      for (let nxt = 0; nxt < numPlaces; nxt++) {
        if (combinedAdj[node]![nxt] && !visited[nxt]) {
          visited[nxt] = true
          queue.push(nxt)
        }
      }
    }
    components.push(comp.sort((a, b) => a - b))
  }
  components.sort((a, b) => a[0]! - b[0]!)

  const placeToComponent = new Array(numPlaces).fill(0)
  for (let ci = 0; ci < components.length; ci++) {
    for (const p of components[ci]!) placeToComponent[p] = ci
  }

  return { components, placeToComponent, combinedAdj }
}

function enumerateIndependentStateMasks(localAdj: boolean[][]): number[] {
  const n = localAdj.length
  if (n > 30) throw new Error(`conflict component size ${n} exceeds 30 (JS bitwise)`)
  const masks: number[] = []
  const neighborMasks = new Array(n).fill(0)
  for (let idx = 0; idx < n; idx++) {
    let bits = 0
    for (let other = 0; other < n; other++) {
      if (localAdj[idx]![other]) bits |= 1 << other
    }
    neighborMasks[idx] = bits
  }
  const total = 1 << n
  for (let mask = 0; mask < total; mask++) {
    let valid = true
    for (let idx = 0; idx < n; idx++) {
      if (((mask >> idx) & 1) === 0) continue
      if (mask & neighborMasks[idx]!) {
        valid = false
        break
      }
    }
    if (valid) masks.push(mask)
  }
  return masks
}

function buildComponentSpecs(
  components: number[][],
  combinedAdj: boolean[][]
): ComponentSpec[] {
  return components.map((places) => {
    const n = places.length
    const localAdj: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false))
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        localAdj[i]![j] = combinedAdj[places[i]!]![places[j]!]!
      }
    }
    const stateMasks = enumerateIndependentStateMasks(localAdj)
    const maskToState = new Map<number, number>()
    stateMasks.forEach((m, idx) => maskToState.set(m, idx))

    const occupancy: number[][] = Array.from({ length: stateMasks.length }, () =>
      new Array(n).fill(0)
    )
    const conflictMasks = new Array(n).fill(0)
    for (let localIdx = 0; localIdx < n; localIdx++) {
      let bits = 0
      for (let other = 0; other < n; other++) {
        if (localAdj[localIdx]![other]) bits |= 1 << other
      }
      conflictMasks[localIdx] = bits
      for (let si = 0; si < stateMasks.length; si++) {
        occupancy[si]![localIdx] = (stateMasks[si]! >> localIdx) & 1
      }
    }

    return {
      places,
      stateMasks,
      maskToState,
      occupancy,
      conflictMasks,
      fullRemainingMask: (1 << n) - 1,
    }
  })
}

function summarizeShuffledBirthProcess(
  baseMask: number,
  qLocal: number[],
  spec: ComponentSpec
): [number[], number[], number[]] {
  const masks = spec.stateMasks
  const maskToState = spec.maskToState
  const conflictMasks = spec.conflictMasks
  const nPlaces = spec.places.length
  const memo = new Map<string, [number[], number[], number[]]>()

  function rec(mask: number, remainingMask: number): [number[], number[], number[]] {
    const key = `${mask},${remainingMask}`
    const hit = memo.get(key)
    if (hit) return hit

    if (remainingMask === 0) {
      const outDist = new Array(masks.length).fill(0)
      outDist[maskToState.get(mask)!] = 1
      const outOpen = new Array(nPlaces).fill(0)
      const outFill = new Array(nPlaces).fill(0)
      memo.set(key, [outDist, outOpen, outFill])
      return [outDist, outOpen, outFill]
    }

    const outDist = new Array(masks.length).fill(0)
    const outOpen = new Array(nPlaces).fill(0)
    const outFill = new Array(nPlaces).fill(0)
    const remainingIndices: number[] = []
    for (let i = 0; i < nPlaces; i++) {
      if ((remainingMask >> i) & 1) remainingIndices.push(i)
    }
    const choiceWeight = 1 / remainingIndices.length

    for (const localIdx of remainingIndices) {
      const bit = 1 << localIdx
      const nextRemaining = remainingMask & ~bit
      const blocked =
        (mask & bit) !== 0 || (mask & conflictMasks[localIdx]!) !== 0
      if (blocked) {
        const [sd, sr, sf] = rec(mask, nextRemaining)
        for (let i = 0; i < masks.length; i++) outDist[i] += choiceWeight * sd[i]!
        for (let i = 0; i < nPlaces; i++) {
          outOpen[i] += choiceWeight * sr[i]!
          outFill[i] += choiceWeight * sf[i]!
        }
        continue
      }

      const q = clip(qLocal[localIdx]!, 0, 1)
      outOpen[localIdx] += choiceWeight

      const [stayDist, stayOpen, stayFill] = rec(mask, nextRemaining)
      for (let i = 0; i < masks.length; i++) outDist[i] += choiceWeight * (1 - q) * stayDist[i]!
      for (let i = 0; i < nPlaces; i++) {
        outOpen[i] += choiceWeight * (1 - q) * stayOpen[i]!
        outFill[i] += choiceWeight * (1 - q) * stayFill[i]!
      }

      const enterMask = mask | bit
      const [enterDist, enterOpen, enterFill] = rec(enterMask, nextRemaining)
      for (let i = 0; i < masks.length; i++) outDist[i] += choiceWeight * q * enterDist[i]!
      for (let i = 0; i < nPlaces; i++) {
        outOpen[i] += choiceWeight * q * enterOpen[i]!
        outFill[i] += choiceWeight * q * enterFill[i]!
      }
      outFill[localIdx] += choiceWeight * q
    }

    memo.set(key, [outDist, outOpen, outFill])
    return [outDist, outOpen, outFill]
  }

  return rec(baseMask, spec.fullRemainingMask)
}

function departureDistribution(
  mask: number,
  stayDuration: number,
  nPlaces: number
): Map<number, number> {
  const leaveProb = 1 / stayDuration
  let depDist = new Map<number, number>([[0, 1]])
  for (let localIdx = 0; localIdx < nPlaces; localIdx++) {
    if (((mask >> localIdx) & 1) === 0) continue
    const bit = 1 << localIdx
    const nextDep = new Map<number, number>()
    for (const [depMask, prob] of depDist) {
      const m1 = depMask | bit
      nextDep.set(m1, (nextDep.get(m1) ?? 0) + prob * (1 - leaveProb))
      nextDep.set(depMask, (nextDep.get(depMask) ?? 0) + prob * leaveProb)
    }
    depDist = nextDep
  }
  return depDist
}

function buildSummaryFromDistribution(
  distribution: number[],
  transitionMatrix: number[][],
  openByState: number[][],
  fillByState: number[][],
  spec: ComponentSpec
): Omit<ComponentSummary, "qLocal"> {
  const nStates = distribution.length
  const nPlaces = spec.places.length
  const placeOccupancy = new Array(nPlaces).fill(0)
  const placeOpenChance = new Array(nPlaces).fill(0)
  const placeFills = new Array(nPlaces).fill(0)
  for (let p = 0; p < nPlaces; p++) {
    for (let s = 0; s < nStates; s++) {
      placeOccupancy[p] += distribution[s]! * spec.occupancy[s]![p]!
      placeOpenChance[p] += distribution[s]! * openByState[s]![p]!
      placeFills[p] += distribution[s]! * fillByState[s]![p]!
    }
  }
  return {
    distribution,
    transitionMatrix,
    placeOccupancy,
    placeOpenChance,
    placeFills,
    openByState,
  }
}

function componentStepSummary(
  qLocal: number[],
  stayDuration: number,
  spec: ComponentSpec
): [number[][], number[][], number[][]] {
  const nStates = spec.stateMasks.length
  const nPlaces = spec.places.length
  const tmat = zeros2D(nStates, nStates)
  const openByState = zeros2D(nStates, nPlaces)
  const fillByState = zeros2D(nStates, nPlaces)
  for (let stateIdx = 0; stateIdx < nStates; stateIdx++) {
    const mask = spec.stateMasks[stateIdx]!
    const depDist = departureDistribution(mask, stayDuration, nPlaces)
    for (const [depMask, depProb] of depDist) {
      const [birthDist, openProb, fillProb] = summarizeShuffledBirthProcess(
        depMask,
        qLocal,
        spec
      )
      for (let j = 0; j < nStates; j++) tmat[stateIdx]![j]! += depProb * birthDist[j]!
      for (let p = 0; p < nPlaces; p++) {
        openByState[stateIdx]![p]! += depProb * openProb[p]!
        fillByState[stateIdx]![p]! += depProb * fillProb[p]!
      }
    }
  }
  return [tmat, openByState, fillByState]
}

function componentSummary(
  qLocal: number[],
  stayDuration: number,
  spec: ComponentSpec,
  start: number[] | null,
  tol = 1e-13,
  maxIterations = 2000
): ComponentSummary {
  const [tmat, openByState, fillByState] = componentStepSummary(
    qLocal,
    stayDuration,
    spec
  )
  const nStates = tmat.length
  let dist: number[]
  try {
    const system = zeros2D(nStates, nStates)
    for (let i = 0; i < nStates; i++) {
      for (let j = 0; j < nStates; j++) {
        system[i]![j] = tmat[j]![i]! - (i === j ? 1 : 0)
      }
    }
    for (let j = 0; j < nStates; j++) system[nStates - 1]![j] = 1
    const rhs = new Array(nStates).fill(0)
    rhs[nStates - 1] = 1
    const solved = solveLinearSystem(system, rhs)
    if (!solved) throw new Error("singular")
    dist = solved.map((x) => Math.max(0, x))
    const total = dist.reduce((a, b) => a + b, 0)
    if (total <= 0) throw new Error("degenerate")
    dist = dist.map((x) => x / total)
  } catch {
    if (!start || start.length !== nStates) {
      dist = new Array(nStates).fill(0)
      dist[spec.maskToState.get(0)!] = 1
    } else {
      dist = [...start]
      let tot = dist.reduce((a, b) => a + b, 0)
      if (tot <= 0) {
        dist = new Array(nStates).fill(0)
        dist[spec.maskToState.get(0)!] = 1
        tot = 1
      } else {
        dist = dist.map((x) => x / tot)
      }
    }
    for (let _ = 0; _ < maxIterations; _++) {
      const nextDist = new Array(nStates).fill(0)
      for (let j = 0; j < nStates; j++) {
        for (let i = 0; i < nStates; i++) nextDist[j]! += dist[i]! * tmat[i]![j]!
      }
      let maxAbs = 0
      for (let i = 0; i < nStates; i++)
        maxAbs = Math.max(maxAbs, Math.abs(nextDist[i]! - dist[i]!))
      if (maxAbs < tol) {
        dist = nextDist
        break
      }
      dist = nextDist
    }
  }

  const placeOccupancy = new Array(spec.places.length).fill(0)
  const placeOpenChance = new Array(spec.places.length).fill(0)
  const placeFills = new Array(spec.places.length).fill(0)
  for (let p = 0; p < spec.places.length; p++) {
    for (let s = 0; s < nStates; s++) {
      placeOccupancy[p]! += dist[s]! * spec.occupancy[s]![p]!
      placeOpenChance[p]! += dist[s]! * openByState[s]![p]!
      placeFills[p]! += dist[s]! * fillByState[s]![p]!
    }
  }

  return {
    distribution: dist,
    transitionMatrix: tmat,
    placeOccupancy,
    placeOpenChance,
    placeFills,
    openByState,
  }
}

function residualStateMask(state: number[]): number {
  let mask = 0
  for (let i = 0; i < state.length; i++) {
    if (state[i]! > 0) mask |= 1 << i
  }
  return mask
}

function enumerateResidualStates(stayTicks: number, spec: ComponentSpec): number[][] {
  const out: number[][] = []
  const cur = new Array(spec.places.length).fill(0)
  const maxResidual = Math.max(0, stayTicks - 1)

  function rec(localIdx: number, mask: number): void {
    if (localIdx === spec.places.length) {
      out.push(cur.slice())
      return
    }

    cur[localIdx] = 0
    rec(localIdx + 1, mask)

    if (maxResidual <= 0) return
    const bit = 1 << localIdx
    if (mask & spec.conflictMasks[localIdx]!) return
    for (let r = 1; r <= maxResidual; r++) {
      cur[localIdx] = r
      rec(localIdx + 1, mask | bit)
    }
    cur[localIdx] = 0
  }

  rec(0, 0)
  return out
}

function componentResidualSummary(
  qLocal: number[],
  stayTicks: number,
  spec: ComponentSpec
): ComponentSummary {
  const residualStates = enumerateResidualStates(stayTicks, spec)
  const stateIndex = new Map(residualStates.map((s, i) => [s.join(","), i]))
  const nStates = residualStates.length
  const nPlaces = spec.places.length
  const tmat = zeros2D(nStates, nStates)
  const openReward = zeros2D(nStates, nPlaces)
  const fillReward = zeros2D(nStates, nPlaces)
  const occupancyReward = zeros2D(nStates, nPlaces)

  function addTransition(
    fromIdx: number,
    prob: number,
    tempState: number[],
    openAcc: number[],
    fillAcc: number[]
  ): void {
    const next = tempState.map((r) => Math.max(0, r - 1))
    const nextIdx = stateIndex.get(next.join(","))
    if (nextIdx == null) throw new Error("missing residual component state")
    tmat[fromIdx]![nextIdx]! += prob
    for (let p = 0; p < nPlaces; p++) {
      openReward[fromIdx]![p]! += prob * openAcc[p]!
      fillReward[fromIdx]![p]! += prob * fillAcc[p]!
      occupancyReward[fromIdx]![p]! += prob * (tempState[p]! > 0 ? 1 : 0)
    }
  }

  function recSweep(
    fromIdx: number,
    tempState: number[],
    remainingMask: number,
    prob: number,
    openAcc: number[],
    fillAcc: number[]
  ): void {
    if (remainingMask === 0) {
      addTransition(fromIdx, prob, tempState, openAcc, fillAcc)
      return
    }

    const remainingIndices: number[] = []
    for (let i = 0; i < nPlaces; i++) {
      if ((remainingMask >> i) & 1) remainingIndices.push(i)
    }
    const choiceWeight = 1 / remainingIndices.length
    const currentMask = residualStateMask(tempState)

    for (const localIdx of remainingIndices) {
      const bit = 1 << localIdx
      const nextRemaining = remainingMask & ~bit
      const blocked =
        (currentMask & bit) !== 0 || (currentMask & spec.conflictMasks[localIdx]!) !== 0
      if (blocked) {
        recSweep(fromIdx, tempState, nextRemaining, prob * choiceWeight, openAcc, fillAcc)
        continue
      }

      const q = clip(qLocal[localIdx]!, 0, 1)
      const openNext = openAcc.slice()
      openNext[localIdx]! += 1

      if (q < 1) {
        recSweep(
          fromIdx,
          tempState,
          nextRemaining,
          prob * choiceWeight * (1 - q),
          openNext,
          fillAcc
        )
      }
      if (q <= 0) continue

      const filledState = tempState.slice()
      filledState[localIdx] = stayTicks
      const fillNext = fillAcc.slice()
      fillNext[localIdx]! += 1
      recSweep(
        fromIdx,
        filledState,
        nextRemaining,
        prob * choiceWeight * q,
        openNext,
        fillNext
      )
    }
  }

  for (let stateIdx = 0; stateIdx < nStates; stateIdx++) {
    recSweep(
      stateIdx,
      residualStates[stateIdx]!.slice(),
      spec.fullRemainingMask,
      1,
      new Array(nPlaces).fill(0),
      new Array(nPlaces).fill(0)
    )
  }

  const system = zeros2D(nStates, nStates)
  for (let i = 0; i < nStates; i++) {
    for (let j = 0; j < nStates; j++) {
      system[i]![j] = tmat[j]![i]! - (i === j ? 1 : 0)
    }
  }
  for (let j = 0; j < nStates; j++) system[nStates - 1]![j] = 1
  const rhs = new Array(nStates).fill(0)
  rhs[nStates - 1] = 1
  const solved = solveLinearSystem(system, rhs)
  let residualDist = solved?.map((x) => Math.max(0, x))
  if (!residualDist) {
    residualDist = new Array(nStates).fill(0)
    residualDist[stateIndex.get(new Array(nPlaces).fill(0).join(","))!] = 1
    for (let iter = 0; iter < 2000; iter++) {
      const next = new Array(nStates).fill(0)
      for (let i = 0; i < nStates; i++) {
        for (let j = 0; j < nStates; j++) next[j]! += residualDist[i]! * tmat[i]![j]!
      }
      let delta = 0
      for (let i = 0; i < nStates; i++) delta = Math.max(delta, Math.abs(next[i]! - residualDist[i]!))
      residualDist = next
      if (delta < 1e-13) break
    }
  }
  const total = residualDist.reduce((a, b) => a + b, 0)
  residualDist = total > 0 ? residualDist.map((x) => x / total) : residualDist

  const distribution = new Array(spec.stateMasks.length).fill(0)
  const placeOccupancy = new Array(nPlaces).fill(0)
  const placeOpenChance = new Array(nPlaces).fill(0)
  const placeFills = new Array(nPlaces).fill(0)
  for (let stateIdx = 0; stateIdx < nStates; stateIdx++) {
    const mass = residualDist[stateIdx]!
    if (mass <= 0) continue
    const mask = residualStateMask(residualStates[stateIdx]!)
    distribution[spec.maskToState.get(mask)!] += mass
    for (let p = 0; p < nPlaces; p++) {
      placeOccupancy[p]! += mass * occupancyReward[stateIdx]![p]!
      placeOpenChance[p]! += mass * openReward[stateIdx]![p]!
      placeFills[p]! += mass * fillReward[stateIdx]![p]!
    }
  }

  const openByState = zeros2D(spec.stateMasks.length, nPlaces)
  const fillByState = zeros2D(spec.stateMasks.length, nPlaces)
  for (let stateIdx = 0; stateIdx < nStates; stateIdx++) {
    const maskIdx = spec.maskToState.get(residualStateMask(residualStates[stateIdx]!))!
    const denom = distribution[maskIdx]!
    if (denom <= 1e-12) continue
    const scale = residualDist[stateIdx]! / denom
    for (let p = 0; p < nPlaces; p++) {
      openByState[maskIdx]![p]! += scale * openReward[stateIdx]![p]!
      fillByState[maskIdx]![p]! += scale * fillReward[stateIdx]![p]!
    }
  }

  return {
    distribution,
    transitionMatrix: zeros2D(spec.stateMasks.length, spec.stateMasks.length),
    placeOccupancy,
    placeOpenChance,
    placeFills,
    openByState,
  }
}

function qFromSinglePlaceTarget(piTarget: number, stayDuration: number): number {
  if (piTarget <= 0) return 0
  const denom = stayDuration - piTarget * (stayDuration - 1)
  if (denom <= 0) return 1
  return clip(piTarget / denom, 0, 1)
}

function interactionTerm(
  beta: number[][],
  catVsCat: number[][],
  itemPlaceGroups: ReadonlyArray<ReadonlyArray<number>> | null | undefined
): number[][] {
  const numCats = beta.length
  const numPlaces = beta[0]?.length ?? 0
  const out = zeros2D(numCats, numPlaces)
  if (!itemPlaceGroups?.length) return out
  for (const rawGroup of itemPlaceGroups) {
    const group = [...rawGroup]
    if (group.length <= 1) continue
    const occByCat = new Array(numCats).fill(0)
    for (let c = 0; c < numCats; c++) {
      for (const p of group) occByCat[c]! += beta[c]![p]!
    }
    for (const placeIdx of group) {
      const occExcl = occByCat.map((v, c) => v - beta[c]![placeIdx]!)
      for (let c = 0; c < numCats; c++) {
        let s = 0
        for (let k = 0; k < numCats; k++) s += catVsCat[c]![k]! * occExcl[k]!
        out[c]![placeIdx]! += s
      }
    }
  }
  return out
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function searchsortedRight(cdf: number[], x: number): number {
  let lo = 0
  let hi = cdf.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (x < cdf[mid]!) hi = mid
    else lo = mid + 1
  }
  return lo
}

function sampledSameItemDrawProbabilities(
  weights: number[][],
  beta: number[][],
  catVsCat: number[][],
  itemPlaceGroups: ReadonlyArray<ReadonlyArray<number>> | null | undefined,
  interactionSamples: number,
  interactionSeed: number
): [number[][], number[][]] {
  const numCats = weights.length
  const numPlaces = weights[0]!.length
  const drawProbs = zeros2D(numCats, numPlaces)
  const interactionMean = zeros2D(numCats, numPlaces)
  if (!itemPlaceGroups?.length) {
    for (let p = 0; p < numPlaces; p++) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
    return [drawProbs, interactionMean]
  }

  const covered = new Array(numPlaces).fill(false)
  for (let groupIdx = 0; groupIdx < itemPlaceGroups.length; groupIdx++) {
    const group = [...itemPlaceGroups[groupIdx]!]
    if (group.length === 0) continue
    for (const p of group) covered[p] = true

    if (group.length === 1 || interactionSamples <= 0) {
      for (const placeIdx of group) {
        let s = 0
        for (let c = 0; c < numCats; c++) s += weights[c]![placeIdx]!
        for (let c = 0; c < numCats; c++)
          drawProbs[c]![placeIdx] = s > 0 ? weights[c]![placeIdx]! / s : 0
      }
      continue
    }

    const groupBeta = zeros2D(numCats, group.length)
    for (let c = 0; c < numCats; c++) {
      for (let j = 0; j < group.length; j++) groupBeta[c]![j] = beta[c]![group[j]!]!
    }
    const cdfByPlace = zeros2D(numCats, group.length)
    for (let j = 0; j < group.length; j++) {
      let acc = 0
      for (let c = 0; c < numCats; c++) {
        acc += groupBeta[c]![j]!
        cdfByPlace[c]![j] = acc
      }
    }
    const emptyProb = new Array(group.length)
    for (let j = 0; j < group.length; j++) {
      let colSum = 0
      for (let c = 0; c < numCats; c++) colSum += groupBeta[c]![j]!
      emptyProb[j] = clip(1 - colSum, 0, 1)
    }

    const rng = mulberry32(interactionSeed + 1000003 * groupIdx)
    const uniforms: number[][] = []
    for (let s = 0; s < interactionSamples; s++) {
      const row: number[] = []
      for (let j = 0; j < group.length; j++) row.push(rng())
      uniforms.push(row)
    }

    for (let localIdx = 0; localIdx < group.length; localIdx++) {
      const placeIdx = group[localIdx]!
      const sampledDraw = new Array(numCats).fill(0)
      const sampledInteraction = new Array(numCats).fill(0)
      for (let sampleIdx = 0; sampleIdx < interactionSamples; sampleIdx++) {
        const occupying = new Array(numCats).fill(0)
        for (let otherLocalIdx = 0; otherLocalIdx < group.length; otherLocalIdx++) {
          if (otherLocalIdx === localIdx) continue
          const u = uniforms[sampleIdx]![otherLocalIdx]!
          const placeEmpty = emptyProb[otherLocalIdx]!
          if (u < placeEmpty) continue
          const rem = u - placeEmpty
          const col = otherLocalIdx
          const catDraw = searchsortedRight(
            cdfByPlace.map((row) => row[col]!),
            rem
          )
          if (catDraw >= numCats) continue
          occupying[catDraw] = 1
        }
        const interactionVec = new Array(numCats).fill(0)
        for (let c = 0; c < numCats; c++) {
          let t = 0
          for (let k = 0; k < numCats; k++) t += catVsCat[c]![k]! * occupying[k]!
          interactionVec[c] = t
          sampledInteraction[c]! += t
        }
        const effectiveWeights = new Array(numCats)
        let tw = 0
        for (let c = 0; c < numCats; c++) {
          const mult = clip(100 + interactionVec[c]!, 30, 400) / 100
          effectiveWeights[c] = weights[c]![placeIdx]! * mult
          tw += effectiveWeights[c]!
        }
        if (tw > 0) {
          for (let c = 0; c < numCats; c++) sampledDraw[c]! += effectiveWeights[c]! / tw
        }
      }
      for (let c = 0; c < numCats; c++) {
        drawProbs[c]![placeIdx] = sampledDraw[c]! / interactionSamples
        interactionMean[c]![placeIdx] = sampledInteraction[c]! / interactionSamples
      }
    }
  }

  for (let p = 0; p < numPlaces; p++) {
    if (!covered[p]) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
  }
  return [drawProbs, interactionMean]
}

function sampledUniqueSameItemDrawProbabilities(
  weights: number[][],
  beta: number[][],
  catVsCat: number[][],
  itemPlaceGroups: ReadonlyArray<ReadonlyArray<number>> | null | undefined,
  interactionSamples: number,
  interactionSeed: number
): [number[][], number[][]] {
  const numCats = weights.length
  const numPlaces = weights[0]!.length
  const drawProbs = zeros2D(numCats, numPlaces)
  const interactionMean = zeros2D(numCats, numPlaces)
  if (!itemPlaceGroups?.length) {
    for (let p = 0; p < numPlaces; p++) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
    return [drawProbs, interactionMean]
  }

  const covered = new Array(numPlaces).fill(false)
  for (let groupIdx = 0; groupIdx < itemPlaceGroups.length; groupIdx++) {
    const group = [...itemPlaceGroups[groupIdx]!]
    if (group.length === 0) continue
    for (const p of group) covered[p] = true

    if (group.length === 1 || interactionSamples <= 0) {
      for (const placeIdx of group) {
        let s = 0
        for (let c = 0; c < numCats; c++) s += weights[c]![placeIdx]!
        for (let c = 0; c < numCats; c++)
          drawProbs[c]![placeIdx] = s > 0 ? weights[c]![placeIdx]! / s : 0
      }
      continue
    }

    const groupBeta = zeros2D(numCats, group.length)
    for (let c = 0; c < numCats; c++) {
      for (let j = 0; j < group.length; j++) groupBeta[c]![j] = beta[c]![group[j]!]!
    }
    const occupiedProb = new Array(group.length)
    const emptyProb = new Array(group.length)
    for (let j = 0; j < group.length; j++) {
      let colSum = 0
      for (let c = 0; c < numCats; c++) colSum += groupBeta[c]![j]!
      occupiedProb[j] = clip(colSum, 0, 1)
      emptyProb[j] = 1 - occupiedProb[j]!
    }

    const rng = mulberry32(interactionSeed + 1000003 * groupIdx)
    const uniforms: number[][] = []
    for (let s = 0; s < interactionSamples; s++) {
      const row: number[] = []
      for (let j = 0; j < group.length; j++) row.push(rng())
      uniforms.push(row)
    }

    for (let localIdx = 0; localIdx < group.length; localIdx++) {
      const placeIdx = group[localIdx]!
      const sampledDraw = new Array(numCats).fill(0)
      const sampledInteraction = new Array(numCats).fill(0)
      const siblingIndices = group.map((_, i) => i).filter((i) => i !== localIdx)

      for (let sampleIdx = 0; sampleIdx < interactionSamples; sampleIdx++) {
        const occupying = new Array(numCats).fill(0)
        const used = new Array(numCats).fill(false)
        for (const otherLocalIdx of siblingIndices) {
          const u = uniforms[sampleIdx]![otherLocalIdx]!
          if (u < emptyProb[otherLocalIdx]!) continue

          const catWeights = new Array(numCats)
          let totalCatWeight = 0
          for (let c = 0; c < numCats; c++) {
            const w = used[c]! ? 0 : groupBeta[c]![otherLocalIdx]!
            catWeights[c] = w
            totalCatWeight += w
          }
          if (totalCatWeight <= 0) continue

          let rem =
            (u - emptyProb[otherLocalIdx]!) /
            Math.max(occupiedProb[otherLocalIdx]!, 1e-15)
          rem = clip(rem, 0, 1 - 1e-15)
          const cdf: number[] = []
          let acc = 0
          for (let c = 0; c < numCats; c++) {
            acc += catWeights[c]! / totalCatWeight
            cdf.push(acc)
          }
          const catDraw = searchsortedRight(cdf, rem)
          if (catDraw >= numCats) continue
          occupying[catDraw] = 1
          used[catDraw] = true
        }

        const interactionVec = new Array(numCats).fill(0)
        for (let c = 0; c < numCats; c++) {
          let t = 0
          for (let k = 0; k < numCats; k++) t += catVsCat[c]![k]! * occupying[k]!
          interactionVec[c] = t
          sampledInteraction[c]! += t
        }
        const effectiveWeights: number[] = []
        let tw = 0
        for (let c = 0; c < numCats; c++) {
          const mult = clip(100 + interactionVec[c]!, 30, 400) / 100
          effectiveWeights[c] = weights[c]![placeIdx]! * mult
          tw += effectiveWeights[c]!
        }
        if (tw > 0) {
          for (let c = 0; c < numCats; c++) sampledDraw[c]! += effectiveWeights[c]! / tw
        }
      }
      for (let c = 0; c < numCats; c++) {
        drawProbs[c]![placeIdx] = sampledDraw[c]! / interactionSamples
        interactionMean[c]![placeIdx] = sampledInteraction[c]! / interactionSamples
      }
    }
  }

  for (let p = 0; p < numPlaces; p++) {
    if (!covered[p]) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
  }
  return [drawProbs, interactionMean]
}

function normalizeEffectiveWeights(
  weightsCol: number[],
  interactionVec: number[]
): number[] {
  const n = weightsCol.length
  const out = new Array(n).fill(0)
  let totalWeight = 0
  const effectiveWeights = new Array(n)
  for (let c = 0; c < n; c++) {
    const mult = clip(100 + interactionVec[c]!, 30, 400) / 100
    effectiveWeights[c] = weightsCol[c]! * mult
    totalWeight += effectiveWeights[c]!
  }
  if (totalWeight <= 0) return out
  for (let c = 0; c < n; c++) out[c] = effectiveWeights[c]! / totalWeight
  return out
}

function sumVecCol(mat: number[][], col: number): number {
  let s = 0
  for (let r = 0; r < mat.length; r++) s += mat[r]![col]!
  return s
}

function exactSmallSiblingDrawAverage(
  weightsCol: number[],
  siblingBeta: number[][],
  catVsCat: number[][]
): [number[], number[]] | null {
  const numCats = siblingBeta.length
  const nSiblings = siblingBeta[0]?.length ?? 0
  if (nSiblings === 0) {
    let tw = 0
    for (let c = 0; c < numCats; c++) tw += weightsCol[c]!
    const plain = new Array(numCats).fill(0)
    if (tw > 0) for (let c = 0; c < numCats; c++) plain[c] = weightsCol[c]! / tw
    return [plain, new Array(numCats).fill(0)]
  }

  if (nSiblings === 1) {
    const localPi = clip(sumVecCol(siblingBeta, 0), 0, 1)
    const emptyProb = 1 - localPi
    const weightedDraw = normalizeEffectiveWeights(
      weightsCol,
      new Array(numCats).fill(0)
    ).map((v) => v * emptyProb)
    const weightedInteraction = new Array(numCats).fill(0)
    for (let catIdx = 0; catIdx < numCats; catIdx++) {
      const prob = siblingBeta[catIdx]![0]!
      if (prob <= 0) continue
      const interactionVec = catVsCat.map((row) => row[catIdx]!)
      const nw = normalizeEffectiveWeights(weightsCol, interactionVec)
      for (let c = 0; c < numCats; c++) {
        weightedDraw[c]! += prob * nw[c]!
        weightedInteraction[c]! += prob * interactionVec[c]!
      }
    }
    return [weightedDraw, weightedInteraction]
  }

  if (nSiblings !== 2) return null

  function secondSeatDistribution(
    seatBeta: number[],
    usedCat: number | null
  ): [number, number | null][] {
    let localPi = 0
    for (let c = 0; c < numCats; c++) localPi += seatBeta[c]!
    localPi = clip(localPi, 0, 1)
    const emptyProb = 1 - localPi
    if (usedCat === null) {
      const out: [number, number | null][] = [[emptyProb, null]]
      for (let catIdx = 0; catIdx < numCats; catIdx++) {
        if (seatBeta[catIdx]! > 0) out.push([seatBeta[catIdx]!, catIdx])
      }
      return out
    }
    const usedMass = seatBeta[usedCat]!
    const remainingMass = localPi - usedMass
    if (remainingMass <= 1e-15) return [[1, null]]
    const scale = localPi / remainingMass
    const out: [number, number | null][] = [[emptyProb, null]]
    for (let catIdx = 0; catIdx < numCats; catIdx++) {
      if (catIdx === usedCat) continue
      const catMass = seatBeta[catIdx]!
      if (catMass <= 0) continue
      out.push([catMass * scale, catIdx])
    }
    let total = 0
    for (const [pr] of out) total += pr
    if (total < 1 - 1e-12) out.push([1 - total, null])
    return out
  }

  function orderedAverage(firstIdx: number, secondIdx: number): [number[], number[]] {
    const firstBeta = siblingBeta.map((row) => row[firstIdx]!)
    let firstPi = 0
    for (const v of firstBeta) firstPi += v
    firstPi = clip(firstPi, 0, 1)
    const firstEmpty = 1 - firstPi
    const weightedDraw = new Array(numCats).fill(0)
    const weightedInteraction = new Array(numCats).fill(0)

    const firstChoices: [number, number | null][] = [[firstEmpty, null]]
    for (let catIdx = 0; catIdx < numCats; catIdx++) {
      if (firstBeta[catIdx]! > 0) firstChoices.push([firstBeta[catIdx]!, catIdx])
    }

    for (const [firstProb, firstCat] of firstChoices) {
      if (firstProb <= 0) continue
      const secondBeta = siblingBeta.map((row) => row[secondIdx]!)
      for (const [secondProb, secondCat] of secondSeatDistribution(
        secondBeta,
        firstCat
      )) {
        const prob = firstProb * secondProb
        if (prob <= 0) continue
        const active: number[] = []
        if (firstCat !== null) active.push(firstCat)
        if (secondCat !== null && !active.includes(secondCat)) active.push(secondCat)
        const interactionVec =
          active.length === 0
            ? new Array(numCats).fill(0)
            : active.reduce((acc, catId) => {
                const col = catVsCat.map((row) => row[catId]!)
                return acc.map((v, i) => v + col[i]!)
              }, new Array(numCats).fill(0))
        const nw = normalizeEffectiveWeights(weightsCol, interactionVec)
        for (let c = 0; c < numCats; c++) {
          weightedDraw[c] += prob * nw[c]!
          weightedInteraction[c] += prob * interactionVec[c]!
        }
      }
    }
    return [weightedDraw, weightedInteraction]
  }

  const [fwdD, fwdI] = orderedAverage(0, 1)
  const [revD, revI] = orderedAverage(1, 0)
  const draw = fwdD.map((v, i) => 0.5 * (v + revD[i]!))
  const inter = fwdI.map((v, i) => 0.5 * (v + revI[i]!))
  return [draw, inter]
}

function stateAveragedSameItemDrawProbabilities(
  weights: number[][],
  beta: number[][],
  catVsCat: number[][],
  itemPlaceGroups: ReadonlyArray<ReadonlyArray<number>> | null | undefined,
  maxExplicitCats: number
): [number[][], number[][]] {
  const numCats = weights.length
  const numPlaces = weights[0]!.length
  const drawProbs = zeros2D(numCats, numPlaces)
  const interactionMean = zeros2D(numCats, numPlaces)
  if (!itemPlaceGroups?.length) {
    for (let p = 0; p < numPlaces; p++) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
    return [drawProbs, interactionMean]
  }

  const covered = new Array(numPlaces).fill(false)
  for (const rawGroup of itemPlaceGroups) {
    const group = [...rawGroup]
    if (group.length === 0) continue
    for (const p of group) covered[p] = true

    if (group.length === 1) {
      for (const placeIdx of group) {
        let s = 0
        for (let c = 0; c < numCats; c++) s += weights[c]![placeIdx]!
        for (let c = 0; c < numCats; c++)
          drawProbs[c]![placeIdx] = s > 0 ? weights[c]![placeIdx]! / s : 0
      }
      continue
    }

    for (let localIdx = 0; localIdx < group.length; localIdx++) {
      const placeIdx = group[localIdx]!
      const siblingPlaces = group.filter((p) => p !== placeIdx)
      const maxPresent = siblingPlaces.length
      if (maxPresent === 0) {
        let tw = 0
        for (let c = 0; c < numCats; c++) tw += weights[c]![placeIdx]!
        if (tw > 0) {
          for (let c = 0; c < numCats; c++) drawProbs[c]![placeIdx] = weights[c]![placeIdx]! / tw
        }
        continue
      }

      const siblingBeta = zeros2D(numCats, siblingPlaces.length)
      for (let c = 0; c < numCats; c++) {
        for (let j = 0; j < siblingPlaces.length; j++) siblingBeta[c]![j] = beta[c]![siblingPlaces[j]!]!
      }

      const exact = exactSmallSiblingDrawAverage(
        weights.map((row) => row[placeIdx]!),
        siblingBeta,
        catVsCat
      )
      if (exact !== null) {
        for (let c = 0; c < numCats; c++) {
          drawProbs[c]![placeIdx] = exact[0]![c]!
          interactionMean[c]![placeIdx] = exact[1]![c]!
        }
        continue
      }

      const siblingPi = new Array(siblingPlaces.length)
      for (let j = 0; j < siblingPlaces.length; j++) {
        let s = 0
        for (let c = 0; c < numCats; c++) s += siblingBeta[c]![j]!
        siblingPi[j] = clip(s, 0, 1)
      }
      const siblingEmpty = siblingPi.map((p) => 1 - p)
      const siblingPresence = new Array(numCats).fill(0)
      for (let c = 0; c < numCats; c++) {
        let s = 0
        for (let j = 0; j < siblingPlaces.length; j++) s += siblingBeta[c]![j]!
        siblingPresence[c] = clip(s, 0, 1)
      }
      const explicitOrder = siblingPresence
        .map((p, i) => [p, i] as const)
        .sort((a, b) => b[0] - a[0])
      const explicit: number[] = []
      const explicitSet = new Set<number>()
      for (let k = 0; k < explicitOrder.length && explicit.length < maxExplicitCats; k++) {
        const idx = explicitOrder[k]![1]
        if (siblingPresence[idx]! > 1e-12) {
          explicit.push(idx)
          explicitSet.add(idx)
        }
      }
      const tail: number[] = []
      for (let idx = 0; idx < numCats; idx++) {
        if (!explicitSet.has(idx)) tail.push(idx)
      }
      let tailMean: number[]
      if (tail.length) {
        tailMean = new Array(numCats).fill(0)
        for (let c = 0; c < numCats; c++) {
          let t = 0
          for (const k of tail) t += catVsCat[c]![k]! * siblingPresence[k]!
          tailMean[c] = t
        }
      } else {
        tailMean = new Array(numCats).fill(0)
      }

      if (explicit.length === 0) {
        for (let c = 0; c < numCats; c++) interactionMean[c]![placeIdx] = tailMean[c]!
        const mult = tailMean.map((t) => clip(100 + t, 30, 400) / 100)
        let tw = 0
        const ew = new Array(numCats)
        for (let c = 0; c < numCats; c++) {
          ew[c] = weights[c]![placeIdx]! * mult[c]!
          tw += ew[c]!
        }
        if (tw > 0) {
          for (let c = 0; c < numCats; c++) drawProbs[c]![placeIdx] = ew[c]! / tw
        }
        continue
      }

      const explicitBeta = explicit.map((catIdx) =>
        siblingBeta[catIdx]!.slice()
      )
      const numExplicit = explicit.length
      const stateProb = new Array(1 << numExplicit).fill(0)
      stateProb[0] = 1

      for (let siblingLocalIdx = 0; siblingLocalIdx < siblingPlaces.length; siblingLocalIdx++) {
        const nextStateProb = new Array(1 << numExplicit).fill(0)
        const occupiedProb = siblingPi[siblingLocalIdx]!
        const emptyProb = siblingEmpty[siblingLocalIdx]!
        const explicitCol = explicitBeta.map((row) => row[siblingLocalIdx]!)

        for (let mask = 0; mask < stateProb.length; mask++) {
          const maskProb = stateProb[mask]!
          if (maskProb <= 0) continue
          nextStateProb[mask] += maskProb * emptyProb

          let usedMass = 0
          for (let bitIdx = 0; bitIdx < numExplicit; bitIdx++) {
            if (mask & (1 << bitIdx)) usedMass += explicitCol[bitIdx]!
          }
          const remainingMass = Math.max(occupiedProb - usedMass, 0)
          if (remainingMass <= 1e-15) {
            nextStateProb[mask] += maskProb * occupiedProb
            continue
          }

          const scale = occupiedProb / remainingMass
          let staySameProb = 0
          for (let bitIdx = 0; bitIdx < numExplicit; bitIdx++) {
            if (mask & (1 << bitIdx)) continue
            const catMass = explicitCol[bitIdx]!
            if (catMass <= 0) continue
            nextStateProb[mask | (1 << bitIdx)] += maskProb * catMass * scale
            staySameProb += catMass * scale
          }
          nextStateProb[mask] += maskProb * Math.max(0, occupiedProb - staySameProb)
        }
        for (let i = 0; i < stateProb.length; i++) stateProb[i] = nextStateProb[i]!
      }

      const weightedDraw = new Array(numCats).fill(0)
      const weightedInteractionAcc = new Array(numCats).fill(0)
      let stateProbSum = 0
      for (let mask = 0; mask < stateProb.length; mask++) {
        const prob = stateProb[mask]!
        if (prob <= 0) continue
        const active: number[] = []
        for (let bitIdx = 0; bitIdx < explicit.length; bitIdx++) {
          if (mask & (1 << bitIdx)) active.push(explicit[bitIdx]!)
        }
        const interactionVec = tailMean.slice()
        for (const catIdx of active) {
          for (let c = 0; c < numCats; c++) interactionVec[c]! += catVsCat[c]![catIdx]!
        }
        const ew: number[] = []
        let tw = 0
        for (let c = 0; c < numCats; c++) {
          const mult = clip(100 + interactionVec[c]!, 30, 400) / 100
          ew[c] = weights[c]![placeIdx]! * mult
          tw += ew[c]!
        }
        if (tw <= 0) continue
        stateProbSum += prob
        for (let c = 0; c < numCats; c++) {
          weightedDraw[c]! += prob * (ew[c]! / tw)
          weightedInteractionAcc[c]! += prob * interactionVec[c]!
        }
      }
      if (stateProbSum > 0) {
        for (let c = 0; c < numCats; c++) {
          drawProbs[c]![placeIdx] = weightedDraw[c]! / stateProbSum
          interactionMean[c]![placeIdx] = weightedInteractionAcc[c]! / stateProbSum
        }
      } else {
        let tw = 0
        for (let c = 0; c < numCats; c++) tw += weights[c]![placeIdx]!
        if (tw > 0) {
          for (let c = 0; c < numCats; c++) drawProbs[c]![placeIdx] = weights[c]![placeIdx]! / tw
        }
      }
    }
  }

  for (let p = 0; p < numPlaces; p++) {
    if (!covered[p]) {
      let s = 0
      for (let c = 0; c < numCats; c++) s += weights[c]![p]!
      for (let c = 0; c < numCats; c++) drawProbs[c]![p] = s > 0 ? weights[c]![p]! / s : 0
    }
  }
  return [drawProbs, interactionMean]
}

function shuffledRowWinProbabilities(
  baseSuccess: number[],
  nonblockingMask: boolean[][]
): number[] {
  const numPlaces = baseSuccess.length
  const success = baseSuccess.map((s) => clip(s, 0, 1))
  const out = new Array(numPlaces).fill(0)
  if (numPlaces === 0) return out

  let fullCoeff: number[] = [1]
  for (const s of success) {
    if (s <= 0) continue
    const next = new Array(fullCoeff.length + 1).fill(0)
    for (let i = 0; i < fullCoeff.length; i++) {
      next[i]! += fullCoeff[i]!
      next[i + 1]! -= s * fullCoeff[i]!
    }
    fullCoeff = next
  }

  const reciprocal = fullCoeff.map((_, k) => 1 / (k + 1))
  const blockedByPlace: number[][] = []
  for (let p = 0; p < numPlaces; p++) {
    const bl: number[] = []
    for (let j = 0; j < numPlaces; j++) {
      if (!nonblockingMask[p]![j]) bl.push(j)
    }
    blockedByPlace.push(bl)
  }

  for (let placeIdx = 0; placeIdx < numPlaces; placeIdx++) {
    const ownSuccess = success[placeIdx]!
    if (ownSuccess <= 0) continue
    let coeff = fullCoeff.slice()
    for (const blockedIdx of blockedByPlace[placeIdx]!) {
      const blockedSuccess = success[blockedIdx]!
      if (blockedSuccess <= 0) continue
      const reduced = new Array(coeff.length - 1)
      reduced[0] = coeff[0]!
      for (let degree = 1; degree < reduced.length; degree++) {
        reduced[degree] = coeff[degree]! + blockedSuccess * reduced[degree - 1]!
      }
      coeff = reduced
    }
    let integral = 0
    for (let i = 0; i < coeff.length; i++) integral += coeff[i]! * reciprocal[i]!
    out[placeIdx] = ownSuccess * Math.max(0, integral)
  }
  return out
}

function allCompeteMask(n: number): boolean[][] {
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_unused, j) => i !== j)
  )
}

function multiplyPolynomials(a: number[], b: number[]): number[] {
  const out = new Array(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!
    if (ai === 0) continue
    for (let j = 0; j < b.length; j++) out[i + j]! += ai * b[j]!
  }
  return out
}

function addScaledPolynomial(target: number[], source: number[], scale: number): number[] {
  while (target.length < source.length) target.push(0)
  for (let i = 0; i < source.length; i++) target[i]! += scale * source[i]!
  return target
}

function integratePolynomial(coeff: number[]): number {
  let out = 0
  for (let degree = 0; degree < coeff.length; degree++) {
    out += coeff[degree]! / (degree + 1)
  }
  return out
}

function successPolynomial(success: number[], skipIdx: number | null = null): number[] {
  let poly = [1]
  for (let idx = 0; idx < success.length; idx++) {
    if (idx === skipIdx) continue
    const s = clip(success[idx]!, 0, 1)
    poly = multiplyPolynomials(poly, [1 - s, s])
  }
  return poly
}

function componentStateRowWinProbabilities(
  drawVisit: number[],
  components: number[][],
  componentSpecs: ComponentSpec[],
  componentStateProbs: (number[] | null)[],
  placeOccupancy: number[],
  catOccupancy: number[],
  componentOpenByState: (number[][] | null)[] | null = null
): number[] {
  const numPlaces = drawVisit.length
  const out = new Array(numPlaces).fill(0)
  const componentAllPolys: number[][] = []
  const componentWinPolys: number[][][] = []

  for (let componentIdx = 0; componentIdx < components.length; componentIdx++) {
    const places = components[componentIdx]!
    const spec = componentSpecs[componentIdx]!
    const dist = componentStateProbs[componentIdx]
    const allPoly: number[] = []
    const winPolys = places.map(() => [] as number[])
    const stateProbs = new Array(spec.stateMasks.length).fill(0)

    if (dist == null) {
      for (let stateIdx = 0; stateIdx < spec.stateMasks.length; stateIdx++) {
        stateProbs[stateIdx] = spec.stateMasks[stateIdx] === 0 ? 1 : 0
      }
    } else if (!isCliqueComponent(spec)) {
      // Non-clique components: skip per-cat conditioning on the state mask. The
      // mean-field joint "one cat → one place" constraint doesn't cleanly
      // factor across multi-bit masks (sum overshoots ≥1, product over-
      // corrects). The cat-conditional `attempt` value already carries the
      // dominant correction; leaving non-clique states unconditioned costs
      // ~0.2% on V-shape topologies but is the cleanest safe default.
      for (let stateIdx = 0; stateIdx < spec.stateMasks.length; stateIdx++) {
        stateProbs[stateIdx] = dist[stateIdx] ?? 0
      }
    } else {
      // Clique component: each state mask has ≤ 1 bit, so "c not at the
      // occupied place" is exactly `1 - β_cp / π_p` by mean-field assignment.
      let total = 0
      for (let stateIdx = 0; stateIdx < spec.stateMasks.length; stateIdx++) {
        const stateMask = spec.stateMasks[stateIdx]!
        let catInState = 0
        for (let localIdx = 0; localIdx < places.length; localIdx++) {
          if (((stateMask >> localIdx) & 1) === 0) continue
          const placeIdx = places[localIdx]!
          const pi = placeOccupancy[placeIdx]!
          if (pi > 1e-12) catInState += catOccupancy[placeIdx]! / pi
        }
        const stateProb = (dist[stateIdx] ?? 0) * clip(1 - catInState, 0, 1)
        stateProbs[stateIdx] = stateProb
        total += stateProb
      }
      if (total > 1e-12) {
        for (let stateIdx = 0; stateIdx < stateProbs.length; stateIdx++) {
          stateProbs[stateIdx]! /= total
        }
      } else {
        stateProbs.fill(0)
        stateProbs[spec.maskToState.get(0)!] = 1
      }
    }

    const openByState = componentOpenByState?.[componentIdx] ?? null

    for (let stateIdx = 0; stateIdx < spec.stateMasks.length; stateIdx++) {
      const stateProb = stateProbs[stateIdx]!
      if (stateProb <= 0) continue

      const stateMask = spec.stateMasks[stateIdx]!
      const localSuccess = new Array(places.length).fill(0)
      for (let localIdx = 0; localIdx < places.length; localIdx++) {
        const placeIdx = places[localIdx]!
        if (openByState) {
          // `openByState[s][p]` is `Pr(p available for visit during this tick |
          // start-of-tick state = s)` from the component summary. This already
          // includes the `1/stay` mid-tick "occupant leaves" contribution, so a
          // place that's "blocked" at start-of-tick still gets partial credit.
          // Using the binary blocked check instead under-counts attempts by
          // ~`π_p / stay_ticks`, which is the residual gap we observed when
          // turning on `componentState` mode on production yards.
          const openProb = openByState[stateIdx]?.[localIdx] ?? 0
          localSuccess[localIdx] = clip(openProb * drawVisit[placeIdx]!, 0, 1)
        } else {
          const blockedMask = (1 << localIdx) | spec.conflictMasks[localIdx]!
          if (stateMask & blockedMask) continue
          localSuccess[localIdx] = clip(drawVisit[placeIdx]!, 0, 1)
        }
      }

      addScaledPolynomial(allPoly, successPolynomial(localSuccess), stateProb)
      for (let localIdx = 0; localIdx < places.length; localIdx++) {
        const success = localSuccess[localIdx]!
        if (success <= 0) continue
        addScaledPolynomial(
          winPolys[localIdx]!,
          successPolynomial(localSuccess, localIdx),
          stateProb * success
        )
      }
    }

    componentAllPolys.push(allPoly.length ? allPoly : [1])
    componentWinPolys.push(winPolys)
  }

  const prefix: number[][] = [[1]]
  for (let i = 0; i < componentAllPolys.length; i++) {
    prefix.push(multiplyPolynomials(prefix[i]!, componentAllPolys[i]!))
  }
  const suffix: number[][] = new Array(componentAllPolys.length + 1)
  suffix[componentAllPolys.length] = [1]
  for (let i = componentAllPolys.length - 1; i >= 0; i--) {
    suffix[i] = multiplyPolynomials(componentAllPolys[i]!, suffix[i + 1]!)
  }

  for (let componentIdx = 0; componentIdx < components.length; componentIdx++) {
    const outside = multiplyPolynomials(prefix[componentIdx]!, suffix[componentIdx + 1]!)
    const places = components[componentIdx]!
    const winPolys = componentWinPolys[componentIdx]!
    for (let localIdx = 0; localIdx < places.length; localIdx++) {
      const winPoly = winPolys[localIdx]!
      if (!winPoly.length) continue
      out[places[localIdx]!] = integratePolynomial(multiplyPolynomials(winPoly, outside))
    }
  }

  return out
}

function closedFormSinglePlaceComponentSummary(
  targetPi: number[],
  stayDuration: number,
  spec: ComponentSpec
): ComponentSummary & { qLocal: number[] } {
  const pi = clip(targetPi[0]!, 0, 1)
  const qLocal = [qFromSinglePlaceTarget(pi, stayDuration)]
  const leaveProb = 1 / stayDuration
  const nStates = spec.stateMasks.length
  const distribution = new Array(nStates).fill(0)
  distribution[spec.maskToState.get(0)!] = 1 - pi
  distribution[spec.maskToState.get(1)!] = pi

  const transitionMatrix = zeros2D(nStates, nStates)
  const e0 = spec.maskToState.get(0)!
  const e1 = spec.maskToState.get(1)!
  transitionMatrix[e0]![e0] = 1 - qLocal[0]!
  transitionMatrix[e0]![e1] = qLocal[0]!
  transitionMatrix[e1]![e0] = leaveProb * (1 - qLocal[0]!)
  transitionMatrix[e1]![e1] = 1 - transitionMatrix[e1]![e0]!

  const openByState = zeros2D(nStates, 1)
  const fillByState = zeros2D(nStates, 1)
  openByState[e0]![0] = 1
  openByState[e1]![0] = leaveProb
  fillByState[e0]![0] = qLocal[0]!
  fillByState[e1]![0] = leaveProb * qLocal[0]!

  const summary = buildSummaryFromDistribution(
    distribution,
    transitionMatrix,
    openByState,
    fillByState,
    spec
  )
  return { ...summary, qLocal }
}

function closedFormPairComponentSummary(
  targetPi: number[],
  stayDuration: number,
  spec: ComponentSpec
): ComponentSummary & { qLocal: number[] } {
  const rawPiA = Math.max(0, targetPi[0]!)
  const rawPiB = Math.max(0, targetPi[1]!)
  const rawTotal = rawPiA + rawPiB
  let piA: number
  let piB: number
  if (rawTotal > 1) {
    const scale = 1 / rawTotal
    piA = rawPiA * scale
    piB = rawPiB * scale
  } else {
    piA = rawPiA
    piB = rawPiB
  }
  const totalOcc = piA + piB
  const leaveProb = 1 / stayDuration
  const nStates = spec.stateMasks.length

  if (totalOcc <= 0) {
    const qLocal = [0, 0]
    const distribution = new Array(nStates).fill(0)
    distribution[spec.maskToState.get(0)!] = 1
    const transitionMatrix = zeros2D(nStates, nStates)
    transitionMatrix[spec.maskToState.get(0)!]![spec.maskToState.get(0)!] = 1
    const openByState = zeros2D(nStates, 2)
    for (let s = 0; s < nStates; s++) {
      openByState[s]![0] = 1
      openByState[s]![1] = 1
    }
    openByState[spec.maskToState.get(1)!] = [0, 0]
    openByState[spec.maskToState.get(2)!] = [0, 0]
    const fillByState = zeros2D(nStates, 2)
    const summary = buildSummaryFromDistribution(
      distribution,
      transitionMatrix,
      openByState,
      fillByState,
      spec
    )
    return { ...summary, qLocal }
  }

  const totalFill = qFromSinglePlaceTarget(totalOcc, stayDuration)
  const winA = totalFill * (piA / totalOcc)
  const winB = totalFill * (piB / totalOcc)
  const delta = winA - winB
  const sumQ = 2 - Math.sqrt(Math.max(0, 4 * (1 - totalFill) + delta * delta))
  const qA = clip(0.5 * (sumQ + delta), 0, 1)
  const qB = clip(0.5 * (sumQ - delta), 0, 1)
  const qLocal = [qA, qB]

  const distribution = new Array(nStates).fill(0)
  distribution[spec.maskToState.get(0)!] = 1 - totalOcc
  distribution[spec.maskToState.get(1)!] = piA
  distribution[spec.maskToState.get(2)!] = piB

  const emptyToA = qA * (1 - 0.5 * qB)
  const emptyToB = qB * (1 - 0.5 * qA)
  const emptyToEmpty = 1 - emptyToA - emptyToB

  const transitionMatrix = zeros2D(nStates, nStates)
  const maskEmpty = spec.maskToState.get(0)!
  const maskA = spec.maskToState.get(1)!
  const maskB = spec.maskToState.get(2)!
  transitionMatrix[maskEmpty]![maskEmpty] = emptyToEmpty
  transitionMatrix[maskEmpty]![maskA] = emptyToA
  transitionMatrix[maskEmpty]![maskB] = emptyToB
  transitionMatrix[maskA]![maskEmpty] = leaveProb * emptyToEmpty
  transitionMatrix[maskA]![maskA] = 1 - leaveProb + leaveProb * emptyToA
  transitionMatrix[maskA]![maskB] = leaveProb * emptyToB
  transitionMatrix[maskB]![maskEmpty] = leaveProb * emptyToEmpty
  transitionMatrix[maskB]![maskA] = leaveProb * emptyToA
  transitionMatrix[maskB]![maskB] = 1 - leaveProb + leaveProb * emptyToB

  const openFromEmpty = [1 - 0.5 * qB, 1 - 0.5 * qA]
  const fillFromEmpty = [emptyToA, emptyToB]
  const openByState = zeros2D(nStates, 2)
  const fillByState = zeros2D(nStates, 2)
  openByState[maskEmpty] = [...openFromEmpty]
  openByState[maskA] = openFromEmpty.map((v) => leaveProb * v)
  openByState[maskB] = openFromEmpty.map((v) => leaveProb * v)
  fillByState[maskEmpty] = [...fillFromEmpty]
  fillByState[maskA] = fillFromEmpty.map((v) => leaveProb * v)
  fillByState[maskB] = fillFromEmpty.map((v) => leaveProb * v)

  const summary = buildSummaryFromDistribution(
    distribution,
    transitionMatrix,
    openByState,
    fillByState,
    spec
  )
  return { ...summary, qLocal }
}

function closedFormComponentSummary(
  targetPi: number[],
  stayDuration: number,
  spec: ComponentSpec
): (ComponentSummary & { qLocal: number[] }) | null {
  const nPlaces = spec.places.length
  if (nPlaces === 1) return closedFormSinglePlaceComponentSummary(targetPi, stayDuration, spec)
  if (Number.isInteger(stayDuration) && stayDuration >= 1) return null
  if (nPlaces === 2 && spec.stateMasks.length === 3)
    return closedFormPairComponentSummary(targetPi, stayDuration, spec)
  return null
}

function solveComponentForTargetOccupancyGeneric(
  targetPi: number[],
  stayDuration: number,
  spec: ComponentSpec,
  startQ: number[] | null,
  startDistribution: number[] | null,
  tol: number,
  maxIterations: number,
  damping: number
): ComponentSummary & { qLocal: number[] } {
  const nPlaces = spec.places.length
  let qLocal =
    startQ && startQ.length === nPlaces
      ? startQ.map((q) => clip(q, 0, 1))
      : targetPi.map((tp) => qFromSinglePlaceTarget(Number(tp), stayDuration))

  let distStart: number[] | null = startDistribution
  let summary: (ComponentSummary & { qLocal: number[] }) | null = null

  for (let _ = 0; _ < maxIterations; _++) {
    const inner =
      Number.isInteger(stayDuration) && stayDuration >= 1
        ? componentResidualSummary(qLocal, stayDuration, spec)
        : componentSummary(qLocal, stayDuration, spec, distStart)
    summary = { ...inner, qLocal }
    distStart = summary.distribution
    let maxErr = 0
    for (let idx = 0; idx < nPlaces; idx++) {
      maxErr = Math.max(
        maxErr,
        Math.abs(summary.placeOccupancy[idx]! - targetPi[idx]!)
      )
    }
    if (maxErr < tol) break

    const updatedQ = qLocal.slice()
    for (let idx = 0; idx < nPlaces; idx++) {
      const target = targetPi[idx]!
      const current = summary.placeOccupancy[idx]!
      if (target <= 0) {
        updatedQ[idx] = 0
        continue
      }
      if (current <= 0) {
        updatedQ[idx] = qFromSinglePlaceTarget(target, stayDuration)
        continue
      }
      updatedQ[idx] = clip((qLocal[idx]! * target) / current, 0, 1)
    }
    qLocal = qLocal.map((q, i) => q * (1 - damping) + updatedQ[i]! * damping)
  }

  return summary as ComponentSummary & { qLocal: number[] }
}

function solveComponentForTargetOccupancy(
  targetPi: number[],
  stayDuration: number,
  spec: ComponentSpec,
  startQ: number[] | null,
  startDistribution: number[] | null,
  tol = 1e-12,
  maxIterations = 80,
  damping = 0.7
): ComponentSummary & { qLocal: number[] } {
  const closed = closedFormComponentSummary(targetPi, stayDuration, spec)
  if (closed) return closed
  return solveComponentForTargetOccupancyGeneric(
    targetPi,
    stayDuration,
    spec,
    startQ,
    startDistribution,
    tol,
    maxIterations,
    damping
  )
}

type ExactPhaseCorrection = {
  beta: number[][]
  visitStarts: number[][]
  gateOpen: number[]
  gateSelect: number[][]
  alpha: number[]
}

function indexPermutations(n: number): number[][] {
  const out: number[][] = []
  const used = new Array(n).fill(false)
  const cur: number[] = []
  function rec(): void {
    if (cur.length === n) {
      out.push(cur.slice())
      return
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue
      used[i] = true
      cur.push(i)
      rec()
      cur.pop()
      used[i] = false
    }
  }
  rec()
  return out
}

function cooldownStateKey(cooldowns: number[]): string {
  return cooldowns.join(",")
}

/**
 * Exact semi-Markov solve for an isolated all-conflicting component.
 * States are the empty-component cooldown vector; each transition is one
 * shuffled placement tick with no visit, or a whole occupied stay phase after
 * the first accepted visit. This mirrors the simulator order directly.
 */
function solveIsolatedCliquePhase(
  draw: number[][],
  visit: number[][],
  stayDuration: number,
  cooldowns: number[],
  maxIterations = 5000,
  tolerance = 1e-12
): ExactPhaseCorrection | null {
  const nCats = draw.length
  const nPlaces = draw[0]?.length ?? 0
  if (nCats === 0 || nPlaces === 0) return null
  const stay = Math.max(1, Math.round(stayDuration))
  const cds = cooldowns.map((x) => Math.max(0, Math.round(x)))
  const stateCount = cds.reduce((acc, cd) => acc * (cd + 1), 1)
  const orders = indexPermutations(nPlaces)
  if (stateCount > 50000 || orders.length > 5040) return null

  const states: number[][] = []
  const stateIndex = new Map<string, number>()
  function enumerateState(idx: number, current: number[]): void {
    if (idx === cds.length) {
      stateIndex.set(cooldownStateKey(current), states.length)
      states.push(current.slice())
      return
    }
    for (let cd = 0; cd <= cds[idx]!; cd++) {
      current.push(cd)
      enumerateState(idx + 1, current)
      current.pop()
    }
  }
  enumerateState(0, [])

  type Outcome = {
    next: number
    prob: number
    duration: number
    betaReward: number[][]
    visitReward: number[][]
    gateOpenReward: number[]
    gateSelectReward: number[][]
  }

  const zeroReward = () => zeros2D(nCats, nPlaces)
  const transitions: Outcome[][] = states.map((state) => {
    const byNext = new Map<number, Outcome>()

    function addOutcome(
      nextCds: number[],
      prob: number,
      duration: number,
      betaReward: number[][],
      visitReward: number[][],
      gateOpenReward: number[],
      gateSelectReward: number[][]
    ): void {
      if (prob <= 0) return
      const next = stateIndex.get(cooldownStateKey(nextCds))!
      let out = byNext.get(next)
      if (!out) {
        out = {
          next,
          prob: 0,
          duration: 0,
          betaReward: zeroReward(),
          visitReward: zeroReward(),
          gateOpenReward: new Array(nPlaces).fill(0),
          gateSelectReward: zeroReward(),
        }
        byNext.set(next, out)
      }
      out.prob += prob
      out.duration += prob * duration
      for (let c = 0; c < nCats; c++) {
        for (let p = 0; p < nPlaces; p++) {
          out.betaReward[c]![p]! += prob * betaReward[c]![p]!
          out.visitReward[c]![p]! += prob * visitReward[c]![p]!
          out.gateSelectReward[c]![p]! += prob * gateSelectReward[c]![p]!
        }
      }
      for (let p = 0; p < nPlaces; p++) {
        out.gateOpenReward[p]! += prob * gateOpenReward[p]!
      }
    }

    for (const order of orders) {
      const orderProb = 1 / orders.length
      function rec(
        pos: number,
        prob: number,
        gateOpenReward: number[],
        gateSelectReward: number[][]
      ): void {
        if (pos >= order.length) {
          addOutcome(
            state.map((cd) => Math.max(0, cd - 1)),
            orderProb * prob,
            1,
            zeroReward(),
            zeroReward(),
            gateOpenReward,
            gateSelectReward
          )
          return
        }

        const placeIdx = order[pos]!
        const nextGateOpen = gateOpenReward.slice()
        nextGateOpen[placeIdx]! += 1
        let drawMass = 0
        for (let catIdx = 0; catIdx < nCats; catIdx++) {
          const drawProb = clip(draw[catIdx]![placeIdx]!, 0, 1)
          if (drawProb <= 0) continue
          drawMass += drawProb
          const nextGateSelect = gateSelectReward.map((row) => row.slice())
          nextGateSelect[catIdx]![placeIdx]! += 1
          const available = state[catIdx]! <= 0
          if (!available) {
            rec(pos + 1, prob * drawProb, nextGateOpen, nextGateSelect)
            continue
          }
          const visitProb = clip(visit[catIdx]![placeIdx]!, 0, 1)
          if (visitProb < 1) {
            rec(pos + 1, prob * drawProb * (1 - visitProb), nextGateOpen, nextGateSelect)
          }
          if (visitProb <= 0) continue

          const betaReward = zeroReward()
          const visitReward = zeroReward()
          betaReward[catIdx]![placeIdx] = stay
          visitReward[catIdx]![placeIdx] = 1
          const nextCds = state.map((cd, idx) =>
            idx === catIdx ? cds[idx]! : Math.max(0, cd - stay)
          )
          addOutcome(
            nextCds,
            orderProb * prob * drawProb * visitProb,
            stay,
            betaReward,
            visitReward,
            nextGateOpen,
            nextGateSelect
          )
        }
        const noDrawProb = Math.max(0, 1 - drawMass)
        if (noDrawProb > 0) {
          rec(pos + 1, prob * noDrawProb, nextGateOpen, gateSelectReward)
        }
      }
      rec(0, 1, new Array(nPlaces).fill(0), zeroReward())
    }

    return [...byNext.values()].map((out) => {
      const inv = out.prob > 0 ? 1 / out.prob : 0
      return {
        ...out,
        duration: out.duration * inv,
        betaReward: out.betaReward.map((row) => row.map((x) => x * inv)),
        visitReward: out.visitReward.map((row) => row.map((x) => x * inv)),
        gateOpenReward: out.gateOpenReward.map((x) => x * inv),
        gateSelectReward: out.gateSelectReward.map((row) => row.map((x) => x * inv)),
      }
    })
  })

  let dist = new Array(states.length).fill(0)
  dist[stateIndex.get(cooldownStateKey(new Array(nCats).fill(0)))!] = 1
  for (let iter = 0; iter < maxIterations; iter++) {
    const next = new Array(states.length).fill(0)
    for (let stateIdx = 0; stateIdx < states.length; stateIdx++) {
      const mass = dist[stateIdx]!
      if (mass <= 0) continue
      for (const out of transitions[stateIdx]!) next[out.next]! += mass * out.prob
    }
    let delta = 0
    for (let i = 0; i < states.length; i++) delta = Math.max(delta, Math.abs(next[i]! - dist[i]!))
    dist = next
    if (delta < tolerance) break
  }

  const betaReward = zeroReward()
  const visitReward = zeroReward()
  const gateSelectReward = zeroReward()
  const gateOpenReward = new Array(nPlaces).fill(0)
  let durationReward = 0
  for (let stateIdx = 0; stateIdx < states.length; stateIdx++) {
    const mass = dist[stateIdx]!
    if (mass <= 0) continue
    for (const out of transitions[stateIdx]!) {
      const prob = mass * out.prob
      durationReward += prob * out.duration
      for (let c = 0; c < nCats; c++) {
        for (let p = 0; p < nPlaces; p++) {
          betaReward[c]![p]! += prob * out.betaReward[c]![p]!
          visitReward[c]![p]! += prob * out.visitReward[c]![p]!
          gateSelectReward[c]![p]! += prob * out.gateSelectReward[c]![p]!
        }
      }
      for (let p = 0; p < nPlaces; p++) gateOpenReward[p]! += prob * out.gateOpenReward[p]!
    }
  }
  const invDuration = durationReward > 0 ? 1 / durationReward : 0
  const beta = betaReward.map((row) => row.map((x) => x * invDuration))
  const visitStarts = visitReward.map((row) => row.map((x) => x * invDuration))
  const gateSelect = gateSelectReward.map((row) => row.map((x) => x * invDuration))
  const gateOpen = gateOpenReward.map((x) => x * invDuration)
  const alpha = new Array(nCats).fill(0)
  for (let c = 0; c < nCats; c++) {
    let occ = 0
    let visits = 0
    for (let p = 0; p < nPlaces; p++) {
      occ += beta[c]![p]!
      visits += visitStarts[c]![p]!
    }
    alpha[c] = clip(1 - occ - cds[c]! * visits, 0, 1)
  }

  return { beta, visitStarts, gateOpen, gateSelect, alpha }
}

/** Mean-field solve for cat/place occupancy. */
export function solveCatPlaceSystem(
  catPlaceWeights: number[][],
  catPlaceVisitProbs: number[][],
  placeNames: string[],
  options: SolveCatPlaceOptions = {}
): SolveCatPlaceResult {
  const {
    mutualExclusivity = null,
    catVsCat = null,
    itemPlaceGroups = null,
    conflictAdjacency = null,
    stayDuration = CAT_STAY_TICK_AVG,
    cooldownDuration = CAT_COOLDOWN_TICK_AVG,
    cooldownDurations,
    interactionMode = "meanField",
    reachMode: requestedReachMode = "componentAware",
    openGateMode: requestedOpenGateMode = "perPlace",
    interactionSamples = 32,
    interactionTopCats = 6,
    interactionSeed = 0,
    maxIterations = 2000,
    convergenceThreshold = 1e-8,
    dampingFactor: requestedDampingFactor,
    componentInnerMaxIterations = 80,
    componentInnerTolerance = 1e-12,
    componentInnerDamping = 0.7,
    verbose = false,
  } = options

  const weights = catPlaceWeights
  const visitProbs = catPlaceVisitProbs
  const reachMode = requestedReachMode
  const openGateMode = requestedOpenGateMode

  if (weights.length !== visitProbs.length || weights[0]?.length !== visitProbs[0]?.length) {
    throw new Error("Weights and visit probabilities must have the same shape")
  }
  if (!weights.length || !weights[0]?.length) {
    const numCats = weights.length
    const numPlaces = weights[0]?.length ?? 0
    const empty = zeros2D(numCats, numPlaces)
    return {
      placeOccupancy: {},
      betaValues: empty,
      drawProbabilities: empty.map((row) => [...row]),
      attemptProbabilities: empty.map((row) => [...row]),
      scaledAttemptProbabilities: empty.map((row) => [...row]),
      interactionValues: empty.map((row) => [...row]),
      iterations: 0,
      converged: true,
      maxDelta: 0,
      alphaValues: new Array(numCats).fill(1),
      piValues: new Array(numPlaces).fill(0),
      componentOccupancy: [],
      componentOpenChance: new Array(numPlaces).fill(1),
      placeToComponent: [],
      cooldownDuration,
      stayDuration,
    }
  }

  const numCats = weights.length
  const numPlaces = weights[0]!.length
  if (placeNames.length !== numPlaces) {
    throw new Error(`Expected ${numPlaces} place names, got ${placeNames.length}`)
  }
  if (stayDuration <= 0) throw new Error("stay_duration must be positive")
  if (cooldownDuration < 0) throw new Error("cooldownDuration cannot be negative")
  const cooldownDurationsArr =
    cooldownDurations == null
      ? new Array(numCats).fill(cooldownDuration)
      : cooldownDurations.slice()
  if (cooldownDurationsArr.length !== numCats) {
    throw new Error(`cooldownDurations must have length ${numCats}`)
  }
  for (const cd of cooldownDurationsArr) {
    if (cd < 0) throw new Error("cooldownDurations cannot contain negative values")
  }
  const representativeCooldownDuration =
    cooldownDurationsArr.reduce((a, b) => a + b, 0) / Math.max(1, numCats)
  // Default damping:
  //   - 0.2 for `componentState` open gate (it iterates a state polynomial that
  //     can oscillate at higher damping).
  //   - 0.5 elsewhere, including `componentAware` reach in `perPlace` mode.
  //     Empirically converges in ~30 iters across a range of yards with the same
  //     fixed point d=0.2 reaches in ~80 iters (≈2.5× wall-time win, identical
  //     accuracy). See `reachAudit/solverVsSim.bench.parity.test.ts`.
  const dampingFactor =
    requestedDampingFactor ??
    (openGateMode === "componentState" ? 0.2 : 0.5)
  if (dampingFactor <= 0 || dampingFactor > 1) {
    throw new Error("dampingFactor must be in (0, 1]")
  }

  const modes: InteractionMode[] = ["meanField", "sampled", "sampledUnique", "stateAverage"]
  if (!modes.includes(interactionMode)) {
    throw new Error(
      "interactionMode must be 'meanField', 'sampled', 'sampledUnique', or 'stateAverage'"
    )
  }
  const rModes: ReachMode[] = ["shared", "renormalized", "componentAware"]
  if (!rModes.includes(reachMode)) {
    throw new Error("reachMode must be 'shared', 'renormalized', or 'componentAware'")
  }
  const openGateModes: OpenGateMode[] = ["perPlace", "componentState"]
  if (!openGateModes.includes(openGateMode)) {
    throw new Error(
      "openGateMode must be 'perPlace' or 'componentState'"
    )
  }
  let catVsCatArr: number[][]
  if (!catVsCat) catVsCatArr = zeros2D(numCats, numCats)
  else {
    if (catVsCat.length !== numCats || catVsCat[0]!.length !== numCats) {
      throw new Error(`catVsCat must be ${numCats}x${numCats}`)
    }
    catVsCatArr = catVsCat
  }

  const { components, placeToComponent, combinedAdj } = buildConflictComponents(
    numPlaces,
    mutualExclusivity,
    conflictAdjacency
  )
  const componentSpecs = buildComponentSpecs(components, combinedAdj)

  const rowCompetitorMask: boolean[][] = []
  for (let p = 0; p < numPlaces; p++) {
    const row: boolean[] = []
    for (let q = 0; q < numPlaces; q++) row.push(p !== q)
    rowCompetitorMask.push(row)
  }

  let beta = zeros2D(numCats, numPlaces)
  let drawProbs = zeros2D(numCats, numPlaces)
  let attemptProbs = zeros2D(numCats, numPlaces)
  let scaledAttemptProbs = zeros2D(numCats, numPlaces)
  let componentOccupancy = new Array(components.length).fill(0)
  let componentOpenChance = new Array(numPlaces).fill(1)
  let maxDelta = Infinity
  let interaction = zeros2D(numCats, numPlaces)
  const cooldownRatios = cooldownDurationsArr.map((cd) => cd / stayDuration)
  let alpha = new Array(numCats).fill(1)
  const componentStateProbs: (number[] | null)[] = componentSpecs.map(() => null)
  const componentQValues: (number[] | null)[] = componentSpecs.map(() => null)
  // `componentOpenByState[i][stateIdx][localPlace]` = `Pr(place open during this
  // tick | start-state = stateIdx)`. Synced to the damped β alongside
  // `componentStateProbs` so `componentStateRowWinProbabilities` can give
  // mid-tick leave-events partial credit instead of treating occupied states as
  // hard zeros.
  const componentOpenByState: (number[][] | null)[] = componentSpecs.map(() => null)

  let iteration = 0
  for (; iteration < maxIterations; iteration++) {
    const prof = yardOptimizerProfilingActive()
    let tMark = prof ? performance.now() : 0
    const mark = (section: SolverProfileSection) => {
      if (!prof) return
      const n = performance.now()
      recordSolverSection(section, n - tMark)
      tMark = n
    }

    let drawProbsRaw: number[][]
    if (interactionMode === "sampled") {
      ;[drawProbsRaw, interaction] = sampledSameItemDrawProbabilities(
        weights,
        beta,
        catVsCatArr,
        itemPlaceGroups,
        interactionSamples,
        interactionSeed
      )
    } else if (interactionMode === "sampledUnique") {
      ;[drawProbsRaw, interaction] = sampledUniqueSameItemDrawProbabilities(
        weights,
        beta,
        catVsCatArr,
        itemPlaceGroups,
        interactionSamples,
        interactionSeed
      )
    } else if (interactionMode === "stateAverage") {
      ;[drawProbsRaw, interaction] = stateAveragedSameItemDrawProbabilities(
        weights,
        beta,
        catVsCatArr,
        itemPlaceGroups,
        interactionTopCats
      )
    } else {
      interaction = interactionTerm(beta, catVsCatArr, itemPlaceGroups)
      drawProbsRaw = zeros2D(numCats, numPlaces)
      for (let p = 0; p < numPlaces; p++) {
        let s = 0
        const ew: number[] = []
        for (let c = 0; c < numCats; c++) {
          const mult = clip(100 + interaction[c]![p]!, 30, 400) / 100
          ew[c] = weights[c]![p]! * mult
          s += ew[c]!
        }
        for (let c = 0; c < numCats; c++) drawProbsRaw[c]![p] = s > 0 ? ew[c]! / s : 0
      }
    }

    mark("interactionDraw")

    const betaBlocker = zeros2D(numCats, numPlaces)
    if (reachMode !== "shared") {
      for (let c = 0; c < numCats; c++) {
        for (let p = 0; p < numPlaces; p++) {
          let s = beta[c]![p]!
          for (let k = 0; k < numPlaces; k++) {
            if (combinedAdj[p]![k]) s += beta[c]![k]!
          }
          betaBlocker[c]![p] = s
        }
      }
    }

    const renormalizedOpenChance = zeros2D(numCats, numPlaces)
    for (let c = 0; c < numCats; c++) {
      for (let p = 0; p < numPlaces; p++) {
        const componentSpec = componentSpecs[placeToComponent[p]!]!
        // The renewal row wants the open hazard conditional on this cat not
        // already blocking the target. Singleton and clique components have a
        // single empty state for every row, so this conditioning is exact for
        // the component-level blocker set. Non-clique components keep the
        // shared state projection so distinct open masks are not collapsed.
        const useRenormalizedReach =
          reachMode === "renormalized" ||
          (reachMode === "componentAware" &&
            (componentSpec.places.length === 1 ||
              cooldownDurationsArr[c]! <= 1e-12 ||
              (openGateMode === "componentState" && isCliqueComponent(componentSpec))))
        if (!useRenormalizedReach) {
          renormalizedOpenChance[c]![p] = componentOpenChance[p]!
          continue
        }
        const denom = 1 - clip(betaBlocker[c]![p]!, 0, 1 - 1e-12)
        renormalizedOpenChance[c]![p] =
          denom > 1e-12 ? componentOpenChance[p]! / denom : componentOpenChance[p]!
        renormalizedOpenChance[c]![p] = clip(renormalizedOpenChance[c]![p]!, 0, 1)
      }
    }

    const catConditionedOpenChance = renormalizedOpenChance

    mark("openGate")

    const attemptProbsRaw = zeros2D(numCats, numPlaces)
    for (let c = 0; c < numCats; c++) {
      for (let p = 0; p < numPlaces; p++) {
        attemptProbsRaw[c]![p] =
          catConditionedOpenChance[c]![p]! * drawProbsRaw[c]![p]! * visitProbs[c]![p]!
      }
    }

    const placeOccupancyCurrent = new Array(numPlaces).fill(0)
    for (let p = 0; p < numPlaces; p++) {
      for (let c = 0; c < numCats; c++) placeOccupancyCurrent[p]! += beta[c]![p]!
    }

    const betaRaw = zeros2D(numCats, numPlaces)
    const perCatWinProbs = zeros2D(numCats, numPlaces)
    for (let catIdx = 0; catIdx < numCats; catIdx++) {
      const rowBase = attemptProbsRaw[catIdx]!
      const rowWins =
        openGateMode === "componentState"
          ? componentStateRowWinProbabilities(
              rowBase.map((v, placeIdx) =>
                catConditionedOpenChance[catIdx]![placeIdx]! > 1e-12
                  ? v / catConditionedOpenChance[catIdx]![placeIdx]!
                  : 0
              ),
              components,
              componentSpecs,
              componentStateProbs,
              placeOccupancyCurrent,
              beta[catIdx]!,
              componentOpenByState
            )
          : shuffledRowWinProbabilities(rowBase, rowCompetitorMask)
      // Note: `componentOpenByState` is plumbed below into the componentState
      // branch to give mid-tick "occupant leaves" partial credit.
      let totalRowWin = 0
      for (const w of rowWins) totalRowWin += w
      if (totalRowWin <= 0) continue
      const trw = Math.min(totalRowWin, 1 - 1e-15)
      const cd = cooldownDurationsArr[catIdx]!
      const totalOcc =
        (trw * stayDuration) / (1 - trw + trw * (stayDuration + cd))
      for (let p = 0; p < numPlaces; p++) perCatWinProbs[catIdx]![p] = rowWins[p]!
      for (let p = 0; p < numPlaces; p++) {
        betaRaw[catIdx]![p] = rowWins[p]! * (totalOcc / trw)
      }
    }

    mark("attemptWinDemand")

    const betaDemand = betaRaw.map((row) => row.slice())
    const piTarget = new Array(numPlaces).fill(0)
    for (let p = 0; p < numPlaces; p++) {
      for (let c = 0; c < numCats; c++) piTarget[p]! += betaDemand[c]![p]!
    }
    const placeOccupancyRaw = new Array(numPlaces).fill(0)
    const componentOccupancyRaw = new Array(components.length).fill(0)
    const componentOpenChanceRaw = new Array(numPlaces).fill(0)

    for (let componentIdx = 0; componentIdx < componentSpecs.length; componentIdx++) {
      const spec = componentSpecs[componentIdx]!
      const places = spec.places
      const localTarget = places.map((pl) => piTarget[pl]!)
      const compSum = solveComponentForTargetOccupancy(
        localTarget,
        stayDuration,
        spec,
        componentQValues[componentIdx],
        componentStateProbs[componentIdx],
        componentInnerTolerance,
        componentInnerMaxIterations,
        componentInnerDamping
      )
      componentStateProbs[componentIdx] = compSum.distribution
      componentQValues[componentIdx] = compSum.qLocal
      let co = 0
      for (const po of compSum.placeOccupancy) co += po
      componentOccupancyRaw[componentIdx] = co
      for (let i = 0; i < places.length; i++) {
        placeOccupancyRaw[places[i]!] = compSum.placeOccupancy[i]!
        componentOpenChanceRaw[places[i]!] = compSum.placeOpenChance[i]!
      }
    }

    mark("solveComponents")

    const share = zeros2D(numCats, numPlaces)
    for (let p = 0; p < numPlaces; p++) {
      let colSum = 0
      for (let c = 0; c < numCats; c++) colSum += betaDemand[c]![p]!
      for (let c = 0; c < numCats; c++) {
        share[c]![p] = colSum > 0 ? betaDemand[c]![p]! / colSum : 0
      }
    }

    const betaRaw2 = zeros2D(numCats, numPlaces)
    for (let c = 0; c < numCats; c++) {
      for (let p = 0; p < numPlaces; p++) {
        betaRaw2[c]![p] = share[c]![p]! * placeOccupancyRaw[p]!
      }
    }

    const alphaRaw = new Array(numCats).fill(0)
    for (let c = 0; c < numCats; c++) {
      let rowSum = 0
      for (let p = 0; p < numPlaces; p++) rowSum += betaRaw2[c]![p]!
      alphaRaw[c] = clip(1 - (1 + cooldownRatios[c]!) * rowSum, 0, 1)
    }

    const betaNew = zeros2D(numCats, numPlaces)
    const alphaNew = new Array(numCats).fill(0)
    const componentOpenChanceNew = new Array(numPlaces).fill(0)
    for (let c = 0; c < numCats; c++) {
      for (let p = 0; p < numPlaces; p++) {
        betaNew[c]![p] =
          beta[c]![p]! * (1 - dampingFactor) + betaRaw2[c]![p]! * dampingFactor
      }
    }
    for (let c = 0; c < numCats; c++) {
      let rowSum = 0
      for (let p = 0; p < numPlaces; p++) rowSum += betaNew[c]![p]!
      alphaNew[c] = clip(1 - (1 + cooldownRatios[c]!) * rowSum, 0, 1)
    }
    for (let p = 0; p < numPlaces; p++) {
      componentOpenChanceNew[p] =
        componentOpenChance[p]! * (1 - dampingFactor) + componentOpenChanceRaw[p]! * dampingFactor
    }

    maxDelta = 0
    for (let c = 0; c < numCats; c++) {
      for (let p = 0; p < numPlaces; p++) {
        maxDelta = Math.max(maxDelta, Math.abs(betaNew[c]![p]! - beta[c]![p]!))
      }
      maxDelta = Math.max(maxDelta, Math.abs(alphaNew[c]! - alpha[c]!))
    }
    for (let p = 0; p < numPlaces; p++) {
      maxDelta = Math.max(maxDelta, Math.abs(componentOpenChanceNew[p]! - componentOpenChance[p]!))
    }

    beta = betaNew
    alpha = alphaNew
    drawProbs = drawProbsRaw
    attemptProbs = attemptProbsRaw
    scaledAttemptProbs = perCatWinProbs
    componentOccupancy = componentOccupancyRaw
    componentOpenChance = componentOpenChanceNew

    // `componentState` open-gate mode reads `componentStateProbs` next iteration
    // and conditions on "cat c not in this component's state" using the *current*
    // β. If the stored state distribution still reflects the pre-damping target
    // (`piTarget = Σ βRaw`) it will be out of sync with the damped β marginals
    // (`placeOccupancyCurrent = Σ β`), and the normalization in the clique
    // correction `dist[1] · (1 − β_cp/π_p)` no longer collapses to `1 − β_cp`.
    // That mismatch produces a stable limit cycle with `maxDelta` pinned at the
    // damping size. Re-solve each component on the damped β marginals so the
    // state distribution lines up with what the next iteration will read.
    if (openGateMode === "componentState") {
      const dampedPi = new Array(numPlaces).fill(0)
      for (let p = 0; p < numPlaces; p++) {
        for (let c = 0; c < numCats; c++) dampedPi[p]! += beta[c]![p]!
      }
      for (let componentIdx = 0; componentIdx < componentSpecs.length; componentIdx++) {
        const spec = componentSpecs[componentIdx]!
        const places = spec.places
        const localTarget = places.map((pl) => dampedPi[pl]!)
        const resync = solveComponentForTargetOccupancy(
          localTarget,
          stayDuration,
          spec,
          componentQValues[componentIdx],
          componentStateProbs[componentIdx],
          componentInnerTolerance,
          componentInnerMaxIterations,
          componentInnerDamping
        )
        componentStateProbs[componentIdx] = resync.distribution
        componentQValues[componentIdx] = resync.qLocal
        componentOpenByState[componentIdx] = resync.openByState
      }
    }

    if (verbose && (iteration % 100 === 0 || maxDelta < convergenceThreshold)) {
      let placeMax = 0
      for (let p = 0; p < numPlaces; p++) {
        let s = 0
        for (let c = 0; c < numCats; c++) s += beta[c]![p]!
        placeMax = Math.max(placeMax, s)
      }
      let catMax = 0
      for (let c = 0; c < numCats; c++) {
        let s = 0
        for (let p = 0; p < numPlaces; p++) s += beta[c]![p]!
        catMax = Math.max(catMax, s)
      }
      console.log(
        "iteration",
        iteration,
        "maxDelta",
        maxDelta,
        "place_max",
        placeMax,
        "cat_max",
        catMax
      )
    }

    if (maxDelta < convergenceThreshold) break
  }

  const pi = new Array(numPlaces).fill(0)
  if (
    reachMode === "componentAware" &&
    Number.isInteger(stayDuration) &&
    !itemPlaceGroups?.length &&
    catVsCatArr.every((row) => row.every((x) => Math.abs(x) < 1e-12))
  ) {
    for (let componentIdx = 0; componentIdx < components.length; componentIdx++) {
      const places = components[componentIdx]!
      const spec = componentSpecs[componentIdx]!
      const isCliqueComponent = places.length > 1 && spec.stateMasks.length === places.length + 1
      if (!isCliqueComponent) continue
      const placeSet = new Set(places)

      const activeCats: number[] = []
      for (let c = 0; c < numCats; c++) {
        let inComponent = false
        let outsideComponent = false
        for (let p = 0; p < numPlaces; p++) {
          if (weights[c]![p]! <= 0) continue
          if (placeSet.has(p)) inComponent = true
          else outsideComponent = true
        }
        if (inComponent && outsideComponent) {
          activeCats.length = 0
          break
        }
        if (inComponent) activeCats.push(c)
      }
      if (activeCats.length === 0) continue
      if (!activeCats.every((c) => Number.isInteger(cooldownDurationsArr[c]!))) continue

      const localDraw = activeCats.map((c) => places.map((p) => drawProbs[c]![p]!))
      const localVisit = activeCats.map((c) => places.map((p) => visitProbs[c]![p]!))
      const localCooldowns = activeCats.map((c) => cooldownDurationsArr[c]!)
      const correction = solveIsolatedCliquePhase(
        localDraw,
        localVisit,
        stayDuration,
        localCooldowns
      )
      if (correction == null) continue

      for (const p of places) {
        for (let c = 0; c < numCats; c++) {
          beta[c]![p] = 0
          scaledAttemptProbs[c]![p] = 0
          attemptProbs[c]![p] = 0
        }
      }
      for (let lc = 0; lc < activeCats.length; lc++) {
        const catIdx = activeCats[lc]!
        for (let lp = 0; lp < places.length; lp++) {
          const placeIdx = places[lp]!
          beta[catIdx]![placeIdx] = correction.beta[lc]![lp]!
          scaledAttemptProbs[catIdx]![placeIdx] = correction.visitStarts[lc]![lp]!
          attemptProbs[catIdx]![placeIdx] =
            correction.gateSelect[lc]![lp]! * visitProbs[catIdx]![placeIdx]!
        }
        alpha[catIdx] = correction.alpha[lc]!
      }
      for (let lp = 0; lp < places.length; lp++) {
        componentOpenChance[places[lp]!] = correction.gateOpen[lp]!
      }
    }
  }

  for (let p = 0; p < numPlaces; p++) {
    for (let c = 0; c < numCats; c++) pi[p]! += beta[c]![p]!
  }

  const componentOccOut = components.map((places) => {
    let s = 0
    for (const pl of places) s += pi[pl]!
    return s
  })

  const placeOccupancy: Record<string, number> = {}
  for (let placeIdx = 0; placeIdx < numPlaces; placeIdx++) {
    placeOccupancy[placeNames[placeIdx]!] = pi[placeIdx]!
  }

  return {
    placeOccupancy,
    betaValues: beta,
    drawProbabilities: drawProbs,
    attemptProbabilities: attemptProbs,
    scaledAttemptProbabilities: scaledAttemptProbs,
    interactionValues: interaction,
    iterations: Math.min(iteration + 1, maxIterations),
    converged: maxDelta < convergenceThreshold,
    maxDelta,
    alphaValues: alpha,
    piValues: pi,
    componentOccupancy: componentOccOut,
    componentOpenChance,
    placeToComponent,
    cooldownDuration: representativeCooldownDuration,
    stayDuration,
  }
}
