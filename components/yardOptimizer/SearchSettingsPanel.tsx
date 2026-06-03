import { useState, type Dispatch, type SetStateAction } from "react"
import Link from "next/link"

import {
  type FitnessAnalyzerOptions,
  type SolverTier,
} from "../../utils/yardOptimizer/fitness"
import {
  OFFSPRING_EXPLORATION_PRESETS,
  PLACES_INDOOR,
  PLACES_OUTDOOR,
  type OffspringScoreMode,
} from "../../utils/yardOptimizer/config"
import type { ItemPools } from "../../utils/yardOptimizer/yardCore"
import type { OffspringExplorationSelectValue } from "../yardOptimizerSessionConfig"
import type {
  InteractionMode,
  OpenGateMode,
  ReachMode,
} from "../../utils/yardOptimizer/analyzer/catPlaceSolver"
import { AdvancedSubcard, SettingsChoice } from "./primitives"

// Accuracy hint numbers come from the PER-AXIS MEAN-ERROR SUMMARY block in
// `utils/yardOptimizer/analyzer/reachAudit/solverVsSim.bench.parity.test.ts`.
// `meanGrossFishPctOffMc` = mean |solver gross gold-equivalent fish/day −
// simulator gross gold-equivalent fish/day| / sim, averaged over five yards
// (Snyap's fav / three GA-found high-yield yards / a heavy-overlap clique
// stress). Measured at full-tier convergence so it matches the single-yard
// score the user sees.
//
// `solverCostX` = mid-tier solver wall time on that option ÷ mid-tier solver
// wall time on the cheapest option on the same axis, averaged across the
// same five test yards (warm cache, converged in <30 iter). This is the
// typical per-scored-yard solver cost the GA pays.
//
// `runCostX` = total Run-Optimizer wall time on that option ÷ total wall
// time on the cheapest option, measured end-to-end on a representative
// 50-gen × 80-pool search (~5,000 yards scored, source:
// `fullOptimization.bench.parity.test.ts`).
//
// componentState is the special case: the GA does NOT search with it. When the
// user selects it, the search tier runs the cheap perPlace proxy
// (`GA_SEARCH_OPEN_GATE_OVERRIDE` in config.ts) and only the final ~80-yard pool
// is re-scored with componentState before display ("Rescoring finalists..."
// phase). So its runCostX measured ~1.06× (50-gen × 80-pool fullOpt bench: proposed
// 46.1s vs the perPlace baseline 43.6s) even though one componentState solve costs
// ~2.0× a perPlace one (`solverCostX`) — the expensive model only touches the
// shortlist, not the ~5,000 yards the GA explores. (Before that proxy existed it
// searched componentState directly and ran ~5×.)
//
// The full validation matrix in solverVsSim now measures accuracy AND per-solve
// cost for every option (including stateAverage / sampled / sampledUnique);
// only their runCostX (total-search) stays estimated, since you would not run a
// full search with them. Caveats the `note` flags: sampledUnique does not
// converge at full tier on this bed (its error is from an unsettled solve), and
// the ms-scale per-solve costs are noisy run-to-run, so solverCostX is
// representative rather than exact.
type AxisHint = {
  meanGrossFishPctOffMc: number
  solverCostX: number
  runCostX: number
  note?: string
}

