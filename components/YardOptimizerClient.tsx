import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  DEFAULT_ALLOWED_FOODS_INDOOR,
  DEFAULT_ALLOWED_FOODS_OUTDOOR,
  PLACES_INDOOR,
  PLACES_OUTDOOR,
  DEFAULT_GENETIC,
} from "../utils/yardOptimizer/config"
import {
  mementoTimeDisplayScale,
  SILVER_FISH_PER_GOLD_FISH,
  type MementoTimeDisplayBasis,
} from "../utils/yardOptimizer/foodBowlEconomy"
import {
  assignValue,
  getYardAnalyzerSummary,
  runMementoAnalysis,
  FITNESS_HARD_REJECT_NONE,
  FITNESS_HARD_REJECT_RULES,
  ANALYZER_WEATHER_CHOICES,
  type FitnessContext,
  type FitnessObjective,
  type FitnessObjectiveTerm,
  type YardAnalyzerSummary,
} from "../utils/yardOptimizer/fitness"
import {
  FEASIBILITY_METRIC_LABELS,
  formatFeasibilityRule,
  formatFeasibilitySummary,
  isDefaultFeasibilityRows,
  type FeasibilityRow,
} from "../utils/yardOptimizer/fitnessConstraints"
import {
  cloneYard,
  defaultItemPools,
  inactiveSeasonalToyIdsForMonth,
  mergeFixedHalvesIntoYard,
  validateYard,
  yardSignature,
} from "../utils/yardOptimizer/yardCore"
import {
  applyDraftToPartialYard,
  draftFromBest,
  draftsEqual,
  fixedFoodTypesFromDrafts,
  fixedIndoorGoodieIdsFromDraft,
  fixedOutdoorGoodieIdsFromDraft,
  generationConstraintsFromDrafts,
  isFixedSlotValue,
  validateManualDraft,
} from "../utils/yardOptimizer/layoutDrafts"
import type { YardState } from "../utils/yardOptimizer/types"
import { cats } from "../utils/yardOptimizer/gameData"
import {
  catGroupForId,
  catIconImageMeta,
  goodieIconImageMeta,
} from "../utils/yardOptimizer/clientAssets"
import { useLanguage } from "../hooks/useLanguage"
import { translate as translateTable } from "../utils/localization/translate"
import FormattedLink from "./FormattedLink"
import { clampComeCountInput, offspringExplorationPresetFor } from "./yardOptimizerSessionConfig"
import { buildOptimizerFitnessContext } from "./yardOptimizer/buildOptimizerFitnessContext"
import { mergeFeasibilityRowsApplied } from "./yardOptimizer/optimizerRunSnapshot"
import { compileYardPresetSummary } from "./yardOptimizer/compileYardPresetSummary"
import { useYardOptimizerSession } from "./yardOptimizer/useYardOptimizerSession"
import RunControlBar from "./yardOptimizer/RunControlBar"
import {
  FOOD_TYPE_IDS,
  MINUTES_PER_DAY,
  TIEBREAKER_OBJECTIVE_OPTION_ROWS,
  UnitChip,
  feasibilityMetricDisplayValue,
  feasibilityRuleMiss,
  feasibilityRulePasses,
  formatExpectedMementoTime,
  formatAnalyzerWeather,
  formatFitnessObjectiveDisplay,
  formatPercent,
  formatRawScore,
  formatStatNumber,
  goalPriorityFormulaTerm,
  isNetFishObjective,
  mementoDisplayUnitLabel,
  multiGoalScoringContextParts,
  objectiveHelpText,
  objectiveLabelLong,
  objectiveLabelShort,
  objectiveNeedsTargetCats,
  objectiveUnitLabel,
  percentileSorted,
  scoreHasDisplayUnit,
} from "./yardOptimizerDisplay"
import {
  AdvancedSubcard,
  ConfigFold,
  SettingsChoice,
} from "./yardOptimizer/primitives"
import {
  ObjectivePanel,
  TargetCatsPickerSection,
} from "./yardOptimizer/ObjectivePanel"
import { SearchSettingsPanel } from "./yardOptimizer/SearchSettingsPanel"
import { MementoAnalysisPanel } from "./yardOptimizer/MementoAnalysisPanel"
import { YardItemPoolEditor } from "./yardOptimizer/YardItemPoolEditor"
import { YardLocationPreferencesEditor } from "./yardOptimizer/YardLocationPreferencesEditor"
import { FeasibilityConstraintsEditor } from "./yardOptimizer/FeasibilityConstraintsEditor"
import { ManualLayoutEditor } from "./yardOptimizer/ManualLayoutEditor"
import { YardOptimizerResultsPanel } from "./yardOptimizer/YardOptimizerResultsPanel"
import {
  geneticSearchModeLabel,
  formatRawIdList,
  goodieConditionLabel,
  optimizerRunLabel,
  sortedUniqueNumbers,
  sortGoodieIds,
} from "./yardOptimizer/clientHelpers"
import {
  YardOptimizerWalkthrough,
  type WalkthroughPage,
} from "./yardOptimizer/YardOptimizerWalkthrough"
import {
  goodieGameFinderInfo,
} from "./yardOptimizer/goodieShopData"
import { isRareCatId } from "../utils/cat/getCatType"
import { useOptimizerRun } from "./yardOptimizer/useOptimizerRun"
import { continuationInvalidationKey } from "./yardOptimizer/continuationInvalidationKey"
import { CONTINUE_BATCH, type RunStats } from "./yardOptimizer/runTypes"
import type { TubbsMode } from "../utils/yardOptimizer/tubbsMode"
import { TUBBS_MODE_OPTIONS } from "../utils/yardOptimizer/tubbsMode"

const WALKTHROUGH_STORAGE_KEY = "nekodb-yard-optimizer-walkthrough-v1"

