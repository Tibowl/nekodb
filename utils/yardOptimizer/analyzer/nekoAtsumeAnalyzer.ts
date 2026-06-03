import {
  ANALYZER_GOLD_PER_SILVER_FOR_GOLD_EQUIV,
  ANALYZER_SILVER_PER_GOLD_FOR_SILVER_EQUIV,
  CAT_COOLDOWN_TICK_AVG,
  CAT_STAY_TICK_AVG,
  MINUTES_PER_TICK,
  TUBBS_CAT_ID,
  YARD_TOTAL_KEY,
} from "./constants"
import {
  emptyAnalyzerResults,
  type AnalyzerResults,
} from "./analyzerResults"
import { CustomGrouping } from "./grouping"
import { removeInteractions } from "./probability"
import {
  solveCatPlaceSystem,
  type InteractionMode,
  type OpenGateMode,
  type ReachMode,
} from "./catPlaceSolver"
import type { TubbsMode } from "../tubbsMode"
import {
  computeTubbsOutdoorBowlEconomy,
  computeTubbsOutdoorMass,
  outdoorOccupancyRetention,
  buildOutdoorRetentionSuppressedMask,
  visitStayRateWithOutdoorRetention,
  indoorOutdoorMassWithRetention,
} from "../tubbsEconomy"
import {
  getCatVsFoodDictCached,
  getPlayspaceWeatherDictCached,
  type AnalyzerStaticData,
} from "./staticData"
import { playSpaceVsCat } from "../gameData"
import { profileSolverMs, yardOptimizerProfilingActive } from "../optimizerProfile"
import {
  foodMementoRateForType,
  MEMENTO_INDOOR_PLACEMENT_MULT,
  MEMENTO_OUTDOOR_PLACEMENT_MULT,
} from "../config"
import {
  COMPANION_VISIT_RULES,
  canCatAppearOnPlayspace,
  isFoodItemId,
} from "../visitRules"
import { giftEconomyForCatOnPlayspace } from "../visitEconomy"
import {
  buildFlowchartRuntimeFromAnalyzer,
} from "../yardMementoSim"
import type { FlowchartSimRuntime } from "../yardFlowchartSim"
import { effectiveItemDamageState } from "../../goodie/itemDamageState"

function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0)
}

export type AnalyzerArgs = {
  foodTypeIndoor: number
  foodTypeOutdoor: number
  itemDamageState: number
  weather: string
  totalDurationMinutes: number
  groupDef: "custom"
  itemsOfInterestIndoors: number[]
  itemsOfInterestOutdoors: number[]
  catId: number[]
  /**
   * Optional memento-proxy overrides (defaults: food rates from `FOOD_MEMENTO_RATE`, placement from
   * `MEMENTO_*_PLACEMENT_MULT`). Used for interactive what-if analysis only.
   */
  mementoPlacementIndoorMult?: number
  mementoPlacementOutdoorMult?: number
  /** Multiplier applied to both bowls’ base food memento rates. */
  mementoFoodRateScale?: number
  /** Solver controls for the mean-field cat/place pass. */
  interactionMode?: InteractionMode
  reachMode?: ReachMode
  openGateMode?: OpenGateMode
  /**
   * "Tubbs effect" outdoor food-cost mode. Occupancy solve is unchanged; after metrics are final,
   * {@link applyTubbsOutdoorBowlEconomy} derives `lastOutdoorBowlCostFactor` and
   * `lastBowlIncomeHaircut` for scoring. Absent ⇒ treated as `off`.
   */
  tubbsMode?: TubbsMode
  interactionSamples?: number
  interactionTopCats?: number
  /** When set, passed to `solveCatPlaceSystem`; omit for full 2000-iter solve. */
  solverMaxIterations?: number
  solverConvergenceThreshold?: number
  solverDampingFactor?: number
  /** Passed to `solveComponentForTargetOccupancy` (per outer MF step); omit for 80 / 1e-12 / 0.7. */
  componentInnerMaxIterations?: number
  componentInnerTolerance?: number
  componentInnerDamping?: number
  /**
   * Optional cache keyed by `${playspaceId}|${side}|${foodIndoor}|${foodOutdoor}`
   * (side = I/O for the indoor/outdoor placement of this play space in the
   * current yard) that stores fully-assembled `PlaySpaceData` rows.
   * `calculateNonInteractiveVariables` checks the cache before computing each
   * row and populates on miss. The side is part of the key because the row
   * depends on which side the goodie sits on (food column, silver economy,
   * weather); a side-flexible goodie placed differently across two yards must
   * not share a row. Caller is responsible for ensuring weather and
   * itemDamageState are constant across all uses of the same cache instance;
   * in production the cache lives on `FitnessContext` where those two are fixed
   * at construction.
   */
  playspaceDataCache?: Map<string, PlaySpaceData>
}

export type PlaySpaceData = {
  catIds: number[]
  drawWeights: number[]
  catVisitProbPermyriad: number[]
  perCatSilverRate: number[]
  conflictedIdxs: number[]
  perCatVisitProb?: number[]
  perCatStayRate?: number[]
  catOnCatInteractions?: number[]
}

type MinCalculationUnit = {
  itemId: number
  playspaceId: number
  catIdx: number
}

type ConstraintGroup = { entries: MinCalculationUnit[] }
type Constraint = { groups: ConstraintGroup[] }

/** Custom-grouping yard analyzer. Scoring runs `solveCatPlaceSystem` for cat/place mean field. */
export class NekoAtsumeAnalyzer {
  args: AnalyzerArgs
  sd: AnalyzerStaticData
  isCustomGrouping = true
  outdoorWeather: string | null = null
  groupingStrategy: CustomGrouping
  catVsFoodIndoor: Record<number, number>
  catVsFoodOutdoor: Record<number, number>
  playspaceToWeatherMul: Record<number, number>
  additionalPlayspaceToWeatherMul: Record<number, number> | null = null