const INTERACTION_OPTIONS: Array<{
  id: InteractionMode
  label: string
  detail: string
  hint: AxisHint
  recommended?: boolean
  experimental?: boolean
}> = [
  {
    id: "meanField",
    label: "Average cats",
    detail:
      "Treat the other cats as average crowd. Fastest, and accurate when no cat strongly likes or dislikes another. Right choice for almost every yard.",
    hint: { meanGrossFishPctOffMc: 0.55, solverCostX: 1, runCostX: 1 },
    recommended: true,
  },
  {
    id: "stateAverage",
    label: "Track which cats are around",
    detail:
      "Take into account which specific other cats happen to be on nearby goodies. Cat relationships (one cat boosting or scaring off another) matter here. Slower; sometimes does not settle on a stable answer when cats compete heavily for the same goodie.",
    hint: {
      meanGrossFishPctOffMc: 0.58,
      solverCostX: 2.7,
      runCostX: 2,
      note: "about the same accuracy as mean-field here, ~2.7× the cost of scoring one yard; total-search cost estimated",
    },
  },
  {
    id: "sampledUnique",
    label: "Sample cat layouts",
    detail:
      "Same idea as the option above, but estimated by running many random layouts instead of computing the average directly. Noisier; mainly a cross-check.",
    hint: {
      meanGrossFishPctOffMc: 0.52,
      solverCostX: 8.8,
      runCostX: 3,
      note: "never settles even after the maximum passes on the test bed, so its error can't be trusted; ~9× the cost of scoring one yard; cross-check only",
    },
    experimental: true,
  },
  {
    id: "sampled",
    label: "Sample, ignore duplicates",
    detail:
      "Same as the option above but lets the same cat appear in two places at once, which the game does not allow. Debugging only; do not use for real runs.",
    hint: { meanGrossFishPctOffMc: 0.55, solverCostX: 3.5, runCostX: 3, note: "debug-only (lets the same cat appear twice); settles only under the recommended overlap-group setting; ~3.5× the cost of scoring one yard" },
    experimental: true,
  },
]

// Reach options render no accuracy badge (under the recommended overlap-group
// setting all three score the same ~0.55% — the blue callout explains why), so
// these carry no `hint`.
const REACH_OPTIONS: Array<{
  id: ReachMode
  label: string
  detail: string
  recommended?: boolean
}> = [
  {
    id: "shared",
    label: "One open-chance number per goodie",
    detail:
      "Every cat sees the same number for whether this goodie is free. It counts the cat already on the goodie as if it were a different cat blocking the play space. With per-goodie overlap handling that makes it the worst choice (about 1.2% off the simulator), but with the recommended overlap-group setting it lands about the same as the other reach options (~0.55%).",
  },
  {
    id: "renormalized",
    label: "Subtract this cat from its own blocker",
    detail:
      "Give each cat its own open-chance number that ignores its own current visit. Exact for a goodie with no overlaps, and for a tight cluster where every goodie overlaps every other (like one bench of cat trees). On messier overlap shapes the subtraction can take off too much, so the safe-formula option below is the default.",
  },
  {
    id: "componentAware",
    label: "Use the safe formula on each goodie",
    detail:
      "Picks between the two options above goodie by goodie. Uses the per-cat subtraction wherever it is mathematically exact (the cases above), and falls back to the shared number on overlap shapes where it would overshoot.",
    recommended: true,
  },
]

const OPEN_GATE_OPTIONS: Array<{
  id: OpenGateMode
  label: string
  detail: string
  hint: AxisHint
  recommended?: boolean
}> = [
  {
    id: "perPlace",
    label: "Treat each goodie on its own",
    detail:
      "Estimate whether each play space is open by itself. Fast, but slightly off when a group of goodies physically overlap and only one of them can be free at a time.",
    hint: { meanGrossFishPctOffMc: 0.75, solverCostX: 1, runCostX: 1 },
  },
  {
    id: "componentState",
    label: "Look at the whole overlap group",
    detail:
      "Look at each overlap group as a whole: which goodies can be free together, plus credit for a cat leaving mid-tick. A small, consistent accuracy gain over per-goodie (about 0.75% → 0.55% off the simulator on the test bed). It stays cheap to search with: the optimizer explores using the quick per-goodie estimate above, then re-scores only the final shortlist with this accurate model. So it barely adds to total search time, even though one accurate solve costs about 2.0× a per-goodie one.",
    hint: { meanGrossFishPctOffMc: 0.55, solverCostX: 2.0, runCostX: 1.06 },
    recommended: true,
  },
]

