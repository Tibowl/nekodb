/**
 * Discrete memento lottery matching the in-game memento roll shape
 * (`SaveDataMementos.LotMemento`, permyriad roll `0 <= draw < 10_000`).
 */

import { foodMementoRateForType, DEFAULT_FOOD_MEMENTO_RATE, MEMENTO_INDOOR_PLACEMENT_MULT } from "./yardOptimizer/config"

export { DEFAULT_FOOD_MEMENTO_RATE }

export const MEMENTO_COME_OFFSET_RARE = -8
export const MEMENTO_COME_OFFSET_NORMAL = -30

export type MementoLotteryParams = {
  comeCount: number
  isRareCat: boolean
  /** Raw table value (`FoodRecordTable.MementoRate`). */
  foodMementoRate: number
  isIndoor: boolean
}

export function mementoFoodMultiplier(
  foodMementoRate: number,
  isIndoor: boolean
): number {
  return isIndoor
    ? foodMementoRate * MEMENTO_INDOOR_PLACEMENT_MULT
    : foodMementoRate
}

/**
 * Float lottery weight before il2cpp truncation to integer threshold T (`int(inner)`).
 * Same visit-count gate as discrete LotMemento; may be non-finite for extreme inputs.
 */
export function mementoThresholdInnerBeforeTrunc(p: MementoLotteryParams): number | null {
  const offset = p.isRareCat ? MEMENTO_COME_OFFSET_RARE : MEMENTO_COME_OFFSET_NORMAL
  if (p.comeCount + offset <= -1) return null

  const m = mementoFoodMultiplier(p.foodMementoRate, p.isIndoor)
  const n = p.comeCount + offset
  return m * (n / 10.0 + 2.5) * 100.0 * 0.5
}

/** Integer threshold T; success iff draw <= T - 1 with draw uniform on [0, 9999]. */
export function mementoPermyriadThreshold(p: MementoLotteryParams): number | null {
  const inner = mementoThresholdInnerBeforeTrunc(p)
  if (inner === null) return null
  if (!Number.isFinite(inner)) return 0

  return Math.trunc(inner)
}

export function mementoSuccessProbability(p: MementoLotteryParams): number {
  const t = mementoPermyriadThreshold(p)
  if (t === null || t <= 0) return 0
  return Math.min(t, 10_000) / 10_000
}

/**
 * Continuous surrogate: skip `⌊inner⌋` and permyriad bucket — treat success rate as
 * `clamp(inner / 10000, 0, 1)`. Same gate as discrete; smoother in come_count for curves / integration.
 * Not bit-accurate vs the client lottery.
 */
export function mementoSuccessProbabilitySmooth(p: MementoLotteryParams): number {
  const inner = mementoThresholdInnerBeforeTrunc(p)
  if (inner === null) return 0
  if (!Number.isFinite(inner)) return 0
  return Math.min(Math.max(inner / 10_000, 0), 1)
}

/** Uniform integer in [0, 9999], inclusive (matches `numpy.integers(0, 10_000)`). */
export function drawPermyriad(rand01: () => number): number {
  return Math.floor(rand01() * 10_000)
}

export function rollMementoSuccess(
  p: MementoLotteryParams,
  rand01: () => number
): boolean {
  const t = mementoPermyriadThreshold(p)
  if (t === null) return false
  const draw = drawPermyriad(rand01)
  return draw <= t - 1
}

/** Distribution of visits-until-first-success when q_i changes each come-count (non-geometric). */
export type WalkExactDistribution = {
  /** `pmf[k]` = P(first success on visit k+1 from start), k = 0 … maxVisits−1. */
  pmfByVisitIndex: number[]
  /** Σ pmf = P(success within cap). */
  probSuccessWithinCap: number
  probCensored: number
  /** Conditional expectation E[N | success within cap], visits from first roll. */
  meanVisitsGivenSuccess: number
  medianVisitsGivenSuccess: number | null
  quantileVisitsGivenSuccess: (q: number) => number | null
}