  allData: Record<number, Record<number, PlaySpaceData>> = {}
  sameCatInteractionTermCalcSpace: Record<
    string,
    Record<number, [number, number, number][]>
  > = {}
  constraints: Constraint[] = []
  /**
   * After `analyze()`, per target-cat mementoProxy ticks (same formula as yard merge). Empty when
   * `catId` is empty.
   */
  lastMementoProxyByTargetCat: Record<number, number> | null = null
  /**
   * After `analyze()`, per target-cat indoor / outdoor stay-rate-per-tick masses. Used by the
   * lottery panel to derive visits/day and the per-visit indoor↔outdoor location mixture. Empty
   * when `catId` is empty.
   */
  lastVisitMassByTargetCat:
    | Record<number, { indoorMass: number; outdoorMass: number }>
    | null = null
  /**
   * After `analyze()`, Tubbs (cat 108) total outdoor stay-rate-per-tick mass across the whole pool,
   * independent of whether 108 is a target cat. Drives the Tubbs-effect outdoor food-cost ratio in
   * `fitnessScore`. Stays 0 when Tubbs never appears outdoors.
   */
  lastTubbsOutdoorMass: number = 0
  /**
   * After `analyze()`: Tubbs's (cat 108) OWN gross income per day on the OUTDOOR FOOD BOWL playspace
   * (item == `foodTypeOutdoor`), by currency — his stay-weighted bowl gift. The ONLY bowl-income
   * surface scoring needs: the kick haircut forgoes his gold and keeps his silver (see `tubbsEconomy`).
   * Uses the same gift-mix payout math as `accumulateCatGroupMetrics` (`goldEquiv` = gold rate +
   * silver rate × {@link ANALYZER_GOLD_PER_SILVER_FOR_GOLD_EQUIV}). Populated once per `analyze()` on
   * the overall pass; stays `{0,0,0}` when Tubbs has no outdoor bowl income.
   */
  lastTubbsBowlIncome: { silver: number; gold: number; goldEquiv: number } = {
    silver: 0,
    gold: 0,
    goldEquiv: 0,
  }
  /**
   * After `applyCatPlaceSolve()`: mean OUTDOOR playspace occupancy θ ∈ [0,1] (steady busy
   * probability averaged over `!isIndoor` places). The Tubbs income-retention factor uses it:
   * `ρ = f / (1 − θ(1 − f))`. Higher θ (crowded outdoor) ⇒ more competition relief during empty
   * periods ⇒ income more resilient to the empty-bowl gate (ρ closer to 1).
   */
  lastOutdoorPlaceOccupancy = 0
  /**
   * After `analyze()`: outdoor occupancy retention ρ ∈ (0,1] — the fraction of outdoor VISITS that
   * survive the empty-bowl gate (same factor the income haircut uses, by Little's law). Scales the
   * outdoor portion of `catProbability`, `mementoProxy`, and `stayRate` for non-Tubbs cats so the
   * analyzer reflects that an empty bowl slows outdoor cat acquisition. 1 under `off` / no Tubbs.
   */
  lastOutdoorOccupancyRetention = 1
  /**
   * After `analyze()`: renewal-derived outdoor-bowl demand-capped refills/day. Prompt kick:
   * `== emptyRate = Rt / (1 - exp(-Rt/Ro))`; helper waits Tubbs out; food-round modes use
   * `min(max(Ri, Ro), emptyRate)`. The Tubbs
   * outdoor food-cost factor is `lastOutdoorBowlRefillRate / Ro` (`1` under `off` / `Rt <= 0` /
   * `Ro <= 0`).
   */
  lastOutdoorBowlRefillRate: number = 0
  /**
   * After `analyze()`: the Tubbs-effect multiplier on the OUTDOOR bowl's food cost, surfaced so
   * scoring reads it directly (`costFactor = lastOutdoorBowlCostFactor`). Equals
   * `(Ro > 0) ? lastOutdoorBowlRefillRate / Ro : 1`, where `Ro` = outdoor refills/day. `1` under
   * `off` / no-Tubbs (`Rt <= 0`) / no-outdoor-bowl (`Ro <= 0`), so the default config and every
   * Tubbs-free yard stay byte-identical.
   */
  lastOutdoorBowlCostFactor: number = 1
  /**
   * After `analyze()`: the per-currency amount to subtract from gross income to apply the Tubbs
   * effect, so scoring's adjusted gross is `metricTotal(results, key) - lastBowlIncomeHaircut[c]`.
   * For kick modes, the haircut removes Tubbs's gold branch but credits the extra silver branch created
   * by setting his gold conversion to zero. Helper/graze keep the full Tubbs gift. All `0` under `off`
   * / no-Tubbs / no-outdoor-bowl, so gross is returned unchanged and Tubbs-free yards stay
   * byte-identical. Empty-bowl availability is applied earlier at the outdoor visit source.
   */
  lastBowlIncomeHaircut: { silver: number; gold: number; goldEquiv: number } = {
    silver: 0,
    gold: 0,
    goldEquiv: 0,
  }
  lastSolverIterations: number | null = null
  lastSolverConverged: boolean | null = null
  /** Lazy cache for memento MC; cleared at start of each `analyze()`. */
  private flowchartRuntimeCache: FlowchartSimRuntime | null = null

  /** Snapshot for tick-level memento sim; built on first use after `analyze()`. */
  getFlowchartRuntime(): FlowchartSimRuntime {
    if (!this.flowchartRuntimeCache) {
      this.flowchartRuntimeCache = buildFlowchartRuntimeFromAnalyzer(this)
    }
    return this.flowchartRuntimeCache
  }

  constructor(sd: AnalyzerStaticData, args: AnalyzerArgs) {
    this.sd = sd
    this.args = args

    if (args.weather === "Summer") {
      this.outdoorWeather = "Burning"
    }

    this.catVsFoodIndoor = getCatVsFoodDictCached(args.foodTypeIndoor)
    this.catVsFoodOutdoor = getCatVsFoodDictCached(args.foodTypeOutdoor)
    this.playspaceToWeatherMul = getPlayspaceWeatherDictCached(args.weather)

    if (this.outdoorWeather) {
      this.additionalPlayspaceToWeatherMul = getPlayspaceWeatherDictCached(
        this.outdoorWeather
      )
    }

    this.groupingStrategy = new CustomGrouping(
      this.sd.playspaceMappings.itemId,
      args.itemsOfInterestIndoors,
      args.itemsOfInterestOutdoors
    )
  }

