/**
 * Parallel batches of `assignValue` for hybrid search via Web Workers.
 * Falls back to main-thread scoring when workers are unavailable or fail.
 */

import { assignValue, type FitnessContext, type SolverTier } from "./fitness"
import { serializeFitnessContext } from "./fitnessWorkerCodec"
import {
  mergeYardOptimizerWorkerProfile,
  yardOptimizerProfilingActive,
} from "./optimizerProfile"
import type {
  YardFitnessBatchWorkerRequest,
  YardFitnessBatchWorkerSuccessResponse,
} from "./yardFitnessBatch.worker"
import { yardToPlain, type PlainYard } from "./yardFitnessPlain"
import type { YardState } from "./types"
import {
  browserDedicatedWorkersLikelyAvailable,
  defaultWorkerCount,
  ensureWorkers,
  postWorkerJob,
  sliceSizes,
  terminateWorkerPool,
  workerHref,
} from "./workerPool"

const FITNESS_WORKER_PATH = "/workers/yard-fitness-batch.worker.js"

/** Below this batch size, worker startup outweighs gains. */
const YARD_FITNESS_MIN_PARALLEL_BATCH = 8

let workerJobSeq = 1

export function terminateYardFitnessWorkerPool(): void {
  terminateWorkerPool(workerHref(FITNESS_WORKER_PATH))
}

function runBatchOnWorker(
  worker: Worker,
  payload: YardFitnessBatchWorkerRequest
): Promise<YardFitnessBatchWorkerSuccessResponse> {
  return postWorkerJob(
    worker,
    payload,
    (d) => d as YardFitnessBatchWorkerSuccessResponse,
    {
      worker: "Yard fitness worker failed",
      deserialize: "Yard fitness worker could not deserialize a message",
    }
  )
}

function assignValuesSequential(
  ctx: FitnessContext,
  yards: YardState[],
  tier: SolverTier
): void {
  for (const y of yards) {
    assignValue(ctx, y, { solverTier: tier })
  }
}

/**
 * In-place: sets `value` / `valueSecondary` on each yard (layout unchanged).
 */
export async function assignValuesToYardsParallel(
  ctx: FitnessContext,
  yards: YardState[],
  tier: SolverTier,
  options: { maxWorkers?: number } = {}
): Promise<void> {
  if (yards.length === 0) return

  const maxW = Math.max(
    1,
    Math.min(options.maxWorkers ?? defaultWorkerCount(), yards.length)
  )
  const useWorkers =
    browserDedicatedWorkersLikelyAvailable() &&
    yards.length >= YARD_FITNESS_MIN_PARALLEL_BATCH &&
    maxW > 1

  if (!useWorkers) {
    assignValuesSequential(ctx, yards, tier)
    return
  }

  const plains = yards.map(yardToPlain)
  const serialized = serializeFitnessContext(ctx)
  const profile = yardOptimizerProfilingActive()

  try {
    const sizes = sliceSizes(plains.length, maxW)
    const workers = ensureWorkers(workerHref(FITNESS_WORKER_PATH), sizes.length)
    const tasks: Promise<YardFitnessBatchWorkerSuccessResponse>[] = []
    let offset = 0
    for (let wi = 0; wi < sizes.length; wi++) {
      const n = sizes[wi]!
      const slice = plains.slice(offset, offset + n)
      offset += n
      const jobId = workerJobSeq++
      tasks.push(
        runBatchOnWorker(workers[wi]!, {
          jobId,
          ctx: serialized,
          tier,
          yards: slice,
          profile,
        })
      )
    }
    const parts = await Promise.all(tasks)
    const merged: PlainYard[] = []
    for (const p of parts) {
      mergeYardOptimizerWorkerProfile(p.profile)
      merged.push(...p.yards)
    }
    for (let i = 0; i < yards.length; i++) {
      const s = merged[i]!
      yards[i]!.value = s.value
      yards[i]!.valueSecondary = s.valueSecondary
      yards[i]!.requirementPenalty = s.requirementPenalty
      yards[i]!.mementoUnreachableTargets = s.mementoUnreachableTargets
      yards[i]!.hardRejectLevel = s.hardRejectLevel
    }
  } catch {
    terminateYardFitnessWorkerPool()
    assignValuesSequential(ctx, yards, tier)
  }
}