/**
 * Sequential visits until first hit with arbitrary per-visit hit probability (discrete or smooth q).
 */
export function walkUntilSuccessDistribution(
  base: Omit<MementoLotteryParams, "comeCount">,
  startComeCount: number,
  maxVisits: number,
  hitProb: (p: MementoLotteryParams) => number
): WalkExactDistribution {
  const W = Math.max(1, Math.floor(maxVisits))
  const pmfByVisitIndex: number[] = []
  let prodSurvival = 1

  for (let k = 0; k < W; k++) {
    const cc = startComeCount + k
    const q = hitProb({ ...base, comeCount: cc })
    const pAt = prodSurvival * q
    pmfByVisitIndex.push(pAt)
    prodSurvival *= 1 - q
  }

  const probCensored = prodSurvival
  const probSuccessWithinCap = 1 - probCensored

  let meanVisitsGivenSuccess = NaN
  let medianVisitsGivenSuccess: number | null = null

  if (probSuccessWithinCap > 1e-15) {
    let sumK = 0
    for (let k = 0; k < W; k++) {
      sumK += (k + 1) * pmfByVisitIndex[k]!
    }
    meanVisitsGivenSuccess = sumK / probSuccessWithinCap

    const quantileVisitsGivenSuccess = (q: number): number | null => {
      if (q <= 0 || q > 1 || probSuccessWithinCap <= 0) return null
      const target = q * probSuccessWithinCap
      let cum = 0
      for (let k = 0; k < W; k++) {
        cum += pmfByVisitIndex[k]!
        if (cum + 1e-12 >= target) return k + 1
      }
      return null
    }
    medianVisitsGivenSuccess = quantileVisitsGivenSuccess(0.5)

    return {
      pmfByVisitIndex,
      probSuccessWithinCap,
      probCensored,
      meanVisitsGivenSuccess,
      medianVisitsGivenSuccess,
      quantileVisitsGivenSuccess,
    }
  }

  return {
    pmfByVisitIndex,
    probSuccessWithinCap,
    probCensored,
    meanVisitsGivenSuccess,
    medianVisitsGivenSuccess,
    quantileVisitsGivenSuccess: () => null,
  }
}

/** Discrete client lottery (`⌊inner⌋`, permyriad). */
export function walkUntilSuccessDistributionExact(
  base: Omit<MementoLotteryParams, "comeCount">,
  startComeCount: number,
  maxVisits: number
): WalkExactDistribution {
  return walkUntilSuccessDistribution(
    base,
    startComeCount,
    maxVisits,
    mementoSuccessProbability
  )
}

/**
 * Per-visit P(hit) when the cat alternates between indoor / outdoor playspaces with the analyzer
 * mass split. Visits are independent Bernoulli mixtures: the location is drawn first
 * (indoor with probability `indoorShare`), then the location-specific permyriad lottery rolls.
 *
 * `come_count` increments on every visit regardless of location (matches `LotMemento`).
 */
export type MementoMixtureParams = {
  comeCount: number
  isRareCat: boolean
  indoorShare: number
  foodMementoRateIndoor: number
  foodMementoRateOutdoor: number
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return Math.min(1, Math.max(0, x))
}

export function mementoSuccessProbabilityMixture(
  p: MementoMixtureParams
): number {
  const s = clamp01(p.indoorShare)
  const pIn = mementoSuccessProbability({
    comeCount: p.comeCount,
    isRareCat: p.isRareCat,
    foodMementoRate: p.foodMementoRateIndoor,
    isIndoor: true,
  })
  const pOut = mementoSuccessProbability({
    comeCount: p.comeCount,
    isRareCat: p.isRareCat,
    foodMementoRate: p.foodMementoRateOutdoor,
    isIndoor: false,
  })
  return s * pIn + (1 - s) * pOut
}