  calculateNonInteractiveVariables(): void {
    const cache = this.args.playspaceDataCache
    const foodIn = this.args.foodTypeIndoor
    const foodOut = this.args.foodTypeOutdoor
    for (const record of playSpaceVsCat) {
      const playspaceId = record.Id
      if (!record.Dict || Object.keys(record.Dict).length === 0) continue

      if (this.groupingStrategy.getCorrespondingGroup(playspaceId) == null) {
        continue
      }

      if (!this.sd.playspaceRecordIds.has(playspaceId)) continue

      const itemId = this.sd.playspaceMappings.itemId[playspaceId]!
      // The assembled row depends on which SIDE the goodie sits on in this yard:
      // isIndoor selects the indoor vs outdoor food column, the silver economy,
      // and the weather handling below. So the side must be part of the cache
      // key — otherwise a side-flexible goodie placed indoors in one yard and
      // outdoors in another under the same food pair would get a stale
      // cross-side hit (corrupting visit probs and the score).
      const isIndoor = this.groupingStrategy.getIsIndoors(playspaceId)
      const cacheKey = `${playspaceId}|${isIndoor ? "I" : "O"}|${foodIn}|${foodOut}`
      const cached = cache?.get(cacheKey)
      if (cached) {
        // Shallow-copy so later phases that add `perCatVisitProb` /
        // `perCatStayRate` / `catOnCatInteractions` on this object do
        // not leak across yards. Inner arrays are read-only after build, so
        // sharing them is safe.
        if (!this.allData[itemId]) this.allData[itemId] = {}
        this.allData[itemId]![playspaceId] = { ...cached }
        continue
      }

      const entries = Object.entries(record.Dict)
      const catIds = entries.map(([k]) => Number(k))
      const weights = entries.map(([, w]) => w as number[])
      const ds = this.args.itemDamageState
      const effectiveDamageState = effectiveItemDamageState(itemId, ds)
      const drawWeights = weights.map((w) =>
        w.length > effectiveDamageState ? w[effectiveDamageState]! : w[w.length - 1]!
      )

      if (sum(drawWeights) === 0) continue

      const multiplierCats = catIds.map((id) => this.sd.catToSilverMul[id]!)
      const multiplierGoodies =
        this.sd.playspaceMappings.silverMul[playspaceId]!
      const catVsFood = isIndoor
        ? this.catVsFoodIndoor
        : this.catVsFoodOutdoor
      const catVisitProbByFood = catIds.map((id) => catVsFood[id] ?? 0)
      const multiplierGoodieCharms =
        this.sd.playspaceMappings.charm[playspaceId]!
      let multiplierWeatherByPlayspaceDelta =
        this.playspaceToWeatherMul[playspaceId] ?? 0

      if (
        this.outdoorWeather &&
        this.additionalPlayspaceToWeatherMul &&
        !isIndoor
      ) {
        multiplierWeatherByPlayspaceDelta =
          this.additionalPlayspaceToWeatherMul[playspaceId] ?? 0
      }

      const multiplierCatWeatherImpact = catIds.map(
        (id) => this.sd.catToWeatherImpact[id]!
      )
      const isIndoorFoodPlayspace = isIndoor && isFoodItemId(itemId)

      const catVisitProbPermyriad = catVisitProbByFood.map((cf, i) => {
        if (isIndoorFoodPlayspace) return 0
        if (
          !canCatAppearOnPlayspace(
            catIds[i]!,
            playspaceId,
            this.args.weather
          )
        ) {
          return 0
        }
        const w =
          cf *
          multiplierGoodieCharms *
          ((multiplierWeatherByPlayspaceDelta *
            (multiplierCatWeatherImpact[i]! / 100) +
            100) /
            100)
        return Math.max(0, Math.min(10000, w))
      })

      const perCatSilverRate = multiplierCats.map((mc) =>
        giftEconomyForCatOnPlayspace(mc, multiplierGoodies, isIndoor)
          .silverRatePerTickWhenSilverGift
      )

      const conflicted = this.sd.playspaceMappings.conflictedIdxs[playspaceId] ?? []

      const psData: PlaySpaceData = {
        catIds,
        drawWeights,
        catVisitProbPermyriad,
        perCatSilverRate,
        conflictedIdxs: conflicted,
      }
      if (!this.allData[itemId]) this.allData[itemId] = {}
      this.allData[itemId]![playspaceId] = psData
      // Cache a separate copy: subsequent per-yard phases mutate
      // `allData[itemId][playspaceId]` by adding `perCatVisitProb`,
      // `perCatStayRate`, `catOnCatInteractions`, and the cached value
      // must stay clean of those.
      cache?.set(cacheKey, { ...psData })
    }
  }

  calculatePerCatStayRate(): void {
    for (const playspaceDict of Object.values(this.allData)) {
      for (const data of Object.values(playspaceDict)) {
        const catIds = data.catIds
        const drawWeights = data.drawWeights
        const catVisitProbPermyriad = data.catVisitProbPermyriad
        const catOnCatInteractions =
          data.catOnCatInteractions ?? new Array(catIds.length).fill(100)

        const interactedDrawWeights = drawWeights.map(
          (dw, i) => (dw * catOnCatInteractions[i]!) / 100
        )
        const dwSum = sum(interactedDrawWeights)
        if (dwSum === 0) {
          data.perCatVisitProb = new Array(catIds.length).fill(0)
          data.perCatStayRate = new Array(catIds.length).fill(0)
          continue
        }
        const drawProbability = interactedDrawWeights.map((w) => w / dwSum)
        const perCatVisitProb = drawProbability.map(
          (dp, i) => dp * catVisitProbPermyriad[i]!
        )
        const playspaceVisitProb = sum(perCatVisitProb)

        if (playspaceVisitProb === 0) {
          data.perCatVisitProb = perCatVisitProb.map(() => 0)
          data.perCatStayRate = new Array(catIds.length).fill(0)
          continue
        }

        const perCatVisitProbGivenVisit = perCatVisitProb.map(
          (p) => p / playspaceVisitProb
        )

        const playspaceCatStayRate =
          CAT_STAY_TICK_AVG /
          (10000 / playspaceVisitProb - 1 + CAT_STAY_TICK_AVG)

        data.perCatVisitProb = perCatVisitProb.map((p) => p / 10000)
        data.perCatStayRate = perCatVisitProbGivenVisit.map(
          (pv) => playspaceCatStayRate * pv
        )
      }
    }
  }

