import { DEFAULT_GENETIC } from "../../utils/yardOptimizer/config"
import {
  assignValue,
  evolutionUsesEndFullRescore,
  FITNESS_HARD_REJECT_NONE,
  FITNESS_HARD_REJECT_RULES,
  getYardAnalyzerSummary,
  pickBestPoolMemberForDisplay,
  yardFitnessBetter,
  yardFitnessCompareDesc,
  type FitnessContext,
  type SolverTier,
} from "../../utils/yardOptimizer/fitness"
import {
  beginYardOptimizerProfileForced,
  buildYardOptimizerProfileReport,
  pauseYardOptimizerProfiling,
  profileFinalPool,
  yardOptimizerProfilingActive,
} from "../../utils/yardOptimizer/optimizerProfile"
import {
  applyDraftToPartialYard,
  validateManualDraft,
  type ManualYardDraft,
  type YardDraftPinFlags,
} from "../../utils/yardOptimizer/layoutDrafts"
import {
  cloneYard,
  mergeFixedHalvesIntoYard,
  mergeUserLayoutIntoGeneticPool,
  validateYard,
  yardSignature,
} from "../../utils/yardOptimizer/yardCore"
import {
  createInitialPoolParallel,
  rescorePoolAndSortParallel,
  runGenerationParallel,
} from "../../utils/yardOptimizer/runStep"
import { terminateYardFitnessWorkerPool } from "../../utils/yardOptimizer/yardFitnessParallel"
import type { YardState } from "../../utils/yardOptimizer/types"
import type { OptimizerRunPhase } from "./clientHelpers"
import type { GenerationChunkResult, RunMeta, RunStats, ContinuationState } from "./runTypes"

export type ItemPools = ReturnType<
  typeof import("../../utils/yardOptimizer/yardCore").defaultItemPools
>

export type GeneticConfig = typeof DEFAULT_GENETIC & {
  poolSize: number
  tournamentK: number
  mutationRate: number
  mutationOffspringRate: number
  foodMutationOffspringRate: number
  openSlotExplorationRate: number
  offspringScoreMode: typeof DEFAULT_GENETIC.offspringScoreMode
  survivorSelection: typeof DEFAULT_GENETIC.survivorSelection
}

export type RunLoopControl = {
  unmountedRef: { current: boolean }
  pauseRequestedRef: { current: boolean }
  runningRef: { current: boolean }
}

export function validateRunInputs(
  optimizeForCats: boolean,
  selectedCats: number[],
  selectedFoodsIndoor: number[],
  selectedFoodsOutdoor: number[]
): string | null {
  if (optimizeForCats && selectedCats.length === 0) {
    return "Pick at least one target cat, or remove the cat-based objective/tiebreaker."
  }
  if (selectedFoodsIndoor.length === 0 || selectedFoodsOutdoor.length === 0) {
    return "Pick at least one food for indoor and one for outdoor."
  }
  return null
}

export type OptimizerRunLifecycleActions = {
  setError: (msg: string | null) => void
  clearPauseRequest: () => void
  setPausedRunRemaining: (value: number | null) => void
  setRunning: (running: boolean) => void
  setRunPhase: (phase: OptimizerRunPhase) => void
  setSearchStrengthAutoBumped: (value: boolean) => void
  setProgress: (value: number) => void
  setProgressTotal: (value: number) => void
}

export type FreshRunLifecycleActions = OptimizerRunLifecycleActions & {
  setRunStats: (stats: RunStats | null) => void
  setFinalPool: (pool: YardState[]) => void
  setHasContinuation: (value: boolean) => void
  setBest: (yard: YardState | null) => void
  setRunMeta: (meta: RunMeta | null) => void
  continuationRef: { current: ContinuationState | null }
}

type RunValidationInputs = {
  optimizeForCats: boolean
  selectedCats: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
}

/** Shared validation + UI reset for a fresh optimizer search. Returns an error message or null. */
export function beginFreshOptimizerRun(
  inputs: RunValidationInputs,
  actions: FreshRunLifecycleActions,
  control: Pick<RunLoopControl, "runningRef">,
  generationCount: number,
  logOptimizerProfile: boolean,
  profileRunStartedAtRef: { current: number | null }
): string | null {
  const validationError = validateRunInputs(
    inputs.optimizeForCats,
    inputs.selectedCats,
    inputs.selectedFoodsIndoor,
    inputs.selectedFoodsOutdoor
  )
  if (validationError) {
    actions.setError(validationError)
    return validationError
  }

  actions.setError(null)
  actions.clearPauseRequest()
  actions.setPausedRunRemaining(null)
  actions.setRunning(true)
  control.runningRef.current = true
  actions.setRunPhase("initializing")
  actions.setSearchStrengthAutoBumped(false)
  actions.setProgress(0)
  actions.setProgressTotal(generationCount)
  actions.setRunStats(null)
  actions.setFinalPool([])
  actions.continuationRef.current = null
  actions.setHasContinuation(false)
  actions.setBest(null)
  actions.setRunMeta(null)
  configureRunProfiling(logOptimizerProfile, profileRunStartedAtRef)
  return null
}

