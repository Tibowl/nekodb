/**
 * How the player handles Tubbs (cat 108, who clears the whole outdoor bowl per visit). Each mode
 * pairs an OUTDOOR-only food-cost factor with an income adjustment before food cost is subtracted.
 * Kicked Tubbs still leaves a stay-based silver gift; kicking only sets his gold conversion to zero.
 * The analyzer derives the cost and income adjustment and surfaces them as
 * `lastOutdoorBowlCostFactor` + `lastBowlIncomeHaircut` for scoring to read. The four active modes
 * are a 2×2 of (kick Tubbs? × refill timing — promptly, or on a food round when you next refill
 * either bowl):
 *  - `off`         today's behavior: identity (no extra cost, gross unchanged).
 *  - `kickSight`  (kick, prompt):     shoo on sight, refill promptly (`emptyRate`); silver-only gift.
 *  - `helper`      (let-be, prompt):   refill once Tubbs leaves (`emptyRate/(1+mass)`); keep the gift.
 *  - `kickRefill` (kick, food round): shoo, refill when you next tend either bowl; silver-only gift.
 *  - `graze`       (let-be, food round): refill when you next tend either bowl; keep the gift.
 * The two food-round modes share the SAME rate `min(max(Ri, Ro), emptyRate)` (checks fire at the
 * union of the two refill cadences = the shorter-lived food, capped by the empty rate); they differ
 * in full gift vs silver-only gift.
 */
export type TubbsMode = "off" | "helper" | "kickSight" | "kickRefill" | "graze"

/** Default Tubbs mode for new sessions; invalid values normalize to this. */
export const DEFAULT_TUBBS_MODE: TubbsMode = "graze"

export const SOLVER_TUBBS_MODES: readonly TubbsMode[] = [
  "off",
  "helper",
  "kickSight",
  "kickRefill",
  "graze",
]

export function isSolverTubbsMode(x: unknown): x is TubbsMode {
  return typeof x === "string" && (SOLVER_TUBBS_MODES as readonly string[]).includes(x)
}

export function normalizeTubbsMode(x: unknown): TubbsMode {
  return isSolverTubbsMode(x) ? x : DEFAULT_TUBBS_MODE
}

/** True when the sim should attach food state and run outdoor-bowl depletion. */
export function isTubbsSimActive(
  mode: TubbsMode | undefined,
  hasOutdoorBowlPlayspace = true
): boolean {
  return !!mode && mode !== "off" && hasOutdoorBowlPlayspace
}

/** Whether Tubbs's bowl gift is kept under this mode (helper / graze). */
export function tubbsKeepsGift(mode: TubbsMode): boolean {
  return mode === "helper" || mode === "graze"
}

/**
 * When (relative to his bowl visit) a mode shoos Tubbs off. The single mode→kick-behavior trait that
 * both the sim (eject timing) and the analyzer (camped-stay gift) read, so neither special-cases a
 * mode name:
 *  - `"none"`        — never shooed (off / helper / graze); he camps his full rolled stay.
 *  - `"onSight"`     — shooed the instant he lands, AFTER the visit's gift settles → still full stay.
 *  - `"onFoodRound"` — shooed when you next refill either bowl, which can interrupt his camp partway
 *                      → he keeps only a partial stay.
 */
export type TubbsKickTiming = "none" | "onSight" | "onFoodRound"

export function tubbsKickTiming(mode: TubbsMode): TubbsKickTiming {
  switch (mode) {
    case "kickSight":
      return "onSight"
    case "kickRefill":
      return "onFoodRound"
    default:
      return "none"
  }
}

/**
 * When a mode refills the OUTDOOR bowl, as a trait both the analyzer renewal rate
 * (`outdoorRefillRateForMode`) and the sim policy (`shouldRefillOutdoorBowlSim`) read, so the two
 * cannot drift on which modes are prompt versus food-round:
 *  - `"prompt"`    — refill as soon as the bowl is free (kickSight, helper).
 *  - `"foodRound"` — refill only when you next tend either bowl (kickRefill, graze).
 * `off` reports `"prompt"` but never reaches the refill path (the economy short-circuits it).
 */
export type TubbsRefillTiming = "prompt" | "foodRound"

export function tubbsRefillTiming(mode: TubbsMode): TubbsRefillTiming {
  return mode === "kickRefill" || mode === "graze" ? "foodRound" : "prompt"
}

export { TUBBS_CAT_ID } from "./analyzer/constants"

export const TUBBS_MODE_LABELS: Record<TubbsMode, string> = {
  off: "Ignore Tubbs",
  helper: "Let him eat, refill once he leaves (keeps his full gift)",
  kickSight: "Shoo on sight, refill right away (silver gift only)",
  kickRefill: "Shoo at your next bowl refill (silver gift only)",
  graze: "Never shoo, top up at your next bowl refill (keeps his full gift)",
}

export const TUBBS_MODE_OPTIONS = (
  Object.entries(TUBBS_MODE_LABELS) as [TubbsMode, string][]
).map(([id, label]) => ({ id, label }))