  calculateCatOnCatInteractions(): void {
    for (const playspaceDict of Object.values(this.allData)) {
      const pidList = Object.keys(playspaceDict).map(Number)
      for (const playspaceId of pidList) {
        const data = playspaceDict[playspaceId]!
        const catIds = data.catIds
        const catOnCatInteractions = catIds.map(() => 100)
        for (const otherPs of pidList) {
          if (otherPs === playspaceId) continue
          const other = playspaceDict[otherPs]!
          const otherCatIds = other.catIds
          const otherRates = other.perCatStayRate ?? new Array(otherCatIds.length).fill(0)
          const otherMap = new Map<number, number>()
          otherCatIds.forEach((id, i) => otherMap.set(id, otherRates[i]!))
          for (let idx = 0; idx < catIds.length; idx++) {
            const catId = catIds[idx]!
            const row = this.sd.catVsCatAll[catId] ?? {}
            for (const otherCatId of otherCatIds) {
              catOnCatInteractions[idx]! +=
                (otherMap.get(otherCatId) ?? 0) *
                Number(row[String(otherCatId)] ?? 0)
            }
          }
        }
        data.catOnCatInteractions = catOnCatInteractions.map((x) =>
          Math.max(30, Math.min(400, x))
        )
      }
    }
  }

  /** Item conflict mutual-exclusivity redistribution (`analyze.resolveConstraints`). */
  resolveConstraints(): void {
    const playspaceIdToItemId = this.sd.playspaceMappings.itemId
    for (const constraint of this.constraints) {
      const visitProbsOrig: number[] = []
      for (const group of constraint.groups) {
        const entriesByPs = new Map<number, MinCalculationUnit[]>()
        for (const e of group.entries) {
          const list = entriesByPs.get(e.playspaceId) ?? []
          list.push(e)
          entriesByPs.set(e.playspaceId, list)
        }
        const groupPlayspaceVisitProbs: number[] = []
        for (const [, entries] of entriesByPs.entries()) {
          let playspaceVisitProb = 0
          for (const entry of entries) {
            const d = this.allData[entry.itemId]?.[entry.playspaceId]
            const v = d?.perCatVisitProb?.[entry.catIdx] ?? 0
            playspaceVisitProb += v
          }
          groupPlayspaceVisitProbs.push(playspaceVisitProb)
        }
        const prod = groupPlayspaceVisitProbs.reduce(
          (acc, pv) => acc * (1 - pv),
          1
        )
        visitProbsOrig.push(1 - prod)
      }

      const adjustedVisitProbs = removeInteractions(visitProbsOrig)
      const adjustedSum = sum(adjustedVisitProbs)
      if (adjustedSum === 0) continue

      const newStayRates = adjustedVisitProbs.map(
        (av) =>
          (CAT_STAY_TICK_AVG / (1 / adjustedSum - 1 + CAT_STAY_TICK_AVG)) *
          (av / adjustedSum)
      )

      for (let gi = 0; gi < constraint.groups.length; gi++) {
        const group = constraint.groups[gi]!
        const newStayRate = newStayRates[gi]!
        const entriesByPs = new Map<number, MinCalculationUnit[]>()
        for (const e of group.entries) {
          const list = entriesByPs.get(e.playspaceId) ?? []
          list.push(e)
          entriesByPs.set(e.playspaceId, list)
        }
        const playspaceOrigStayRates: number[] = []
        const psOrder: number[] = []
        for (const [playspaceId, entries] of entriesByPs.entries()) {
          psOrder.push(playspaceId)
          const itemId = playspaceIdToItemId[playspaceId]!
          const playspaceData = this.allData[itemId]![playspaceId]!
          let s = 0
          for (const e of entries) {
            s += playspaceData.perCatStayRate?.[e.catIdx] ?? 0
          }
          playspaceOrigStayRates.push(s)
        }
        const origSum = sum(playspaceOrigStayRates)
        if (origSum === 0) continue
        const adjustedPlayspaceStayRates = playspaceOrigStayRates.map(
          (r) => (r / origSum) * newStayRate
        )
        for (let i = 0; i < psOrder.length; i++) {
          const playspaceId = psOrder[i]!
          const adjustedPlayspaceStayRate = adjustedPlayspaceStayRates[i]!
          const entries = entriesByPs.get(playspaceId)!
          const itemId = playspaceIdToItemId[playspaceId]!
          const playspaceData = this.allData[itemId]![playspaceId]!
          const perCatVisitProb = playspaceData.perCatVisitProb
          if (!perCatVisitProb || sum(perCatVisitProb) === 0) continue
          const sm = sum(perCatVisitProb)
          playspaceData.perCatStayRate = perCatVisitProb.map(
            (p) => (p / sm) * adjustedPlayspaceStayRate
          )
        }
      }
    }
  }

  calculateSameCatInteractions(): void {
    for (const catDict of Object.values(this.sameCatInteractionTermCalcSpace)) {
      for (const catData of Object.values(catDict)) {
        const appear = catData.map((r) => r[0]!)
        if (sum(appear) === 0) continue
        const adjusted = removeInteractions(appear)
        for (let i = 0; i < catData.length; i++) {
          catData[i]![0] = adjusted[i]!
        }
      }
    }
  }