// Per-combination accuracy + convergence from the full validation matrix in
// `utils/yardOptimizer/analyzer/reachAudit/solverVsSim.bench.parity.test.ts`
// (errPct = mean % off the simulator; converged = the solve settles). Used only
// to show a custom combination's number on the "Custom combination" line below —
// no standalone readout. Regenerate from the bench if the solver changes.
const SELECTION_VALIDATION: Record<
  string,
  { errPct: number; converged: boolean }
> = {
  "meanField|shared|perPlace": { errPct: 1.21, converged: true },
  "meanField|shared|componentState": { errPct: 0.55, converged: true },
  "meanField|renormalized|perPlace": { errPct: 0.83, converged: true },
  "meanField|renormalized|componentState": { errPct: 0.55, converged: true },
  "meanField|componentAware|perPlace": { errPct: 0.75, converged: true },
  "meanField|componentAware|componentState": { errPct: 0.55, converged: true },
  "stateAverage|shared|perPlace": { errPct: 1.14, converged: true },
  "stateAverage|shared|componentState": { errPct: 0.58, converged: true },
  "stateAverage|renormalized|perPlace": { errPct: 0.89, converged: true },
  "stateAverage|renormalized|componentState": { errPct: 0.58, converged: true },
  "stateAverage|componentAware|perPlace": { errPct: 0.82, converged: true },
  "stateAverage|componentAware|componentState": { errPct: 0.58, converged: true },
  "sampledUnique|shared|perPlace": { errPct: 1.19, converged: false },
  "sampledUnique|shared|componentState": { errPct: 0.52, converged: false },
  "sampledUnique|renormalized|perPlace": { errPct: 0.82, converged: false },
  "sampledUnique|renormalized|componentState": { errPct: 0.52, converged: false },
  "sampledUnique|componentAware|perPlace": { errPct: 0.75, converged: false },
  "sampledUnique|componentAware|componentState": { errPct: 0.52, converged: false },
  "sampled|shared|perPlace": { errPct: 1.17, converged: false },
  "sampled|shared|componentState": { errPct: 0.55, converged: true },
  "sampled|renormalized|perPlace": { errPct: 0.87, converged: false },
  "sampled|renormalized|componentState": { errPct: 0.55, converged: true },
  "sampled|componentAware|perPlace": { errPct: 0.79, converged: false },
  "sampled|componentAware|componentState": { errPct: 0.55, converged: true },
}

const selectionKey = (
  o: Pick<FitnessAnalyzerOptions, "interactionMode" | "reachMode" | "openGateMode">
): string => `${o.interactionMode}|${o.reachMode}|${o.openGateMode}`

const RECOMMENDED_OPTIONS: Pick<
  FitnessAnalyzerOptions,
  "interactionMode" | "reachMode" | "openGateMode"
> = {
  interactionMode: "meanField",
  reachMode: "componentAware",
  openGateMode: "componentState",
}

function isRecommendedSelection(
  options: Pick<FitnessAnalyzerOptions, "interactionMode" | "reachMode" | "openGateMode">
): boolean {
  return (
    options.interactionMode === RECOMMENDED_OPTIONS.interactionMode &&
    options.reachMode === RECOMMENDED_OPTIONS.reachMode &&
    options.openGateMode === RECOMMENDED_OPTIONS.openGateMode
  )
}

function formatRelativeCost(x: number): string {
  if (x < 0.95) return `${x.toFixed(2)}×`
  if (Math.abs(x - 1) < 0.05) return "1×"
  return `${x.toFixed(1)}×`
}

