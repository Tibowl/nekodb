/**
 * Dev profiling for the yard GA: enable with Advanced configs → Search →
 * Log optimizer profiling report, then Run optimizer; see console summary.
 */

/** Fine-grained buckets inside `solveCatPlaceSystem` (summed over all iterations × all solves). */
export type SolverProfileSection =
  | "interactionDraw"
  | "openGate"
  | "attemptWinDemand"
  | "solveComponents"

const solverBuckets: Record<SolverProfileSection, number> = {
  interactionDraw: 0,
  openGate: 0,
  attemptWinDemand: 0,
  solveComponents: 0,
}

function resetSolverBuckets(): void {
  for (const k of Object.keys(solverBuckets) as SolverProfileSection[]) {
    solverBuckets[k] = 0
  }
}

export function recordSolverSection(section: SolverProfileSection, ms: number): void {
  if (!active) return
  solverBuckets[section] += ms
}

/** Snapshot of solver-internal timing (only non-zero when profiling was active during solves). */
export function getSolverSectionSnapshot(): Record<SolverProfileSection, number> {
  return { ...solverBuckets }
}

export type YardOptimizerProfileStats = {
  assignValueCalls: number
  cacheHits: number
  missesGoodieConstraint: number
  missesFullAnalyze: number
  /** Wall time inside `NekoAtsumeAnalyzer.analyze()` (cache misses only). */
  msAnalyze: number
  /** Subset of analyze: `solveCatPlaceSystem` only. */
  msSolver: number
}

export type YardOptimizerWorkerProfileSnapshot = {
  stats: YardOptimizerProfileStats
  solverSections: Record<SolverProfileSection, number>
}

export type YardOptimizerGenerationProfile = {
  iteration: number
  poolIn: number
  freshCandidatesGenerated: number
  freshCandidates: number
  offspringCandidatesGenerated: number
  offspringCandidates: number
  poolOut: number
  msFreshBuild: number
  msFreshScore: number
  msBreed: number
  msOffspringScore: number
  msMerge: number
  msTotal: number
  bestBefore: number | null
  bestAfter: number | null
  bestImproved: boolean
}

export type YardOptimizerFinalPoolProfile = {
  size: number
  bestFood: string | null
  bestValue: number | null
  bestSecondary: number | null
  deluxeCount: number
  foodCounts: Record<string, number>
}

let active = false
let stats: YardOptimizerProfileStats = freshStats()
let generations: YardOptimizerGenerationProfile[] = []
let finalPool: YardOptimizerFinalPoolProfile | null = null

function freshStats(): YardOptimizerProfileStats {
  return {
    assignValueCalls: 0,
    cacheHits: 0,
    missesGoodieConstraint: 0,
    missesFullAnalyze: 0,
    msAnalyze: 0,
    msSolver: 0,
  }
}

function addStats(
  target: YardOptimizerProfileStats,
  incoming: YardOptimizerProfileStats
): void {
  target.assignValueCalls += incoming.assignValueCalls
  target.cacheHits += incoming.cacheHits
  target.missesGoodieConstraint += incoming.missesGoodieConstraint
  target.missesFullAnalyze += incoming.missesFullAnalyze
  target.msAnalyze += incoming.msAnalyze
  target.msSolver += incoming.msSolver
}

/** Headless/tests: turn profiling on or off. Resets counters only when `enable` is true. */
export function beginYardOptimizerProfileForced(enable: boolean): void {
  active = enable
  if (enable) {
    stats = freshStats()
    generations = []
    finalPool = null
    resetSolverBuckets()
  }
}

export function yardOptimizerProfilingActive(): boolean {
  return active
}

/** Stop recording (e.g. before `getYardAnalyzerSummary`, which calls `analyze()` again). */
export function pauseYardOptimizerProfiling(): void {
  active = false
}

export function profileAssignValueEnter(): void {
  if (!active) return
  stats.assignValueCalls++
}

export function profileAssignValueCacheHit(): void {
  if (!active) return
  stats.cacheHits++
}

export function profileAssignValueGoodieReject(): void {
  if (!active) return
  stats.missesGoodieConstraint++
}

export function profileAssignValueAnalyze(ms: number): void {
  if (!active) return
  stats.missesFullAnalyze++
  stats.msAnalyze += ms
}

export function profileSolverMs(ms: number): void {
  if (!active) return
  stats.msSolver += ms
}

export function profileGenerationStep(step: YardOptimizerGenerationProfile): void {
  if (!active) return
  generations.push(step)
}