  enumerateItemConflictIdxConstraint(): Constraint[] {
    const conflicts: Constraint[] = []
    for (const [itemIdStr, playspaceDict] of Object.entries(this.allData)) {
      const itemId = Number(itemIdStr)
      const conflictingGroups = new Map<string, Set<number>>()
      for (const [psIdStr, data] of Object.entries(playspaceDict)) {
        const thisPlayspaceId = Number(psIdStr)
        const conflictingIdxs = data.conflictedIdxs
        if (!conflictingIdxs.length) continue
        const key = JSON.stringify(conflictingIdxs)
        if (!conflictingGroups.has(key)) conflictingGroups.set(key, new Set())
        conflictingGroups.get(key)!.add(thisPlayspaceId)
      }

      if (conflictingGroups.size === 0) continue

      const processedConflictKeys = new Set<string>()
      for (const [thisKey, thisPlayspaceIds] of conflictingGroups) {
        if (processedConflictKeys.has(thisKey)) continue
        const idxs = JSON.parse(thisKey) as number[]
        let otherPlayspaceIds = new Set(
          idxs.map((idx) => parseInt(String(itemId) + String(idx), 10))
        )
        if (otherPlayspaceIds.size > 1) continue
        processedConflictKeys.add(thisKey)

        for (const [otherKey, possiblePlayspaceIds] of conflictingGroups) {
          if (setIsSupersetOrEqual(otherPlayspaceIds, possiblePlayspaceIds)) {
            if (setIsStrictSuperset(otherPlayspaceIds, possiblePlayspaceIds)) {
              otherPlayspaceIds = new Set(possiblePlayspaceIds)
            }
            processedConflictKeys.add(otherKey)
            const group1: MinCalculationUnit[] = []
            const group2: MinCalculationUnit[] = []
            for (const playspaceId of thisPlayspaceIds) {
              const n = playspaceDict[playspaceId]!.catIds.length
              for (let catIdx = 0; catIdx < n; catIdx++) {
                group1.push({ itemId, playspaceId, catIdx })
              }
            }
            for (const playspaceId of otherPlayspaceIds) {
              const n = playspaceDict[playspaceId]!.catIds.length
              for (let catIdx = 0; catIdx < n; catIdx++) {
                group2.push({ itemId, playspaceId, catIdx })
              }
            }
            conflicts.push({ groups: [{ entries: group1 }, { entries: group2 }] })
          }
        }
      }
    }
    return conflicts
  }

  /** Mean-field cat/place solve. */
  private applyCatPlaceSolve(): void {
    const placeIds: number[] = []
    for (const playspaceDict of Object.values(this.allData)) {
      for (const ps of Object.keys(playspaceDict)) placeIds.push(Number(ps))
    }
    placeIds.sort((a, b) => a - b)
    const placeIndex = new Map(placeIds.map((id, i) => [id, i]))
    const placeNames = placeIds.map((id) => String(id))

    const catSet = new Set<number>()
    for (const playspaceDict of Object.values(this.allData)) {
      for (const data of Object.values(playspaceDict)) {
        for (const cid of data.catIds) catSet.add(cid)
      }
    }
    const catIds = [...catSet].sort((a, b) => a - b)
    const catIndex = new Map(catIds.map((id, i) => [id, i]))
    const numCats = catIds.length
    const numPlaces = placeIds.length
    if (numCats === 0 || numPlaces === 0) return

    const weights: number[][] = Array.from({ length: numCats }, () =>
      new Array(numPlaces).fill(0)
    )
    const visitProbs: number[][] = Array.from({ length: numCats }, () =>
      new Array(numPlaces).fill(0)
    )
    for (const playspaceDict of Object.values(this.allData)) {
      for (const psStr of Object.keys(playspaceDict)) {
        const ps = Number(psStr)
        const pi = placeIndex.get(ps)!
        const data = playspaceDict[ps]!
        for (let i = 0; i < data.catIds.length; i++) {
          const ci = catIndex.get(data.catIds[i]!)!
          weights[ci]![pi] = data.drawWeights[i]!
          visitProbs[ci]![pi] = (data.catVisitProbPermyriad[i] ?? 0) / 10000
        }
      }
    }

    const conflictAdj: number[][] = Array.from({ length: numPlaces }, () =>
      new Array(numPlaces).fill(0)
    )
    for (const constraint of this.constraints) {
      if (constraint.groups.length !== 2) continue
      const ps1 = new Set<number>()
      const ps2 = new Set<number>()
      for (const e of constraint.groups[0]!.entries) ps1.add(e.playspaceId)
      for (const e of constraint.groups[1]!.entries) ps2.add(e.playspaceId)
      for (const a of ps1) {
        for (const b of ps2) {
          const ia = placeIndex.get(a)!
          const ib = placeIndex.get(b)!
          if (ia !== ib) {
            conflictAdj[ia]![ib] = 1
            conflictAdj[ib]![ia] = 1
          }
        }
      }
    }

    const itemPlaceGroups: number[][] = []
    for (const itemIdStr of Object.keys(this.allData)) {
      const playspaceDict = this.allData[Number(itemIdStr)]!
      const pss = Object.keys(playspaceDict)
        .map(Number)
        .sort((a, b) => a - b)
      if (pss.length >= 2) {
        itemPlaceGroups.push(pss.map((ps) => placeIndex.get(ps)!))
      }
    }

    const catVsCatMat: number[][] = Array.from({ length: numCats }, () =>
      new Array(numCats).fill(0)
    )
    for (let i = 0; i < numCats; i++) {
      const row = this.sd.catVsCatAll[catIds[i]!] ?? {}
      for (let j = 0; j < numCats; j++) {
        if (i === j) continue
        catVsCatMat[i]![j] = Number(row[String(catIds[j]!)] ?? 0)
      }
    }

    const tSol = yardOptimizerProfilingActive() ? performance.now() : 0
    const solved = solveCatPlaceSystem(weights, visitProbs, placeNames, {
      conflictAdjacency: conflictAdj,
      itemPlaceGroups,
      catVsCat: catVsCatMat,
      stayDuration: CAT_STAY_TICK_AVG,
      cooldownDuration: CAT_COOLDOWN_TICK_AVG,
      interactionMode: this.args.interactionMode ?? "stateAverage",
      reachMode: this.args.reachMode ?? "componentAware",
      openGateMode: this.args.openGateMode ?? "perPlace",
      interactionSamples: this.args.interactionSamples ?? 32,
      interactionTopCats: this.args.interactionTopCats ?? 6,
      maxIterations: this.args.solverMaxIterations ?? 2000,
      convergenceThreshold:
        this.args.solverConvergenceThreshold ?? 1e-8,
      dampingFactor: this.args.solverDampingFactor,
      componentInnerMaxIterations:
        this.args.componentInnerMaxIterations ?? 80,
      componentInnerTolerance: this.args.componentInnerTolerance ?? 1e-12,
      componentInnerDamping: this.args.componentInnerDamping ?? 0.7,
    })
    this.lastSolverIterations = solved.iterations
    this.lastSolverConverged = solved.converged
    if (yardOptimizerProfilingActive()) {
      profileSolverMs(performance.now() - tSol)
    }

    for (const playspaceDict of Object.values(this.allData)) {
      for (const psStr of Object.keys(playspaceDict)) {
        const ps = Number(psStr)
        const pi = placeIndex.get(ps)!
        const data = playspaceDict[ps]!
        const stay: number[] = []
        const visit: number[] = []
        const mults: number[] = []
        for (let i = 0; i < data.catIds.length; i++) {
          const ci = catIndex.get(data.catIds[i]!)!
          stay.push(solved.betaValues[ci]![pi]!)
          visit.push(
            solved.drawProbabilities[ci]![pi]! * visitProbs[ci]![pi]!
          )
          mults.push(
            Math.max(
              30,
              Math.min(400, 100 + solved.interactionValues[ci]![pi]!)
            )
          )
        }
        data.perCatStayRate = stay
        data.perCatVisitProb = visit
        data.catOnCatInteractions = mults
      }
    }
    // Mean OUTDOOR playspace occupancy θ (busy probability), for the Tubbs income-retention factor.
    // `solved.placeOccupancy[pi]` ∈ [0,1] is the steady busy probability of place `pi`; the
    // competition relief that makes outdoor income resilient to the empty-bowl gate scales with it.
    let occSum = 0
    let occCount = 0
    for (const ps of placeIndex.keys()) {
      if (!this.groupingStrategy.getIsIndoors(ps)) {
        occSum += solved.placeOccupancy[String(ps)] ?? 0
        occCount += 1
      }
    }
    this.lastOutdoorPlaceOccupancy = occCount > 0 ? occSum / occCount : 0
  }

