import {
  DEFAULT_ALLOWED_FOODS_INDOOR,
  DEFAULT_ALLOWED_FOODS_OUTDOOR,
  GA_EVOLUTION_SOLVER_TIER,
  DEFAULT_GENETIC,
  OFFSPRING_EXPLORATION_PRESETS,
  type OffspringExplorationPreset,
  type OffspringScoreMode,
} from "../utils/yardOptimizer/config"
import {
  defaultFeasibilityRows,
  defaultFeasibilityRow,
} from "../utils/yardOptimizer/fitnessConstraints"
import {
  normalizeFitnessAnalyzerOptions,
  defaultFitnessAnalyzerOptions,
  type FitnessAnalyzerOptions,
  type FitnessObjective,
  type FitnessObjectiveTerm,
  type SolverTier,
} from "../utils/yardOptimizer/fitness"
import {
  FEASIBILITY_METRIC_ORDER,
  type FeasibilityRow,
} from "../utils/yardOptimizer/fitnessConstraints"
import {
  defaultFixedIndoorDraft,
  defaultFixedOutdoorDraft,
  deriveYardPresetFromSlots,
  parseFixedIndoorDraft,
  parseFixedOutdoorDraft,
  type FixedIndoorDraft,
  type FixedOutdoorDraft,
  type SlotDraftValue,
  type YardPreset,
} from "../utils/yardOptimizer/layoutDrafts"
import { goodies } from "../utils/yardOptimizer/gameData"
import { isOptimizerGoodie } from "../utils/yardOptimizer/yardCore"

/** Per-cat memento lottery start come counts (optimizer session + memento lab). */
export type CatStartComeCounts = Record<number, number>

export function clampComeCountInput(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(5000, Math.floor(value)))
}

export const SEARCH_DEFAULTS_VERSION = 3

export type GoalMode = "guided" | "multi"
export type OffspringExplorationSelectValue =
  | OffspringExplorationPreset
  | "custom"

export type YardOptimizerSessionV1 = {
  v: 1
  selectedCats: number[]
  catStartComeCounts: CatStartComeCounts
  secondaryObjective: FitnessObjective | null
  fitnessObjective: FitnessObjective
  goalMode?: GoalMode
  showMultiGoalOption?: boolean
  objectiveBlendTerms?: FitnessObjectiveTerm[]
  yardPreset: YardPreset
  fixedIndoorDraft?: FixedIndoorDraft
  fixedOutdoorDraft?: FixedOutdoorDraft
  applyFeasibilityGate: boolean
  feasibilityRows: FeasibilityRow[]
  requiredGoodieIds: number[]
  forbiddenGoodieIds: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
  poolEditorOpen: boolean
  locationEditorOpen?: boolean
  generations: number
  poolSize: number
  tournamentK: number
  mutationRate: number
  mutationOffspringRate: number
  searchDefaultsVersion?: number
  foodMutationOffspringRate?: number
  openSlotExplorationRate?: number
  offspringScoreMode?: OffspringScoreMode
  survivorSelectionEnabled?: boolean
  survivorExploratoryRate?: number
  survivorInitialRankTemperature?: number
  survivorFinalRankTemperature?: number
  analyzerOptions: FitnessAnalyzerOptions
  /** Random toy pool excludes off-season rotating shop items when enabled. */
  seasonalPoolOnly: boolean
  /** Analyzer pipeline during GA: `mid` = Standard (capped MF); `full` = Full mean-field. */
  evolutionSolverTier: SolverTier
  /** Dev-only console timing report for optimizer runs. */
  logOptimizerProfile?: boolean
}

const VALID_INDOOR_FOOD_IDS = new Set<number>(DEFAULT_ALLOWED_FOODS_INDOOR)
const VALID_OUTDOOR_FOOD_IDS = new Set<number>(DEFAULT_ALLOWED_FOODS_OUTDOOR)
const VALID_GOODIE_IDS = new Set<number>(
  goodies.filter(isOptimizerGoodie).map((g) => g.Id)
)