function readWalkthroughComplete(): boolean {
  try {
    return localStorage.getItem(WALKTHROUGH_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/** Same row order as `CatRecordTable` / the Cats page (not alphabetical). */
function sortCatIdsByTableOrder(
  ids: number[],
  orderMap: Map<number, number>
): number[] {
  return [...ids].sort(
    (a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0)
  )
}

export default function YardOptimizerClient() {
  const { translate } = useLanguage()
  const [walkthroughComplete, setWalkthroughComplete] = useState<boolean | null>(null)
  const [walkthroughInitialPage, setWalkthroughInitialPage] =
    useState<WalkthroughPage>("objective")
  const [highlightTargetCats, setHighlightTargetCats] = useState(false)
  const session = useYardOptimizerSession()
  const {
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
  } = session
  const [mementoTimeDisplayBasis, setMementoTimeDisplayBasis] =
    useState<MementoTimeDisplayBasis>("shortestBowlRefill")
  const offspringExplorationPreset = offspringExplorationPresetFor(
    mutationOffspringRate,
    foodMutationOffspringRate,
    openSlotExplorationRate,
    offspringScoreMode
  )
  const fixedIndoorGoodieIds = useMemo(
    () => fixedIndoorGoodieIdsFromDraft(fixedIndoorDraft),
    [fixedIndoorDraft]
  )
  const fixedOutdoorGoodieIds = useMemo(
    () => fixedOutdoorGoodieIdsFromDraft(fixedOutdoorDraft),
    [fixedOutdoorDraft]
  )
  const fixedLocationFoodTypes = useMemo(
    () => fixedFoodTypesFromDrafts(fixedIndoorDraft, fixedOutdoorDraft),
    [fixedIndoorDraft, fixedOutdoorDraft]
  )
  const fixedLocationGoodieIds = useMemo(
    () => sortedUniqueNumbers([...fixedIndoorGoodieIds, ...fixedOutdoorGoodieIds]),
    [fixedIndoorGoodieIds, fixedOutdoorGoodieIds]
  )
  const yardGenerationConstraints = useMemo(
    () => generationConstraintsFromDrafts(fixedIndoorDraft, fixedOutdoorDraft),
    [fixedIndoorDraft, fixedOutdoorDraft]
  )
  const [copyYardViewOpen, setCopyYardViewOpen] = useState(false)
  const [selectedPreviewYardId, setSelectedPreviewYardId] = useState(0)
  const [showFishMementoAnalysis, setShowFishMementoAnalysis] = useState(false)
  const currentLayoutRef = useRef<HTMLDivElement | null>(null)
  const showTargetCatsHighlight =
    highlightTargetCats && selectedCats.length === 0

  // Client-only: read walkthrough flag after hydration (must match SSR initial `null`).
  useEffect(() => {
    queueMicrotask(() => setWalkthroughComplete(readWalkthroughComplete()))
  }, [])

  useEffect(() => {
    if (!highlightTargetCats) return
    const t = setTimeout(() => setHighlightTargetCats(false), 12000)
    return () => clearTimeout(t)
  }, [highlightTargetCats])

  const completeWalkthrough = useCallback((mode: "skip" | "fish" | "memento") => {
    if (mode === "fish") {
      setFitnessObjective("netGoldEquiv")
      setHighlightTargetCats(false)
    } else if (mode === "memento") {
      setFitnessObjective("mementoExpectedDays")
      setHighlightTargetCats(true)
    } else {
      setHighlightTargetCats(false)
    }
    try {
      localStorage.setItem(WALKTHROUGH_STORAGE_KEY, "1")
    } catch {
      /* ignore */
    }
    setWalkthroughComplete(true)
    const scrollId =
      mode === "memento" ? "yard-optimizer-target-cats" : "yard-optimizer-config"
    setTimeout(() => {
      document.getElementById(scrollId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }, 120)
  }, [setFitnessObjective])

  const showWalkthroughAgain = useCallback(() => {
    setWalkthroughInitialPage("objective")
    setWalkthroughComplete(false)
    setHighlightTargetCats(false)
    setSecondaryObjective(null)
    setSelectedFoodsIndoor([...DEFAULT_ALLOWED_FOODS_INDOOR])
    setSelectedFoodsOutdoor([...DEFAULT_ALLOWED_FOODS_OUTDOOR])
    applyFullYardDrafts()
  }, [
    applyFullYardDrafts,
    setSecondaryObjective,
    setSelectedFoodsIndoor,
    setSelectedFoodsOutdoor,
  ])

  const scrollToObjectiveConfig = useCallback(() => {
    document.getElementById("yard-optimizer-objective")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, [])

  const chooseGuidedObjective = useCallback((objective: FitnessObjective) => {
    setGoalMode("guided")
    setApplyFeasibilityGate(true)
    setFitnessObjective(objective)
  }, [setApplyFeasibilityGate, setFitnessObjective, setGoalMode])

  const chooseMultiGoal = useCallback(() => {
    setShowMultiGoalOption(true)
    setGoalMode("multi")
    setApplyFeasibilityGate(false)
  }, [setApplyFeasibilityGate, setGoalMode, setShowMultiGoalOption])

  const activeObjectiveBlendTerms = useMemo(
    () => (goalMode === "multi" ? objectiveBlendTerms : []),
    [goalMode, objectiveBlendTerms]
  )
  const activeScoringParts = useMemo(
    () =>
      goalMode === "multi"
        ? multiGoalScoringContextParts(objectiveBlendTerms, fitnessObjective)
        : { objective: fitnessObjective, blendTerms: [] },
    [goalMode, objectiveBlendTerms, fitnessObjective]
  )
  const activeSecondaryObjective = secondaryObjective
  const optimizeForCats =
    (goalMode === "guided" && objectiveNeedsTargetCats(fitnessObjective)) ||
    objectiveNeedsTargetCats(activeSecondaryObjective) ||
    activeObjectiveBlendTerms.some((term) =>
      objectiveNeedsTargetCats(term.objective)
    )
  const optimizeForMementoWait =
    (goalMode === "guided" && fitnessObjective === "mementoExpectedDays") ||
    activeObjectiveBlendTerms.some(
      (term) => term.objective === "mementoExpectedDays"
    )

  const pools = useMemo(() => {
    const base = defaultItemPools({
      seasonalOnly: seasonalPoolOnly,
    })
    return {
      ...base,
      allowedFoodsIndoor: sortGoodieIds(selectedFoodsIndoor),
      allowedFoodsOutdoor: sortGoodieIds(selectedFoodsOutdoor),
    }
  }, [selectedFoodsIndoor, selectedFoodsOutdoor, seasonalPoolOnly])

  useEffect(() => {
    setFixedIndoorDraft((draft) =>
      isFixedSlotValue(draft.foodIndoor) && !selectedFoodsIndoor.includes(draft.foodIndoor)
        ? { ...draft, foodIndoor: "open" }
        : draft
    )
  }, [selectedFoodsIndoor, setFixedIndoorDraft])

  useEffect(() => {
    setFixedOutdoorDraft((draft) =>
      isFixedSlotValue(draft.foodOutdoor) && !selectedFoodsOutdoor.includes(draft.foodOutdoor)
        ? { ...draft, foodOutdoor: "open" }
        : draft
    )
  }, [selectedFoodsOutdoor, setFixedOutdoorDraft])

  const offSeasonSeasonalCount = useMemo(
    () => inactiveSeasonalToyIdsForMonth().length,
    []
  )

  const foodDisplayName = useCallback(
    (foodTypeId: number) =>
      translate(translateTable("Goods", `GoodsName${foodTypeId}`)),
    [translate]
  )

  const goodieDisplayName = useCallback(
    (goodieId: number) =>
      translate(translateTable("Goods", `GoodsName${goodieId}`)),
    [translate]
  )

  /** Row index in `CatRecordTable`, used to sort selections like the Cats page order. */
  const catOrderIndex = useMemo(() => {
    const m = new Map<number, number>()
    for (let i = 0; i < cats.length; i++) {
      m.set(cats[i].Id, i)
    }
    return m
  }, [])

  /**
   * Mean-field scoring context for layouts under the active optimizer session.
   * Intentionally **does not** depend on `best` so clicking Apply always scores through the same
   * frozen objective/constraints as `runMeta`, then React picks up fresh `best.value` / run stats.
   */
  const fitnessLiveSlice = useMemo(
    () => ({
      yardPreset,
      draftPinFlags,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      objective: activeScoringParts.objective,
      objectiveBlendTerms: activeScoringParts.blendTerms,
      secondaryObjective: activeSecondaryObjective,
      selectedCats,
      catStartComeCounts,
      applyFeasibilityGate,
      feasibilityRows,
      requiredGoodieIds,
      fixedIndoorGoodieIds,
      fixedOutdoorGoodieIds,
      forbiddenGoodieIds,
      analyzerOptions,
      pools,
      yardGenerationConstraints,
      sortCatIds: (ids: number[]) => sortCatIdsByTableOrder(ids, catOrderIndex),
      sortGoodieIds,
    }),
    [
      yardPreset,
      draftPinFlags,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      activeScoringParts,
      activeSecondaryObjective,
      selectedCats,
      catStartComeCounts,
      applyFeasibilityGate,
      feasibilityRows,
      requiredGoodieIds,
      fixedIndoorGoodieIds,
      fixedOutdoorGoodieIds,
      forbiddenGoodieIds,
      fixedIndoorDraft,
      analyzerOptions,
      pools,
      yardGenerationConstraints,
      catOrderIndex,
    ]
  )

  const optimizationParamsKey = useMemo(
    () =>
      continuationInvalidationKey({
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
        generations,
        yardPreset,
        fixedIndoorDraft,
        fixedOutdoorDraft,
        fitnessObjective,
        activeObjectiveBlendTerms,
        activeSecondaryObjective,
        applyFeasibilityGate,
        feasibilityRows,
        requiredGoodieIds: sortGoodieIds(requiredGoodieIds),
        requiredIndoorGoodieIds: sortGoodieIds(fixedIndoorGoodieIds),
        requiredOutdoorGoodieIds: sortGoodieIds(fixedOutdoorGoodieIds),
        forbiddenGoodieIds: sortGoodieIds(forbiddenGoodieIds),
        selectedFoodsIndoor: sortGoodieIds(selectedFoodsIndoor),
        selectedFoodsOutdoor: sortGoodieIds(selectedFoodsOutdoor),
        analyzerOptions,
        seasonalPoolOnly,
        evolutionSolverTier,
        catStartComeCounts: optimizeForMementoWait ? catStartComeCounts : {},
        cats: optimizeForCats
          ? sortCatIdsByTableOrder(selectedCats, catOrderIndex)
          : [],
      }),
    [
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
      yardPreset,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      fitnessObjective,
      activeObjectiveBlendTerms,
      activeSecondaryObjective,
      applyFeasibilityGate,
      feasibilityRows,
      requiredGoodieIds,
      fixedIndoorGoodieIds,
      fixedOutdoorGoodieIds,
      forbiddenGoodieIds,
      selectedFoodsIndoor,
      selectedFoodsOutdoor,
      analyzerOptions,
      seasonalPoolOnly,
      evolutionSolverTier,
      generations,
      optimizeForCats,
      optimizeForMementoWait,
      catStartComeCounts,
      selectedCats,
      catOrderIndex,
    ]
  )

  const genetic = useMemo(
    () => ({
      ...DEFAULT_GENETIC,
      poolSize,
      tournamentK,
      mutationRate,
      mutationOffspringRate,
      foodMutationOffspringRate,
      openSlotExplorationRate,
      offspringScoreMode,
      survivorSelection: {
        ...DEFAULT_GENETIC.survivorSelection,
        enabled: survivorSelectionEnabled,
        exploratoryRate: survivorExploratoryRate,
        initialRankTemperature: survivorInitialRankTemperature,
        finalRankTemperature: survivorFinalRankTemperature,
        annealGenerations: generations,
      },
    }),
    [
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
      generations,
    ]
  )

  const {
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
    error,
    runStats,
    finalPool,
    searchStrengthAutoBumped,
    setSearchStrengthAutoBumped,
    hasContinuation,
    showRunCelebration,
    run,
    continueRun,
    requestPause,
  } = useOptimizerRun({
    validation: {
      optimizeForCats,
      selectedCats,
      selectedFoodsIndoor,
      selectedFoodsOutdoor,
    },
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
  })

  const optimizerFitnessCtx = useMemo(
    () => buildOptimizerFitnessContext(runMeta, fitnessLiveSlice),
    [runMeta, fitnessLiveSlice]
  )

  const displayObjective = runMeta?.objective ?? fitnessObjective
  const displayBlendTerms = runMeta?.objectiveBlendTerms ?? activeObjectiveBlendTerms
  const ranCatObjective =
    displayObjective === "catProbability" ||
    displayObjective === "mementoExpectedDays" ||
    displayBlendTerms.some((term) => objectiveNeedsTargetCats(term.objective))
  const ranFishObjective = isNetFishObjective(displayObjective)
  const showMementoAnalysis =
    ranCatObjective || ranFishObjective || showFishMementoAnalysis

  const mementoAnalysisCtx = useMemo((): FitnessContext | null => {
    if (!showMementoAnalysis) return null
    if (!runMeta && !optimizerFitnessCtx) return null
    if (ranCatObjective) return optimizerFitnessCtx

    return buildOptimizerFitnessContext(runMeta, fitnessLiveSlice, {
      objective:
        selectedCats.length > 0 ? "mementoExpectedDays" : "netGoldEquiv",
      objectiveBlendTerms: [],
      catIds: sortCatIdsByTableOrder(selectedCats, catOrderIndex),
      includeMementoComeCounts: true,
    })
  }, [
    showMementoAnalysis,
    runMeta,
    optimizerFitnessCtx,
    ranCatObjective,
    fitnessLiveSlice,
    selectedCats,
    catOrderIndex,
  ])

  const mementoAnalysis = useMemo(() => {
    if (!showMementoAnalysis) return null
    if (!best || !mementoAnalysisCtx) return null
    // Display/lab only — GA scores memento via assignValue in workers, not this helper.
    if (running) return null
    return runMementoAnalysis(mementoAnalysisCtx, best)
  }, [best, mementoAnalysisCtx, showMementoAnalysis, running])

  const mementoDisplayScale = useMemo(() => {
    const foodIndoor = mementoAnalysis?.foodTypeIndoor ?? best?.foodTypeIndoor
    const foodOutdoor = mementoAnalysis?.foodTypeOutdoor ?? best?.foodTypeOutdoor
    if (foodIndoor == null || foodOutdoor == null) return null
    return mementoTimeDisplayScale(
      mementoTimeDisplayBasis,
      foodIndoor,
      foodOutdoor
    )
  }, [mementoAnalysis, mementoTimeDisplayBasis, best?.foodTypeIndoor, best?.foodTypeOutdoor])

  const formatObjectiveScore = useCallback(
    (score: number, objective?: FitnessObjective | null) => {
      if (objective === "mementoExpectedDays" && mementoDisplayScale) {
        return formatExpectedMementoTime(
          -score,
          mementoDisplayScale.displayMul,
          mementoDisplayScale.basis
        )
      }
      return formatFitnessObjectiveDisplay(score, objective)
    },
    [mementoDisplayScale]
  )

  /** Gold / visit lines follow the inspected layout (`best`), not necessarily rank #1. */
  const displayRunStats = useMemo((): RunStats | null => {
    if (!runStats) return null
    if (!best || !optimizerFitnessCtx) return runStats
    if (running) return runStats
    return {
      ...runStats,
      ...getYardAnalyzerSummary(optimizerFitnessCtx, best),
    }
  }, [runStats, best, optimizerFitnessCtx, running])

  const missedMinimumRows = useMemo(() => {
    if (!displayRunStats) return []
    const rows = mergeFeasibilityRowsApplied(runMeta, {
      applyFeasibilityGate,
      feasibilityRows,
    })
    return rows.flatMap((row) => {
      const value = feasibilityMetricDisplayValue(row.metric, displayRunStats)
      if (value == null || feasibilityRulePasses(value, row.rule)) return []
      return [
        {
          id: row.id,
          label: FEASIBILITY_METRIC_LABELS[row.metric],
          rule: formatFeasibilityRule(row.rule),
          value,
          miss: feasibilityRuleMiss(value, row.rule),
        },
      ]
    })
  }, [applyFeasibilityGate, displayRunStats, feasibilityRows, runMeta])

  const applyManualLayout = useCallback(() => {
    if (!best || !manualDraft || !optimizerFitnessCtx || !runMeta) return
    const pinFlags = {
      pinIndoor: runMeta.pinIndoor,
      pinOutdoor: runMeta.pinOutdoor,
    }
    const msg = validateManualDraft(
      manualDraft,
      pinFlags,
      pools,
      runMeta.requiredGoodieIds,
      runMeta.forbiddenGoodieIds
    )
    if (msg) {
      setLayoutManualNote(msg)
      return
    }
    try {
      const merged = mergeFixedHalvesIntoYard(
        optimizerFitnessCtx,
        applyDraftToPartialYard(best, manualDraft, pinFlags)
      )
      validateYard(merged)
      assignValue(optimizerFitnessCtx, merged, { solverTier: "full" })
      setBest(cloneYard(merged))
      setManualDraft(draftFromBest(merged))
      setLayoutManualNote(null)
    } catch (e) {
      setLayoutManualNote(e instanceof Error ? e.message : String(e))
    }
  }, [best, manualDraft, optimizerFitnessCtx, runMeta, pools, setBest, setLayoutManualNote, setManualDraft])

  const byGroup = useMemo(() => {
    const normal: { id: number; label: string }[] = []
    const rare: { id: number; label: string }[] = []
    const other: { id: number; label: string }[] = []
    for (const c of cats) {
      if (c.IsDebug) continue
      const row = {
        id: c.Id,
        label: translate(translateTable("Cat", `CatName${c.Id}`)),
      }
      const g = catGroupForId(c.Id)
      if (g === "normal") normal.push(row)
      else if (g === "rare") rare.push(row)
      else other.push(row)
    }
    return { normal, rare, other }
  }, [translate])

  const selectedCatNames = useMemo(
    () =>
      sortCatIdsByTableOrder(selectedCats, catOrderIndex).map((id) =>
        translate(translateTable("Cat", `CatName${id}`))
      ),
    [selectedCats, catOrderIndex, translate]
  )

  const selectedCatVisitConfigs = useMemo(
    () =>
      sortCatIdsByTableOrder(selectedCats, catOrderIndex).map((id) => ({
        id,
        name: translate(translateTable("Cat", `CatName${id}`)),
        isRare: isRareCatId(id),
        startComeCount: clampComeCountInput(catStartComeCounts[id] ?? 0),
      })),
    [selectedCats, catOrderIndex, translate, catStartComeCounts]
  )

  const setTargetCatStartComeCount = useCallback((catId: number, next: number) => {
    setCatStartComeCounts((prev) => ({
      ...prev,
      [catId]: clampComeCountInput(next),
    }))
  }, [setCatStartComeCounts])

  const objectiveLabel = objectiveLabelLong(displayObjective)
  const hasMultiGoalScore = goalMode === "multi" || displayBlendTerms.length > 0
  const displayMultiGoalTerms =
    goalMode === "multi"
      ? objectiveBlendTerms
      : [
          { objective: displayObjective, weight: 1 },
          ...displayBlendTerms,
        ]
  const scoreDisplayObjective = hasMultiGoalScore ? null : displayObjective
  const scoreLabel = hasMultiGoalScore ? "Multi-objective score" : objectiveLabel
  const displayPrimaryScore = useMemo(() => {
    if (!best) return null
    if (
      !hasMultiGoalScore &&
      displayObjective === "mementoExpectedDays" &&
      mementoAnalysis
    ) {
      return Number.isFinite(mementoAnalysis.expectedMaxTargetMementoDays) &&
        mementoAnalysis.expectedMaxTargetMementoDays > 0
        ? -mementoAnalysis.expectedMaxTargetMementoDays
        : 0
    }
    return best.value
  }, [best, displayObjective, hasMultiGoalScore, mementoAnalysis])
  const displayMementoUnreachableTargets = useMemo(() => {
    if (!best || hasMultiGoalScore || displayObjective !== "mementoExpectedDays") return 0
    if (mementoAnalysis) {
      return mementoAnalysis.byCat.filter(
        (row) =>
          !Number.isFinite(row.expectedMementoDays) ||
          row.expectedMementoDays <= 0
      ).length
    }
    return best.mementoUnreachableTargets ?? 0
  }, [best, displayObjective, hasMultiGoalScore, mementoAnalysis])
  const displayPrimaryScoreText =
    displayMementoUnreachableTargets > 0
      ? `${displayMementoUnreachableTargets} unreachable target${
          displayMementoUnreachableTargets === 1 ? "" : "s"
        }`
      : formatObjectiveScore(displayPrimaryScore ?? best?.value ?? 0, scoreDisplayObjective)
  const displayPrimaryScoreHasUnit =
    displayMementoUnreachableTargets === 0 &&
    best != null &&
    scoreHasDisplayUnit(displayPrimaryScore ?? best.value, scoreDisplayObjective)
  const rankingScoreBreakdown = useMemo(() => {
    if (
      !best ||
      displayPrimaryScore == null ||
      ((best.requirementPenalty ?? 0) <= 0 &&
        (best.mementoUnreachableTargets ?? 0) <= 0)
    ) {
      return null
    }
    return {
      objective: displayPrimaryScore,
      requirementPenalty: best.requirementPenalty ?? 0,
      mementoUnreachableTargets: best.mementoUnreachableTargets ?? 0,
    }
  }, [best, displayPrimaryScore])
  const finalPoolSummary = useMemo(() => {
    if (finalPool.length === 0) return null
    const scores = finalPool.map((y) => y.value).sort((a, b) => a - b)
    const bestScore = scores[scores.length - 1]!
    const worstScore = scores[0]!
    const q1 = percentileSorted(scores, 0.25)
    const median = percentileSorted(scores, 0.5)
    const q3 = percentileSorted(scores, 0.75)
    const foodCounts = new Map<string, number>()
    for (const y of finalPool) {
      const key = `${y.foodTypeIndoor}/${y.foodTypeOutdoor}`
      foodCounts.set(key, (foodCounts.get(key) ?? 0) + 1)
    }
    const topFoods = [...foodCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 4)
    return { bestScore, worstScore, q1, median, q3, topFoods }
  }, [finalPool])
  const selectedPoolSignature = best ? yardSignature(best) : null

  const displaySecondaryObjective =
    runMeta?.secondaryObjective ?? activeSecondaryObjective
  const displayFishObjective =
    isNetFishObjective(displayObjective)
      ? displayObjective
      : displaySecondaryObjective && isNetFishObjective(displaySecondaryObjective)
        ? displaySecondaryObjective
        : "netGoldEquiv"

  const toggleCat = useCallback(
    (id: number) => {
      setSelectedCats((prev) =>
        prev.includes(id)
          ? prev.filter((x) => x !== id)
          : sortCatIdsByTableOrder([...prev, id], catOrderIndex)
      )
    },
    [catOrderIndex, setSelectedCats]
  )

  const location = "/yard-optimizer"

  const displayPinFlags = runMeta
    ? { pinIndoor: runMeta.pinIndoor, pinOutdoor: runMeta.pinOutdoor }
    : draftPinFlags

  const indoorTitle = displayPinFlags.pinIndoor
    ? "Indoor (held fixed for this run)"
    : displayPinFlags.pinOutdoor
      ? "Indoor (optimized)"
      : "Indoor"
  const outdoorTitle = displayPinFlags.pinOutdoor
    ? "Outdoor (held fixed for this run)"
    : displayPinFlags.pinIndoor
      ? "Outdoor (optimized)"
      : "Outdoor"

  const editPinFlags = displayPinFlags
  const fixedIndoorSmallSlotCount =
    PLACES_INDOOR - (isFixedSlotValue(fixedIndoorDraft.indoorLarge) ? 2 : 0)
  const fixedOutdoorSmallSlotCount =
    PLACES_OUTDOOR - (isFixedSlotValue(fixedOutdoorDraft.outdoorLarge) ? 2 : 0)
  const openFoodLabel = "Open food play space"
  const closedFoodLabel = "Closed food play space"
  const openLargeLabel = "Open large play space"
  const closedLargeLabel = "Closed large play space"
  const openSmallLabel = "Open play space"
  const closedSmallLabel = "Closed play space"
  const compiledYardPreset = useMemo(
    () =>
      compileYardPresetSummary({
        yardPreset,
        draftPinFlags,
        fixedIndoorDraft,
        fixedOutdoorDraft,
        fixedIndoorSmallSlotCount,
        fixedOutdoorSmallSlotCount,
        selectedFoodsIndoor,
        selectedFoodsOutdoor,
        pools,
        fixedLocationFoodTypes,
        fixedLocationGoodieIds,
        fixedIndoorGoodieIds,
        fixedOutdoorGoodieIds,
        requiredGoodieIds,
        forbiddenGoodieIds,
        seasonalPoolOnly,
        offSeasonSeasonalCount,
        labels: {
          openFoodLabel,
          closedFoodLabel,
          openLargeLabel,
          closedLargeLabel,
          openSmallLabel,
          closedSmallLabel,
        },
        foodDisplayName,
        goodieDisplayName,
      }),
    [
      yardPreset,
      draftPinFlags,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      fixedIndoorSmallSlotCount,
      fixedOutdoorSmallSlotCount,
      openFoodLabel,
      closedFoodLabel,
      openLargeLabel,
      closedLargeLabel,
      openSmallLabel,
      closedSmallLabel,
      foodDisplayName,
      goodieDisplayName,
      selectedFoodsIndoor,
      selectedFoodsOutdoor,
      pools,
      fixedLocationFoodTypes,
      fixedLocationGoodieIds,
      fixedIndoorGoodieIds,
      fixedOutdoorGoodieIds,
      requiredGoodieIds,
      forbiddenGoodieIds,
      seasonalPoolOnly,
      offSeasonSeasonalCount,
    ]
  )
  const playerGoodieConstraintsSummaryFor = useCallback((requiredIds: readonly number[], forbiddenIds: readonly number[]) => {
    const parts: string[] = []
    if (requiredIds.length > 0) {
      parts.push(
        `must include ${requiredIds
          .map((id) => `${goodieDisplayName(id)} (#${id})`)
          .join(", ")}`
      )
    }
    if (forbiddenIds.length > 0) {
      parts.push(
        `must not include ${forbiddenIds
          .map((id) => `${goodieDisplayName(id)} (#${id})`)
          .join(", ")}`
      )
    }
    return parts.length > 0 ? parts.join("; ") : "none"
  }, [goodieDisplayName])
  const playerGoodieConstraintsSummary = useMemo(
    () => playerGoodieConstraintsSummaryFor(requiredGoodieIds, forbiddenGoodieIds),
    [requiredGoodieIds, forbiddenGoodieIds, playerGoodieConstraintsSummaryFor]
  )
  const copyToGameRows = useMemo(() => {
    if (!best) return []
    const rows: Array<{
      key: string
      side: "Indoor" | "Outdoor"
      slot: string
      id: number
      sourceLabel: string
      filterOptions: string[]
      hint: string
      sourceRank: number
      sourceIndex: number
    }> = []
    const addGoodie = (
      side: "Indoor" | "Outdoor",
      slot: string,
      id: number,
      index?: number
    ) => {
      const finder = goodieGameFinderInfo(id)
      rows.push({
        key: `${side}-${slot}-${id}-${index ?? 0}`,
        side,
        slot: index == null ? slot : `${slot} ${index + 1}`,
        id,
        ...finder,
      })
    }
    Array.from(best.indoorLarge).forEach((id, index) =>
      addGoodie("Indoor", "large play space", id, index)
    )
    Array.from(best.indoorSmall).forEach((id, index) =>
      addGoodie("Indoor", "small play space", id, index)
    )
    Array.from(best.outdoorLarge).forEach((id, index) =>
      addGoodie("Outdoor", "large play space", id, index)
    )
    Array.from(best.outdoorSmall).forEach((id, index) =>
      addGoodie("Outdoor", "small play space", id, index)
    )
    return rows
  }, [best])
  const needEditIndoorSmall =
    manualDraft !== null
      ? PLACES_INDOOR - (manualDraft.indoorLarge != null ? 2 : 0)
      : 0
  const needEditOutdoorSmall =
    manualDraft !== null
      ? PLACES_OUTDOOR - (manualDraft.outdoorLarge != null ? 2 : 0)
      : 0

  const manualDraftDirty = useMemo(() => {
    if (!manualDraft || !best || running) return false
    return !draftsEqual(manualDraft, draftFromBest(best))
  }, [manualDraft, best, running])

  const runButtonText = optimizerRunLabel(
    running,
    progress,
    progressTotal,
    runPhase,
    pauseRequested
  )
  const canPauseRun = running && runPhase === "searching" && !pauseRequested
  const pauseButtonText = pauseRequested
    ? "Pausing after this generation..."
    : "Pause after generation"
  const resumeButtonText =
    pausedRunRemaining == null
      ? null
      : `Resume ${pausedRunRemaining} ${
          pausedRunRemaining === 1 ? "generation" : "generations"
        }`
  const continueButtonText = resumeButtonText ?? `Next ${CONTINUE_BATCH} generations`
  const runUnavailableText =
    goalMode === "multi" && objectiveBlendTerms.length === 0
      ? "Add at least one objective for the multi-objective score."
      : optimizeForCats && selectedCats.length === 0
      ? "Choose at least one target cat, or remove the cat-based objective/tiebreaker."
      : selectedFoodsIndoor.length === 0 || selectedFoodsOutdoor.length === 0
        ? "Choose at least one food for indoor and outdoor before running."
        : null
  const primaryFlowSummary =
    goalMode === "multi"
      ? "Multi-objective score"
      : optimizeForCats
        ? `${selectedCatNames.length} ${
            selectedCatNames.length === 1 ? "target cat" : "target cats"
          }`
        : "Net fish income"
  const continueUnavailableText =
    runUnavailableText ??
    (!running && !hasContinuation && best
      ? "Run again first; settings or result state changed."
      : null)

  return (
    <div className="w-full max-w-7xl space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-2">
        <h1 className="text-4xl font-bold">Yard optimizer</h1>
        {walkthroughComplete ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end">
            <FormattedLink
              href="/yard-optimizer/how-it-works"
              location="/yard-optimizer"
              className="text-sm sm:text-base"
            >
              How does it work? &rarr;
            </FormattedLink>
          </div>
        ) : null}
      </div>

      {walkthroughComplete === null ? (
        <div
          className="rounded-xl border border-slate-200 dark:border-slate-600 p-8 bg-white/50 dark:bg-slate-800/50 flex flex-col items-center justify-center gap-3 min-h-[14rem]"
          aria-busy="true"
          aria-live="polite"
        >
          <div className="h-10 w-10 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin dark:border-slate-600 dark:border-t-blue-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
        </div>
      ) : null}

      {walkthroughComplete === false ? (
        <YardOptimizerWalkthrough
          initialPage={walkthroughInitialPage}
          onPickFish={() => completeWalkthrough("fish")}
          onPickMemento={() => completeWalkthrough("memento")}
          onSkip={() => completeWalkthrough("skip")}
        />
      ) : null}

      {walkthroughComplete ? (
        <>
      <p className="text-slate-600 dark:text-slate-300">
        <strong>Runs in your browser.</strong> It tries lots of yard layouts and keeps the
        strongest one it finds. Pick an objective, run the search, and it will suggest food and goodies
        for your yard{" "}
        <span>
          (
          <FormattedLink
            href="/yard-optimizer/how-it-works#not-perfect"
            location="/yard-optimizer"
            className="underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200"
            style={{
              color: "inherit",
              fontWeight: "inherit",
              textDecorationLine: "underline",
              textUnderlineOffset: "0.15em",
            }}
          >
            a few edge cases are approximate
          </FormattedLink>
          )
        </span>
        .
      </p>

      <section
        id="yard-optimizer-config"
        className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-800/50 space-y-2 scroll-mt-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <h2 className="text-xl font-bold">Configuration</h2>
          <div className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 justify-end shrink-0">
            <button
              type="button"
              onClick={resetConfig}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2"
            >
              Reset config
            </button>
            <button
              type="button"
              onClick={scrollToObjectiveConfig}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2"
            >
              Edit objective
            </button>
            <button
              type="button"
              onClick={showWalkthroughAgain}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2"
            >
              Intro again
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Set your <strong>Objective</strong> and (if it asks) your <strong>Target cats</strong>.
          Everything else lives under <strong>Advanced configs</strong>. Settings are saved for
          this browser tab and apply on the next run.
        </p>
        <div className="space-y-3">
          <div id="yard-optimizer-objective" className="scroll-mt-4">
            <ObjectivePanel
              goalMode={goalMode}
              fitnessObjective={fitnessObjective}
              showMultiGoalOption
              objectiveBlendTerms={objectiveBlendTerms}
              chooseGuidedObjective={chooseGuidedObjective}
              chooseMultiGoal={chooseMultiGoal}
              setObjectiveBlendTerms={setObjectiveBlendTerms}
            />
          </div>

          {optimizeForCats ? (
            <TargetCatsPickerSection
              id="yard-optimizer-target-cats"
              className={
                showTargetCatsHighlight
                  ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 transition-shadow"
                  : undefined
              }
              title="Target cats"
              description={
                optimizeForMementoWait
                  ? "Pick the cats this run should optimize for. The search will prefer layouts that shorten their memento wait."
                  : "Pick the cats this run should optimize for. The search will prefer layouts that put these cats on screen."
              }
              selectedCatNames={selectedCatNames}
              selectedCatVisitConfigs={selectedCatVisitConfigs}
              selectedCats={selectedCats}
              byGroup={byGroup}
              showMementoMultiCatHint={
                optimizeForMementoWait &&
                selectedCatNames.length > 1
              }
              showVisitConfig={optimizeForMementoWait}
              emptySelectionHint="choose at least one before running."
              onClear={() => setSelectedCats([])}
              onResetStartComeCounts={() => setCatStartComeCounts({})}
              onSetStartComeCount={setTargetCatStartComeCount}
              onToggleCat={toggleCat}
              location={location}
            />
          ) : null}

          <ConfigFold
            title="Advanced configs"
            description="Optional: choose foods and goodies, set yard spaces, add minimum requirements, and change how long the search runs."
          >
            <div className="space-y-6">
    <AdvancedSubcard
      title="Yard inputs"
      description="What food, goodies, and yard spaces the optimizer may use."
    >
      <div className="space-y-3">
      <YardItemPoolEditor
        poolEditorOpen={poolEditorOpen}
        setPoolEditorOpen={setPoolEditorOpen}
        selectedFoodsIndoor={selectedFoodsIndoor}
        setSelectedFoodsIndoor={setSelectedFoodsIndoor}
        selectedFoodsOutdoor={selectedFoodsOutdoor}
        setSelectedFoodsOutdoor={setSelectedFoodsOutdoor}
        seasonalPoolOnly={seasonalPoolOnly}
        setSeasonalPoolOnly={setSeasonalPoolOnly}
        requiredGoodieIds={requiredGoodieIds}
        setRequiredGoodieIds={setRequiredGoodieIds}
        forbiddenGoodieIds={forbiddenGoodieIds}
        setForbiddenGoodieIds={setForbiddenGoodieIds}
      />
      <YardLocationPreferencesEditor
        locationEditorOpen={locationEditorOpen}
        setLocationEditorOpen={setLocationEditorOpen}
        compiledYardPreset={compiledYardPreset}
        yardPreset={yardPreset}
        onSelectFullYard={applyFullYardDrafts}
        onSelectOutdoorOnly={applyOutdoorOnlyDrafts}
        onSelectCustomLayout={applyFullYardDrafts}
        fixedIndoorDraft={fixedIndoorDraft}
        setFixedIndoorDraft={setFixedIndoorDraft}
        fixedOutdoorDraft={fixedOutdoorDraft}
        setFixedOutdoorDraft={setFixedOutdoorDraft}
        selectedFoodsIndoor={selectedFoodsIndoor}
        selectedFoodsOutdoor={selectedFoodsOutdoor}
        pools={pools}
        fixedIndoorSmallSlotCount={fixedIndoorSmallSlotCount}
        fixedOutdoorSmallSlotCount={fixedOutdoorSmallSlotCount}
        foodDisplayName={foodDisplayName}
      />
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3 space-y-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Scoring assumptions
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          These only change the estimate. They do not change your saved layout.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Goodie condition</span>
            <select
              className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800"
              value={analyzerOptions.itemDamageState}
              onChange={(e) =>
                setAnalyzerOptions((o) => ({
                  ...o,
                  itemDamageState: Number(e.target.value) as 0 | 1 | 2,
                }))
              }
            >
              <option value={2}>Fixed / repaired</option>
              <option value={0}>New / intact</option>
              <option value={1}>Broken</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Weather</span>
            <select
              className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800"
              value={analyzerOptions.weather}
              onChange={(e) =>
                setAnalyzerOptions((o) => ({ ...o, weather: e.target.value }))
              }
            >
              {ANALYZER_WEATHER_CHOICES.map((weather) => (
                <option key={weather} value={weather}>
                  {formatAnalyzerWeather(weather)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Estimate over this many minutes</span>
            <input
              type="number"
              min={60}
              max={10080}
              step={60}
              value={analyzerOptions.totalDurationMinutes}
              onChange={(e) =>
                setAnalyzerOptions((o) => ({
                  ...o,
                  totalDurationMinutes: Number(e.target.value),
                }))
              }
              className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
            />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              ={" "}
              {(analyzerOptions.totalDurationMinutes / MINUTES_PER_DAY).toFixed(1)}{" "}
              food days (results are reported per food day)
            </span>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">
            How to handle Tubbs at the outdoor food bowl
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Adjusts the outdoor food cost and the outdoor income for the
            visiting big cat. While the bowl sits empty it also quiets your
            outdoor goodies, since outdoor cats come for the food.
          </span>
          <select
            className="border rounded px-2 py-1.5 bg-white dark:bg-slate-800"
            value={analyzerOptions.tubbsMode}
            onChange={(e) =>
              setAnalyzerOptions((o) => ({
                ...o,
                tubbsMode: e.target.value as TubbsMode,
              }))
            }
          >
            {TUBBS_MODE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3 text-sm text-slate-700 dark:text-slate-300 space-y-3">
        <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Current setup
        </h5>
        <p>
          For this search, the optimizer can choose{" "}
          <strong>{compiledYardPreset.optimizerChanges}</strong> and must keep any fixed food,
          goodies, and closed spaces shown below.
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 px-2 py-1">
            Yard: <strong>{compiledYardPreset.presetLabel}</strong>
          </span>
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 px-2 py-1">
            Search changes: <strong>{compiledYardPreset.optimizerChanges}</strong>
          </span>
          <span className="rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/30 px-2 py-1">
            Goodies: {compiledYardPreset.pool.largeCount} large,{" "}
            {compiledYardPreset.pool.smallCount} small
          </span>
        </div>
        <p>{compiledYardPreset.optimizerChoices}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Available items
            </p>
            <p>Indoor food: {compiledYardPreset.pool.foodsIndoor}</p>
            <p>Outdoor food: {compiledYardPreset.pool.foodsOutdoor}</p>
            <p>Seasonal shop: {compiledYardPreset.pool.seasonal}.</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Goodie rules
            </p>
            <p>
              Must include:{" "}
              {requiredGoodieIds.length > 8
                ? `${requiredGoodieIds.length} goodies`
                : compiledYardPreset.pool.required}
            </p>
            <p>Must include inside: {compiledYardPreset.pool.requiredIndoor}</p>
            <p>Must include outside: {compiledYardPreset.pool.requiredOutdoor}</p>
            <p>
              Must not include:{" "}
              {forbiddenGoodieIds.length > 8
                ? `${forbiddenGoodieIds.length} goodies`
                : compiledYardPreset.pool.forbidden}
            </p>
          </div>
        </div>
        {fixedLocationFoodTypes.length > 0 || fixedLocationGoodieIds.length > 0 ? (
          <p>{compiledYardPreset.fixedLocations}</p>
        ) : null}
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Indoor locations
            </p>
            <p>Food: {compiledYardPreset.indoor.food}</p>
            <p>Large play space: {compiledYardPreset.indoor.large}</p>
            <p>Small play spaces: {compiledYardPreset.indoor.small}</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-slate-800 dark:text-slate-100">
              Outdoor locations
            </p>
            <p>Food: {compiledYardPreset.outdoor.food}</p>
            <p>Large play space: {compiledYardPreset.outdoor.large}</p>
            <p>Small play spaces: {compiledYardPreset.outdoor.small}</p>
          </div>
        </div>
      </div>
      </div>
    </AdvancedSubcard>

    <AdvancedSubcard
      title="Objective"
      description="Extra controls for how layouts are ranked."
    >

    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
        Tiebreaker
      </h4>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
        If two layouts tie on the selected score, this decides which one wins.
      </p>
      <div className="flex flex-col gap-3">
        <SettingsChoice>
          <input
            type="radio"
            name="secondaryObjective"
            checked={secondaryObjective === null}
            onChange={() => setSecondaryObjective(null)}
            className="mt-1"
          />
          <span>
            <strong>None:</strong> no extra tiebreaker.
          </span>
        </SettingsChoice>
        {TIEBREAKER_OBJECTIVE_OPTION_ROWS.filter(
          (row) => goalMode === "multi" || row.id !== fitnessObjective
        ).map(({ id, title, description }) => (
          <SettingsChoice key={id}>
            <input
              type="radio"
              name="secondaryObjective"
              checked={secondaryObjective === id}
              onChange={() => setSecondaryObjective(id)}
              className="mt-1"
            />
            <span>
              <strong>{title}:</strong> {description}
            </span>
          </SettingsChoice>
        ))}
      </div>
    </div>

    <FeasibilityConstraintsEditor
      applyFeasibilityGate={applyFeasibilityGate}
      setApplyFeasibilityGate={setApplyFeasibilityGate}
      feasibilityRows={feasibilityRows}
      setFeasibilityRows={setFeasibilityRows}
    />

        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
          How layouts are chosen
      </h4>
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
        <ol className="list-decimal pl-5 space-y-1">
          <li>
              <strong>Must-have rules:</strong>{" "}
            {requiredGoodieIds.length === 0 && forbiddenGoodieIds.length === 0 ? (
              applyFeasibilityGate ? (
                <>
                  First satisfy must-have rules, then compare your selected objective.
                </>
              ) : (
                <>None. Every layout can be scored.</>
              )
            ) : (
              <>
                {playerGoodieConstraintsSummary}
                {applyFeasibilityGate ? (
                  <>
                    {" "}
                    The search prefers layouts with smaller requirement shortfalls before comparing
                    your selected objective.
                  </>
                ) : (
                  <>. Minimum requirements are off.</>
                )}
              </>
            )}
          </li>
          <li>
              <strong>Ranking objective:</strong>{" "}
            {goalMode === "multi" ? (
              <>
                Multi-objective score =
                {objectiveBlendTerms.length > 0
                  ? objectiveBlendTerms.map((term, idx) => (
                      <span key={`${term.objective}-${idx}`}>
                        {idx > 0 ? " + " : " "}
                        {goalPriorityFormulaTerm(term)}
                      </span>
                    ))
                  : " no objectives added yet"}
              </>
            ) : (
              <>Objective = {objectiveLabelShort(fitnessObjective)}</>
            )}
          </li>
          <li>
              <strong>Tie breaker:</strong>{" "}
            {displaySecondaryObjective ? (
              <>{objectiveLabelShort(displaySecondaryObjective)} breaks exact ties.</>
            ) : (
              <>No tiebreaker.</>
            )}
          </li>
        </ol>
      </div>
    </div>
    </AdvancedSubcard>

    <SearchSettingsPanel
      evolutionSolverTier={evolutionSolverTier}
      setEvolutionSolverTier={setEvolutionSolverTier}
      setSearchStrengthAutoBumped={setSearchStrengthAutoBumped}
      generations={generations}
      setGenerations={setGenerations}
      poolSize={poolSize}
      setPoolSize={setPoolSize}
      tournamentK={tournamentK}
      setTournamentK={setTournamentK}
      mutationRate={mutationRate}
      setMutationRate={setMutationRate}
      offspringExplorationPreset={offspringExplorationPreset}
      setMutationOffspringRate={setMutationOffspringRate}
      setFoodMutationOffspringRate={setFoodMutationOffspringRate}
      setOpenSlotExplorationRate={setOpenSlotExplorationRate}
      setOffspringScoreMode={setOffspringScoreMode}
      survivorSelectionEnabled={survivorSelectionEnabled}
      setSurvivorSelectionEnabled={setSurvivorSelectionEnabled}
      survivorExploratoryRate={survivorExploratoryRate}
      setSurvivorExploratoryRate={setSurvivorExploratoryRate}
      survivorInitialRankTemperature={survivorInitialRankTemperature}
      setSurvivorInitialRankTemperature={setSurvivorInitialRankTemperature}
      survivorFinalRankTemperature={survivorFinalRankTemperature}
      setSurvivorFinalRankTemperature={setSurvivorFinalRankTemperature}
      logOptimizerProfile={logOptimizerProfile}
      setLogOptimizerProfile={setLogOptimizerProfile}
      pools={pools}
      analyzerOptions={analyzerOptions}
      setAnalyzerOptions={setAnalyzerOptions}
    />

            </div>
          </ConfigFold>
        </div>
      </section>

      <RunControlBar
        runButtonText={runButtonText}
        continueButtonText={continueButtonText}
        pauseButtonText={pauseButtonText}
        running={running}
        runUnavailableText={runUnavailableText}
        continueUnavailableText={continueUnavailableText}
        hasContinuation={hasContinuation}
        canPauseRun={canPauseRun}
        showRunCelebration={showRunCelebration}
        onRun={() => void run()}
        onContinue={() => void continueRun()}
        onPause={requestPause}
      />

      {error && (
        <div className="text-red-600 dark:text-red-400" role="alert">
          {error}
        </div>
      )}

      {best ? (
        <section
          className="rounded-xl border border-slate-200 dark:border-slate-600 p-4 bg-white/50 dark:bg-slate-800/50 flex flex-col gap-4"
        >
          <YardOptimizerResultsPanel
            layout={{
              best,
              setBest,
              currentLayoutRef,
              manualDraftDirty,
              copyToGameRows,
              indoorTitle,
              outdoorTitle,
              foodDisplayName,
              goodieDisplayName,
              location,
              copyYardViewOpen,
              setCopyYardViewOpen,
              selectedPreviewYardId,
              setSelectedPreviewYardId,
              sortCatIdsByTableOrder: (ids) => sortCatIdsByTableOrder(ids, catOrderIndex),
              playerGoodieConstraintsSummaryFor,
            }}
            scores={{
              scoreLabel,
              displayPrimaryScoreText,
              displayPrimaryScoreHasUnit,
              scoreDisplayObjective,
              displaySecondaryObjective,
              formatObjectiveScore,
              hasMultiGoalScore,
              displayMultiGoalTerms,
              searchStrengthAutoBumped,
              displayObjective,
              displayMementoUnreachableTargets,
              missedMinimumRows,
              ranCatObjective,
              displayPrimaryScore,
              displayBlendTerms,
              rankingScoreBreakdown,
            }}
            config={{
              yardPreset,
              draftPinFlags,
              fitnessObjective,
              selectedCats,
              selectedFoodsIndoor,
              selectedFoodsOutdoor,
              applyFeasibilityGate,
              feasibilityRows,
              requiredGoodieIds,
              forbiddenGoodieIds,
              fixedLocationFoodTypes,
              fixedLocationGoodieIds,
              analyzerOptions,
              fixedIndoorDraft,
              fixedOutdoorDraft,
              activeSecondaryObjective,
              geneticPoolSize: poolSize,
              offspringScoreMode,
              pools,
            }}
            run={{
              runMeta,
              displayRunStats,
              running,
              progress,
              progressTotal,
              runPhase,
              pauseRequested,
              hasContinuation,
              finalPoolSummary,
              finalPool,
              selectedPoolSignature,
              mementoAnalysis,
              mementoDisplayScale,
            }}
          />
          <ManualLayoutEditor
            manualDraft={manualDraft}
            setManualDraft={setManualDraft}
            layoutManualNote={layoutManualNote}
            editPinFlags={editPinFlags}
            indoorTitle={indoorTitle}
            outdoorTitle={outdoorTitle}
            needEditIndoorSmall={needEditIndoorSmall}
            needEditOutdoorSmall={needEditOutdoorSmall}
            pools={pools}
            runMeta={runMeta}
            running={running}
            hasContinuation={hasContinuation}
            foodDisplayName={foodDisplayName}
            applyManualLayout={applyManualLayout}
          />
                    <MementoAnalysisPanel
            ranCatObjective={ranCatObjective}
            ranFishObjective={ranFishObjective}
            showFishMementoAnalysis={showFishMementoAnalysis}
            onToggleFishMementoAnalysis={() =>
              setShowFishMementoAnalysis((x) => !x)
            }
            mementoAnalysis={mementoAnalysis}
            selectedCatNames={selectedCatNames}
            selectedCatVisitConfigs={selectedCatVisitConfigs}
            selectedCats={selectedCats}
            byGroup={byGroup}
            onClearSelectedCats={() => setSelectedCats([])}
            onResetStartComeCounts={() => setCatStartComeCounts({})}
            onSetStartComeCount={setTargetCatStartComeCount}
            onToggleCat={toggleCat}
            location={location}
            catStartComeCounts={catStartComeCounts}
            setCatStartComeCounts={setCatStartComeCounts}
            mementoTimeDisplayBasis={mementoTimeDisplayBasis}
            setMementoTimeDisplayBasis={setMementoTimeDisplayBasis}
          />

        </section>
      ) : null}
      <div className="fixed inset-x-0 bottom-0 z-40 pointer-events-none px-2 pb-2 sm:px-4 sm:pb-3">
        <div className="pointer-events-auto mx-auto max-w-6xl rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-950/95 shadow-lg backdrop-blur px-3 py-2">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 md:flex md:items-baseline md:gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Yard optimizer
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100 md:truncate">
                {primaryFlowSummary}
                {best ? (
                  <>
                    {" · "}
                    {hasMultiGoalScore ? "Multi-objective score" : objectiveLabelShort(displayObjective)}{" "}
                    {displayPrimaryScoreText}
                    {displayPrimaryScoreHasUnit ? (
                      <>
                        {" "}
                        <UnitChip
                          unit={objectiveUnitLabel(scoreDisplayObjective)}
                          help={objectiveHelpText(scoreDisplayObjective)}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
              </p>
              {continueUnavailableText ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 md:ml-1">
                  {continueUnavailableText}
                </p>
              ) : null}
            </div>
            <RunControlBar
              variant="sticky"
              runButtonText={runButtonText}
              continueButtonText={continueButtonText}
              pauseButtonText={pauseButtonText}
              running={running}
              runUnavailableText={runUnavailableText}
              continueUnavailableText={continueUnavailableText}
              hasContinuation={hasContinuation}
              canPauseRun={canPauseRun}
              showRunCelebration={false}
              onRun={() => void run()}
              onContinue={() => void continueRun()}
              onPause={requestPause}
            />
          </div>
        </div>
      </div>
        </>
      ) : null}
    </div>
  )
}
