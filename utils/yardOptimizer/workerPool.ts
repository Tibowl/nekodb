/** Shared lazy Web Worker pools keyed by worker script URL. */

const workerPools = new Map<string, Worker[]>()

export function terminateWorkerPool(entryHref?: string): void {
  if (entryHref) {
    const pool = workerPools.get(entryHref)
    if (!pool) return
    for (const w of pool) {
      try {
        w.terminate()
      } catch {
        /* ignore */
      }
    }
    workerPools.delete(entryHref)
    return
  }
  for (const href of [...workerPools.keys()]) {
    terminateWorkerPool(href)
  }
}

export function defaultWorkerCount(): number {
  if (typeof navigator === "undefined") return 1
  return Math.min(
    8,
    Math.max(1, Math.floor(navigator.hardwareConcurrency ?? 4))
  )
}

export function browserDedicatedWorkersLikelyAvailable(): boolean {
  return typeof window !== "undefined" && typeof Worker !== "undefined"
}

export function workerHref(path: string): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return new URL(path, window.location.origin).href
  }
  return path
}

export function sliceSizes(total: number, parts: number): number[] {
  const p = Math.max(1, Math.min(parts, total))
  const base = Math.floor(total / p)
  const rem = total % p
  const sizes: number[] = []
  for (let i = 0; i < p; i++) sizes.push(base + (i < rem ? 1 : 0))
  return sizes
}

export function ensureWorkers(entryHref: string, count: number): Worker[] {
  if (!workerPools.has(entryHref)) workerPools.set(entryHref, [])
  const workerPool = workerPools.get(entryHref)!
  while (workerPool.length < count) {
    workerPool.push(
      new Worker(entryHref, {
        type: "module",
      })
    )
  }
  return workerPool.slice(0, count)
}

type WorkerJobEnvelope = { jobId: number; error?: string }

/** Route a single worker job by `jobId`; shared by fitness batch and memento MC pools. */
export function postWorkerJob<TReq extends { jobId: number }, TSuccess>(
  worker: Worker,
  payload: TReq,
  extractSuccess: (data: WorkerJobEnvelope) => TSuccess,
  labels: { worker?: string; deserialize?: string } = {}
): Promise<TSuccess> {
  const workerFailedMessage = labels.worker ?? "Worker failed"
  const deserializeFailedMessage =
    labels.deserialize ?? "Worker could not deserialize a message"

  return new Promise((resolve, reject) => {
    const jobId = payload.jobId
    const cleanup = () => {
      worker.removeEventListener("message", onMsg as EventListener)
      worker.removeEventListener("error", onError as EventListener)
      worker.removeEventListener("messageerror", onMessageError as EventListener)
    }
    const onMsg = (ev: MessageEvent<WorkerJobEnvelope>) => {
      const d = ev.data
      if (!d || typeof d.jobId !== "number" || d.jobId !== jobId) return
      cleanup()
      if (typeof d.error === "string") reject(new Error(d.error))
      else resolve(extractSuccess(d))
    }
    const onError = (ev: ErrorEvent) => {
      cleanup()
      reject(new Error(ev.message || workerFailedMessage))
    }
    const onMessageError = () => {
      cleanup()
      reject(new Error(deserializeFailedMessage))
    }
    worker.addEventListener("message", onMsg as EventListener)
    worker.addEventListener("error", onError as EventListener)
    worker.addEventListener("messageerror", onMessageError as EventListener)
    try {
      worker.postMessage(payload)
    } catch (e) {
      cleanup()
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}