  enumerateConstraints(): void {
    this.constraints = this.enumerateItemConflictIdxConstraint()
  }

  restructureAllDataToSameCatInteractionGroup(): void {
    this.sameCatInteractionTermCalcSpace = {}
    for (const [itemIdStr, playspaceDict] of Object.entries(this.allData)) {
      for (const [playspaceIdStr, data] of Object.entries(playspaceDict)) {
        const playspaceId = Number(playspaceIdStr)
        const catIds = data.catIds
        const perCatStayRate = data.perCatStayRate ?? []
        const perCatSilverRate = data.perCatSilverRate
        catIds.forEach((catId, i) => {
          const w = perCatStayRate[i]!
          const s = perCatSilverRate[i]!
          const groupId = this.groupingStrategy.getCorrespondingGroup(playspaceId)
          if (groupId == null) return
          if (!this.sameCatInteractionTermCalcSpace[groupId]) {
            this.sameCatInteractionTermCalcSpace[groupId] = {}
          }
          if (!this.sameCatInteractionTermCalcSpace[groupId]![catId]) {
            this.sameCatInteractionTermCalcSpace[groupId]![catId] = []
          }
          this.sameCatInteractionTermCalcSpace[groupId]![catId]!.push([
            w,
            s,
            playspaceId,
          ])
        })
      }
    }
  }

  private mementoTickFromMasses(indoorMass: number, outdoorMass: number): number {
    const scale = this.args.mementoFoodRateScale ?? 1
    const baseIn =
      foodMementoRateForType(this.args.foodTypeIndoor) * scale
    const baseOut =
      foodMementoRateForType(this.args.foodTypeOutdoor) * scale
    const multIn =
      this.args.mementoPlacementIndoorMult ?? MEMENTO_INDOOR_PLACEMENT_MULT
    const multOut =
      this.args.mementoPlacementOutdoorMult ?? MEMENTO_OUTDOOR_PLACEMENT_MULT
    return indoorMass * baseIn * multIn + outdoorMass * baseOut * multOut
  }

  /**
   * Last step of `analyze()`: derive outdoor-bowl availability and scoring surfaces via
   * {@link computeTubbsOutdoorBowlEconomy}. See that module for the renewal derivation.
   */
  private applyTubbsOutdoorBowlEconomy(): void {
    const economy = computeTubbsOutdoorBowlEconomy({
      mode: this.args.tubbsMode ?? "off",
      tubbsOutdoorMass: this.lastTubbsOutdoorMass,
      foodTypeIndoor: this.args.foodTypeIndoor,
      foodTypeOutdoor: this.args.foodTypeOutdoor,
      tubbsBowlIncome: this.lastTubbsBowlIncome,
    })
    this.lastOutdoorBowlRefillRate = economy.refillRate
    this.lastOutdoorBowlCostFactor = economy.costFactor
    this.lastBowlIncomeHaircut = economy.haircut
  }

  private applyCompanionVisitsToSameCatSpace(): void {
    for (const [, catDict] of Object.entries(this.sameCatInteractionTermCalcSpace)) {
      for (const rule of COMPANION_VISIT_RULES) {
        const triggerData = catDict[rule.triggerCatId]
        if (!triggerData || triggerData.length === 0) continue

        const companionEntries = triggerData.map(([stayRate, , playspaceId]) => {
          const playspaceSilverMul =
            this.sd.playspaceMappings.silverMul[playspaceId] ?? 0
          const companionSilverMul =
            this.sd.catToSilverMul[rule.companionCatId] ?? 0
          const isIndoor = this.groupingStrategy.getIsIndoors(playspaceId)
          return [
            stayRate,
            giftEconomyForCatOnPlayspace(
              companionSilverMul,
              playspaceSilverMul,
              isIndoor
            ).silverRatePerTickWhenSilverGift,
            playspaceId,
          ] as [number, number, number]
        })

        catDict[rule.companionCatId] = [
          ...(catDict[rule.companionCatId] ?? []),
          ...companionEntries,
        ]
      }
    }
  }

  generateResults(
    calcSpace: Record<string, Record<number, [number, number, number][]>> = this
      .sameCatInteractionTermCalcSpace
  ): AnalyzerResults {
    const groupExpectedValues = emptyAnalyzerResults()
    for (const [groupId, catDict] of Object.entries(calcSpace)) {
      for (const [catIdStr, catData] of Object.entries(catDict)) {
        this.accumulateCatGroupMetrics(
          groupId,
          Number(catIdStr),
          catData,
          groupExpectedValues
        )
      }
    }
    return groupExpectedValues
  }