/** Sequential walk where each visit is an independent indoor/outdoor mixture. */
export function walkUntilSuccessDistributionMixture(
  base: Omit<MementoMixtureParams, "comeCount">,
  startComeCount: number,
  maxVisits: number
): WalkExactDistribution {
  const W = Math.max(1, Math.floor(maxVisits))
  const pmfByVisitIndex: number[] = []
  let prodSurvival = 1
  for (let k = 0; k < W; k++) {
    const cc = startComeCount + k
    const q = mementoSuccessProbabilityMixture({ ...base, comeCount: cc })
    pmfByVisitIndex.push(prodSurvival * q)
    prodSurvival *= 1 - q
  }
  const probCensored = prodSurvival
  const probSuccessWithinCap = 1 - probCensored
  let meanVisitsGivenSuccess = NaN
  let medianVisitsGivenSuccess: number | null = null
  let quantileFn: (q: number) => number | null = () => null
  if (probSuccessWithinCap > 1e-15) {
    let sumK = 0
    for (let k = 0; k < W; k++) sumK += (k + 1) * pmfByVisitIndex[k]!
    meanVisitsGivenSuccess = sumK / probSuccessWithinCap
    quantileFn = (q: number) => {
      if (q <= 0 || q > 1) return null
      const target = q * probSuccessWithinCap
      let cum = 0
      for (let k = 0; k < W; k++) {
        cum += pmfByVisitIndex[k]!
        if (cum + 1e-12 >= target) return k + 1
      }
      return null
    }
    medianVisitsGivenSuccess = quantileFn(0.5)
  }
  return {
    pmfByVisitIndex,
    probSuccessWithinCap,
    probCensored,
    meanVisitsGivenSuccess,
    medianVisitsGivenSuccess,
    quantileVisitsGivenSuccess: quantileFn,
  }
}

export type MixtureWalkParams = Omit<MementoMixtureParams, "comeCount"> & {
  startComeCount: number
  maxVisits: number
}

/** Monte Carlo: visits-from-start until first hit; each visit picks indoor/outdoor first, then rolls. */
export function simulateVisitCountUntilSuccessMixture(
  opts: MixtureWalkParams,
  rand01: () => number
): number | null {
  const s = clamp01(opts.indoorShare)
  let cc = opts.startComeCount
  const endCap = opts.startComeCount + opts.maxVisits
  while (cc < endCap) {
    const isIndoor = rand01() < s
    const t = mementoPermyriadThreshold({
      comeCount: cc,
      isRareCat: opts.isRareCat,
      foodMementoRate: isIndoor
        ? opts.foodMementoRateIndoor
        : opts.foodMementoRateOutdoor,
      isIndoor,
    })
    if (t !== null && t > 0) {
      const draw = drawPermyriad(rand01)
      if (draw <= t - 1) return cc - opts.startComeCount + 1
    }
    cc += 1
  }
  return null
}

export function simulateVisitCountUntilSuccessMixtureBatch(
  opts: MixtureWalkParams,
  count: number,
  rand01: () => number
): (number | null)[] {
  const out: (number | null)[] = new Array(count)
  for (let i = 0; i < count; i++) {
    out[i] = simulateVisitCountUntilSuccessMixture(opts, rand01)
  }
  return out
}

/**
 * P(N ≥ k) for N ~ Poisson(lambda), via cumulative PMF (no specials). Exact-ish in float64.
 */
export function poissonProbAtLeast(k: number, lambda: number): number {
  if (k <= 0) return 1
  if (lambda <= 0) return 0
  let pmf = Math.exp(-lambda)
  let cdf = pmf
  for (let i = 0; i < k - 1; i++) {
    pmf = (pmf * lambda) / (i + 1)
    cdf += pmf
  }
  return Math.max(0, Math.min(1, 1 - cdf))
}

/**
 * Convolve a visit-count CDF with a Poisson visit-arrival process to get day-time CDF.
 *
 *     P(success by day d) = Σ_{n≥1} P(first success on visit n) · P(N(d) ≥ n)
 *
 * with N(d) ~ Poisson(visitsPerDay · d). The visits-axis curve is conditional on visit count
 * (no timing variance); the days axis here additionally folds in the Poisson arrival noise,
 * which usually dominates for memoryless yard-visit traffic.
 */