/** Shared validation + UI reset for continuing a paused search. Returns an error message or null. */
export function beginContinueOptimizerRun(
  inputs: RunValidationInputs,
  actions: OptimizerRunLifecycleActions,
  control: Pick<RunLoopControl, "runningRef">,
  generationCount: number,
  logOptimizerProfile: boolean,
  profileRunStartedAtRef: { current: number | null }
): string | null {
  const validationError = validateRunInputs(
    inputs.optimizeForCats,
    inputs.selectedCats,
    inputs.selectedFoodsIndoor,
    inputs.selectedFoodsOutdoor
  )
  if (validationError) {
    actions.setError(validationError)
    return validationError
  }

  actions.setError(null)
  actions.clearPauseRequest()
  actions.setPausedRunRemaining(null)
  actions.setRunning(true)
  control.runningRef.current = true
  actions.setRunPhase("initializing")
  actions.setSearchStrengthAutoBumped(false)
  actions.setProgress(0)
  actions.setProgressTotal(generationCount)
  if (logOptimizerProfile) {
    if (!yardOptimizerProfilingActive()) {
      configureRunProfiling(true, profileRunStartedAtRef)
    }
  } else {
    configureRunProfiling(false, profileRunStartedAtRef)
  }
  return null
}

export function configureRunProfiling(
  logOptimizerProfile: boolean,
  profileRunStartedAtRef: { current: number | null }
): void {
  if (logOptimizerProfile) {
    beginYardOptimizerProfileForced(true)
    profileRunStartedAtRef.current = performance.now()
  } else {
    pauseYardOptimizerProfiling()
    profileRunStartedAtRef.current = null
  }
}

export function logRunProfileReport(profileRunStartedAtRef: { current: number | null }): void {
  if (!yardOptimizerProfilingActive()) return
  const startedAt = profileRunStartedAtRef.current ?? performance.now()
  console.info(
    "Yard optimizer profile",
    buildYardOptimizerProfileReport(performance.now() - startedAt)
  )
  pauseYardOptimizerProfiling()
}

export async function createInitialSearchPool(
  ctx: FitnessContext,
  pools: ItemPools,
  poolSize: number,
  evolutionSolverTier: SolverTier,
  control: Pick<RunLoopControl, "unmountedRef">
): Promise<YardState[] | null> {
  const pool = await createInitialPoolParallel(ctx, pools, poolSize, evolutionSolverTier)
  if (control.unmountedRef.current) return null
  return pool
}

export async function mergeManualDraftIntoPool(
  ctx: FitnessContext,
  pool: YardState[],
  manualDraft: ManualYardDraft,
  best: YardState,
  pinFlags: YardDraftPinFlags,
  pools: ItemPools,
  poolSize: number,
  runMeta: RunMeta
): Promise<{ pool: YardState[] } | { error: string }> {
  const msg = validateManualDraft(
    manualDraft,
    pinFlags,
    pools,
    runMeta.requiredGoodieIds,
    runMeta.forbiddenGoodieIds
  )
  if (msg) return { error: msg }

  try {
    const merged = mergeFixedHalvesIntoYard(
      ctx,
      applyDraftToPartialYard(best, manualDraft, pinFlags)
    )
    validateYard(merged)
    let nextPool = mergeUserLayoutIntoGeneticPool(ctx, pool, poolSize, merged)
    const sig = yardSignature(merged)
    for (const y of nextPool) {
      if (yardSignature(y) === sig) {
        assignValue(ctx, y, { solverTier: "full" })
        break
      }
    }
    nextPool = [...nextPool].sort(yardFitnessCompareDesc)
    return { pool: nextPool }
  } catch (injErr) {
    return {
      error: injErr instanceof Error ? injErr.message : String(injErr),
    }
  }
}

export type OnBestOptions = {
  /** Bypass generation throttle (chunk start, pause, completion). */
  flush?: boolean
}