  /** One cat pass over the yard calc space; per-item buckets split inline (no second full aggregation). */
  private generateOverallAndPerItemResults(
    calcSpace: Record<string, Record<number, [number, number, number][]>>
  ): { overall: AnalyzerResults; perItem: AnalyzerResults } {
    const overall = emptyAnalyzerResults()
    const perItem = emptyAnalyzerResults()
    this.lastMementoProxyByTargetCat = {}
    this.lastVisitMassByTargetCat = {}
    for (const [groupId, catDict] of Object.entries(calcSpace)) {
      for (const [catIdStr, catData] of Object.entries(catDict)) {
        const catId = Number(catIdStr)
        if (catData.length === 0) continue
        // Overall pass ONLY: accumulate lastTubbsBowlIncome here. The
        // per-item pass below MUST pass false or every net score doubles (this method runs
        // accumulateCatGroupMetrics once for overall + once per item bucket per cat).
        this.accumulateCatGroupMetrics(groupId, catId, catData, overall, true)

        const byItem = new Map<string, [number, number, number][]>()
        for (const record of catData) {
          const itemId = String(this.groupingStrategy.playspaceToItemId[record[2]!]!)
          const bucket = byItem.get(itemId)
          if (bucket) bucket.push(record)
          else byItem.set(itemId, [record])
        }
        for (const [itemId, itemData] of byItem) {
          // Per-item bucket: accumulateOutdoorIncome=false (income is overall-only).
          this.accumulateCatGroupMetrics(itemId, catId, itemData, perItem, false)
        }
      }
    }
    return { overall, perItem }
  }

  private accumulateCatGroupMetrics(
    groupId: string,
    catId: number,
    catData: [number, number, number][],
    groupExpectedValues: AnalyzerResults,
    accumulateOutdoorIncome: boolean = false
  ): void {
    const mutuallyExclusiveAppearProbPerPlayspace = catData.map((r) => r[0])
    const silverRatePerPlayspace = catData.map((r) => r[1])
    const playspaceIds = catData.map((r) => r[2])
    const stayRatePerTick = sum(mutuallyExclusiveAppearProbPerPlayspace)
    if (sum(mutuallyExclusiveAppearProbPerPlayspace) === 0) return

    const appearProbGivenAppear = mutuallyExclusiveAppearProbPerPlayspace.map(
      (p) => p / stayRatePerTick
    )
    const catNiboshi = this.sd.catToSilverMul[catId] ?? 0
    const isIndoorArr = playspaceIds.map((psid) =>
      this.groupingStrategy.getIsIndoors(psid)
    )
    const rho = this.lastOutdoorOccupancyRetention
    const outdoorSuppressed = buildOutdoorRetentionSuppressedMask({
      rho,
      catId,
      tubbsCatId: TUBBS_CAT_ID,
      foodTypeOutdoor: this.args.foodTypeOutdoor,
      playspaceIds,
      playspaceToItemId: this.groupingStrategy.playspaceToItemId,
      isIndoor: isIndoorArr,
    })
    const applyRho = outdoorSuppressed !== null
    const visitStayRate = visitStayRateWithOutdoorRetention(
      mutuallyExclusiveAppearProbPerPlayspace,
      outdoorSuppressed,
      rho,
      stayRatePerTick
    )
    const { indoorMass, outdoorMass } = indoorOutdoorMassWithRetention(
      mutuallyExclusiveAppearProbPerPlayspace,
      isIndoorArr,
      outdoorSuppressed,
      rho
    )
    let silverRatePerTickAfterGiftMix = 0
    let goldRatePerTickAfterGiftMix = 0
    // OUTDOOR FOOD BOWL mirror of the two sums above (item == foodTypeOutdoor); only touched on
    // the overall income pass so the off / per-item / non-overall paths are byte-identical.
    let silverRatePerTickAfterGiftMixBowl = 0
    let goldRatePerTickAfterGiftMixBowl = 0
    for (let i = 0; i < appearProbGivenAppear.length; i++) {
      const playspaceId = playspaceIds[i]!
      const economy = giftEconomyForCatOnPlayspace(
        catNiboshi,
        this.sd.playspaceMappings.silverMul[playspaceId] ?? 0,
        isIndoorArr[i]!
      )
      const p = appearProbGivenAppear[i]!
      let silverTerm =
        p * (1 - economy.goldGiftProbability) * silverRatePerPlayspace[i]!
      let goldTerm =
        p * economy.goldGiftProbability * economy.goldRatePerTickWhenGoldGift
      if (applyRho && outdoorSuppressed![i]) {
        silverTerm *= rho
        goldTerm *= rho
      }
      silverRatePerTickAfterGiftMix += silverTerm
      goldRatePerTickAfterGiftMix += goldTerm
      // The outdoor BOWL subset (item == foodTypeOutdoor) feeds the bowl income split used for
      // Tubbs's own gift (the only remaining income haircut term). Overall-pass only, so per-item
      // and off paths stay byte-identical.
      if (
        accumulateOutdoorIncome &&
        !isIndoorArr[i] &&
        this.groupingStrategy.playspaceToItemId[playspaceId] === this.args.foodTypeOutdoor
      ) {
        silverRatePerTickAfterGiftMixBowl += silverTerm
        goldRatePerTickAfterGiftMixBowl += goldTerm
      }
    }

    const totalTicks = this.args.totalDurationMinutes / MINUTES_PER_TICK

    // TUBBS's own outdoor-bowl income (the `!isIndoor && item == foodTypeOutdoor` subset of the
    // gift-mix sum). This is the ONLY income surface scoring still needs — the kick haircut forgoes
    // his gold and keeps his silver. Only Tubbs is accumulated (the all-cats bowl total had no
    // remaining consumer). Gated on the overall pass + single YARD_TOTAL_KEY group ⇒ once per analyze.
    if (accumulateOutdoorIncome && groupId === YARD_TOTAL_KEY && catId === TUBBS_CAT_ID) {
      const goldEquivBowlRate =
        goldRatePerTickAfterGiftMixBowl +
        silverRatePerTickAfterGiftMixBowl *
          ANALYZER_GOLD_PER_SILVER_FOR_GOLD_EQUIV
      const f = stayRatePerTick * totalTicks
      this.lastTubbsBowlIncome.silver += f * silverRatePerTickAfterGiftMixBowl
      this.lastTubbsBowlIncome.gold += f * goldRatePerTickAfterGiftMixBowl
      this.lastTubbsBowlIncome.goldEquiv += f * goldEquivBowlRate
    }

    let expectedValue =
      stayRatePerTick * silverRatePerTickAfterGiftMix * totalTicks
    groupExpectedValues.silver![groupId] =
      (groupExpectedValues.silver![groupId] ?? 0) + expectedValue

    expectedValue =
      stayRatePerTick * goldRatePerTickAfterGiftMix * totalTicks
    groupExpectedValues.gold![groupId] =
      (groupExpectedValues.gold![groupId] ?? 0) + expectedValue

    /** Gold fish / day as a **payout mix**: not the same as `(silver column)/50 + gold column`. */
    const silverEquivRatePerTick =
      goldRatePerTickAfterGiftMix *
        ANALYZER_SILVER_PER_GOLD_FOR_SILVER_EQUIV +
      silverRatePerTickAfterGiftMix
    expectedValue =
      stayRatePerTick * silverEquivRatePerTick * totalTicks
    groupExpectedValues.silverEquiv![groupId] =
      (groupExpectedValues.silverEquiv![groupId] ?? 0) + expectedValue

    const goldEquivRatePerTick =
      goldRatePerTickAfterGiftMix +
      silverRatePerTickAfterGiftMix *
        ANALYZER_GOLD_PER_SILVER_FOR_GOLD_EQUIV
    expectedValue =
      stayRatePerTick * goldEquivRatePerTick * totalTicks
    groupExpectedValues.goldEquiv![groupId] =
      (groupExpectedValues.goldEquiv![groupId] ?? 0) + expectedValue

    if (
      this.args.catId.length &&
      this.args.catId.includes(catId)
    ) {
      expectedValue = visitStayRate
      const mementoTick = this.mementoTickFromMasses(indoorMass, outdoorMass)
      groupExpectedValues.mementoProxy![groupId] =
        (groupExpectedValues.mementoProxy![groupId] ?? 0) + mementoTick
      if (accumulateOutdoorIncome) {
        this.lastMementoProxyByTargetCat![catId] =
          (this.lastMementoProxyByTargetCat![catId] ?? 0) + mementoTick
        const prev = this.lastVisitMassByTargetCat![catId] ?? {
          indoorMass: 0,
          outdoorMass: 0,
        }
        this.lastVisitMassByTargetCat![catId] = {
          indoorMass: prev.indoorMass + indoorMass,
          outdoorMass: prev.outdoorMass + outdoorMass,
        }
      }
    } else {
      expectedValue = 0
    }
    groupExpectedValues.catProbability![groupId] =
      (groupExpectedValues.catProbability![groupId] ?? 0) + expectedValue

    expectedValue = visitStayRate
    groupExpectedValues.stayRate![groupId] =
      (groupExpectedValues.stayRate![groupId] ?? 0) + expectedValue
  }

