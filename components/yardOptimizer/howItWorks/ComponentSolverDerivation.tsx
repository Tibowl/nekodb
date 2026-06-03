import { Latex } from "./primitives"
import {
  LATEX_COMPONENT_DAMPED_UPDATE,
  LATEX_COMPONENT_PAIR_SHORTCUT,
  LATEX_COMPONENT_PROJECTED_PI,
  LATEX_COMPONENT_Q_SINGLE_SPOT,
  LATEX_COMPONENT_SHARE_BETA,
  LATEX_LOOP_SUMMARY,
} from "./solverCoreLatex"

export function ComponentSolverShortcutsDetails() {
  return (
    <>
    <details className="font-sans text-slate-600 dark:text-slate-300">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
        Component projection details
      </summary>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
        <p>
          The component projection turns requested occupancy into physically
          possible overlap states. If a group has one play space, the solver can
          directly invert the single-play-space occupancy formula. Here{" "}
          <Latex>{String.raw`s`}</Latex> is the average visit length in ticks.
          Cooldown is absent here because Step 5 already turned arrivals into a
          requested on-yard visiting occupancy before this projection step.
        </p>
        <Latex display>{LATEX_COMPONENT_Q_SINGLE_SPOT}</Latex>
        <p>
          Two overlapping play spaces (filled states{" "}
          <Latex>{String.raw`a`}</Latex> or <Latex>{String.raw`b`}</Latex> only)
          have a closed form, which production uses when the stay duration is
          not a whole number of ticks. For integer stays it switches to the
          residual-state component chain, which captures deterministic stay
          timing directly. Either way the two-play-space case stays simple: it
          reduces to one quadratic, which larger non-clique components cannot.
        </p>
        <p>
          In that formula <Latex>{String.raw`\tau`}</Latex> is the summed
          requested occupancy of the two play spaces (clamped to be
          non-negative), <Latex>{String.raw`\pi'_a,\pi'_b`}</Latex> are those
          demands rescaled to sum to at most one,{" "}
          <Latex>{String.raw`F`}</Latex> is the combined win chance for the
          pair, and <Latex>{String.raw`\delta`}</Latex> is how that win chance
          splits between the two play spaces.
        </p>
        <Latex display>{LATEX_COMPONENT_PAIR_SHORTCUT}</Latex>
        <details className="font-sans text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
            Where the two-play-space formula comes from
          </summary>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
            <p>
              Treat the two overlapping play spaces as a small random-order race. Play space{" "}
              <Latex>{String.raw`a`}</Latex> wins if it is checked first and succeeds, or if{" "}
              <Latex>{String.raw`b`}</Latex> is checked first, fails, and then{" "}
              <Latex>{String.raw`a`}</Latex> succeeds.
            </p>
            <Latex display>{String.raw`
\begin{aligned}
w_a &= q_a(1-q_b/2), \\
w_b &= q_b(1-q_a/2).
\end{aligned}
`}</Latex>
            <p>
              The combined win chance is set to the single-play-space occupancy
              inverse of the summed demand,{" "}
              <Latex>{String.raw`F=Q(\pi'_a+\pi'_b)`}</Latex> (the same{" "}
              <Latex>{String.raw`Q`}</Latex> from the one-play-space case above),
              and the quadratic below splits that <Latex>{String.raw`F`}</Latex>{" "}
              between the two wins in proportion to the scaled requested
              occupancies.
            </p>
            <Latex display>{String.raw`
\begin{aligned}
w_a+w_b &= F, \\
w_a-w_b
  &= F\frac{\pi'_a-\pi'_b}{\pi'_a+\pi'_b}
   = \delta.
\end{aligned}
`}</Latex>
            <p>
              The difference equation gives <Latex>{String.raw`q_a-q_b=\delta`}</Latex>. Let{" "}
              <Latex>{String.raw`z=q_a+q_b`}</Latex>. Then the total equation is one quadratic
              in <Latex>{String.raw`z`}</Latex>.
            </p>
            <Latex display>{String.raw`
\begin{aligned}
F
  &= q_a+q_b-q_aq_b \\
  &= z-\frac{z^2-\delta^2}{4}.
\end{aligned}
`}</Latex>
            <p>
              Solving that quadratic for <Latex>{String.raw`z`}</Latex> (the
              root with <Latex>{String.raw`z\le 2`}</Latex>) and splitting by{" "}
              <Latex>{String.raw`q_a-q_b=\delta`}</Latex> lands on the boxed
              shortcut:
            </p>
            <Latex display>{String.raw`
\begin{aligned}
z = q_a+q_b &= 2-\sqrt{4(1-F)+\delta^2}, \\
q_a &= \tfrac{z+\delta}{2}
     = \tfrac{2-\sqrt{4(1-F)+\delta^2}+\delta}{2}, \\
q_b &= \tfrac{z-\delta}{2}
     = \tfrac{2-\sqrt{4(1-F)+\delta^2}-\delta}{2}.
\end{aligned}
`}</Latex>
          </div>
        </details>
      </div>
    </details>
        <details className="font-sans text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
            Why the shortcut stops after two play spaces
          </summary>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
            <p>
              A larger valid-state component already has a different shape. In a V-shaped
              conflict, side play spaces <Latex>{String.raw`a,b`}</Latex> can appear together,
              while the middle play space <Latex>{String.raw`m`}</Latex> conflicts with both of
              them. The valid snapshots are:
            </p>
            <Latex display>{String.raw`
\begin{aligned}
\mathcal S = \{\emptyset,a,b,m,ab\}.
\end{aligned}
`}</Latex>
            <p>
              The requested occupancies <Latex>{String.raw`A,B,M`}</Latex> do not tell us how
              often the two side play spaces are filled together. Call that hidden state mass{" "}
              <Latex>{String.raw`H=\Pr(ab)`}</Latex>.
            </p>
            <Latex display>{String.raw`
\begin{aligned}
\mu_\emptyset &= 1-A-B-M+H, \\
\mu_a &= A-H, &
\mu_b &= B-H, \\
\mu_m &= M, &
\mu_{ab} &= H.
\end{aligned}
`}</Latex>
            <p>
              With leave chance <Latex>{String.raw`\ell=1/s`}</Latex> and stay chance{" "}
              <Latex>{String.raw`h=1-\ell`}</Latex>, the pre-fill masses depend on that unknown{" "}
              <Latex>{String.raw`H`}</Latex>.
            </p>
            <Latex display>{String.raw`
\begin{aligned}
r_\emptyset
  &= 1-A-B-M+\ell(A+B+M)+h^2H, \\
r_a &= hA-h^2H, \\
r_b &= hB-h^2H, \\
r_{ab} &= h^2H.
\end{aligned}
`}</Latex>
            <p>From an empty V group, the exact random-order fill pass is:</p>
            <Latex display>{String.raw`
\begin{aligned}
E_a &=
  q_a\frac{6-3q_m+q_bq_m}{6}, \\
E_b &=
  q_b\frac{6-3q_m+q_aq_m}{6}, \\
E_m &=
  q_m\left(1-\frac{q_a+q_b}{2}
      +\frac{q_aq_b}{3}\right), \\
E_{ab} &=
  q_aq_b\left(1-\frac{q_m}{3}\right).
\end{aligned}
`}</Latex>
            <p>The inverse must satisfy these four equations:</p>
            <Latex display>{String.raw`
\begin{aligned}
\ell A &= r_\emptyset E_a+r_bq_a, \\
\ell B &= r_\emptyset E_b+r_aq_b, \\
\ell M &= r_\emptyset E_m, \\
H &= r_{ab}+r_aq_b+r_bq_a+r_\emptyset E_{ab}.
\end{aligned}
`}</Latex>
            <p>
              This is where the two-play-space proof no longer works. The V case has the extra unknown{" "}
              <Latex>{String.raw`H`}</Latex>, and the exact fill equations include products like{" "}
              <Latex>{String.raw`q_aq_b`}</Latex>, <Latex>{String.raw`q_aq_m`}</Latex>, and{" "}
              <Latex>{String.raw`q_aq_bq_m`}</Latex>. The two-play-space case reduced to one
              quadratic; this V-shaped case introduces hidden joint mass and higher-degree
              coupling, so there is no small quadratic shortcut of the same kind. For larger
              components, production evaluates the valid-state chain exactly for a proposed{" "}
              <Latex>{String.raw`\mathbf q_g`}</Latex>, then uses a deterministic damped
              numerical fit to choose that vector.
            </p>
          </div>
        </details>
    </>
  )
}

