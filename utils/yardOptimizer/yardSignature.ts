import type { YardState } from "./types"

/** Stable layout fingerprint for dedupe and fitness cache keys. */
export function yardSignature(y: YardState): string {
  return JSON.stringify({
    fi: y.foodTypeIndoor,
    fo: y.foodTypeOutdoor,
    il: [...y.indoorLarge].sort((a, b) => a - b),
    is: [...y.indoorSmall].sort((a, b) => a - b),
    ol: [...y.outdoorLarge].sort((a, b) => a - b),
    os: [...y.outdoorSmall].sort((a, b) => a - b),
  })
}
