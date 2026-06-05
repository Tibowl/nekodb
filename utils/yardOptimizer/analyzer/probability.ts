/** Mirrors `ProbabilityCalculator` in `analyze.py`. */

export function expectationOfUniformRoundedDown(a: number, b: number): number {
  const aFrac = a - Math.floor(a)
  const bFrac = b - Math.floor(b)
  return (
    (a + b) / 2 -
    (Math.floor(b) - Math.floor(a) + bFrac ** 2 - aFrac ** 2) / (b - a) / 2
  )
}

export function expectationOfUniformRoundedDownClipped(a: number, b: number): number {
  if (b < 1) return 1
  if (a < 1) {
    return (
      ((1 - a) / (b - a)) * 1 +
      ((b - 1) / (b - a)) * expectationOfUniformRoundedDown(1, b)
    )
  }
  return expectationOfUniformRoundedDown(a, b)
}

/** Mirrors `ProbabilityCalculator.remove_interactions` (`analyze.py`) — sequential OR inclusion–exclusion. */
export function removeInteractions(probs: readonly number[]): number[] {
  let accProduct = 1
  const out: number[] = []
  for (const p of probs) {
    out.push(p * accProduct)
    accProduct *= 1 - p
  }
  return out
}
