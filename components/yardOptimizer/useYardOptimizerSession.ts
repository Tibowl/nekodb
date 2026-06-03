import { useCallback, useEffect, useMemo, useState } from "react"
import {
  DEFAULT_ALLOWED_FOODS_INDOOR,
  DEFAULT_ALLOWED_FOODS_OUTDOOR,
  GA_EVOLUTION_SOLVER_TIER,
  DEFAULT_GENETIC,
  type OffspringScoreMode,
} from "../../utils/yardOptimizer/config"
import {
  defaultFitnessAnalyzerOptions,
  type FitnessAnalyzerOptions,
  type FitnessObjective,
  type FitnessObjectiveTerm,
  type SolverTier,
} from "../../utils/yardOptimizer/fitness"
import { defaultFeasibilityRows, type FeasibilityRow } from "../../utils/yardOptimizer/fitnessConstraints"
import {
  defaultFixedIndoorDraft,
  defaultFixedOutdoorDraft,
  deriveYardPresetFromSlots,
  draftPinFlagsFromDrafts,
  type FixedIndoorDraft,
  type FixedOutdoorDraft,
  type YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import {
  applyYardOptimizerSession,
  buildYardOptimizerSessionPayload,
  defaultSession,
  parseSessionConfig,
  serializeSession,
  type CatStartComeCounts,
  type GoalMode,
  type YardOptimizerSessionActions,
} from "../yardOptimizerSessionConfig"
import { defaultSecondaryForPrimaryObjective } from "../yardOptimizerDisplay"
import { DEFAULT_GENERATIONS } from "./runTypes"

export const YARD_OPTIMIZER_CONFIG_SESSION_KEY = "nekodb-yard-optimizer-config-v2"

export function clearPersistedOptimizerConfig(): void {
  try {
    sessionStorage.removeItem(YARD_OPTIMIZER_CONFIG_SESSION_KEY)
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(YARD_OPTIMIZER_CONFIG_SESSION_KEY)
  } catch {
    /* ignore */
  }
}

export function useYardOptimizerSession() {
  const [selectedCats, setSelectedCats] = useState<number[]>([])
  const [catStartComeCounts, setCatStartComeCounts] = useState<CatStartComeCounts>({})
  const [secondaryObjective, setSecondaryObjective] =
    useState<FitnessObjective | null>(null)
  const [fitnessObjective, setFitnessObjectiveState] =
    useState<FitnessObjective>("netGoldEquiv")

  const setFitnessObjective = useCallback((objective: FitnessObjective) => {
    setFitnessObjectiveState(objective)
    setSecondaryObjective(defaultSecondaryForPrimaryObjective(objective))
  }, [])
  const [goalMode, setGoalMode] = useState<GoalMode>("guided")
  const [showMultiGoalOption, setShowMultiGoalOption] = useState(true)
  const [objectiveBlendTerms, setObjectiveBlendTerms] = useState<FitnessObjectiveTerm[]>([])
  const [fixedIndoorDraft, setFixedIndoorDraft] =
    useState<FixedIndoorDraft>(() => defaultFixedIndoorDraft())
  const [fixedOutdoorDraft, setFixedOutdoorDraft] =
    useState<FixedOutdoorDraft>(() => defaultFixedOutdoorDraft())
  const yardPreset = useMemo(
    (): YardPreset =>
      deriveYardPresetFromSlots(fixedIndoorDraft, fixedOutdoorDraft),
    [fixedIndoorDraft, fixedOutdoorDraft]
  )
  const draftPinFlags = useMemo(
    () => draftPinFlagsFromDrafts(fixedIndoorDraft, fixedOutdoorDraft),
    [fixedIndoorDraft, fixedOutdoorDraft]
  )
  const [applyFeasibilityGate, setApplyFeasibilityGate] = useState(true)
  const [feasibilityRows, setFeasibilityRows] = useState<FeasibilityRow[]>(() =>
    defaultFeasibilityRows()
  )
  const [requiredGoodieIds, setRequiredGoodieIds] = useState<number[]>([])
  const [forbiddenGoodieIds, setForbiddenGoodieIds] = useState<number[]>([])
  const [selectedFoodsIndoor, setSelectedFoodsIndoor] = useState<number[]>(() => [
    ...DEFAULT_ALLOWED_FOODS_INDOOR,
  ])
  const [selectedFoodsOutdoor, setSelectedFoodsOutdoor] = useState<number[]>(() => [
    ...DEFAULT_ALLOWED_FOODS_OUTDOOR,
  ])
  const [poolEditorOpen, setPoolEditorOpen] = useState(false)
  const [locationEditorOpen, setLocationEditorOpen] = useState(false)
  const [seasonalPoolOnly, setSeasonalPoolOnly] = useState(true)
  const [generations, setGenerations] = useState(DEFAULT_GENERATIONS)
  const [poolSize, setPoolSize] = useState(DEFAULT_GENETIC.poolSize)
  const [tournamentK, setTournamentK] = useState(DEFAULT_GENETIC.tournamentK)
  const [mutationRate, setMutationRate] = useState(DEFAULT_GENETIC.mutationRate)
  const [mutationOffspringRate, setMutationOffspringRate] = useState(
    DEFAULT_GENETIC.mutationOffspringRate
  )
  const [foodMutationOffspringRate, setFoodMutationOffspringRate] = useState(
    DEFAULT_GENETIC.foodMutationOffspringRate
  )
  const [openSlotExplorationRate, setOpenSlotExplorationRate] = useState(
    DEFAULT_GENETIC.openSlotExplorationRate
  )
  const [offspringScoreMode, setOffspringScoreMode] =
    useState<OffspringScoreMode>(DEFAULT_GENETIC.offspringScoreMode)
  const [survivorSelectionEnabled, setSurvivorSelectionEnabled] = useState(
    DEFAULT_GENETIC.survivorSelection.enabled
  )
  const [survivorExploratoryRate, setSurvivorExploratoryRate] = useState(
    DEFAULT_GENETIC.survivorSelection.exploratoryRate
  )
  const [survivorInitialRankTemperature, setSurvivorInitialRankTemperature] =
    useState(DEFAULT_GENETIC.survivorSelection.initialRankTemperature)
  const [survivorFinalRankTemperature, setSurvivorFinalRankTemperature] =
    useState(DEFAULT_GENETIC.survivorSelection.finalRankTemperature)
  const [evolutionSolverTier, setEvolutionSolverTier] = useState<SolverTier>(
    () => GA_EVOLUTION_SOLVER_TIER
  )
  const [logOptimizerProfile, setLogOptimizerProfile] = useState(false)
  const [analyzerOptions, setAnalyzerOptions] = useState<FitnessAnalyzerOptions>(
    () => ({ ...defaultFitnessAnalyzerOptions(), itemDamageState: 2 })
  )
  const [configHydrated, setConfigHydrated] = useState(false)

  const sessionActions = useMemo(
    (): YardOptimizerSessionActions => ({
      setSelectedCats,
      setCatStartComeCounts,
      setSecondaryObjective,
      setFitnessObjective: setFitnessObjectiveState,
      setGoalMode,
      setShowMultiGoalOption,
      setObjectiveBlendTerms,
      setFixedIndoorDraft,
      setFixedOutdoorDraft,
      setApplyFeasibilityGate,
      setFeasibilityRows,
      setRequiredGoodieIds,
      setForbiddenGoodieIds,
      setSelectedFoodsIndoor,
      setSelectedFoodsOutdoor,
      setPoolEditorOpen,
      setLocationEditorOpen,
      setGenerations,
      setPoolSize,
      setTournamentK,
      setMutationRate,
      setMutationOffspringRate,
      setFoodMutationOffspringRate,
      setOpenSlotExplorationRate,
      setOffspringScoreMode,
      setSurvivorSelectionEnabled,
      setSurvivorExploratoryRate,
      setSurvivorInitialRankTemperature,
      setSurvivorFinalRankTemperature,
      setAnalyzerOptions,
      setSeasonalPoolOnly,
      setEvolutionSolverTier,
      setLogOptimizerProfile,
    }),
    []
  )

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(YARD_OPTIMIZER_CONFIG_SESSION_KEY)
      if (raw) {
        const p = parseSessionConfig(raw)
        if (p) applyYardOptimizerSession(p, sessionActions)
      }
    } catch {
      /* ignore */
    }
    queueMicrotask(() => setConfigHydrated(true))
  }, [sessionActions])

  const sessionPayload = useMemo(
    () =>
      buildYardOptimizerSessionPayload({
        selectedCats,
        catStartComeCounts,
        secondaryObjective,
        fitnessObjective,
        goalMode,
        showMultiGoalOption,
        objectiveBlendTerms,
        fixedIndoorDraft,
        fixedOutdoorDraft,
        applyFeasibilityGate,
        feasibilityRows,
        requiredGoodieIds,
        forbiddenGoodieIds,
        selectedFoodsIndoor,
        selectedFoodsOutdoor,
        poolEditorOpen,
        locationEditorOpen,
        generations,
        poolSize,
        tournamentK,
        mutationRate,
        mutationOffspringRate,
        foodMutationOffspringRate,
        openSlotExplorationRate,
        offspringScoreMode,
        survivorSelectionEnabled,
        survivorExploratoryRate,
        survivorInitialRankTemperature,
        survivorFinalRankTemperature,
        analyzerOptions,
        seasonalPoolOnly,
        evolutionSolverTier,
        logOptimizerProfile,
      }),
    [
      selectedCats,
      catStartComeCounts,
      secondaryObjective,
      fitnessObjective,
      goalMode,
      showMultiGoalOption,
      objectiveBlendTerms,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      applyFeasibilityGate,
      feasibilityRows,
      requiredGoodieIds,
      forbiddenGoodieIds,
      selectedFoodsIndoor,
      selectedFoodsOutdoor,
      poolEditorOpen,
      locationEditorOpen,
      generations,
      poolSize,
      tournamentK,
      mutationRate,
      mutationOffspringRate,
      foodMutationOffspringRate,
      openSlotExplorationRate,
      offspringScoreMode,
      survivorSelectionEnabled,
      survivorExploratoryRate,
      survivorInitialRankTemperature,
      survivorFinalRankTemperature,
      analyzerOptions,
      seasonalPoolOnly,
      evolutionSolverTier,
      logOptimizerProfile,
    ]
  )

  useEffect(() => {
    if (!configHydrated) return
    try {
      sessionStorage.setItem(
        YARD_OPTIMIZER_CONFIG_SESSION_KEY,
        serializeSession(sessionPayload)
      )
    } catch {
      /* ignore */
    }
  }, [configHydrated, sessionPayload])

  const resetConfig = useCallback(() => {
    applyYardOptimizerSession(defaultSession(), sessionActions)
    clearPersistedOptimizerConfig()
  }, [sessionActions])

  const applyFullYardDrafts = useCallback(() => {
    setFixedIndoorDraft(defaultFixedIndoorDraft("open"))
    setFixedOutdoorDraft(defaultFixedOutdoorDraft("open"))
  }, [])

  const applyOutdoorOnlyDrafts = useCallback(() => {
    setFixedIndoorDraft(defaultFixedIndoorDraft("closed"))
    setFixedOutdoorDraft(defaultFixedOutdoorDraft("open"))
  }, [])

  return {
    configHydrated,
    selectedCats,
    setSelectedCats,
    catStartComeCounts,
    setCatStartComeCounts,
    secondaryObjective,
    setSecondaryObjective,
    fitnessObjective,
    setFitnessObjective,
    goalMode,
    setGoalMode,
    showMultiGoalOption,
    setShowMultiGoalOption,
    objectiveBlendTerms,
    setObjectiveBlendTerms,
    fixedIndoorDraft,
    setFixedIndoorDraft,
    fixedOutdoorDraft,
    setFixedOutdoorDraft,
    yardPreset,
    draftPinFlags,
    applyFeasibilityGate,
    setApplyFeasibilityGate,
    feasibilityRows,
    setFeasibilityRows,
    requiredGoodieIds,
    setRequiredGoodieIds,
    forbiddenGoodieIds,
    setForbiddenGoodieIds,
    selectedFoodsIndoor,
    setSelectedFoodsIndoor,
    selectedFoodsOutdoor,
    setSelectedFoodsOutdoor,
    poolEditorOpen,
    setPoolEditorOpen,
    locationEditorOpen,
    setLocationEditorOpen,
    seasonalPoolOnly,
    setSeasonalPoolOnly,
    generations,
    setGenerations,
    poolSize,
    setPoolSize,
    tournamentK,
    setTournamentK,
    mutationRate,
    setMutationRate,
    mutationOffspringRate,
    setMutationOffspringRate,
    foodMutationOffspringRate,
    setFoodMutationOffspringRate,
    openSlotExplorationRate,
    setOpenSlotExplorationRate,
    offspringScoreMode,
    setOffspringScoreMode,
    survivorSelectionEnabled,
    setSurvivorSelectionEnabled,
    survivorExploratoryRate,
    setSurvivorExploratoryRate,
    survivorInitialRankTemperature,
    setSurvivorInitialRankTemperature,
    survivorFinalRankTemperature,
    setSurvivorFinalRankTemperature,
    evolutionSolverTier,
    setEvolutionSolverTier,
    logOptimizerProfile,
    setLogOptimizerProfile,
    analyzerOptions,
    setAnalyzerOptions,
    resetConfig,
    applyFullYardDrafts,
    applyOutdoorOnlyDrafts,
  }
}

export type YardOptimizerSessionState = ReturnType<typeof useYardOptimizerSession>