export function cumulativeProbSuccessByDay(
  pmfByVisitIndex: readonly number[],
  daysGrid: readonly number[],
  visitsPerDay: number
): { day: number; cum: number }[] {
  const out: { day: number; cum: number }[] = []
  if (visitsPerDay <= 0) return daysGrid.map((d) => ({ day: d, cum: 0 }))

  for (const day of daysGrid) {
    if (day <= 0) {
      out.push({ day, cum: 0 })
      continue
    }
    const lam = visitsPerDay * day
    let cum = 0
    let pmf = Math.exp(-lam)
    let cdfPoisson = pmf
    for (let n = 1; n <= pmfByVisitIndex.length; n++) {
      const pmfMass = pmfByVisitIndex[n - 1]!
      if (pmfMass !== 0) cum += pmfMass * Math.max(0, 1 - cdfPoisson)
      pmf = (pmf * lam) / n
      cdfPoisson += pmf
    }
    out.push({ day, cum })
  }
  return out
}

/**
 * One full Monte Carlo path over <em>continuous time</em>:
 *   - Visit inter-arrival times Exp(λ) with λ = `visitsPerDay`.
 *   - Each visit picks indoor/outdoor with `indoorShare`, rolls the location-specific lottery.
 *   - Returns the number of visits and the time (days) at first hit; null if `maxVisits` exhausted.
 */
export type MixtureDayWalkParams = MixtureWalkParams & {
  visitsPerDay: number
}

export type MixtureDaySample = {
  visits: number
  days: number
}

function expSample(lambda: number, rand01: () => number): number {
  if (lambda <= 0) return Number.POSITIVE_INFINITY
  const u = Math.max(rand01(), Number.MIN_VALUE)
  return -Math.log(u) / lambda
}

export function simulateMixtureDayAndVisitUntilSuccess(
  opts: MixtureDayWalkParams,
  rand01: () => number
): MixtureDaySample | null {
  const s = Math.min(1, Math.max(0, opts.indoorShare))
  let cc = opts.startComeCount
  const endCap = opts.startComeCount + opts.maxVisits
  let dayClock = 0
  let visitIndex = 0
  while (cc < endCap) {
    dayClock += expSample(opts.visitsPerDay, rand01)
    visitIndex += 1
    const isIndoor = rand01() < s
    const t = mementoPermyriadThreshold({
      comeCount: cc,
      isRareCat: opts.isRareCat,
      foodMementoRate: isIndoor
        ? opts.foodMementoRateIndoor
        : opts.foodMementoRateOutdoor,
      isIndoor,
    })
    if (t !== null && t > 0) {
      const draw = drawPermyriad(rand01)
      if (draw <= t - 1) return { visits: visitIndex, days: dayClock }
    }
    cc += 1
  }
  return null
}

export function simulateMixtureDayAndVisitBatch(
  opts: MixtureDayWalkParams,
  count: number,
  rand01: () => number
): (MixtureDaySample | null)[] {
  const out: (MixtureDaySample | null)[] = new Array(count)
  for (let i = 0; i < count; i++) {
    out[i] = simulateMixtureDayAndVisitUntilSuccess(opts, rand01)
  }
  return out
}

/**
 * Empirical P(success by day ≤ d) at each day grid point with Wilson CIs. Censored runs (no hit
 * within `maxVisits`) count as not-yet-success at every d.
 */
export function empiricalCdfSuccessWithinDay(
  daySamples: (number | null)[],
  daysGrid: readonly number[],
  z = 1.96
): { day: number; mean: number; low: number; high: number }[] {
  const N = daySamples.length
  if (N === 0) return []
  const sorted = [...daySamples]
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b)
  const out: { day: number; mean: number; low: number; high: number }[] = []
  let cursor = 0
  let successes = 0
  for (const d of daysGrid) {
    while (cursor < sorted.length && sorted[cursor]! <= d) {
      successes++
      cursor++
    }
    const w = wilsonScoreInterval(successes, N, z)
    out.push({ day: d, mean: successes / N, low: w.low, high: w.high })
  }
  return out
}