export function isFitnessObjective(x: unknown): x is FitnessObjective {
  return (
    x === "netGoldEquiv" ||
    x === "netGold" ||
    x === "netSilver" ||
    x === "catProbability" ||
    x === "mementoExpectedDays"
  )
}

function parseObjectiveBlendTerms(x: unknown): FitnessObjectiveTerm[] {
  if (!Array.isArray(x)) return []
  const out: FitnessObjectiveTerm[] = []
  for (const raw of x) {
    if (!raw || typeof raw !== "object") continue
    const t = raw as Record<string, unknown>
    if (!isFitnessObjective(t.objective)) continue
    if (typeof t.weight !== "number" || !Number.isFinite(t.weight) || t.weight === 0) {
      continue
    }
    out.push({ objective: t.objective, weight: t.weight })
  }
  return out
}

function parseGoalMode(x: unknown): GoalMode {
  return x === "multi" ? "multi" : "guided"
}

export function parseYardPreset(x: unknown): YardPreset {
  if (x === "outdoor_only" || x === "custom") return x
  return "full"
}

function parseEvolutionSolverTier(x: unknown): SolverTier {
  if (x === "mid" || x === "full") return x
  return GA_EVOLUTION_SOLVER_TIER
}

function parseOffspringScoreMode(x: unknown): OffspringScoreMode {
  if (x === "fast" || x === "balanced" || x === "thorough") return x
  return DEFAULT_GENETIC.offspringScoreMode
}

export function offspringExplorationPresetFor(
  mutationOffspringRate: number,
  foodMutationOffspringRate: number,
  openSlotExplorationRate: number,
  offspringScoreMode: OffspringScoreMode
): OffspringExplorationSelectValue {
  for (const [preset, cfg] of Object.entries(OFFSPRING_EXPLORATION_PRESETS)) {
    if (
      Math.abs(cfg.mutationOffspringRate - mutationOffspringRate) < 1e-9 &&
      Math.abs(cfg.foodMutationOffspringRate - foodMutationOffspringRate) < 1e-9 &&
      cfg.offspringScoreMode === offspringScoreMode &&
      Math.abs(cfg.openSlotExplorationRate - openSlotExplorationRate) < 1e-9
    ) {
      return preset as OffspringExplorationPreset
    }
  }
  return "custom"
}

function finiteNumberOrDefault(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback
}

function sanitizeNumberList(
  ids: readonly number[],
  validIds: ReadonlySet<number>
): number[] {
  const out: number[] = []
  for (const id of ids) {
    if (Number.isInteger(id) && validIds.has(id) && !out.includes(id)) {
      out.push(id)
    }
  }
  return out
}

function sanitizeFoodIds(
  ids: readonly number[],
  validIds: ReadonlySet<number>,
  fallback: readonly number[]
): number[] {
  const out = sanitizeNumberList(ids, validIds)
  return out.length > 0 ? out : [...fallback]
}

function sanitizeGoodieSlot(value: SlotDraftValue): SlotDraftValue {
  if (typeof value !== "number") return value
  return VALID_GOODIE_IDS.has(value) ? value : null
}

function sanitizeFoodSlot(
  value: SlotDraftValue,
  validIds: ReadonlySet<number>
): SlotDraftValue {
  if (typeof value !== "number") return value
  return validIds.has(value) ? value : null
}

function sanitizeFixedIndoorDraft(draft: FixedIndoorDraft): FixedIndoorDraft {
  return {
    foodIndoor: sanitizeFoodSlot(draft.foodIndoor, VALID_INDOOR_FOOD_IDS),
    indoorLarge: sanitizeGoodieSlot(draft.indoorLarge),
    indoorSmallSlots: draft.indoorSmallSlots.map(sanitizeGoodieSlot),
  }
}

function sanitizeFixedOutdoorDraft(draft: FixedOutdoorDraft): FixedOutdoorDraft {
  return {
    foodOutdoor: sanitizeFoodSlot(draft.foodOutdoor, VALID_OUTDOOR_FOOD_IDS),
    outdoorLarge: sanitizeGoodieSlot(draft.outdoorLarge),
    outdoorSmallSlots: draft.outdoorSmallSlots.map(sanitizeGoodieSlot),
  }
}

