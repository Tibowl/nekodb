/**
 * Browser dedicated worker: runs a slice of memento-on-flowchart Monte Carlo with deterministic
 * seeds (must match `simulateYardMementoBatchSeeded` in `mementoYardSimParallel.ts`).
 */

import { mixRunSeed, mulberry32 } from "./mementoSimRng"
import {
  simulateYardMementoUntilSuccess,
  type YardMementoSample,
  type YardMementoSimParams,
} from "./yardMementoSim"

export type MementoYardSimWorkerRequest = {
  jobId: number
  opts: YardMementoSimParams
  startGlobalIndex: number
  count: number
  masterSeed: number
}

export type MementoYardSimWorkerResponse =
  | { jobId: number; out: YardMementoSample[] }
  | { jobId: number; error: string }

/** Worker global; avoid `lib: webworker` duplication with `dom` elsewhere. */
type WorkerPort = {
  onmessage: ((ev: MessageEvent<MementoYardSimWorkerRequest>) => void) | null
  postMessage(message: MementoYardSimWorkerResponse): void
}

const port = globalThis as unknown as WorkerPort

port.onmessage = (ev: MessageEvent<MementoYardSimWorkerRequest>) => {
  const d = ev.data
  const { jobId, opts, startGlobalIndex, count, masterSeed } = d
  try {
    const out: YardMementoSample[] = new Array(count)
    for (let k = 0; k < count; k++) {
      const gi = startGlobalIndex + k
      const rng = mulberry32(mixRunSeed(masterSeed, gi))
      out[k] = simulateYardMementoUntilSuccess(opts, rng)
    }
    const msg: MementoYardSimWorkerResponse = { jobId, out }
    port.postMessage(msg)
  } catch (e) {
    const msg: MementoYardSimWorkerResponse = {
      jobId,
      error: e instanceof Error ? e.message : String(e),
    }
    port.postMessage(msg)
  }
}
