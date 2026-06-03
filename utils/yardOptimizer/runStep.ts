import {
  GA_EVOLUTION_SOLVER_TIER,
  repopulationSize,
  type GeneticConfig,
} from "./config"
import {
  yardFitnessBetter,
  yardFitnessCompareDesc,
  type FitnessContext,
  type SolverTier,
} from "./fitness"
import { assignValuesToYardsParallel } from "./yardFitnessParallel"
import {
  profileGenerationStep,
  yardOptimizerProfilingActive,
} from "./optimizerProfile"
import type { ItemPools } from "./types"
import { createOffspring, kTournament } from "./yardGenetic"
import {
  mergePool,
  generateYardStateUnscored,
  yardSignature,
} from "./yardCore"
import type { YardState } from "./types"

function createUnscoredRandomYards(
  ctx: FitnessContext,
  pools: ItemPools,
  size: number,
  options: { requireAny?: boolean } = {}
): YardState[] {
  const out: YardState[] = []
  let lastError: unknown = null
  for (let i = 0; i < size; i++) {
    try {
      out.push(generateYardStateUnscored(ctx, pools))
    } catch (e) {
      lastError = e
      /* rare collision / empty pool */
    }
  }
  if (options.requireAny && out.length === 0 && size > 0) {
    const detail = lastError instanceof Error ? lastError.message : String(lastError)
    throw new Error(
      detail && detail !== "null"
        ? `No valid yard layouts match these rules: ${detail}`
        : "No valid yard layouts match these rules."
    )
  }
  return out
}

function uniqueUnscoredCandidates(
  candidates: YardState[],
  existing: YardState[] = []
): YardState[] {
  const seen = new Set(existing.map(yardSignature))
  const out: YardState[] = []
  for (const y of candidates) {
    const sig = yardSignature(y)
    if (seen.has(sig)) continue
    seen.add(sig)
    out.push(y)
  }
  return out
}

function scoreLimitForGeneration(genetic: GeneticConfig): number {
  switch (genetic.offspringScoreMode) {
    case "fast":
      return genetic.poolSize
    case "balanced":
      return Math.round(genetic.poolSize * 1.5)
    case "thorough":
      return Number.POSITIVE_INFINITY
  }
}

function sampleUnscoredCandidates(
  candidates: YardState[],
  limit: number
): YardState[] {
  if (!Number.isFinite(limit) || candidates.length <= limit) return candidates
  const pool = [...candidates]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  return pool.slice(0, limit)
}

async function scoreYards(
  ctx: FitnessContext,
  yards: YardState[],
  evolutionTier: SolverTier
): Promise<YardState[]> {
  await assignValuesToYardsParallel(ctx, yards, evolutionTier)
  return yards
}

function sortBestFirst(yards: YardState[]): YardState[] {
  return [...yards].sort(yardFitnessCompareDesc)
}

function dedupeBest(yards: YardState[]): YardState[] {
  const map = new Map<string, YardState>()
  for (const y of yards) {
    const sig = yardSignature(y)
    const prev = map.get(sig)
    if (!prev || yardFitnessBetter(y, prev)) map.set(sig, y)
  }
  return sortBestFirst([...map.values()])
}

function clamped01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function annealedRankTemperature(
  genetic: GeneticConfig,
  iteration: number
): number {
  const selection = genetic.survivorSelection
  const span = Math.max(1, selection.annealGenerations)
  const t = clamped01(Math.max(0, iteration - 1) / span)
  return (
    selection.initialRankTemperature +
    (selection.finalRankTemperature - selection.initialRankTemperature) * t
  )
}

function weightedRankSample(
  candidates: YardState[],
  count: number,
  rankTemperature: number
): YardState[] {
  const out: YardState[] = []
  const remaining = [...candidates]
  const temperature = Math.max(0.01, rankTemperature)
  while (out.length < count && remaining.length > 0) {
    let total = 0
    const weights = remaining.map((_, i) => {
      const weight = Math.exp(-i / temperature)
      total += weight
      return weight
    })
    let pick = Math.random() * total
    let selectedIndex = weights.length - 1
    for (let i = 0; i < weights.length; i++) {
      pick -= weights[i]!
      if (pick <= 0) {
        selectedIndex = i
        break
      }
    }
    out.push(remaining.splice(selectedIndex, 1)[0]!)
  }
  return out
}

