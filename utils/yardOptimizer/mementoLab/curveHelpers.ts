import type { WalkExactDistribution } from "../../mementoLottery"
import type { YardMementoSample } from "../yardMementoSim"
import type { BatchMementoSample, MementoCurveId } from "./types"

export function buildVisitCumulativeSeries(
  dist: WalkExactDistribution,
  maxN: number
): { x: number; cum: number }[] {
  const cap = Math.min(Math.max(1, Math.floor(maxN)), dist.pmfByVisitIndex.length)
  let cum = 0
  const out: { x: number; cum: number }[] = []
  for (let k = 0; k < cap; k++) {
    cum += dist.pmfByVisitIndex[k]!
    out.push({ x: k + 1, cum })
  }
  return out
}

export function catCurveId(catId: number): MementoCurveId {
  return `cat-${catId}`
}

export function findCurveCrossing(
  curve: { x: number; cum: number }[],
  target: number
): number | null {
  if (curve.length === 0) return null
  const last = curve[curve.length - 1]!
  if (last.cum < target - 1e-12) return null
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1]!
    const b = curve[i]!
    if (b.cum >= target && a.cum <= target) {
      const dy = b.cum - a.cum
      if (dy <= 0) return a.x
      const t = (target - a.cum) / dy
      return a.x + t * (b.x - a.x)
    }
  }
  return last.x
}

export function sampleDayForCurve(
  sample: BatchMementoSample,
  curveId: MementoCurveId
): number | null {
  if (curveId === "joint") return sample.hitMemento ? sample.days : null
  const catId = Number(curveId.slice(4))
  return sample.targetDaysByCat[catId] ?? null
}

export function compactBatchMementoSample(sample: YardMementoSample): BatchMementoSample {
  const targetDaysByCat: Record<number, number> = {}
  for (const hit of sample.targetMementos) {
    targetDaysByCat[hit.catId] = hit.days
  }
  return {
    hitMemento: sample.hitMemento,
    days: sample.days,
    targetDaysByCat,
  }
}