export async function runGenerationChunk(args: {
  ctx: FitnessContext
  pools: ItemPools
  genetic: GeneticConfig
  evolutionSolverTier: SolverTier
  pool: YardState[]
  generationStart: number
  generationCount: number
  control: RunLoopControl
  onPhase: (phase: OptimizerRunPhase) => void
  onProgress: (step: number, total: number) => void
  onBest: (yard: YardState, options?: OnBestOptions) => void
}): Promise<GenerationChunkResult> {
  const {
    ctx,
    pools,
    genetic,
    evolutionSolverTier,
    pool: startPool,
    generationStart,
    generationCount,
    control,
    onPhase,
    onProgress,
    onBest,
  } = args

  let pool = startPool
  let top = pool[0] ?? null
  if (top) onBest(cloneYard(top), { flush: true })

  const endGen = generationStart + generationCount
  onPhase("searching")
  let step = 0
  for (let i = generationStart + 1; i <= endGen; i++) {
    pool = await runGenerationParallel(ctx, pools, pool, genetic, i, evolutionSolverTier)
    if (control.unmountedRef.current) return { kind: "aborted" }

    const b = pool[0] ?? null
    if (b && (!top || yardFitnessBetter(b, top))) {
      top = b
      onBest(cloneYard(b))
    }
    step++
    onProgress(step, generationCount)

    if (control.pauseRequestedRef.current && step < generationCount) {
      // Promote the pool to `full`-tier scoring before returning so the user
      // sees properly-scored yard options at the pause point — same terminal
      // rescore the "completed" branch does below. Without this, the paused
      // pool keeps its `mid`-tier scores (lower iteration cap, looser tolerance,
      // and — when the display row-win is `componentState` — the cheaper
      // `perPlace` search proxy), so the "best" yard shown can re-rank once the
      // final `full`-tier rescore lands under the user's real row-win.
      if (evolutionUsesEndFullRescore(evolutionSolverTier)) {
        onPhase("rescoring")
        await new Promise((r) => setTimeout(r, 0))
        if (control.unmountedRef.current) return { kind: "aborted" }
        pool = await rescorePoolAndSortParallel(ctx, pool, "full")
        if (control.unmountedRef.current) return { kind: "aborted" }
      }
      const displayBest = pickBestPoolMemberForDisplay(pool)
      if (displayBest) onBest(cloneYard(displayBest), { flush: true })
      return {
        kind: "paused",
        pool,
        ctx,
        lastGeneration: i,
        remainingGenerations: generationCount - step,
        best: displayBest ? cloneYard(displayBest) : top ? cloneYard(top) : null,
        totalGenerations: i,
        evolutionTierUsed: evolutionSolverTier,
      }
    }

    await new Promise((r) => setTimeout(r, 0))
    if (control.unmountedRef.current) return { kind: "aborted" }
  }

  if (evolutionUsesEndFullRescore(evolutionSolverTier)) {
    onPhase("rescoring")
    await new Promise((r) => setTimeout(r, 0))
    if (control.unmountedRef.current) return { kind: "aborted" }
    pool = await rescorePoolAndSortParallel(ctx, pool, "full")
    if (control.unmountedRef.current) return { kind: "aborted" }
  }

  const displayBest = pickBestPoolMemberForDisplay(pool)
  if (displayBest) onBest(cloneYard(displayBest), { flush: true })

  if (yardOptimizerProfilingActive()) {
    profileFinalPool(pool)
  }

  return {
    kind: "completed",
    pool,
    ctx,
    lastGeneration: endGen,
    best: displayBest ? cloneYard(displayBest) : null,
    totalGenerations: endGen,
    evolutionTierUsed: evolutionSolverTier,
    searchStrengthAutoBumped:
      Boolean(displayBest) &&
      (displayBest!.hardRejectLevel ?? FITNESS_HARD_REJECT_NONE) ===
        FITNESS_HARD_REJECT_RULES &&
      evolutionUsesEndFullRescore(evolutionSolverTier),
  }
}

export function buildRunStats(
  ctx: FitnessContext,
  yard: YardState,
  totalGenerations: number,
  evolutionTierUsed: SolverTier
): RunStats {
  return {
    totalGenerations,
    searchMode: "genetic",
    evolutionTierUsed,
    ...getYardAnalyzerSummary(ctx, yard),
  }
}

export function cleanupRunLoop(
  control: RunLoopControl,
  clearPauseRequest: () => void,
  setRunning: (running: boolean) => void,
  setRunPhase: (phase: OptimizerRunPhase) => void
): void {
  control.runningRef.current = false
  if (control.unmountedRef.current) {
    pauseYardOptimizerProfiling()
    control.pauseRequestedRef.current = false
    terminateYardFitnessWorkerPool()
  } else {
    setRunning(false)
    setRunPhase("idle")
    clearPauseRequest()
  }
}

