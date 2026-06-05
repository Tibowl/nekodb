import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import { pauseYardOptimizerProfiling } from "../../utils/yardOptimizer/optimizerProfile"
import type { SolverTier } from "../../utils/yardOptimizer/fitness"
import { terminateYardFitnessWorkerPool } from "../../utils/yardOptimizer/yardFitnessParallel"
import type { YardState } from "../../utils/yardOptimizer/types"
import {
  draftFromBest,
  formatCurrentLayoutSummary,
  type FixedOutdoorDraft,
  type ManualYardDraft,
} from "../../utils/yardOptimizer/layoutDrafts"
import {
  buildOptimizerFitnessContext,
  buildRunMetaFromFitnessStart,
  type OptimizerFitnessLiveSlice,
} from "./buildOptimizerFitnessContext"
import { sortedUniqueNumbers } from "./clientHelpers"
import {
  beginContinueOptimizerRun,
  beginFreshOptimizerRun,
  cleanupRunLoop,
  createInitialSearchPool,
  executeGenerationSearch,
  mergeManualDraftIntoPool,
  type GeneticConfig,
  type GenerationSearchCallbacks,
  type ItemPools,
  type OnBestOptions,
  type RunLoopControl,
} from "./yardOptimizerRunLoop"
import {
  CONTINUE_BATCH,
  DEFAULT_GENERATIONS,
  type ContinuationState,
  type RunMeta,
  type RunStats,
} from "./runTypes"
import type { OptimizerRunPhase } from "./clientHelpers"

/** Min chunk-local generations between `setBest` UI updates (sticky bar + results panel). */
const BEST_UI_UPDATE_EVERY = 3

export type OptimizerRunValidation = {
  optimizeForCats: boolean
  selectedCats: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
}

export type UseOptimizerRunOptions = {
  validation: OptimizerRunValidation
  generations: number
  genetic: GeneticConfig
  pools: ItemPools
  evolutionSolverTier: SolverTier
  setEvolutionSolverTier: (tier: SolverTier) => void
  logOptimizerProfile: boolean
  optimizationParamsKey: string
  fitnessLiveSlice: OptimizerFitnessLiveSlice
  fixedLocationFoodTypes: number[]
  fixedOutdoorDraft: FixedOutdoorDraft
  optimizeForMementoWait: boolean
  currentLayoutRef?: RefObject<HTMLDivElement | null>
}

export type UseOptimizerRunResult = {
  running: boolean
  runPhase: OptimizerRunPhase
  pauseRequested: boolean
  pausedRunRemaining: number | null
  progress: number
  progressTotal: number
  best: YardState | null
  setBest: Dispatch<SetStateAction<YardState | null>>
  manualDraft: ManualYardDraft | null
  setManualDraft: Dispatch<SetStateAction<ManualYardDraft | null>>
  layoutManualNote: string | null
  setLayoutManualNote: (note: string | null) => void
  runMeta: RunMeta | null
  setRunMeta: (meta: RunMeta | null) => void
  error: string | null
  setError: (msg: string | null) => void
  runStats: RunStats | null
  finalPool: YardState[]
  searchStrengthAutoBumped: boolean
  setSearchStrengthAutoBumped: (value: boolean) => void
  hasContinuation: boolean
  showRunCelebration: boolean
  run: () => Promise<void>
  continueRun: () => Promise<void>
  requestPause: () => void
}

type OptimizerRunMode = "fresh" | "continue"