export function ComponentSolverDampedUpdate() {
  return (
    <>
      <details className="font-sans text-slate-600 dark:text-slate-300">
        <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
          Larger groups: the damped inner loop
        </summary>
        <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
          <p>
            The one- and two-play-space cases above are closed forms: one shot, no
            iteration. A larger conflict group has no closed form, so the solver fits{" "}
            <Latex>{String.raw`\mathbf q_g`}</Latex> with an inner loop, projecting,
            comparing against the demand, and damping partway toward the correction
            each pass (the inner step <Latex>{String.raw`\eta`}</Latex>). This loop
            runs inside Step 6 of every outer fixed-point pass.
          </p>
          <p>
            In this generic update, <Latex>{String.raw`\pi^{\mathrm{demand}}_p`}</Latex> is the
            requested occupancy for play space <Latex>{String.raw`p`}</Latex>, and{" "}
            <Latex>{String.raw`\mathbf q_g`}</Latex> is the vector of local fill chances for conflict
            group <Latex>{String.raw`g`}</Latex>.{" "}
            <Latex>{String.raw`\mu_g(\mathbf q_g,x)`}</Latex> is the stationary probability of valid
            state <Latex>{String.raw`x`}</Latex> under those fill chances, and{" "}
            <Latex>{String.raw`Q`}</Latex> is the one-play-space inverse used as a fallback correction.
          </p>
          <Latex display>{LATEX_COMPONENT_DAMPED_UPDATE}</Latex>
          <p>
            <Latex>{String.raw`\widehat{\pi}_p`}</Latex> is the occupancy produced by the current
            local fill chances, <Latex>{String.raw`\widetilde q`}</Latex> is the raw correction, and{" "}
            <Latex>{String.raw`\eta`}</Latex> is the damping step that moves only partway each pass.
          </p>
          <Latex display>{LATEX_COMPONENT_PROJECTED_PI}</Latex>
          <p>
            The projected occupancy is the expected occupancy of the valid-state chain induced by the
            final local fill chances.
          </p>
        </div>
      </details>
      <p>
        <Latex>{String.raw`\pi^{\mathrm{projected}}_p`}</Latex> is the play space occupancy the
        chosen fill chances actually deliver. The share-back hands each cat its slice of it:
      </p>
      <Latex display>{LATEX_COMPONENT_SHARE_BETA}</Latex>
      <p>
        Each cat gets the same share it held in the original demand. This share-back is the actual
        output the next pass reads, and it applies whichever way the fill chances were found, closed
        form or loop.
      </p>
    </>
  )
}