export function handleCompletedGenerationChunk(args: {
  result: Extract<GenerationChunkResult, { kind: "completed" }>
  profileRunStartedAtRef: { current: number | null }
  setFinalPool: (pool: YardState[]) => void
  setRunStats: (stats: RunStats) => void
  setHasContinuation: (value: boolean) => void
  setEvolutionSolverTier: (tier: SolverTier) => void
  setSearchStrengthAutoBumped: (value: boolean) => void
  continuationRef: { current: { ctx: FitnessContext; pool: YardState[]; lastGeneration: number } | null }
}): void {
  const {
    result,
    profileRunStartedAtRef,
    setFinalPool,
    setRunStats,
    setHasContinuation,
    setEvolutionSolverTier,
    setSearchStrengthAutoBumped,
    continuationRef,
  } = args

  setFinalPool(result.pool.map(cloneYard))
  logRunProfileReport(profileRunStartedAtRef)
  if (result.searchStrengthAutoBumped) {
    setEvolutionSolverTier("full")
    setSearchStrengthAutoBumped(true)
  }
  if (result.best) {
    setRunStats(
      buildRunStats(
        result.ctx,
        result.best,
        result.totalGenerations,
        result.evolutionTierUsed
      )
    )
  }
  continuationRef.current = {
    ctx: result.ctx,
    pool: result.pool,
    lastGeneration: result.lastGeneration,
  }
  setHasContinuation(true)
}

export function handlePausedGenerationChunk(args: {
  result: Extract<GenerationChunkResult, { kind: "paused" }>
  setFinalPool: (pool: YardState[]) => void
  setRunStats: (stats: RunStats) => void
  setHasContinuation: (value: boolean) => void
  setPausedRunRemaining: (value: number) => void
  continuationRef: { current: { ctx: FitnessContext; pool: YardState[]; lastGeneration: number } | null }
}): void {
  const {
    result,
    setFinalPool,
    setRunStats,
    setHasContinuation,
    setPausedRunRemaining,
    continuationRef,
  } = args
  // After the pause-time `full`-tier rescore, surface the same finalists list
  // + scorecard the completed branch shows so the user can inspect the current
  // pool's properly-scored yards (search value, fish income, memento wait) at
  // the pause point without having to wait for all remaining generations.
  setFinalPool(result.pool.map(cloneYard))
  if (result.best) {
    setRunStats(
      buildRunStats(
        result.ctx,
        result.best,
        result.totalGenerations,
        result.evolutionTierUsed
      )
    )
  }
  continuationRef.current = {
    ctx: result.ctx,
    pool: result.pool,
    lastGeneration: result.lastGeneration,
  }
  setHasContinuation(true)
  setPausedRunRemaining(result.remainingGenerations)
}

export type GenerationSearchCallbacks = {
  control: RunLoopControl
  onPhase: (phase: OptimizerRunPhase) => void
  onProgress: (step: number, total: number) => void
  onBest: (yard: YardState, options?: OnBestOptions) => void
  profileRunStartedAtRef: { current: number | null }
  setFinalPool: (pool: YardState[]) => void
  setRunStats: (stats: RunStats) => void
  setHasContinuation: (value: boolean) => void
  setEvolutionSolverTier: (tier: SolverTier) => void
  setSearchStrengthAutoBumped: (value: boolean) => void
  continuationRef: {
    current: { ctx: FitnessContext; pool: YardState[]; lastGeneration: number } | null
  }
  setPausedRunRemaining: (value: number | null) => void
}

/** Shared chunk dispatch for fresh and continue runs. */
export async function executeGenerationSearch(args: {
  ctx: FitnessContext
  pools: ItemPools
  genetic: GeneticConfig
  evolutionSolverTier: SolverTier
  pool: YardState[]
  generationStart: number
  generationCount: number
  callbacks: GenerationSearchCallbacks
}): Promise<GenerationChunkResult["kind"]> {
  const chunk = await runGenerationChunk({
    ctx: args.ctx,
    pools: args.pools,
    genetic: args.genetic,
    evolutionSolverTier: args.evolutionSolverTier,
    pool: args.pool,
    generationStart: args.generationStart,
    generationCount: args.generationCount,
    control: args.callbacks.control,
    onPhase: args.callbacks.onPhase,
    onProgress: args.callbacks.onProgress,
    onBest: args.callbacks.onBest,
  })
  if (chunk.kind === "paused") {
    handlePausedGenerationChunk({
      result: chunk,
      setFinalPool: args.callbacks.setFinalPool,
      setRunStats: args.callbacks.setRunStats,
      setHasContinuation: args.callbacks.setHasContinuation,
      setPausedRunRemaining: args.callbacks.setPausedRunRemaining,
      continuationRef: args.callbacks.continuationRef,
    })
    return "paused"
  }
  if (chunk.kind === "completed") {
    handleCompletedGenerationChunk({
      result: chunk,
      profileRunStartedAtRef: args.callbacks.profileRunStartedAtRef,
      setFinalPool: args.callbacks.setFinalPool,
      setRunStats: args.callbacks.setRunStats,
      setHasContinuation: args.callbacks.setHasContinuation,
      setEvolutionSolverTier: args.callbacks.setEvolutionSolverTier,
      setSearchStrengthAutoBumped: args.callbacks.setSearchStrengthAutoBumped,
      continuationRef: args.callbacks.continuationRef,
    })
    return "completed"
  }
  return "aborted"
}