function AccuracyHintBadge({ hint }: { hint: AxisHint }) {
  return (
    <span className="ml-2 inline-flex items-baseline gap-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-medium text-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
      <span title="Average distance between this option's predicted gold-equivalent fish per day and the simulator's measured value, taken across a fixed set of five test yards (heaviest on dense-overlap GA-found yards). Lower is closer to the simulator. The simulator's own run-to-run noise is roughly 0.6–0.7% on these yards, so errors near that level are hard to distinguish from noise.">
        ≈ {hint.meanGrossFishPctOffMc.toFixed(2)}% off simulator
      </span>
      <span className="text-slate-400">·</span>
      <span title="Per-yard cost of one solve with this model, relative to the cheapest option for this choice (other two choices held at recommended). This is what a single scored yard costs when this model is actually run.">
        {formatRelativeCost(hint.solverCostX)} solver
      </span>
      <span className="text-slate-400">/</span>
      <span title="Total Run-Optimizer time relative to the cheapest option, measured end-to-end on a 50-gen × 80-pool search (~5,000 yards scored). For the accurate overlap model the optimizer searches with the fast per-goodie proxy and only re-scores the ~80-yard finalist pool with the accurate model, so this stays near 1× even though a single accurate solve is pricier (see the solver multiplier).">
        ~{formatRelativeCost(hint.runCostX)} search
      </span>
      {hint.note ? (
        <>
          <span className="text-slate-400">·</span>
          <span className="text-amber-700 dark:text-amber-400">{hint.note}</span>
        </>
      ) : null}
    </span>
  )
}

function HowItWorksLink({ anchor, label }: { anchor: string; label: string }) {
  return (
    <Link
      href={`/yard-optimizer/how-it-works#${anchor}`}
      className="ml-2 text-[11px] font-medium text-blue-700 underline hover:no-underline dark:text-blue-300"
      title="Opens the matching section of the How the optimizer works page"
      target="_blank"
      rel="noopener"
    >
      {label}
    </Link>
  )
}

function RecommendedBadge() {
  return (
    <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
      recommended
    </span>
  )
}

function ExperimentalBadge() {
  return (
    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-900/70 dark:text-amber-100">
      experimental
    </span>
  )
}