export function SolverLoopSummaryFormulas() {
  return (
    <details className="font-sans text-slate-600 dark:text-slate-300">
      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
        Short formula version of the loop
      </summary>
      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
        <p>
          This is the same walkthrough compressed into one reference block after the pieces have
          been introduced.
        </p>
        <p>
          Legend: <Latex>{String.raw`\lambda`}</Latex> is the outer-loop damping step,{" "}
          <Latex>{String.raw`\eta`}</Latex> is the inner conflict-group damping step,{" "}
          <Latex>{String.raw`\widehat{\pi}`}</Latex> is projected occupancy from the current
          valid-state chain, <Latex>{String.raw`\mu_g`}</Latex> is that chain&rsquo;s state
          distribution, <Latex>{String.raw`Q`}</Latex> is the one-play-space inverse,{" "}
          <Latex>{String.raw`\operatorname{catOpen}`}</Latex> is Step 1&rsquo;s
          cat-conditioned open chance and{" "}
          <Latex>{String.raw`\operatorname{draw}`}</Latex> is Step 2&rsquo;s draw
          chance, and{" "}
          <Latex>{String.raw`\operatorname{share}_{cp}`}</Latex> gives each cat back its share of
          the feasible play space occupancy.
        </p>
        <Latex display>{LATEX_LOOP_SUMMARY}</Latex>
      </div>
    </details>
  )
}
