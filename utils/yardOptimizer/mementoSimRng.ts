/**
 * Deterministic RNG for parallel memento MC: each global run index gets an independent stream
 * from one session `masterSeed` (reproducible vs `simulateYardMementoBatchSeeded`).
 */

/** 32-bit mulberry32 PRNG; returns draws in [0, 1). */
export function mulberry32(initial: number): () => number {
  let state = initial >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Mix session seed with global run ordinal for well-spaced PRNG states. */
export function mixRunSeed(masterSeed: number, globalRunIndex: number): number {
  let x = Math.imul(masterSeed ^ globalRunIndex, 0x85ebca6b)
  x ^= x >>> 13
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 16
  return (x >>> 0) || 1
}