export function profileFinalPool(
  pool: readonly {
    foodTypeIndoor: number
    foodTypeOutdoor: number
    value: number
    valueSecondary: number
  }[]
): void {
  if (!active) return
  const foodCounts: Record<string, number> = {}
  let deluxeCount = 0
  for (const y of pool) {
    const key = `${y.foodTypeIndoor}/${y.foodTypeOutdoor}`
    foodCounts[key] = (foodCounts[key] ?? 0) + 1
    if (y.foodTypeIndoor === 5 || y.foodTypeOutdoor === 5) deluxeCount++
  }
  const best = pool[0] ?? null
  finalPool = {
    size: pool.length,
    bestFood: best ? `${best.foodTypeIndoor}/${best.foodTypeOutdoor}` : null,
    bestValue: best?.value ?? null,
    bestSecondary: best?.valueSecondary ?? null,
    deluxeCount,
    foodCounts,
  }
}

export function getYardOptimizerProfileStats(): YardOptimizerProfileStats {
  return { ...stats }
}

export function getYardOptimizerWorkerProfileSnapshot(): YardOptimizerWorkerProfileSnapshot {
  return {
    stats: getYardOptimizerProfileStats(),
    solverSections: getSolverSectionSnapshot(),
  }
}

export function mergeYardOptimizerWorkerProfile(
  snapshot: YardOptimizerWorkerProfileSnapshot | undefined
): void {
  if (!active || !snapshot) return
  addStats(stats, snapshot.stats)
  for (const k of Object.keys(solverBuckets) as SolverProfileSection[]) {
    solverBuckets[k] += snapshot.solverSections[k] ?? 0
  }
}

/** Console-friendly blob for browser or scripts (solver subsection = inside fixed-point loop). */
export function buildYardOptimizerProfileReport(wallClockMs: number): Record<string, unknown> {
  const s = getYardOptimizerProfileStats()
  const rest = Math.max(0, s.msAnalyze - s.msSolver)
  const solverSections = getSolverSectionSnapshot()
  const secSum = Object.values(solverSections).reduce((a, b) => a + b, 0)
  const solverSectionPct =
    secSum > 0
      ? Object.fromEntries(
          Object.entries(solverSections).map(([k, v]) => [
            k,
            Math.round((1000 * v) / secSum) / 10,
          ])
        )
      : {}
  const slowestGenerations = [...generations]
    .sort((a, b) => b.msTotal - a.msTotal)
    .slice(0, 5)
  const improvedGenerations = generations
    .filter((g) => g.bestImproved)
    .map((g) => ({
      iteration: g.iteration,
      bestBefore: g.bestBefore,
      bestAfter: g.bestAfter,
      msTotal: Math.round(g.msTotal * 10) / 10,
      candidates: g.freshCandidates + g.offspringCandidates,
    }))
  const totals = generations.reduce(
    (acc, g) => {
      acc.freshCandidatesGenerated += g.freshCandidatesGenerated
      acc.freshCandidates += g.freshCandidates
      acc.offspringCandidatesGenerated += g.offspringCandidatesGenerated
      acc.offspringCandidates += g.offspringCandidates
      acc.msFreshScore += g.msFreshScore
      acc.msOffspringScore += g.msOffspringScore
      acc.msBreed += g.msBreed
      acc.msMerge += g.msMerge
      return acc
    },
    {
      freshCandidates: 0,
      freshCandidatesGenerated: 0,
      offspringCandidates: 0,
      offspringCandidatesGenerated: 0,
      msFreshScore: 0,
      msOffspringScore: 0,
      msBreed: 0,
      msMerge: 0,
    }
  )
  return {
    wallClockMs: Math.round(wallClockMs),
    ...s,
    generations: generations.length,
    generationTotals: {
      ...totals,
      msFreshScore: Math.round(totals.msFreshScore * 10) / 10,
      msOffspringScore: Math.round(totals.msOffspringScore * 10) / 10,
      msBreed: Math.round(totals.msBreed * 10) / 10,
      msMerge: Math.round(totals.msMerge * 10) / 10,
    },
    finalPool,
    slowestGenerations,
    improvedGenerations,
    msAnalyzeRest: Math.round(rest * 10) / 10,
    msSolverPctOfAnalyze:
      s.msAnalyze > 0 ? Math.round((1000 * s.msSolver) / s.msAnalyze) / 10 : 0,
    avgMsAnalyzePerCall:
      s.missesFullAnalyze > 0
        ? Math.round((100 * s.msAnalyze) / s.missesFullAnalyze) / 100
        : 0,
    solverSectionMs: solverSections,
    solverSectionPctOfSolverLoop: solverSectionPct,
    solverSectionsSumMs: Math.round(secSum * 10) / 10,
  }
}