function isFeasibilityMetric(x: unknown): x is FeasibilityRow["metric"] {
  return (FEASIBILITY_METRIC_ORDER as readonly string[]).includes(x as string)
}

function isFeasibilityRule(x: unknown): x is FeasibilityRow["rule"] {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  if (o.op === "between") {
    return (
      typeof o.min === "number" &&
      typeof o.max === "number" &&
      Number.isFinite(o.min) &&
      Number.isFinite(o.max)
    )
  }
  if (o.op === ">=" || o.op === "<=" || o.op === ">" || o.op === "<") {
    return typeof o.value === "number" && Number.isFinite(o.value)
  }
  return false
}

function parseCatStartComeCounts(x: unknown): CatStartComeCounts | null {
  if (!x || typeof x !== "object" || Array.isArray(x)) return null
  const out: CatStartComeCounts = {}
  for (const [key, value] of Object.entries(x as Record<string, unknown>)) {
    const catId = Number(key)
    if (!Number.isInteger(catId) || typeof value !== "number") return null
    out[catId] = clampComeCountInput(value)
  }
  return out
}

export function parseSessionConfig(raw: string): YardOptimizerSessionV1 | null {
  try {
    const j = JSON.parse(raw) as unknown
    if (!j || typeof j !== "object") return null
    const o = j as Record<string, unknown>
    if (o.v !== 1) return null
    if (!Array.isArray(o.selectedCats) || !o.selectedCats.every((n) => typeof n === "number")) {
      return null
    }
    const catStartComeCounts =
      o.catStartComeCounts === undefined
        ? {}
        : parseCatStartComeCounts(o.catStartComeCounts)
    if (catStartComeCounts === null) return null
    if (o.secondaryObjective !== null && !isFitnessObjective(o.secondaryObjective)) return null
    if (!isFitnessObjective(o.fitnessObjective)) return null
    if (typeof o.applyFeasibilityGate !== "boolean") return null
    if (!Array.isArray(o.feasibilityRows)) return null
    for (const row of o.feasibilityRows) {
      if (!row || typeof row !== "object") return null
      const r = row as Record<string, unknown>
      if (typeof r.id !== "string" || !isFeasibilityMetric(r.metric) || !isFeasibilityRule(r.rule)) {
        return null
      }
    }
    if (
      !Array.isArray(o.requiredGoodieIds) ||
      !o.requiredGoodieIds.every((n: unknown) => typeof n === "number")
    ) {
      return null
    }
    if (
      !Array.isArray(o.forbiddenGoodieIds) ||
      !o.forbiddenGoodieIds.every((n: unknown) => typeof n === "number")
    ) {
      return null
    }
    if (
      !Array.isArray(o.selectedFoodsIndoor) ||
      !o.selectedFoodsIndoor.every((n: unknown) => typeof n === "number")
    ) {
      return null
    }
    if (
      !Array.isArray(o.selectedFoodsOutdoor) ||
      !o.selectedFoodsOutdoor.every((n: unknown) => typeof n === "number")
    ) {
      return null
    }
    if (typeof o.poolEditorOpen !== "boolean") return null
    const locationEditorOpen =
      typeof o.locationEditorOpen === "boolean" ? o.locationEditorOpen : false
    if (o.seasonalPoolOnly !== undefined && typeof o.seasonalPoolOnly !== "boolean") {
      return null
    }
    const nums = [
      o.generations,
      o.poolSize,
      o.tournamentK,
      o.mutationRate,
      o.mutationOffspringRate,
    ]
    if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return null
    const ao = o.analyzerOptions
    if (!ao || typeof ao !== "object") return null
    const analyzerOptions = normalizeFitnessAnalyzerOptions(ao as Record<string, unknown>)
    if (!analyzerOptions) return null
    const seasonalPoolOnly =
      typeof o.seasonalPoolOnly === "boolean" ? o.seasonalPoolOnly : false
    const evolutionSolverTier = parseEvolutionSolverTier(o.evolutionSolverTier)
    const hasCurrentSearchDefaults =
      o.searchDefaultsVersion === SEARCH_DEFAULTS_VERSION
    const offspringScoreMode = hasCurrentSearchDefaults
      ? parseOffspringScoreMode(o.offspringScoreMode)
      : DEFAULT_GENETIC.offspringScoreMode
    const goalMode = parseGoalMode(o.goalMode)
    const yardPreset = parseYardPreset(o.yardPreset ?? o.yardScope)
    const objectiveBlendTerms = parseObjectiveBlendTerms(o.objectiveBlendTerms)
    const fixedIndoorDraft = sanitizeFixedIndoorDraft(
      parseFixedIndoorDraft(o.fixedIndoorDraft) ?? defaultFixedIndoorDraft()
    )
    const fixedOutdoorDraft = sanitizeFixedOutdoorDraft(
      parseFixedOutdoorDraft(o.fixedOutdoorDraft) ?? defaultFixedOutdoorDraft()
    )
    const selectedFoodsIndoor = sanitizeFoodIds(
      o.selectedFoodsIndoor,
      VALID_INDOOR_FOOD_IDS,
      DEFAULT_ALLOWED_FOODS_INDOOR
    )
    const selectedFoodsOutdoor = sanitizeFoodIds(
      o.selectedFoodsOutdoor,
      VALID_OUTDOOR_FOOD_IDS,
      DEFAULT_ALLOWED_FOODS_OUTDOOR
    )
    const requiredGoodieIds = sanitizeNumberList(
      o.requiredGoodieIds,
      VALID_GOODIE_IDS
    )
    const forbiddenGoodieIds = sanitizeNumberList(
      o.forbiddenGoodieIds,
      VALID_GOODIE_IDS
    ).filter((id) => !requiredGoodieIds.includes(id))
    const showMultiGoalOption =
      typeof o.showMultiGoalOption === "boolean"
        ? o.showMultiGoalOption
        : goalMode === "multi" || objectiveBlendTerms.length > 0
    const logOptimizerProfile =
      typeof o.logOptimizerProfile === "boolean" ? o.logOptimizerProfile : false
    return {
      ...(o as YardOptimizerSessionV1),
      catStartComeCounts,
      goalMode,
      yardPreset,
      showMultiGoalOption,
      objectiveBlendTerms,
      fixedIndoorDraft,
      fixedOutdoorDraft,
      selectedFoodsIndoor,
      selectedFoodsOutdoor,
      requiredGoodieIds,
      forbiddenGoodieIds,
      locationEditorOpen,
      seasonalPoolOnly,
      analyzerOptions,
      evolutionSolverTier,
      logOptimizerProfile,
      searchDefaultsVersion: SEARCH_DEFAULTS_VERSION,
      offspringScoreMode,
      foodMutationOffspringRate: finiteNumberOrDefault(
        hasCurrentSearchDefaults ? o.foodMutationOffspringRate : undefined,
        DEFAULT_GENETIC.foodMutationOffspringRate
      ),
      openSlotExplorationRate: finiteNumberOrDefault(
        hasCurrentSearchDefaults ? o.openSlotExplorationRate : undefined,
        DEFAULT_GENETIC.openSlotExplorationRate
      ),
      survivorSelectionEnabled:
        hasCurrentSearchDefaults && typeof o.survivorSelectionEnabled === "boolean"
          ? o.survivorSelectionEnabled
          : DEFAULT_GENETIC.survivorSelection.enabled,
      survivorExploratoryRate: finiteNumberOrDefault(
        o.survivorExploratoryRate,
        DEFAULT_GENETIC.survivorSelection.exploratoryRate
      ),
      survivorInitialRankTemperature: finiteNumberOrDefault(
        o.survivorInitialRankTemperature,
        DEFAULT_GENETIC.survivorSelection.initialRankTemperature
      ),
      survivorFinalRankTemperature: finiteNumberOrDefault(
        o.survivorFinalRankTemperature,
        DEFAULT_GENETIC.survivorSelection.finalRankTemperature
      ),
    }
  } catch {
    return null
  }
}

