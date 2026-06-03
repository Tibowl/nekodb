import { getAnalyzerStaticData } from "./analyzer/staticData"
import type {
  FitnessAnalyzerOptions,
  FitnessContext,
  FitnessObjective,
  FitnessObjectiveTerm,
} from "./fitness"
import type { FitnessConstraints } from "./fitnessConstraints"

export type SerializedFixedOutdoor = {
  foodTypeOutdoor: number
  outdoorLarge: number[]
  outdoorSmall: number[]
}

export type SerializedFixedIndoor = {
  foodTypeIndoor: number
  indoorLarge: number[]
  indoorSmall: number[]
}

/** `FitnessContext` without `staticData` (worker loads tables via `getAnalyzerStaticData()`). */
export type SerializedFitnessContext = {
  targetCatIds: number[]
  targetCatStartComeCounts: Record<number, number>
  objective: FitnessObjective
  objectiveBlendTerms?: FitnessObjectiveTerm[]
  secondaryObjective: FitnessObjective | null
  constraints: FitnessConstraints
  fixedOutdoor?: SerializedFixedOutdoor
  fixedIndoor?: SerializedFixedIndoor
  generationConstraints?: FitnessContext["generationConstraints"]
  analyzerOptions: FitnessAnalyzerOptions
}

export function serializeFitnessContext(ctx: FitnessContext): SerializedFitnessContext {
  return {
    targetCatIds: [...ctx.targetCatIds],
    targetCatStartComeCounts: { ...ctx.targetCatStartComeCounts },
    objective: ctx.objective,
    objectiveBlendTerms: ctx.objectiveBlendTerms.map((t) => ({ ...t })),
    secondaryObjective: ctx.secondaryObjective,
    constraints: {
      feasibilityRows: ctx.constraints.feasibilityRows.map((r) => ({ ...r })),
      requiredGoodieIds: [...ctx.constraints.requiredGoodieIds],
      requiredIndoorGoodieIds: [...(ctx.constraints.requiredIndoorGoodieIds ?? [])],
      requiredOutdoorGoodieIds: [...(ctx.constraints.requiredOutdoorGoodieIds ?? [])],
      forbiddenGoodieIds: [...ctx.constraints.forbiddenGoodieIds],
    },
    fixedOutdoor: ctx.fixedOutdoor
      ? {
          foodTypeOutdoor: ctx.fixedOutdoor.foodTypeOutdoor,
          outdoorLarge: [...ctx.fixedOutdoor.outdoorLarge],
          outdoorSmall: [...ctx.fixedOutdoor.outdoorSmall],
        }
      : undefined,
    fixedIndoor: ctx.fixedIndoor
      ? {
          foodTypeIndoor: ctx.fixedIndoor.foodTypeIndoor,
          indoorLarge: [...ctx.fixedIndoor.indoorLarge],
          indoorSmall: [...ctx.fixedIndoor.indoorSmall],
        }
      : undefined,
    generationConstraints: ctx.generationConstraints
      ? {
          ...ctx.generationConstraints,
          indoorSmallSlots: [...ctx.generationConstraints.indoorSmallSlots],
          outdoorSmallSlots: [...ctx.generationConstraints.outdoorSmallSlots],
        }
      : undefined,
    analyzerOptions: { ...ctx.analyzerOptions },
  }
}

export function fitnessContextFromSerialized(
  s: SerializedFitnessContext
): FitnessContext {
  return {
    targetCatIds: [...s.targetCatIds],
    targetCatStartComeCounts: { ...(s.targetCatStartComeCounts ?? {}) },
    objective: s.objective,
    objectiveBlendTerms: (s.objectiveBlendTerms ?? []).map((t) => ({ ...t })),
    secondaryObjective: s.secondaryObjective,
    constraints: {
      feasibilityRows: s.constraints.feasibilityRows.map((r) => ({ ...r })),
      requiredGoodieIds: [...s.constraints.requiredGoodieIds],
      requiredIndoorGoodieIds: [...(s.constraints.requiredIndoorGoodieIds ?? [])],
      requiredOutdoorGoodieIds: [...(s.constraints.requiredOutdoorGoodieIds ?? [])],
      forbiddenGoodieIds: [...s.constraints.forbiddenGoodieIds],
    },
    fixedOutdoor: s.fixedOutdoor
      ? {
          foodTypeOutdoor: s.fixedOutdoor.foodTypeOutdoor,
          outdoorLarge: new Set(s.fixedOutdoor.outdoorLarge),
          outdoorSmall: new Set(s.fixedOutdoor.outdoorSmall),
        }
      : undefined,
    fixedIndoor: s.fixedIndoor
      ? {
          foodTypeIndoor: s.fixedIndoor.foodTypeIndoor,
          indoorLarge: new Set(s.fixedIndoor.indoorLarge),
          indoorSmall: new Set(s.fixedIndoor.indoorSmall),
        }
      : undefined,
    generationConstraints: s.generationConstraints
      ? {
          ...s.generationConstraints,
          indoorSmallSlots: [...s.generationConstraints.indoorSmallSlots],
          outdoorSmallSlots: [...s.generationConstraints.outdoorSmallSlots],
        }
      : undefined,
    staticData: getAnalyzerStaticData(),
    analyzerOptions: { ...s.analyzerOptions },
    // Per-batch cache: shared across all yards within one worker invocation
    // (typically ~10-20 yards). Maps do not survive `postMessage`, so a fresh
    // empty cache is built each batch. Within a batch the food pairs explored
    // are a small subset of 7 × 7, so hit rate is high.
    playspaceDataCache: new Map(),
  }
}
