import type {
  FitnessAnalyzerOptions,
  SolverTier,
} from "../../utils/yardOptimizer/fitness"

export type OptimizerRunPhase = "idle" | "initializing" | "searching" | "rescoring"

export function geneticSearchModeLabel(tier: SolverTier): string {
  switch (tier) {
    case "mid":
      return "Genetic: Standard search, full final check"
    case "full":
      return "Genetic: Full search"
  }
}

export function formatRawIdList(ids: readonly number[]): string {
  return ids.length > 0 ? `[${ids.join(", ")}]` : "[]"
}

export function formatCompactList(items: readonly string[], empty = "none"): string {
  if (items.length === 0) return empty
  if (items.length <= 3) return items.join(", ")
  return `${items.slice(0, 3).join(", ")} +${items.length - 3} more`
}

export function sortedUniqueNumbers(ids: readonly number[]): number[] {
  return [...new Set(ids)].sort((a, b) => a - b)
}

export function sortGoodieIds(ids: number[]): number[] {
  return [...ids].sort((a, b) => a - b)
}

export function goodieConstraintStateForId(
  id: number,
  required: readonly number[],
  forbidden: readonly number[]
): "neutral" | "required" | "forbidden" {
  if (required.includes(id)) return "required"
  if (forbidden.includes(id)) return "forbidden"
  return "neutral"
}

export function goodieConditionLabel(
  itemDamageState: FitnessAnalyzerOptions["itemDamageState"]
): string {
  if (itemDamageState === 0) return "New / intact"
  if (itemDamageState === 1) return "Broken"
  return "Fixed / repaired"
}

export function optimizerRunLabel(
  running: boolean,
  progress: number,
  progressTotal: number,
  phase: OptimizerRunPhase,
  pauseRequested = false
): string {
  if (!running) return "Run optimizer"
  if (pauseRequested) return `Pausing... ${progress}/${progressTotal}`
  if (phase === "initializing") return "Starting..."
  if (phase === "rescoring") return "Rescoring finalists..."
  return `Running... ${progress}/${progressTotal}`
}