export function defaultSession(): YardOptimizerSessionV1 {
  return {
    v: 1,
    selectedCats: [],
    catStartComeCounts: {},
    secondaryObjective: null,
    fitnessObjective: "netGoldEquiv",
    goalMode: "guided",
    showMultiGoalOption: true,
    objectiveBlendTerms: [],
    yardPreset: "full",
    fixedIndoorDraft: defaultFixedIndoorDraft(),
    fixedOutdoorDraft: defaultFixedOutdoorDraft(),
    applyFeasibilityGate: true,
    feasibilityRows: defaultFeasibilityRows(),
    requiredGoodieIds: [],
    forbiddenGoodieIds: [],
    selectedFoodsIndoor: [...DEFAULT_ALLOWED_FOODS_INDOOR],
    selectedFoodsOutdoor: [...DEFAULT_ALLOWED_FOODS_OUTDOOR],
    poolEditorOpen: false,
    locationEditorOpen: false,
    generations: 50,
    poolSize: DEFAULT_GENETIC.poolSize,
    tournamentK: DEFAULT_GENETIC.tournamentK,
    mutationRate: DEFAULT_GENETIC.mutationRate,
    mutationOffspringRate: DEFAULT_GENETIC.mutationOffspringRate,
    searchDefaultsVersion: SEARCH_DEFAULTS_VERSION,
    foodMutationOffspringRate: DEFAULT_GENETIC.foodMutationOffspringRate,
    openSlotExplorationRate: DEFAULT_GENETIC.openSlotExplorationRate,
    offspringScoreMode: DEFAULT_GENETIC.offspringScoreMode,
    survivorSelectionEnabled: DEFAULT_GENETIC.survivorSelection.enabled,
    survivorExploratoryRate: DEFAULT_GENETIC.survivorSelection.exploratoryRate,
    survivorInitialRankTemperature:
      DEFAULT_GENETIC.survivorSelection.initialRankTemperature,
    survivorFinalRankTemperature:
      DEFAULT_GENETIC.survivorSelection.finalRankTemperature,
    analyzerOptions: { ...defaultFitnessAnalyzerOptions(), itemDamageState: 2 },
    seasonalPoolOnly: true,
    evolutionSolverTier: GA_EVOLUTION_SOLVER_TIER,
    logOptimizerProfile: false,
  }
}