export function SearchSettingsPanel({
  evolutionSolverTier,
  setEvolutionSolverTier,
  setSearchStrengthAutoBumped,
  generations,
  setGenerations,
  poolSize,
  setPoolSize,
  tournamentK,
  setTournamentK,
  mutationRate,
  setMutationRate,
  offspringExplorationPreset,
  setMutationOffspringRate,
  setFoodMutationOffspringRate,
  setOpenSlotExplorationRate,
  setOffspringScoreMode,
  survivorSelectionEnabled,
  setSurvivorSelectionEnabled,
  survivorExploratoryRate,
  setSurvivorExploratoryRate,
  survivorInitialRankTemperature,
  setSurvivorInitialRankTemperature,
  survivorFinalRankTemperature,
  setSurvivorFinalRankTemperature,
  logOptimizerProfile,
  setLogOptimizerProfile,
  pools,
  analyzerOptions,
  setAnalyzerOptions,
}: {
  evolutionSolverTier: SolverTier
  setEvolutionSolverTier: (tier: SolverTier) => void
  setSearchStrengthAutoBumped: (autoBumped: boolean) => void
  generations: number
  setGenerations: (generations: number) => void
  poolSize: number
  setPoolSize: (poolSize: number) => void
  tournamentK: number
  setTournamentK: (tournamentK: number) => void
  mutationRate: number
  setMutationRate: (mutationRate: number) => void
  offspringExplorationPreset: OffspringExplorationSelectValue
  setMutationOffspringRate: (rate: number) => void
  setFoodMutationOffspringRate: (rate: number) => void
  setOpenSlotExplorationRate: (rate: number) => void
  setOffspringScoreMode: (mode: OffspringScoreMode) => void
  survivorSelectionEnabled: boolean
  setSurvivorSelectionEnabled: (enabled: boolean) => void
  survivorExploratoryRate: number
  setSurvivorExploratoryRate: (rate: number) => void
  survivorInitialRankTemperature: number
  setSurvivorInitialRankTemperature: (temperature: number) => void
  survivorFinalRankTemperature: number
  setSurvivorFinalRankTemperature: (temperature: number) => void
  logOptimizerProfile: boolean
  setLogOptimizerProfile: (enabled: boolean) => void
  pools: Pick<ItemPools, "largeItems" | "smallItems">
  analyzerOptions: FitnessAnalyzerOptions
  setAnalyzerOptions: Dispatch<SetStateAction<FitnessAnalyzerOptions>>
}) {
  const isRecommended = isRecommendedSelection(analyzerOptions)
  const selectionStats = SELECTION_VALIDATION[selectionKey(analyzerOptions)]
  // Preset-first disclosure: hide the three-axis fieldsets unless the user opts
  // in. Default open only when a non-recommended combo is already loaded (e.g.
  // restored from a saved session), so customizers still see their choices.
  const [customizeScoring, setCustomizeScoring] = useState(!isRecommended)

  return (
    <>
      <AdvancedSubcard
        title="Search"
        description="Where to search, and how hard to search."
      >
        <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Search strength
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
            These controls trade speed for stricter scoring and wider search. Higher settings can
            find better layouts, but they take longer.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 max-w-2xl">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Generations</span>
              <input
                type="number"
                min={1}
                max={500}
                value={generations}
                onChange={(e) => setGenerations(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Pool size</span>
              <input
                type="number"
                min={20}
                max={300}
                step={10}
                value={poolSize}
                onChange={(e) => setPoolSize(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Selection pressure (tournament size)</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                How many layouts compete to become a parent. Higher is greedier:
                it picks the current best more often; lower keeps more
                variety.
              </span>
              <input
                type="number"
                min={2}
                max={20}
                value={tournamentK}
                onChange={(e) => setTournamentK(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Mutation rate</span>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={mutationRate}
                onChange={(e) => setMutationRate(Number(e.target.value))}
                className="border rounded px-2 py-1 bg-white dark:bg-slate-800"
              />
            </label>
            <fieldset className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
              <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
                Evolution scoring
              </legend>
              <div className="grid gap-2">
                <SettingsChoice className="text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="evolutionSolverTier"
                    checked={evolutionSolverTier === "mid"}
                    onChange={() => {
                      setSearchStrengthAutoBumped(false)
                      setEvolutionSolverTier("mid")
                    }}
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      Standard
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Faster evaluator during evolution, then full rerank at the end. Quicker, but
                      can miss layouts the full scorer would favor earlier.
                    </span>
                  </span>
                </SettingsChoice>
                <SettingsChoice className="text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="evolutionSolverTier"
                    checked={evolutionSolverTier === "full"}
                    onChange={() => {
                      setSearchStrengthAutoBumped(false)
                      setEvolutionSolverTier("full")
                    }}
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      Full
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Full evaluator during evolution. Slowest, but search ranking and final ranking
                      use the same stricter scorer.
                    </span>
                  </span>
                </SettingsChoice>
              </div>
            </fieldset>
            <fieldset className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
              <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
                Offspring exploration
              </legend>
              <div className="grid gap-2">
                {offspringExplorationPreset === "custom" ? (
                  <SettingsChoice className="text-slate-700 dark:text-slate-300">
                    <input
                      type="radio"
                      name="offspringExplorationPreset"
                      checked
                      readOnly
                      className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        Custom
                      </span>
                      <span className="block text-xs text-slate-600 dark:text-slate-400">
                        Uses the custom offspring rates currently set for this session.
                      </span>
                    </span>
                  </SettingsChoice>
                ) : null}
                <SettingsChoice className="text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="offspringExplorationPreset"
                    checked={offspringExplorationPreset === "fast"}
                    onChange={() => {
                      const cfg = OFFSPRING_EXPLORATION_PRESETS.fast
                      setMutationOffspringRate(cfg.mutationOffspringRate)
                      setFoodMutationOffspringRate(cfg.foodMutationOffspringRate)
                      setOpenSlotExplorationRate(cfg.openSlotExplorationRate)
                      setOffspringScoreMode(cfg.offspringScoreMode)
                    }}
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      Fast
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Samples fewer children: mutation 25%, food 25%, open play spaces 35%. Fastest, but
                      explores less of the layout space.
                    </span>
                  </span>
                </SettingsChoice>
                <SettingsChoice className="text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="offspringExplorationPreset"
                    checked={offspringExplorationPreset === "balanced"}
                    onChange={() => {
                      const cfg = OFFSPRING_EXPLORATION_PRESETS.balanced
                      setMutationOffspringRate(cfg.mutationOffspringRate)
                      setFoodMutationOffspringRate(cfg.foodMutationOffspringRate)
                      setOpenSlotExplorationRate(cfg.openSlotExplorationRate)
                      setOffspringScoreMode(cfg.offspringScoreMode)
                    }}
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      Balanced
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Mutation 50%, food 50%, open play spaces 65%. Moderate runtime with a broad child
                      search.
                    </span>
                  </span>
                </SettingsChoice>
                <SettingsChoice className="text-slate-700 dark:text-slate-300">
                  <input
                    type="radio"
                    name="offspringExplorationPreset"
                    checked={offspringExplorationPreset === "thorough"}
                    onChange={() => {
                      const cfg = OFFSPRING_EXPLORATION_PRESETS.thorough
                      setMutationOffspringRate(cfg.mutationOffspringRate)
                      setFoodMutationOffspringRate(cfg.foodMutationOffspringRate)
                      setOpenSlotExplorationRate(cfg.openSlotExplorationRate)
                      setOffspringScoreMode(cfg.offspringScoreMode)
                    }}
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      Thorough
                    </span>
                    <span className="block text-xs text-slate-600 dark:text-slate-400">
                      Mutation 50%, food 90%, open play spaces 90%, and scores every unique child.
                      Slowest, with the widest offspring search.
                    </span>
                  </span>
                </SettingsChoice>
              </div>
            </fieldset>
          </div>
          <fieldset className="mt-4 max-w-2xl border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
              Relaxed survivor selection
            </legend>
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 mt-1 mb-3">
              <input
                type="checkbox"
                checked={survivorSelectionEnabled}
                onChange={(e) => setSurvivorSelectionEnabled(e.target.checked)}
                className="mt-1 accent-sky-600 dark:accent-sky-500"
              />
              <span>Keep a small slice of lower-ranked layouts each generation.</span>
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              Temperature controls how freely the search keeps weaker layouts for another try.
              Higher values explore more; lower values tighten back toward the best-ranked layouts.
              These three inputs only matter when the box above is checked. As a starting point, try a
              start temperature around 10, an end temperature around 1, and a small exploratory share
              like 0.1.
            </p>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Exploratory survivors</span>
                <input
                  type="number"
                  min={0}
                  max={0.9}
                  step={0.05}
                  value={survivorExploratoryRate}
                  onChange={(e) => setSurvivorExploratoryRate(Number(e.target.value))}
                  disabled={!survivorSelectionEnabled}
                  className="border rounded px-2 py-1 bg-white dark:bg-slate-800 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">Start temperature</span>
                <input
                  type="number"
                  min={0.01}
                  max={200}
                  step={1}
                  value={survivorInitialRankTemperature}
                  onChange={(e) => setSurvivorInitialRankTemperature(Number(e.target.value))}
                  disabled={!survivorSelectionEnabled}
                  className="border rounded px-2 py-1 bg-white dark:bg-slate-800 disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">End temperature</span>
                <input
                  type="number"
                  min={0.01}
                  max={200}
                  step={1}
                  value={survivorFinalRankTemperature}
                  onChange={(e) => setSurvivorFinalRankTemperature(Number(e.target.value))}
                  disabled={!survivorSelectionEnabled}
                  className="border rounded px-2 py-1 bg-white dark:bg-slate-800 disabled:opacity-50"
                />
              </label>
            </div>
          </fieldset>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Yard shape: {PLACES_INDOOR} indoor play spaces, {PLACES_OUTDOOR} outdoor (one large goodie uses
            two play spaces). Goodie pool: {pools.largeItems.length} large, {pools.smallItems.length} small
            goodies (food bowls are separate).
          </p>
          <SettingsChoice boxed className="mt-3">
            <input
              type="checkbox"
              checked={logOptimizerProfile}
              onChange={(e) => setLogOptimizerProfile(e.target.checked)}
              className="mt-0.5 rounded border-slate-300"
            />
            <span>
              <strong>Log optimizer profiling report</strong>
              <span className="block text-slate-600 dark:text-slate-400 font-normal mt-0.5">
                Prints a developer timing summary to the browser console after the run finishes.
              </span>
            </span>
          </SettingsChoice>
        </div>
      </AdvancedSubcard>

      <AdvancedSubcard
        title="Analyzer model"
        description="Advanced controls for how carefully the scorer estimates a yard. Most runs can leave this alone."
      >
        <div className="grid gap-3 max-w-3xl">
          <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 p-3 text-xs leading-relaxed">
            <p className="text-slate-700 dark:text-slate-200">
              Three choices control how the scorer rates a yard: a
              cat&rsquo;s chance to find a goodie open, which cat sits down, and
              how cats split across overlapping goodies.{" "}
              <Link
                href="/yard-optimizer/how-it-works#mean-field"
                target="_blank"
                rel="noopener"
                className="text-blue-700 underline hover:no-underline dark:text-blue-300"
              >
                How the optimizer works
              </Link>{" "}
              explains the math.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {isRecommended ? (
                <span className="font-medium text-blue-700 dark:text-blue-300">
                  ✓ Using the recommended combination, about 0.55% off the
                  simulator (a slow tick-by-tick reference run we treat as ground
                  truth) on a 5-yard test set.
                </span>
              ) : (
                <>
                  <span className="font-medium text-amber-700 dark:text-amber-300">
                    {selectionStats
                      ? selectionStats.converged
                        ? `Custom combination: about ${selectionStats.errPct}% off the simulator.`
                        : "Custom combination: this model doesn’t settle, so its score can’t be trusted."
                      : "Custom combination selected."}
                  </span>
                  <button
                    type="button"
                    className="text-blue-700 underline hover:no-underline dark:text-blue-300"
                    onClick={() =>
                      setAnalyzerOptions((o) => ({ ...o, ...RECOMMENDED_OPTIONS }))
                    }
                  >
                    Reset to recommended
                  </button>
                </>
              )}
              <button
                type="button"
                className="text-blue-700 underline hover:no-underline dark:text-blue-300"
                aria-expanded={customizeScoring}
                onClick={() => setCustomizeScoring((v) => !v)}
              >
                {customizeScoring ? "Hide options" : "Customize…"}
              </button>
            </div>
          </div>

          {customizeScoring ? (
            <>
              <details className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 text-xs leading-relaxed [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer px-3 py-2 font-medium text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2 list-none">
                  <span>How to read the badges below</span>
                  <span className="text-slate-400 text-[10px]" aria-hidden>
                    ▼
                  </span>
                </summary>
                <p className="border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-600 dark:text-slate-400">
                  Each badge shows the simulator error and two cost ratios for
                  that one option, with the other two choices held on their
                  recommended setting. The <strong>solver</strong> ratio is what
                  a single solve with that option costs. The{" "}
                  <strong>search</strong> ratio is the estimated total
                  Run-Optimizer time for a typical 50-gen × 80-pool search,
                  usually smaller, because the per-yard work the
                  optimizer repeats (mutation, crossover, scoring overhead) is
                  shared across options, and the accurate overlap-group setting
                  only runs on the final shortlist. Numbers come from a 5-yard
                  test set; your own runs will vary a little.
                </p>
              </details>

          <fieldset className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
              How likely a goodie is open for this cat
              <HowItWorksLink anchor="analytic-reach" label="see math →" />
            </legend>
            <p className="px-1 text-xs text-slate-600 dark:text-slate-400 mb-2">
              When the scorer asks &ldquo;is this goodie free right now?&rdquo;
              it has to be careful not to count the cat&rsquo;s own current
              visit as if it were a different cat blocking it. This row picks
              how careful.
            </p>
            {analyzerOptions.openGateMode === "componentState" ? (
              <div className="mx-1 mb-2 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-700/60 dark:bg-sky-900/20 dark:text-sky-100">
                <strong>No effect right now</strong>: under &ldquo;Look at
                the whole overlap group&rdquo; all three give the same ≈0.55%.
                They only differ if you switch the setting below to &ldquo;Treat
                each goodie on its own.&rdquo;
              </div>
            ) : (
              <div className="mx-1 mb-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100">
                <strong>This affects the score now.</strong> The safe formula
                (recommended) is the best pick; &ldquo;one open-chance number per
                goodie&rdquo; is about 1.2% off the simulator.
              </div>
            )}
            <div className="grid gap-2">
              {REACH_OPTIONS.map((opt) => (
                <SettingsChoice
                  key={opt.id}
                  className="text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="reachMode"
                    checked={analyzerOptions.reachMode === opt.id}
                    onChange={() =>
                      setAnalyzerOptions((o) => ({ ...o, reachMode: opt.id }))
                    }
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {opt.label}
                    </span>
                    {opt.recommended ? <RecommendedBadge /> : null}
                    <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {opt.detail}
                    </span>
                  </span>
                </SettingsChoice>
              ))}
            </div>
          </fieldset>

          <fieldset className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
              How to pick which cat sits down
              <HowItWorksLink anchor="analytic-draw" label="see math →" />
            </legend>
            <p className="px-1 text-xs text-slate-600 dark:text-slate-400 mb-2">
              When several cats could grab the same goodie, the scorer has to
              guess which one. This row picks how much detail it uses about who
              else is around.
            </p>
            <div className="grid gap-2">
              {INTERACTION_OPTIONS.map((opt) => (
                <SettingsChoice
                  key={opt.id}
                  className="text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="interactionMode"
                    checked={analyzerOptions.interactionMode === opt.id}
                    onChange={() =>
                      setAnalyzerOptions((o) => ({ ...o, interactionMode: opt.id }))
                    }
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {opt.label}
                    </span>
                    {opt.recommended ? <RecommendedBadge /> : null}
                    {opt.experimental ? <ExperimentalBadge /> : null}
                    <AccuracyHintBadge hint={opt.hint} />
                    <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {opt.detail}
                    </span>
                  </span>
                </SettingsChoice>
              ))}
            </div>
          </fieldset>

          <fieldset className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 bg-white/60 dark:bg-slate-800/30">
            <legend className="text-sm font-medium text-slate-800 dark:text-slate-200 px-1">
              How cats split between overlapping goodies
              <HowItWorksLink anchor="analytic-row-win" label="see math →" />
            </legend>
            <p className="px-1 text-xs text-slate-600 dark:text-slate-400 mb-2">
              If two goodies physically overlap (only one can be used at a
              time), the game still wants to know which goodie the cat ends up
              picking. This row picks how the scorer divides cats between
              them.
            </p>
            <div className="grid gap-2">
              {OPEN_GATE_OPTIONS.map((opt) => (
                <SettingsChoice
                  key={opt.id}
                  className="text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="openGateMode"
                    checked={analyzerOptions.openGateMode === opt.id}
                    onChange={() =>
                      setAnalyzerOptions((o) => ({ ...o, openGateMode: opt.id }))
                    }
                    className="accent-sky-600 dark:accent-sky-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {opt.label}
                    </span>
                    {opt.recommended ? <RecommendedBadge /> : null}
                    <AccuracyHintBadge hint={opt.hint} />
                    <span className="block text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      {opt.detail}
                    </span>
                  </span>
                </SettingsChoice>
              ))}
            </div>
          </fieldset>
            </>
          ) : null}
        </div>
      </AdvancedSubcard>
    </>
  )
}