export function useOptimizerRun(options: UseOptimizerRunOptions): UseOptimizerRunResult {
  const {
    validation,
    generations,
    genetic,
    pools,
    evolutionSolverTier,
    setEvolutionSolverTier,
    logOptimizerProfile,
    optimizationParamsKey,
    fitnessLiveSlice,
    fixedLocationFoodTypes,
    fixedOutdoorDraft,
    optimizeForMementoWait,
    currentLayoutRef,
  } = options

  const [running, setRunning] = useState(false)
  const [runPhase, setRunPhase] = useState<OptimizerRunPhase>("idle")
  const [pauseRequested, setPauseRequested] = useState(false)
  const [pausedRunRemaining, setPausedRunRemaining] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [progressTotal, setProgressTotal] = useState(DEFAULT_GENERATIONS)
  const [best, setBest] = useState<YardState | null>(null)
  const [manualDraft, setManualDraft] = useState<ManualYardDraft | null>(null)
  const [layoutManualNote, setLayoutManualNote] = useState<string | null>(null)
  const [runMeta, setRunMeta] = useState<RunMeta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [runStats, setRunStats] = useState<RunStats | null>(null)
  const [finalPool, setFinalPool] = useState<YardState[]>([])
  const [searchStrengthAutoBumped, setSearchStrengthAutoBumped] = useState(false)
  const [hasContinuation, setHasContinuation] = useState(false)
  const [showRunCelebration, setShowRunCelebration] = useState(false)

  const continuationRef = useRef<ContinuationState | null>(null)
  const wasRunningRef = useRef(false)
  const pauseRequestedRef = useRef(false)
  const runningRef = useRef(false)
  const unmountedRef = useRef(false)
  const profileRunStartedAtRef = useRef<number | null>(null)
  const pendingBestRef = useRef<YardState | null>(null)
  const chunkProgressStepRef = useRef(0)
  const lastBestUiAtStepRef = useRef(-1)

  const resetBestUiThrottle = useCallback(() => {
    pendingBestRef.current = null
    chunkProgressStepRef.current = 0
    lastBestUiAtStepRef.current = -1
  }, [])

  const onBestForUi = useCallback((yard: YardState, options?: OnBestOptions) => {
    pendingBestRef.current = yard
    const step = chunkProgressStepRef.current
    if (
      options?.flush ||
      lastBestUiAtStepRef.current < 0 ||
      step - lastBestUiAtStepRef.current >= BEST_UI_UPDATE_EVERY
    ) {
      setBest(yard)
      lastBestUiAtStepRef.current = step
    }
  }, [])

  const onProgressForUi = useCallback((step: number, _total: number) => {
    chunkProgressStepRef.current = step
    setProgress(step)
    const pending = pendingBestRef.current
    if (
      pending &&
      lastBestUiAtStepRef.current >= 0 &&
      step - lastBestUiAtStepRef.current >= BEST_UI_UPDATE_EVERY
    ) {
      setBest(pending)
      lastBestUiAtStepRef.current = step
    }
  }, [])

  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      continuationRef.current = null
      if (!runningRef.current) {
        terminateYardFitnessWorkerPool()
      }
    }
  }, [])

  useEffect(() => {
    if (!showRunCelebration) return
    const t = setTimeout(() => setShowRunCelebration(false), 4000)
    return () => clearTimeout(t)
  }, [showRunCelebration])

  useEffect(() => {
    if (
      wasRunningRef.current &&
      !running &&
      !error &&
      best &&
      pausedRunRemaining == null
    ) {
      setShowRunCelebration(true)
      setTimeout(() => {
        currentLayoutRef?.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        })
      }, 80)
    }
    wasRunningRef.current = running
  }, [running, error, best, pausedRunRemaining, currentLayoutRef])

  useEffect(() => {
    if (!best || running) return
    setManualDraft(draftFromBest(best))
    setLayoutManualNote(null)
  }, [best, running])

  useEffect(() => {
    continuationRef.current = null
    setHasContinuation(false)
    pauseRequestedRef.current = false
    setPauseRequested(false)
    setPausedRunRemaining(null)
  }, [optimizationParamsKey])

  const clearPauseRequest = useCallback(() => {
    pauseRequestedRef.current = false
    setPauseRequested(false)
  }, [])

  const requestPause = useCallback(() => {
    pauseRequestedRef.current = true
    setPauseRequested(true)
  }, [])

  const runLoopControl: RunLoopControl = useMemo(
    () => ({
      unmountedRef,
      pauseRequestedRef,
      runningRef,
    }),
    []
  )

  const generationSearchCallbacks = useMemo(
    (): GenerationSearchCallbacks => ({
      control: runLoopControl,
      onPhase: setRunPhase,
      onProgress: onProgressForUi,
      onBest: onBestForUi,
      profileRunStartedAtRef,
      setFinalPool,
      setRunStats,
      setHasContinuation,
      setEvolutionSolverTier,
      setSearchStrengthAutoBumped,
      continuationRef,
      setPausedRunRemaining,
    }),
    [runLoopControl, setEvolutionSolverTier, onProgressForUi, onBestForUi]
  )

  const lifecycleActions = useMemo(
    () => ({
      setError,
      clearPauseRequest,
      setPausedRunRemaining,
      setRunning,
      setRunPhase,
      setSearchStrengthAutoBumped,
      setProgress,
      setProgressTotal,
      setRunStats,
      setFinalPool,
      setHasContinuation,
      setBest,
      setRunMeta,
      continuationRef,
    }),
    [clearPauseRequest]
  )

  const executeRun = useCallback(
    async (mode: OptimizerRunMode) => {
      const generationCount =
        mode === "fresh" ? generations : (pausedRunRemaining ?? CONTINUE_BATCH)

      const setupError =
        mode === "fresh"
          ? beginFreshOptimizerRun(
              validation,
              lifecycleActions,
              runLoopControl,
              generationCount,
              logOptimizerProfile,
              profileRunStartedAtRef
            )
          : beginContinueOptimizerRun(
              validation,
              lifecycleActions,
              runLoopControl,
              generationCount,
              logOptimizerProfile,
              profileRunStartedAtRef
            )
      if (setupError) return

      resetBestUiThrottle()

      let ctx = null as ReturnType<typeof buildOptimizerFitnessContext> | null
      let pool: YardState[] | null = null
      let generationStart = 0

      if (mode === "fresh") {
        const rowsApplied = fitnessLiveSlice.applyFeasibilityGate
          ? fitnessLiveSlice.feasibilityRows
          : []
        ctx = buildOptimizerFitnessContext(null, fitnessLiveSlice)
        setRunMeta(
          buildRunMetaFromFitnessStart(ctx, {
            yardPreset: fitnessLiveSlice.yardPreset,
            pinIndoor: fitnessLiveSlice.draftPinFlags.pinIndoor,
            pinOutdoor: fitnessLiveSlice.draftPinFlags.pinOutdoor,
            objective: fitnessLiveSlice.objective,
            catStartComeCounts: optimizeForMementoWait
              ? fitnessLiveSlice.catStartComeCounts
              : {},
            feasibilityRowsApplied: rowsApplied,
            allowedFoodsIndoor: [...pools.allowedFoodsIndoor],
            allowedFoodsOutdoor: [...pools.allowedFoodsOutdoor],
            fixedFoodTypes: fixedLocationFoodTypes,
            fixedItemIds: sortedUniqueNumbers([
              ...fitnessLiveSlice.fixedIndoorGoodieIds,
              ...fitnessLiveSlice.fixedOutdoorGoodieIds,
            ]),
            largeItemCount: pools.largeItems.length,
            smallItemCount: pools.smallItems.length,
            poolSize: genetic.poolSize,
            offspringScoreMode: genetic.offspringScoreMode,
            currentLayoutSummary: formatCurrentLayoutSummary(
              fitnessLiveSlice.fixedIndoorDraft,
              fixedOutdoorDraft
            ),
          })
        )
      } else {
        const cont = continuationRef.current
        if (!cont) return
        ctx = cont.ctx
        pool = cont.pool
        generationStart = cont.lastGeneration
      }

      await new Promise((r) => setTimeout(r, 0))

      try {
        if (mode === "fresh") {
          pool = await createInitialSearchPool(
            ctx!,
            pools,
            genetic.poolSize,
            evolutionSolverTier,
            runLoopControl
          )
          if (!pool) return
          generationStart = 0
        } else {
          const cont = continuationRef.current
          if (!cont || !pool) return

          const pinFlags = runMeta
            ? { pinIndoor: runMeta.pinIndoor, pinOutdoor: runMeta.pinOutdoor }
            : fitnessLiveSlice.draftPinFlags
          if (manualDraft && best && runMeta) {
            const merged = await mergeManualDraftIntoPool(
              cont.ctx,
              pool,
              manualDraft,
              best,
              pinFlags,
              pools,
              genetic.poolSize,
              runMeta
            )
            if ("error" in merged) {
              setError(merged.error)
              runningRef.current = false
              setRunning(false)
              setRunPhase("idle")
              return
            }
            pool = merged.pool
          }
        }

        await executeGenerationSearch({
          ctx: ctx!,
          pools,
          genetic,
          evolutionSolverTier,
          pool: pool!,
          generationStart,
          generationCount,
          callbacks: generationSearchCallbacks,
        })
      } catch (e) {
        pauseYardOptimizerProfiling()
        if (mode === "fresh") {
          setRunMeta(null)
        }
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        cleanupRunLoop(runLoopControl, clearPauseRequest, setRunning, setRunPhase)
      }
    },
    [
      generations,
      pausedRunRemaining,
      validation,
      lifecycleActions,
      runLoopControl,
      logOptimizerProfile,
      fitnessLiveSlice,
      optimizeForMementoWait,
      fixedLocationFoodTypes,
      fixedOutdoorDraft,
      pools,
      genetic,
      evolutionSolverTier,
      manualDraft,
      best,
      runMeta,
      generationSearchCallbacks,
      clearPauseRequest,
      resetBestUiThrottle,
    ]
  )

  const run = useCallback(() => executeRun("fresh"), [executeRun])
  const continueRun = useCallback(() => executeRun("continue"), [executeRun])

  return {
    running,
    runPhase,
    pauseRequested,
    pausedRunRemaining,
    progress,
    progressTotal,
    best,
    setBest,
    manualDraft,
    setManualDraft,
    layoutManualNote,
    setLayoutManualNote,
    runMeta,
    setRunMeta,
    error,
    setError,
    runStats,
    finalPool,
    searchStrengthAutoBumped,
    setSearchStrengthAutoBumped,
    hasContinuation,
    showRunCelebration,
    run,
    continueRun,
    requestPause,
  }
}