export function serializeSession(session: YardOptimizerSessionV1): string {
  return JSON.stringify({
    ...session,
    v: 1 as const,
    searchDefaultsVersion: SEARCH_DEFAULTS_VERSION,
  })
}

/** Build the persisted session blob from current optimizer config state. */
export function buildYardOptimizerSessionPayload(input: {
  selectedCats: number[]
  catStartComeCounts: CatStartComeCounts
  secondaryObjective: FitnessObjective | null
  fitnessObjective: FitnessObjective
  goalMode: GoalMode
  showMultiGoalOption: boolean
  objectiveBlendTerms: FitnessObjectiveTerm[]
  fixedIndoorDraft: FixedIndoorDraft
  fixedOutdoorDraft: FixedOutdoorDraft
  applyFeasibilityGate: boolean
  feasibilityRows: FeasibilityRow[]
  requiredGoodieIds: number[]
  forbiddenGoodieIds: number[]
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
  poolEditorOpen: boolean
  locationEditorOpen: boolean
  generations: number
  poolSize: number
  tournamentK: number
  mutationRate: number
  mutationOffspringRate: number
  foodMutationOffspringRate: number
  openSlotExplorationRate: number
  offspringScoreMode: OffspringScoreMode
  survivorSelectionEnabled: boolean
  survivorExploratoryRate: number
  survivorInitialRankTemperature: number
  survivorFinalRankTemperature: number
  analyzerOptions: FitnessAnalyzerOptions
  seasonalPoolOnly: boolean
  evolutionSolverTier: SolverTier
  logOptimizerProfile: boolean
}): YardOptimizerSessionV1 {
  const yardPreset = deriveYardPresetFromSlots(
    input.fixedIndoorDraft,
    input.fixedOutdoorDraft
  )
  return {
    v: 1,
    selectedCats: input.selectedCats,
    catStartComeCounts: input.catStartComeCounts,
    secondaryObjective: input.secondaryObjective,
    fitnessObjective: input.fitnessObjective,
    goalMode: input.goalMode,
    showMultiGoalOption: input.showMultiGoalOption,
    objectiveBlendTerms: input.objectiveBlendTerms,
    yardPreset,
    fixedIndoorDraft: input.fixedIndoorDraft,
    fixedOutdoorDraft: input.fixedOutdoorDraft,
    applyFeasibilityGate: input.applyFeasibilityGate,
    feasibilityRows: input.feasibilityRows,
    requiredGoodieIds: input.requiredGoodieIds,
    forbiddenGoodieIds: input.forbiddenGoodieIds,
    selectedFoodsIndoor: input.selectedFoodsIndoor,
    selectedFoodsOutdoor: input.selectedFoodsOutdoor,
    poolEditorOpen: input.poolEditorOpen,
    locationEditorOpen: input.locationEditorOpen,
    generations: input.generations,
    poolSize: input.poolSize,
    tournamentK: input.tournamentK,
    mutationRate: input.mutationRate,
    mutationOffspringRate: input.mutationOffspringRate,
    searchDefaultsVersion: SEARCH_DEFAULTS_VERSION,
    foodMutationOffspringRate: input.foodMutationOffspringRate,
    openSlotExplorationRate: input.openSlotExplorationRate,
    offspringScoreMode: input.offspringScoreMode,
    survivorSelectionEnabled: input.survivorSelectionEnabled,
    survivorExploratoryRate: input.survivorExploratoryRate,
    survivorInitialRankTemperature: input.survivorInitialRankTemperature,
    survivorFinalRankTemperature: input.survivorFinalRankTemperature,
    analyzerOptions: input.analyzerOptions,
    seasonalPoolOnly: input.seasonalPoolOnly,
    evolutionSolverTier: input.evolutionSolverTier,
    logOptimizerProfile: input.logOptimizerProfile,
  }
}

