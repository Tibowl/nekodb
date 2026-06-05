/**
 * Parallel memento yard Monte Carlo in the browser via Web Workers. Falls back to the same seeded
 * main-thread loop when workers are unavailable or fail.
 */

import { mixRunSeed, mulberry32 } from "./mementoSimRng"
import type {
  MementoYardSimWorkerRequest,
  MementoYardSimWorkerResponse,
} from "./mementoYardSim.worker"
import {
  simulateYardMementoUntilSuccess,
  type YardMementoSample,
  type YardMementoSimParams,
} from "./yardMementoSim"

import {
  browserDedicatedWorkersLikelyAvailable,
  defaultWorkerCount,
  ensureWorkers,
  postWorkerJob,
  sliceSizes,
  terminateWorkerPool,
  workerHref,
} from "./workerPool"

const MEMENTO_WORKER_PATH = "/workers/memento-yard-sim.worker.js"

/** Below this slice size, worker startup outweighs gains. */
const MEMENTO_MC_MIN_PARALLEL_CHUNK = 2

let workerJobSeq = 1

export function terminateMementoYardSimWorkerPool(): void {
  terminateWorkerPool(workerHref(MEMENTO_WORKER_PATH))
}

/** Same outcomes as partitioning across workers (`masterSeed`, `globalStart`, run order preserved). */
export function simulateYardMementoBatchSeeded(
  opts: YardMementoSimParams,
  count: number,
  globalStart: number,
  masterSeed: number
): YardMementoSample[] {
  const out: YardMementoSample[] = new Array(count)
  for (let k = 0; k < count; k++) {
    const gi = globalStart + k
    const rng = mulberry32(mixRunSeed(masterSeed, gi))
    out[k] = simulateYardMementoUntilSuccess(opts, rng)
  }
  return out
}

function runSliceOnDedicatedWorker(
  worker: Worker,
  payload: MementoYardSimWorkerRequest
): Promise<YardMementoSample[]> {
  return postWorkerJob(
    worker,
    payload,
    (d) => (d as Extract<MementoYardSimWorkerResponse, { out: YardMementoSample[] }>).out,
    {
      worker: "Memento simulation worker failed",
      deserialize: "Memento simulation worker could not deserialize a message",
    }
  )
}

/**
 * Run `count` flowchart memento sims. Uses up to `maxWorkers` dedicated workers when available.
 */
export async function simulateYardMementoBatchParallel(
  opts: YardMementoSimParams,
  count: number,
  o: {
    masterSeed: number
    globalStart: number
    maxWorkers?: number
  }
): Promise<YardMementoSample[]> {
  if (count <= 0) return []

  const maxW = Math.max(
    1,
    Math.min(o.maxWorkers ?? defaultWorkerCount(), count)
  )
  const useWorkers =
    browserDedicatedWorkersLikelyAvailable() &&
    count >= MEMENTO_MC_MIN_PARALLEL_CHUNK &&
    maxW > 1

  if (!useWorkers) {
    return simulateYardMementoBatchSeeded(
      opts,
      count,
      o.globalStart,
      o.masterSeed
    )
  }

  try {
    const sizes = sliceSizes(count, maxW)
    const workers = ensureWorkers(workerHref(MEMENTO_WORKER_PATH), sizes.length)
    const tasks: Promise<YardMementoSample[]>[] = []
    let offset = 0
    for (let wi = 0; wi < sizes.length; wi++) {
      const n = sizes[wi]!
      const startGlobalIndex = o.globalStart + offset
      offset += n
      const jobId = workerJobSeq++
      tasks.push(
        runSliceOnDedicatedWorker(workers[wi]!, {
          jobId,
          opts,
          startGlobalIndex,
          count: n,
          masterSeed: o.masterSeed,
        })
      )
    }
    const parts = await Promise.all(tasks)
    const merged: YardMementoSample[] = []
    for (const p of parts) merged.push(...p)
    return merged
  } catch {
    terminateMementoYardSimWorkerPool()
    return simulateYardMementoBatchSeeded(
      opts,
      count,
      o.globalStart,
      o.masterSeed
    )
  }
}