  analyze(): Record<string, Record<string | number, number>> {
    this.lastMementoProxyByTargetCat = null
    this.lastVisitMassByTargetCat = null
    this.lastTubbsOutdoorMass = 0
    this.lastTubbsBowlIncome = { silver: 0, gold: 0, goldEquiv: 0 }
    this.lastOutdoorPlaceOccupancy = 0
    this.lastOutdoorOccupancyRetention = 1
    this.lastOutdoorBowlRefillRate = 0
    this.lastOutdoorBowlCostFactor = 1
    this.lastBowlIncomeHaircut = { silver: 0, gold: 0, goldEquiv: 0 }
    this.flowchartRuntimeCache = null
    this.calculateNonInteractiveVariables()
    this.enumerateConstraints()
    this.applyCatPlaceSolve()
    this.restructureAllDataToSameCatInteractionGroup()
    this.applyCompanionVisitsToSameCatSpace()

    // Tubbs outdoor mass + occupancy retention ρ must be known BEFORE the metric passes.
    this.lastTubbsOutdoorMass = computeTubbsOutdoorMass(
      this.sameCatInteractionTermCalcSpace,
      (psid) => this.groupingStrategy.getIsIndoors(psid)
    )
    this.lastOutdoorOccupancyRetention = outdoorOccupancyRetention({
      mode: this.args.tubbsMode ?? "off",
      tubbsOutdoorMass: this.lastTubbsOutdoorMass,
      outdoorPlaceOccupancy: this.lastOutdoorPlaceOccupancy,
      foodTypeIndoor: this.args.foodTypeIndoor,
      foodTypeOutdoor: this.args.foodTypeOutdoor,
    })

    const calcSpace = this.sameCatInteractionTermCalcSpace
    const { overall: resultsOverall, perItem: resultsPerItem } =
      this.generateOverallAndPerItemResults(calcSpace)
    // Last step of analyze(): derive the outdoor-bowl availability + refill rate from first
    // principles (renewal theory) now that the converged Tubbs mass and bowl income are final.
    this.applyTubbsOutdoorBowlEconomy()
    const itemCalcSpace = this.groupingStrategy.transformToItemGroup(calcSpace)
    this.sameCatInteractionTermCalcSpace = itemCalcSpace as unknown as Record<
      string,
      Record<number, [number, number, number][]>
    >
    const output: Record<string, Record<string | number, number>> = {}
    for (const entry of Object.keys(resultsOverall) as Array<
      keyof AnalyzerResults
    >) {
      output[entry] = {}
      this.groupingStrategy.applyGroupValues(
        resultsPerItem[entry],
        resultsOverall[entry],
        output[entry]!
      )
    }
    return output
  }
}

function setIsSupersetOrEqual(a: Set<number>, b: Set<number>): boolean {
  for (const x of b) if (!a.has(x)) return false
  return true
}

function setIsStrictSuperset(a: Set<number>, b: Set<number>): boolean {
  return setIsSupersetOrEqual(a, b) && a.size > b.size
}