/** Apply parsed session to React setters — single source for hydrate and reset. */
export type YardOptimizerSessionActions = {
  setSelectedCats: (value: number[]) => void
  setCatStartComeCounts: (value: CatStartComeCounts) => void
  setSecondaryObjective: (value: FitnessObjective | null) => void
  setFitnessObjective: (value: FitnessObjective) => void
  setGoalMode: (value: GoalMode) => void
  setShowMultiGoalOption: (value: boolean) => void
  setObjectiveBlendTerms: (value: FitnessObjectiveTerm[]) => void
  setFixedIndoorDraft: (value: FixedIndoorDraft) => void
  setFixedOutdoorDraft: (value: FixedOutdoorDraft) => void
  setApplyFeasibilityGate: (value: boolean) => void
  setFeasibilityRows: (value: FeasibilityRow[]) => void
  setRequiredGoodieIds: (value: number[]) => void
  setForbiddenGoodieIds: (value: number[]) => void
  setSelectedFoodsIndoor: (value: number[]) => void
  setSelectedFoodsOutdoor: (value: number[]) => void
  setPoolEditorOpen: (value: boolean) => void
  setLocationEditorOpen: (value: boolean) => void
  setGenerations: (value: number) => void
  setPoolSize: (value: number) => void
  setTournamentK: (value: number) => void
  setMutationRate: (value: number) => void
  setMutationOffspringRate: (value: number) => void
  setFoodMutationOffspringRate: (value: number) => void
  setOpenSlotExplorationRate: (value: number) => void
  setOffspringScoreMode: (value: OffspringScoreMode) => void
  setSurvivorSelectionEnabled: (value: boolean) => void
  setSurvivorExploratoryRate: (value: number) => void
  setSurvivorInitialRankTemperature: (value: number) => void
  setSurvivorFinalRankTemperature: (value: number) => void
  setAnalyzerOptions: (value: FitnessAnalyzerOptions) => void
  setSeasonalPoolOnly: (value: boolean) => void
  setEvolutionSolverTier: (value: SolverTier) => void
  setLogOptimizerProfile: (value: boolean) => void
}