export function mergePoolForGeneration(
  existing: YardState[],
  incoming: YardState[],
  genetic: GeneticConfig,
  iteration: number
): YardState[] {
  const selection = genetic.survivorSelection
  if (!selection.enabled) {
    return mergePool(existing, incoming, genetic.poolSize)
  }

  const sorted = dedupeBest([...existing, ...incoming])
  if (sorted.length <= genetic.poolSize) return sorted

  const exploratorySlots = Math.min(
    genetic.poolSize - 1,
    Math.round(genetic.poolSize * clamped01(selection.exploratoryRate))
  )
  if (exploratorySlots <= 0) return sorted.slice(0, genetic.poolSize)

  const eliteCount = genetic.poolSize - exploratorySlots
  const elites = sorted.slice(0, eliteCount)
  const exploratory = weightedRankSample(
    sorted.slice(eliteCount),
    exploratorySlots,
    annealedRankTemperature(genetic, iteration)
  )
  const selected = dedupeBest([...elites, ...exploratory])

  if (selected.length >= genetic.poolSize) return selected.slice(0, genetic.poolSize)
  const seen = new Set(selected.map(yardSignature))
  for (const y of sorted) {
    if (selected.length >= genetic.poolSize) break
    const sig = yardSignature(y)
    if (seen.has(sig)) continue
    seen.add(sig)
    selected.push(y)
  }
  return sortBestFirst(selected)
}

export async function createInitialPoolParallel(
  ctx: FitnessContext,
  pools: ItemPools,
  poolSize: number,
  evolutionTier: SolverTier = GA_EVOLUTION_SOLVER_TIER
): Promise<YardState[]> {
  const pool = uniqueUnscoredCandidates(
    createUnscoredRandomYards(ctx, pools, poolSize, { requireAny: true })
  )
  await scoreYards(ctx, pool, evolutionTier)
  return mergePool(pool, [], poolSize)
}

export async function runGenerationParallel(
  ctx: FitnessContext,
  pools: ItemPools,
  pool: YardState[],
  genetic: GeneticConfig,
  iteration: number,
  evolutionTier: SolverTier = GA_EVOLUTION_SOLVER_TIER
): Promise<YardState[]> {
  const profiling = yardOptimizerProfilingActive()
  const tTotal0 = profiling ? performance.now() : 0
  const bestBefore = pool[0]?.value ?? null
  let freshGeneratedCount = 0
  let freshCount = 0
  let offspringGeneratedCount = 0
  let offspringCount = 0
  let msFreshBuild = 0
  let msFreshScore = 0
  let msBreed = 0
  let msOffspringScore = 0
  let msMerge = 0
  let next = [...pool]
  if (iteration > 1) {
    const tFreshBuild0 = profiling ? performance.now() : 0
    const freshGenerated = createUnscoredRandomYards(
      ctx,
      pools,
      repopulationSize(genetic.poolSize)
    )
    freshGeneratedCount = freshGenerated.length
    const fresh = uniqueUnscoredCandidates(freshGenerated, next)
    freshCount = fresh.length
    if (profiling) msFreshBuild = performance.now() - tFreshBuild0
    const tFreshScore0 = profiling ? performance.now() : 0
    await scoreYards(ctx, fresh, evolutionTier)
    if (profiling) msFreshScore = performance.now() - tFreshScore0
    const tMergeFresh0 = profiling ? performance.now() : 0
    next = mergePoolForGeneration(next, fresh, genetic, iteration)
    if (profiling) msMerge += performance.now() - tMergeFresh0
  }

  const tBreed0 = profiling ? performance.now() : 0
  const winners = kTournament(next, genetic)
  const offspringGenerated = createOffspring(
    ctx,
    pools,
    next,
    winners,
    genetic,
    null
  )
  offspringGeneratedCount = offspringGenerated.length
  const offspringScoreBudget = scoreLimitForGeneration(genetic) - freshCount
  const sampledOffspring = sampleUnscoredCandidates(
    uniqueUnscoredCandidates(offspringGenerated, next),
    offspringScoreBudget
  )
  const offspring = uniqueUnscoredCandidates(sampledOffspring, next)
  offspringCount = offspring.length
  if (profiling) msBreed = performance.now() - tBreed0
  const tOffspringScore0 = profiling ? performance.now() : 0
  await scoreYards(ctx, offspring, evolutionTier)
  if (profiling) msOffspringScore = performance.now() - tOffspringScore0
  const tMergeOffspring0 = profiling ? performance.now() : 0
  const merged = mergePoolForGeneration(next, offspring, genetic, iteration)
  if (profiling) {
    msMerge += performance.now() - tMergeOffspring0
    const bestAfter = merged[0]?.value ?? null
    profileGenerationStep({
      iteration,
      poolIn: pool.length,
      freshCandidatesGenerated: freshGeneratedCount,
      freshCandidates: freshCount,
      offspringCandidatesGenerated: offspringGeneratedCount,
      offspringCandidates: offspringCount,
      poolOut: merged.length,
      msFreshBuild,
      msFreshScore,
      msBreed,
      msOffspringScore,
      msMerge,
      msTotal: performance.now() - tTotal0,
      bestBefore,
      bestAfter,
      bestImproved:
        bestBefore == null ? bestAfter != null : bestAfter != null && bestAfter > bestBefore,
    })
  }
  return merged
}

export async function rescorePoolAndSortParallel(
  ctx: FitnessContext,
  pool: YardState[],
  tier: SolverTier
): Promise<YardState[]> {
  await scoreYards(ctx, pool, tier)
  return [...pool].sort(yardFitnessCompareDesc)
}
