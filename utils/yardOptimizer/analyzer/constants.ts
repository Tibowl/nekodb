/** Mirrors `GameConstants` in `analyze.py`. */
export const MINUTES_PER_TICK = 5
export const CAT_STAY_TICK_AVG = 9.5
export const STAY_TICK_RANGE = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
/** After leaving a playspace; uniform inclusive (mirrors `analyze.py` GameConstants). */
export const CAT_COOLDOWN_TICK_MIN = 8
export const CAT_COOLDOWN_TICK_MAX = 23
export const CAT_COOLDOWN_TICK_RANGE = Array.from(
  { length: CAT_COOLDOWN_TICK_MAX - CAT_COOLDOWN_TICK_MIN + 1 },
  (_, i) => CAT_COOLDOWN_TICK_MIN + i
)
/** Mean post-visit cooldown ticks (uniform discrete average). */
export const CAT_COOLDOWN_TICK_AVG =
  CAT_COOLDOWN_TICK_RANGE.reduce((a, b) => a + b, 0) / CAT_COOLDOWN_TICK_RANGE.length
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
/** Gold payout: floor(S/2) per leave; per tick of presence = sum(floor(s/2))/sum(s). */
export const GOLD_FISH_PER_TICK_WHEN_GOLD_PAYOUT =
  sum(STAY_TICK_RANGE.map((x) => Math.floor(x / 2))) / sum(STAY_TICK_RANGE)
export const SILVER_FISH_MULTIPLIER_RANGE = [1, 1.5] as const
/** Analyzer payout mix: gold gifts valued as silver in `silverEquiv` totals (mirrors `analyze.py`). */
export const ANALYZER_SILVER_PER_GOLD_FOR_SILVER_EQUIV = 25
/** Analyzer payout mix: silver gifts valued as gold in `goldEquiv` totals (mirrors `analyze.py`). */
export const ANALYZER_GOLD_PER_SILVER_FOR_GOLD_EQUIV = 1 / 50

export const YARD_TOTAL_KEY = "Your Yard Total"

export const MINUTES_PER_DAY = 24 * 60
export const TICKS_PER_DAY = MINUTES_PER_DAY / MINUTES_PER_TICK

/** Cat 108 — empties the whole outdoor bowl per visit. */
export const TUBBS_CAT_ID = 108

/** Visits per food day from analyzer horizon totals. */
export function visitsPerDayFromHorizon(
  visitsPerHorizon: number,
  totalDurationMinutes: number
): number {
  return visitsPerHorizon * (MINUTES_PER_DAY / Math.max(totalDurationMinutes, 1))
}

/** Expected visits per food day from converged playspace mass (0–1). */
export function visitsPerDayFromMass(mass: number): number {
  const m = Math.max(0, Math.min(1, mass))
  return (m * TICKS_PER_DAY) / CAT_STAY_TICK_AVG
}

/** Expected visits over a tick horizon from converged playspace mass (0–1). */
export function visitsFromMassOverTicks(mass: number, totalTicks: number): number {
  const m = Math.max(0, Math.min(1, mass))
  return (m * totalTicks) / CAT_STAY_TICK_AVG
}