function draftsFromSession(p: YardOptimizerSessionV1): {
  indoor: FixedIndoorDraft
  outdoor: FixedOutdoorDraft
} {
  const parsedIndoor = p.fixedIndoorDraft
    ? parseFixedIndoorDraft(p.fixedIndoorDraft)
    : null
  const parsedOutdoor = p.fixedOutdoorDraft
    ? parseFixedOutdoorDraft(p.fixedOutdoorDraft)
    : null
  if (parsedIndoor && parsedOutdoor) {
    return { indoor: parsedIndoor, outdoor: parsedOutdoor }
  }

  const legacyScope = (p as { yardScope?: unknown }).yardScope
  const preset = p.yardPreset ?? parseYardPreset(legacyScope)
  return {
    indoor:
      parsedIndoor ??
      (preset === "outdoor_only"
        ? defaultFixedIndoorDraft("closed")
        : defaultFixedIndoorDraft("open")),
    outdoor: parsedOutdoor ?? defaultFixedOutdoorDraft("open"),
  }
}

export function applyYardOptimizerSession(
  p: YardOptimizerSessionV1,
  actions: YardOptimizerSessionActions
): void {
  const drafts = draftsFromSession(p)
  actions.setSelectedCats(p.selectedCats)
  actions.setCatStartComeCounts(p.catStartComeCounts)
  actions.setSecondaryObjective(p.secondaryObjective)
  actions.setFitnessObjective(p.fitnessObjective)
  actions.setGoalMode(p.goalMode ?? "guided")
  actions.setShowMultiGoalOption(p.showMultiGoalOption ?? true)
  actions.setObjectiveBlendTerms(p.objectiveBlendTerms ?? [])
  actions.setFixedIndoorDraft(drafts.indoor)
  actions.setFixedOutdoorDraft(drafts.outdoor)
  actions.setApplyFeasibilityGate(p.applyFeasibilityGate)
  actions.setFeasibilityRows(p.feasibilityRows)
  actions.setRequiredGoodieIds(p.requiredGoodieIds)
  actions.setForbiddenGoodieIds(p.forbiddenGoodieIds)
  actions.setSelectedFoodsIndoor(p.selectedFoodsIndoor)
  actions.setSelectedFoodsOutdoor(p.selectedFoodsOutdoor)
  actions.setPoolEditorOpen(p.poolEditorOpen)
  actions.setLocationEditorOpen(p.locationEditorOpen ?? false)
  actions.setGenerations(p.generations)
  actions.setPoolSize(p.poolSize)
  actions.setTournamentK(p.tournamentK)
  actions.setMutationRate(p.mutationRate)
  actions.setMutationOffspringRate(p.mutationOffspringRate)
  actions.setFoodMutationOffspringRate(
    p.foodMutationOffspringRate ?? DEFAULT_GENETIC.foodMutationOffspringRate
  )
  actions.setOpenSlotExplorationRate(
    p.openSlotExplorationRate ?? DEFAULT_GENETIC.openSlotExplorationRate
  )
  actions.setOffspringScoreMode(
    p.offspringScoreMode ?? DEFAULT_GENETIC.offspringScoreMode
  )
  actions.setSurvivorSelectionEnabled(
    p.survivorSelectionEnabled ?? DEFAULT_GENETIC.survivorSelection.enabled
  )
  actions.setSurvivorExploratoryRate(
    p.survivorExploratoryRate ??
      DEFAULT_GENETIC.survivorSelection.exploratoryRate
  )
  actions.setSurvivorInitialRankTemperature(
    p.survivorInitialRankTemperature ??
      DEFAULT_GENETIC.survivorSelection.initialRankTemperature
  )
  actions.setSurvivorFinalRankTemperature(
    p.survivorFinalRankTemperature ??
      DEFAULT_GENETIC.survivorSelection.finalRankTemperature
  )
  actions.setAnalyzerOptions({
    ...p.analyzerOptions,
    itemDamageState: p.analyzerOptions.itemDamageState ?? 2,
  })
  actions.setSeasonalPoolOnly(p.seasonalPoolOnly)
  actions.setEvolutionSolverTier(p.evolutionSolverTier)
  actions.setLogOptimizerProfile(p.logOptimizerProfile ?? false)
}
