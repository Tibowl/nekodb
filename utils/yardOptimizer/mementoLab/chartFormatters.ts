import type { MementoTimeDisplayScale } from "../foodBowlEconomy"

/** Probability as percent; three decimals (0.001% steps) — not tied to sim precision, display only. */
export function pct(x: number): string {
  return `${(100 * x).toFixed(3)}%`
}

/**
 * Linear interpolation of `cum` at an arbitrary `x`. The grid produced by
 * `cumulativeProbSuccessByDay` is monotone in both `x` and `cum`, so a binary
 * search lookup is fine. Returns the curve's clamp value outside the range.
 */
export function interpCumulative(
  curve: { x: number; cum: number }[],
  x: number
): number {
  if (curve.length === 0) return 0
  if (x <= curve[0]!.x) return curve[0]!.cum
  const last = curve[curve.length - 1]!
  if (x >= last.x) return last.cum
  let lo = 0
  let hi = curve.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (curve[mid]!.x <= x) lo = mid
    else hi = mid
  }
  const a = curve[lo]!
  const b = curve[hi]!
  const span = b.x - a.x
  if (span <= 0) return a.cum
  const t = (x - a.x) / span
  return a.cum + t * (b.cum - a.cum)
}

export function pickXTicks(xLo: number, xHi: number, maxTicks: number): number[] {
  if (!Number.isFinite(xLo) || !Number.isFinite(xHi) || xHi <= xLo) return [xLo]
  const span = xHi - xLo
  const stepRaw = span / Math.max(2, maxTicks)
  const pow10 = 10 ** Math.floor(Math.log10(Math.max(stepRaw, 1e-9)))
  const niceStep = Math.max(pow10 / 20, Math.ceil(stepRaw / pow10) * pow10)
  const ticks: number[] = []
  let x = Math.ceil(xLo / niceStep - 1e-9) * niceStep
  let i = 0
  while (x <= xHi + niceStep * 0.01 && i < maxTicks + 50) {
    if (x >= xLo - niceStep * 0.01) ticks.push(Number(x.toPrecision(12)))
    x += niceStep
    i++
  }
  if (ticks.length === 0) return [xLo, xHi]
  return ticks
}

export function fmtAxisTick(v: number, isDays: boolean): string {
  if (isDays) {
    if (v >= 10) return v.toFixed(0)
    if (v >= 1) return v.toFixed(1)
    return v.toFixed(2)
  }
  return Number.isInteger(v) ? String(v) : v.toFixed(1)
}

/** Formats **display** time = `gameDays * displayMul` (tick labels, copy). */
export function fmtDisplayTick(gameDays: number, displayMul: number): string {
  return fmtAxisTick(gameDays * displayMul, true)
}

/** Compact tick labels for fish counts on the single-yard income SVG. */
export function fmtFishAxisTick(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return v.toFixed(0)
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

export function displayUnitWords(timeDisplay: MementoTimeDisplayScale): string {
  return timeDisplay.basis === "gameDay" ? "food days" : "food refills"
}

export function displayAxisLabel(timeDisplay: MementoTimeDisplayScale): string {
  return timeDisplay.basis === "gameDay" ? "food days" : "food refills"
}

export function formatDisplayTimeText(
  gameDays: number,
  timeDisplay: MementoTimeDisplayScale
): string {
  const value = fmtDisplayTick(gameDays, timeDisplay.displayMul)
  if (timeDisplay.basis === "gameDay") {
    return `${value} food ${Math.abs(Number(value)) === 1 ? "day" : "days"}`
  }
  return `${value} food refills`
}