/** Smooth q_i — same product structure, easier to treat as approximately continuous in come_count. */
export function walkUntilSuccessDistributionSmooth(
  base: Omit<MementoLotteryParams, "comeCount">,
  startComeCount: number,
  maxVisits: number
): WalkExactDistribution {
  return walkUntilSuccessDistribution(
    base,
    startComeCount,
    maxVisits,
    mementoSuccessProbabilitySmooth
  )
}

export type VisitWalkParams = Omit<MementoLotteryParams, "comeCount"> & {
  /** Come-count where simulation starts; increments after each failed roll. */
  startComeCount: number
  /** Max visits attempted from start (exclusive upper bound on comeCount). */
  maxVisits: number
}

/**
 * Walk visits upward from `startComeCount`; roll lottery once per visit until success.
 * Returns visit index on success, or null if capped without success.
 */
export function simulateFirstSuccessVisit(
  opts: VisitWalkParams,
  rand01: () => number
): number | null {
  let comeCount = opts.startComeCount
  const endCap = opts.startComeCount + opts.maxVisits
  while (comeCount < endCap) {
    const hit = rollMementoSuccess(
      {
        comeCount,
        isRareCat: opts.isRareCat,
        foodMementoRate: opts.foodMementoRate,
        isIndoor: opts.isIndoor,
      },
      rand01
    )
    if (hit) return comeCount
    comeCount += 1
  }
  return null
}

/** Rolls until success: returns visit count from start (1 … maxVisits), or null if capped. */
export function simulateVisitCountUntilSuccess(
  opts: VisitWalkParams,
  rand01: () => number
): number | null {
  const hitCc = simulateFirstSuccessVisit(opts, rand01)
  if (hitCc === null) return null
  return hitCc - opts.startComeCount + 1
}

export function simulateVisitCountUntilSuccessBatch(
  opts: VisitWalkParams,
  count: number,
  rand01: () => number
): (number | null)[] {
  const out: (number | null)[] = new Array(count)
  for (let i = 0; i < count; i++) {
    out[i] = simulateVisitCountUntilSuccess(opts, rand01)
  }
  return out
}

/**
 * Wilson score interval for Binomial(successes | trials).
 * z = 1.96 → ~95% two-sided when successes arise from i.i.d. Bernoulli trials.
 */
export function wilsonScoreInterval(
  successes: number,
  trials: number,
  z = 1.96
): { low: number; high: number } {
  if (trials <= 0) return { low: 0, high: 1 }
  const phat = successes / trials
  const zz = z * z
  const denom = 1 + zz / trials
  const center = (phat + zz / (2 * trials)) / denom
  const halfWidth =
    (z / denom) *
    Math.sqrt((phat * (1 - phat)) / trials + zz / (4 * trials * trials))
  return {
    low: Math.max(0, center - halfWidth),
    high: Math.min(1, center + halfWidth),
  }
}

/** Empirical P(success within n visits) per n with Wilson CIs (censored runs count as not-yet-success). */
export function empiricalCdfSuccessWithinN(
  visitCounts: (number | null)[],
  maxN: number,
  z = 1.96
): { n: number; mean: number; low: number; high: number }[] {
  const N = visitCounts.length
  if (N === 0 || maxN < 1) return []
  const rows: { n: number; mean: number; low: number; high: number }[] = []
  for (let n = 1; n <= maxN; n++) {
    let successes = 0
    for (let i = 0; i < visitCounts.length; i++) {
      const v = visitCounts[i]!
      if (v !== null && v <= n) successes++
    }
    const w = wilsonScoreInterval(successes, N, z)
    rows.push({ n, mean: successes / N, low: w.low, high: w.high })
  }
  return rows
}
