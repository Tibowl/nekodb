/**
 * Batch mean-field fitness scoring in a dedicated worker (esbuild → public/workers/).
 */

import { assignValue, type SolverTier } from "./fitness"
import { fitnessContextFromSerialized, type SerializedFitnessContext } from "./fitnessWorkerCodec"
import {
  beginYardOptimizerProfileForced,
  getYardOptimizerWorkerProfileSnapshot,
  pauseYardOptimizerProfiling,
  type YardOptimizerWorkerProfileSnapshot,
} from "./optimizerProfile"
import { plainToYard, type PlainYard, yardToPlain } from "./yardFitnessPlain"

export type YardFitnessBatchWorkerRequest = {
  jobId: number
  ctx: SerializedFitnessContext
  tier: SolverTier
  yards: PlainYard[]
  profile?: boolean
}

export type YardFitnessBatchWorkerSuccessResponse = {
  jobId: number
  yards: PlainYard[]
  profile?: YardOptimizerWorkerProfileSnapshot
}

export type YardFitnessBatchWorkerResponse =
  | YardFitnessBatchWorkerSuccessResponse
  | { jobId: number; error: string }

type WorkerPort = {
  onmessage: ((ev: MessageEvent<YardFitnessBatchWorkerRequest>) => void) | null
  postMessage(message: YardFitnessBatchWorkerResponse): void
}

const port = globalThis as unknown as WorkerPort

port.onmessage = (ev: MessageEvent<YardFitnessBatchWorkerRequest>) => {
  const d = ev.data
  const { jobId, tier, yards: plains } = d
  try {
    beginYardOptimizerProfileForced(d.profile === true)
    const ctx = fitnessContextFromSerialized(d.ctx)
    const out: PlainYard[] = new Array(plains.length)
    for (let i = 0; i < plains.length; i++) {
      const y = plainToYard(plains[i]!)
      assignValue(ctx, y, { solverTier: tier })
      out[i] = yardToPlain(y)
    }
    const profile = d.profile ? getYardOptimizerWorkerProfileSnapshot() : undefined
    pauseYardOptimizerProfiling()
    port.postMessage({ jobId, yards: out, profile })
  } catch (e) {
    pauseYardOptimizerProfiling()
    port.postMessage({
      jobId,
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
