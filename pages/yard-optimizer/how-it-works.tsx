import Head from "next/head"
import { useEffect, type ReactNode } from "react"
import FormattedLink from "../../components/FormattedLink"
import {
  ComponentSolverDampedUpdate,
  ComponentSolverShortcutsDetails,
  SolverLoopSummaryFormulas,
} from "../../components/yardOptimizer/howItWorks/ComponentSolverDerivation"
import {
  C_NSMALL_3,
  C_NSMALL_5,
  N_LARGE,
  N_SMALL,
  N_TOY,
  ONE_LARGE_THREE_SMALL_LAYOUTS,
  SIDE_TOY_LAYOUTS,
  SIDE_TOY_LAYOUTS_LABEL,
  TWO_SIDE_TOY_LAYOUTS_NO_DUPES,
  YARD_BRUTE_FORCE_YEARS_LABEL,
  YARD_COUNT_ORDER,
  YARD_ORDER_MAG_LABEL,
} from "../../components/yardOptimizer/howItWorks/exampleData"
import {
  AdjustedDrawExample,
  CrossoverExample,
  FooterDedicationCats,
  InlineGoodieName,
  TinyOptimizerExample,
} from "../../components/yardOptimizer/howItWorks/interactiveExamples"
import { Callout, Latex } from "../../components/yardOptimizer/howItWorks/primitives"
import CatFace from "../../components/CatFaceName"

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="space-y-3 scroll-mt-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-300 font-semibold">
          {eyebrow}
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
          {title}
        </h2>
      </div>
      <div className="space-y-3 text-slate-700 dark:text-slate-300 leading-relaxed">
        {children}
      </div>
    </section>
  )
}


function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/50 px-4 py-3">
      <div className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
        {value}
      </div>
      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
        {label}
      </div>
    </div>
  )
}

function StepCard({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/40 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-sm font-bold text-blue-700 dark:text-blue-200">
          {number}
        </span>
        <div className="space-y-1.5">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h3>
          <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function FormulaLine({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
        {children}
      </p>
    </div>
  )
}

/**
 * Inline tag rendered above a `<Latex display>` to mark how literal the formula
 * is. See the legend at the top of the analytic walkthrough for the spectrum
 * (definition / identity / mean-field exact / approximation).
 */
function FormulaTag({
  kind,
  note,
}: {
  kind: "definition" | "identity" | "mf-exact" | "approximation"
  note?: string
}) {
  const palettes = {
    definition:
      "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100",
    identity:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-100",
    "mf-exact":
      "bg-blue-100 text-blue-800 dark:bg-blue-900/70 dark:text-blue-100",
    approximation:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-100",
  } as const
  const labels = {
    definition: "definition",
    identity: "identity",
    "mf-exact": "mean-field exact",
    approximation: "approximation",
  } as const
  return (
    <div className="-mb-1 -mt-1 flex flex-wrap items-baseline gap-2">
      <span
        className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${palettes[kind]}`}
      >
        {labels[kind]}
      </span>
      {note ? (
        <span className="text-[11px] text-slate-500 dark:text-slate-400">{note}</span>
      ) : null}
    </div>
  )
}

function LifecycleNode({
  children,
  tone = "default",
}: {
  children: ReactNode
  tone?: "default" | "decision" | "terminal"
}) {
  const toneClass = {
    default: "bg-slate-50 dark:bg-slate-950/60",
    decision: "bg-blue-50 dark:bg-blue-950/50 border-blue-300 dark:border-blue-700",
    terminal:
      "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700",
  }[tone]

  return (
    <div
      className={`min-h-14 w-full rounded-lg border border-slate-300 dark:border-slate-600 ${toneClass} px-3 py-2 text-center text-[15px] leading-snug text-slate-800 dark:text-slate-100 flex items-center justify-center`}
    >
      {children}
    </div>
  )
}

function LifecycleDown({ label }: { label?: string }) {
  return (
    <div className="text-center text-slate-500 dark:text-slate-400">
      {label ? (
        <div className="text-[11px] font-semibold uppercase tracking-wide">
          {label}
        </div>
      ) : null}
      <div className="text-xl leading-none">↓</div>
    </div>
  )
}

function VisitLifecycleGraph() {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-900/5 dark:bg-slate-900/40 p-4">
      <div className="grid gap-3 pb-4 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950/60 p-3">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Cat selection inputs
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Each cat&rsquo;s attraction to this goodie, whether the goodie is
            damaged, and cat relationships with cats already playing.
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950/60 p-3">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Visit gate inputs
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Whether this play space or any conflicting play space is occupied, whether this
            is an indoor food play space, where the selected cat already is, and
            whether cooldown has expired.
          </p>
        </div>
        <div className="rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950/60 p-3">
          <p className="font-semibold text-slate-800 dark:text-slate-100">
            Visit probability inputs
          </p>
          <p className="mt-1 text-slate-600 dark:text-slate-300">
            Food staying power, goodie charm, and the current weather and
            seasonal modifiers.
          </p>
        </div>
      </div>

      <div className="mx-auto flex max-w-3xl flex-col items-center gap-2 border-t border-slate-300 pt-4 dark:border-slate-700">
        <div className="w-full max-w-xs">
          <LifecycleNode tone="terminal">
            For each play space at each tick
          </LifecycleNode>
        </div>
        <LifecycleDown />
        <div className="w-full max-w-md">
          <LifecycleNode>
            <span>
              <span className="font-semibold">
                Compute adjusted cat weights
              </span>
              <br />
              <span className="mt-1 block font-mono text-sm leading-relaxed">
                adjusted weight = base attraction × (100 + cat
                relationships from other playing cats)%
              </span>
            </span>
          </LifecycleNode>
        </div>
        <LifecycleDown />
        <div className="w-full max-w-xs">
          <LifecycleNode>Cat Selection weighted draw</LifecycleNode>
        </div>
        <LifecycleDown />
        <div className="w-full max-w-sm">
          <LifecycleNode tone="decision">
            <span>
              <span className="font-semibold">Can this cat visit?</span>
              <br />
              <span className="mt-1 block text-sm leading-relaxed">
                Uses play space conflicts, food placement, current occupancy, the
                selected cat&rsquo;s location, and cooldown state.
                <br />
                Must pass: play space empty; conflicts empty; not indoor food;
                cat not in cooldown; cat not playing elsewhere.
              </span>
            </span>
          </LifecycleNode>
        </div>

        <div className="grid w-full gap-4 pt-2 sm:grid-cols-2">
          <div className="flex flex-col items-center gap-2">
            <LifecycleDown label="no" />
            <LifecycleNode>No visit here</LifecycleNode>
            <LifecycleDown />
            <LifecycleNode tone="terminal">Next play space or tick</LifecycleNode>
          </div>
          <div className="flex flex-col items-center gap-2">
            <LifecycleDown label="yes" />
            <LifecycleNode>
              <span>
                <span className="font-semibold">Visit Probability roll</span>
                <br />
                <span className="mt-1 block font-mono text-sm leading-relaxed">
                  precomputed visit chance from food staying power, goodie
                  charm, weather, and season
                </span>
              </span>
            </LifecycleNode>
            <LifecycleDown />
            <LifecycleNode tone="decision">
              Does the cat visit?
            </LifecycleNode>
            <LifecycleDown label="yes" />
            <LifecycleNode>Cat visits and plays for stay duration</LifecycleNode>
            <LifecycleDown />
            <LifecycleNode>Leaves and starts cooldown</LifecycleNode>
            <LifecycleDown />
            <LifecycleNode tone="terminal">Pickable later</LifecycleNode>
          </div>
        </div>
      </div>
    </div>
  )
}

function Disclosure({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  return (
    <details className="group/concept-fold rounded-xl border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-2 list-none">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </span>
          {subtitle ? (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </span>
          ) : null}
        </span>
        <span
          className="text-slate-400 text-xs shrink-0 transition-transform group-open/concept-fold:rotate-180"
          aria-hidden
        >
          ▼
        </span>
      </summary>
      <div className="border-t border-slate-200 dark:border-slate-600 px-4 pb-4 pt-3 space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
        {children}
      </div>
    </details>
  )
}

const TOC_ACT_1: { href: string; label: string }[] = [
  { href: "#problem", label: "What are we even trying to do?" },
  { href: "#scoring", label: "Predict the cats: scoring one yard" },
  { href: "#mean-field", label: "Why the optimizer uses averages" },
]

const TOC_ACT_2: { href: string; label: string }[] = [
  { href: "#scale", label: "How big is the haystack?" },
  { href: "#search", label: "Now find a great yard" },
  { href: "#tricks", label: "How it stays fast enough" },
]

const TOC_POST: { href: string; label: string }[] = [
  { href: "#tubbs", label: "A note on Tubbs and the outdoor bowl" },
  { href: "#not-perfect", label: "What the optimizer does not know" },
  { href: "#learn-more", label: "Where to go next" },
]

function TocItem({
  href,
  label,
  index,
}: {
  href: string
  label: string
  index: number
}) {
  return (
    <li className="leading-snug">
      <span className="text-slate-400 dark:text-slate-500 mr-1.5 tabular-nums">
        {index}.
      </span>
      <a
        href={href}
        className="text-blue-700 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200 underline-offset-2 hover:underline"
      >
        {label}
      </a>
    </li>
  )
}

function TableOfContents() {
  return (
    <nav
      aria-label="Contents"
      className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-800/40 p-4 sm:p-5"
    >
      <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-3">
        Two acts &amp; a postscript
      </p>
      <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Act I &middot; Yard layout &rarr; ranking
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            How does one layout become comparable?
          </p>
          <ol className="space-y-1 text-sm">
            {TOC_ACT_1.map((it, i) => (
              <TocItem key={it.href} href={it.href} label={it.label} index={i + 1} />
            ))}
          </ol>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Act II &middot; Then, optimization
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Given that we can rank, how do we find a great layout?
          </p>
          <ol className="space-y-1 text-sm">
            {TOC_ACT_2.map((it, i) => (
              <TocItem
                key={it.href}
                href={it.href}
                label={it.label}
                index={TOC_ACT_1.length + i + 1}
              />
            ))}
          </ol>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-600">
        <p className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-semibold mb-1">
          Postscript
        </p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {TOC_POST.map((it) => (
            <li key={it.href}>
              <a
                href={it.href}
                className="text-blue-700 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200 underline-offset-2 hover:underline"
              >
                {it.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default function YardOptimizerHowItWorks() {
  // The math walkthrough lives inside collapsed <details> folds. Deep links
  // into it (e.g. the "see math →" links on the optimizer Analyzer model
  // panel point at #analytic-reach / #analytic-draw / #analytic-row-win) would
  // otherwise land on a closed fold and show nothing. On load and on hash
  // change, open every ancestor fold of the target, then scroll it into view.
  useEffect(() => {
    function revealHashTarget() {
      const { hash } = window.location
      if (!hash) return
      let id
      try {
        id = decodeURIComponent(hash.slice(1))
      } catch {
        id = hash.slice(1) // malformed escape (e.g. "#%"), use the raw value
      }
      const target = document.getElementById(id)
      if (!target) return
      for (
        let node: HTMLElement | null = target;
        node;
        node = node.parentElement
      ) {
        if (node instanceof HTMLDetailsElement) node.open = true
      }
      // Wait one frame so the freshly-opened folds lay out before we scroll;
      // scrollIntoView honors the targets' scroll-mt offset.
      requestAnimationFrame(() => target.scrollIntoView())
    }
    revealHashTarget()
    window.addEventListener("hashchange", revealHashTarget)
    return () => window.removeEventListener("hashchange", revealHashTarget)
  }, [])

  return (
    <main className="w-full max-w-4xl">
      <Head>
        <title>How does the yard optimizer work? - NekoDB</title>
        <meta
          name="description"
          content="A friendly tour of the math, computer science, and game logic behind the Neko Atsume 2 yard optimizer."
        />
        <meta
          property="og:title"
          content="How does the yard optimizer work? - NekoDB"
        />
        <meta
          property="og:description"
          content="A friendly tour of the math, computer science, and game logic behind the yard optimizer."
        />
      </Head>

      <div className="space-y-10">
        <header className="space-y-4">
          <p className="text-xs uppercase tracking-widest text-blue-600 dark:text-blue-300 font-semibold">
            <FormattedLink href="/yard-optimizer" location="/yard-optimizer/how-it-works">
              &larr; Back to the yard optimizer
            </FormattedLink>
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
            How does the yard optimizer work?
          </h1>
          <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed">
            A friendly tour through the math, computer science, and game logic
            that quietly hum behind the &ldquo;Run optimizer&rdquo; button.
            No background required. If you&rsquo;ve ever wondered how
            machines find &ldquo;good enough&rdquo; answers to questions with
            astronomical numbers of possibilities, this is a small,
            self-contained example you can poke at.
          </p>
          <Callout tone="violet" title="Why it&rsquo;s here">
            <p>
              Every example below is sampled from the shipped cat and goodie
              tables: real cats, real goodies, real attraction weights. The
              point is to make the optimizer feel less like a mysterious button
              and more like a set of yard decisions you can follow.
            </p>
          </Callout>
          <TableOfContents />
        </header>

        <Section
          id="problem"
          eyebrow="The problem"
          title="What are we even trying to do?"
        >
          <p>
            A yard has <strong>two halves</strong> (indoor and outdoor),{" "}
            <strong>five play spaces each</strong> (a large goodie, or toy,
            uses two), and{" "}
            <strong>one food bowl per side</strong>. You pick an{" "}
            <strong>objective</strong>, the single result the optimizer
            ranks by: most fish, most visits from your favorite cats, or fastest
            mementos (keepsake gifts from cats). A{" "}
            <strong>secondary objective</strong> breaks near-ties.
            The optimizer searches for the layout that ranks
            best for your objective, while accounting for any rules you set
            (required goodies, food types, minimum income, etc.).
          </p>
          <p>
            That sounds simple, but it turns into two linked questions
            that we take in order:
          </p>
          <ol className="list-decimal pl-6 space-y-1">
            <li>
              <strong>Yard layout &rarr; ranking.</strong> For one specific
              yard, how do we compute meaningful numbers for it?
            </li>
            <li>
              <strong>Then, the search.</strong> Given that we can rank a
              yard, how do we find a great one when there are far too many to
              check by hand? (This is the optimization half.)
            </li>
          </ol>
        </Section>

        <Section
          id="scoring"
          eyebrow="Act I &middot; Yard layout &rarr; ranking"
          title="To know which yard fits your objective, you have to predict the cats"
        >
          <p>
            Start with ranking: before we worry about searching, we have to be
            able to look at one yard and decide how it compares to another yard.
          </p>
          <p>
            The scorer is not trying to predict the next exact cat. It is
            trying to estimate the long-run pattern: which cats spend time on
            which play spaces, and how often.
          </p>
          <p>
            For Neko Atsume 2, that means simulating which cats are likely to
            show up. The game itself is not random magic; cats
            are picked by a defined procedure, and the optimizer follows that
            procedure closely enough to compare layouts.
          </p>
          <p>
            One important wrinkle: cats are not independent. Some cats make
            others more or less likely to appear. Before picking a candidate,
            the game adjusts each cat&rsquo;s attraction weight by the{" "}
            <strong>cat relationship</strong>: the boost or penalty other
            playing cats apply to its chance of being picked. So &ldquo;who
            visits next?&rdquo; depends partly on &ldquo;who is already
            here?&rdquo; Some goodies span several play spaces and host more
            than one cat, and the game &ldquo;draws&rdquo; a candidate by
            weight. The example below shows that adjustment before we zoom in
            on a single play space.
          </p>
          <AdjustedDrawExample />

          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 pt-1">
            One play space, one tick
          </h3>
          <p>
            Think of the game as moving in small, regular time steps called{" "}
            <strong>ticks</strong>. At every tick, for each play space in the yard,
            the visit logic works in this order:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <StepCard number="1" title="Pick a candidate cat">
              <p>
                Each cat has a base attraction weight for this play space, then
                that weight is adjusted by the cat relationship from
                cats already playing. Higher adjusted weight means the cat is
                more likely to be considered here.
              </p>
            </StepCard>
            <StepCard number="2" title="Check whether the visit is allowed">
              <p>
                The play space must be empty, along with any overlapping play
                space, and the chosen cat must be free: not playing elsewhere,
                and not on cooldown.
              </p>
            </StepCard>
            <StepCard number="3" title="Roll yes/no for the visit">
              <p>
                If the cat is allowed to come, the game makes one yes/no check.
                The chance comes from how long the food lasts, how attractive
                the goodie is, and the current weather or season bonus.
              </p>
            </StepCard>
            <StepCard number="4" title="Carry time forward">
              <p>
                A visiting cat occupies the play space for its stay duration.
                After leaving, it waits through cooldown before becoming
                available again.
              </p>
            </StepCard>
          </div>

          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 text-sm leading-relaxed dark:border-slate-600 dark:bg-slate-900/30">
            <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
              Why the order matters
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Picking a cat (the first card above) happens before the
              free-to-visit check (the second card). If the game picks a cat
              that is already busy elsewhere or on cooldown, the play space
              stays empty for this tick and no other cat gets a second chance. A
              popular cat with a strong draw weight (its attraction weight from
              the first card) can therefore crowd out its yardmates even on
              ticks where it does not actually visit.
            </p>
          </div>

          <Disclosure title="Visit lifecycle" subtitle="Plain-language flow chart">
            <p>
              This diagram keeps the game-flow names, but makes the path
              readable. Read it top to bottom. First the game picks a
              candidate cat, then it checks whether that cat is allowed to
              visit. After that, it rolls the visit probability and carries
              the visit lifecycle forward.
            </p>
            <VisitLifecycleGraph />
          </Disclosure>

          <p>
            That four-step cycle is the small version of the problem. On one
            play space, the scorer estimates whether a visit starts. Across the whole
            yard, it repeats that estimate for every cat and play space until the
            yard has stable visit rates. The hard part is that each estimate
            changes the others.
          </p>

        </Section>

        <Section
          id="mean-field"
          eyebrow="Act I &middot; Yard layout &rarr; ranking"
          title="Why the optimizer uses averages"
        >
          <p>
            The four-step visit cycle is manageable for one cat and one
            play space. A full yard adds two kinds of feedback:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <StepCard number="A" title="Cats affect cats">
              <p>
                The cat chosen for a play space depends partly on which cats
                are already playing. Some cats make other cats more likely;
                some make them less likely. That means the answer to &ldquo;who
                visits?&rdquo; depends on the answer to &ldquo;who is already
                there?&rdquo;
              </p>
            </StepCard>
            <StepCard number="B" title="Cooldown remembers the recent past">
              <p>
                A cat that visited recently is temporarily unavailable. Its
                chance of visiting now depends on how often it has
                been visiting lately.
              </p>
            </StepCard>
          </div>
          <p>
            That is why the scorer cannot just multiply the percentages once
            and be done. In a full yard, cat probabilities produce
            occupied play spaces, occupied play spaces change cat probabilities,
            and cooldown changes availability.
          </p>
          <p>
            <strong>Mean-field</strong> is the approximation that makes this
            fast enough to use. Rather than simulate every exact timeline,
            it gives each cat an average view of the rest of the yard. The
            averages look like &ldquo;this other cat is here 8% of the time&rdquo;
            and &ldquo;that play space is occupied 34% of the time&rdquo; (so open
            the other 66%).
          </p>

          <p>
            This is how one messy yard turns into stable numbers the optimizer
            can compare. Guess the average yard, score against that guess,
            update the guess, and stop when another pass barely changes
            anything.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <StepCard number="1" title="Start with a guess">
              <p>
                Guess how often every cat occupies every play space. It does not
                need to be perfect; it just gives the equations
                something to evaluate.
              </p>
            </StepCard>
            <StepCard number="2" title="Score the yard against that average">
              <p>
                For each cat and play space, compute the visit chance as if the
                rest of the yard were sitting at those average occupancy
                levels.
              </p>
            </StepCard>
            <StepCard number="3" title="Update the averages">
              <p>
                Those new visit chances imply new occupancies and cooldown
                rates. The solver blends the new values with the old values so
                the numbers do not bounce around.
              </p>
            </StepCard>
            <StepCard number="4" title="Repeat until stable">
              <p>
                When another pass barely changes the numbers, the solver has a
                self-consistent picture of the average yard.
              </p>
            </StepCard>
          </div>

          <p>
            The scorer keeps repeating those passes, up to 2,000,
            until the averages stop changing. That stable state is called a{" "}
            <strong>fixed point</strong>: feeding the averages back in returns
            almost the same averages. (Act II calls this averages loop the{" "}
            <strong>fixed-point solver</strong>.) The result is a table of chances: how
            likely each cat is to be on each play space. The optimizer turns that
            table into expected fish, visits, and memento progress.
          </p>
          <p>
            Now one layout has numbers the optimizer can compare: expected
            fish, target-cat visit counts, and memento timing estimates. It
            does not collapse them into one mysterious score right away. First
            it removes layouts that break your rules. Then it ranks the
            remaining layouts by your selected objective, using the{" "}
            <strong>secondary objective</strong> (the tie-breaker from the start
            of the page) only when results are close.
          </p>
          <Disclosure title="Ranking tie-breakers" subtitle="Optional detail">
            <p>
              The exact comparison order is still fixed. Hard rejects come
              first, unreachable memento targets and missed minimum requirements
              come next, then the selected objective, then the secondary objective as the
              final tie-breaker.
            </p>
            <FormulaLine label="Layout comparison order">
              impossible layouts, unreachable mementos, missed minimums, selected objective, secondary objective
            </FormulaLine>
          </Disclosure>

          <Disclosure
            title="Why cooldown adds memory"
            subtitle="Optional preview"
          >
            <p>
              If cats had <strong>no cooldown</strong>, the solver could mostly
              ask whether a cat is currently playing. If the cat is not playing,
              it can be drawn again.
            </p>
            <p>
              Cooldown makes the past matter. A cat that just visited can be
              gone from the yard but still unavailable for a while. That means
              the scorer has to keep recalculating: current occupancy affects
              new visits, new visits affect cooldown, and cooldown affects the
              next round of visits. The visiting-fraction step in the full
              walkthrough below turns that into the exact timing formula.
            </p>
          </Disclosure>

          <Disclosure
            title="How scoring estimates visits"
            subtitle="The full derivation &middot; long, math-heavy"
          >
            <p>
              This is the same averages loop from above: the page&rsquo;s
              fixed-point solver, which the tool&rsquo;s Analyzer model panel
              tunes. It starts with a guess about where cats are, estimates
              visits from that guess, turns those visits into a new guess, and
              repeats until the guess barely changes.
            </p>
            <p>
              The default below makes two choices, both explained in the steps:
              an overlap-aware estimate of when a goodie is open, and a
              mean-field draw for which cat sits down.
            </p>
            <p>A few names repeat through the walkthrough:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                the <strong>visit roll</strong> is the game&rsquo;s yes/no roll;
              </li>
              <li>
                the <strong>raw claim</strong> is open opportunity × drawn
                cat × visit roll;
              </li>
              <li>
                the <strong>real arrival</strong> is that claim after
                one-cat-one-play-space cleanup;
              </li>
              <li>
                the <strong>visiting fraction</strong> is how those arrivals
                turn into on-yard occupancy.
              </li>
            </ul>
            <p>
              Cooldown appears in the timing formula because it delays the next
              visit.
            </p>
            <details id="formula-legend" className="font-sans">
              <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                What the badges next to each formula mean
              </summary>
              <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 text-xs leading-relaxed">
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Each significant formula below carries a small tag so you know
                what kind of statement it is. Everything in the walkthrough is
                built on top of the mean-field assumption introduced earlier in
                this section, so &ldquo;exact&rdquo; here always means
                &ldquo;exact <em>given</em> that assumption&rdquo;.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                <li>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-100">
                    definition
                  </span>{" "}
                  just gives a name to a quantity, no claim about how it is
                  computed.
                </li>
                <li>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-800 dark:bg-emerald-900/70 dark:text-emerald-100">
                    identity
                  </span>{" "}
                  is a pure algebraic equality that would hold even without any
                  approximation (for example, the order-statistic integral in
                  Step 4).
                </li>
                <li>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10.5px] font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                    mean-field exact
                  </span>{" "}
                  is exact <em>given</em> the mean-field independence
                  assumption, with no further approximation beyond what the
                  &ldquo;why averages&rdquo; section already announced.
                </li>
                <li>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800 dark:bg-amber-900/70 dark:text-amber-100">
                    approximation
                  </span>{" "}
                  introduces an extra approximation on top of mean-field: a
                  closed-form replacement, a truncation, or a heuristic that
                  the test set says is safe.
                </li>
              </ul>
              <p className="mt-3 text-slate-600 dark:text-slate-300">
                What is every formula checked against? A{" "}
                <strong>tick simulator</strong>: a slower play-out of the same
                yard that drops thousands of random cats in one five-minute tick
                at a time and tallies what they earn. That play-out is the
                ground truth; the closed-form formulas are the fast estimate of
                it. When an <em>approximation</em> note says &ldquo;the
                gap,&rdquo; it means the place the formula&rsquo;s assumption
                parts from that simulator, so the note both states the shortcut
                and names where it bends. A small gap is why the result is a lead
                to test in your own yard, not a guarantee.
              </p>
              </div>
            </details>
            <details id="symbol-glossary" className="font-sans">
              <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                Symbols used in this walkthrough
              </summary>
              <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 text-xs leading-relaxed">
              <p className="mb-2 text-slate-600 dark:text-slate-300">
                Everything below carries a cat index{" "}
                <Latex>{String.raw`c`}</Latex> and a play-space index{" "}
                <Latex>{String.raw`p`}</Latex> (with{" "}
                <Latex>{String.raw`q`}</Latex> a second, possibly conflicting
                play space). These are the quantities that recur across the six
                steps; smaller symbols are defined where they first appear. You
                can also jump straight to a step from the optimizer&rsquo;s
                Analyzer model panel.
              </p>
              <div className="grid gap-x-4 gap-y-1 text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                <div>
                  <Latex>{String.raw`w_{cp}`}</Latex>, base draw weight:
                  cat <Latex>{String.raw`c`}</Latex>&rsquo;s lottery slice at{" "}
                  <Latex>{String.raw`p`}</Latex>
                </div>
                <div>
                  <Latex>{String.raw`v_{cp}`}</Latex>, per-tick visit
                  chance (food staying power, charm, weather)
                </div>
                <div>
                  <Latex>{String.raw`\beta_{cp}`}</Latex>, occupancy
                  fraction; every reported number is built from it
                </div>
                <div>
                  <Latex>{String.raw`O_p`}</Latex>, shared open
                  opportunity for <Latex>{String.raw`p`}</Latex> (Step 1)
                </div>
                <div>
                  <Latex>{String.raw`B_{cp}`}</Latex>,{" "}
                  <Latex>{String.raw`c`}</Latex>&rsquo;s blocker mass around{" "}
                  <Latex>{String.raw`p`}</Latex> (Step 1)
                </div>
                <div>
                  <Latex>{String.raw`G_{cp}`}</Latex>,{" "}
                  <Latex>{String.raw`c`}</Latex>&rsquo;s cat-conditioned open
                  chance (Step 1)
                </div>
                <div>
                  <Latex>{String.raw`D_{cp}`}</Latex>,{" "}
                  <Latex>{String.raw`c`}</Latex>&rsquo;s draw chance at{" "}
                  <Latex>{String.raw`p`}</Latex> (Step 2)
                </div>
                <div>
                  <Latex>{String.raw`u_{cp}`}</Latex>, raw claim:{" "}
                  <Latex>{String.raw`G_{cp}D_{cp}v_{cp}`}</Latex> (Step 3)
                </div>
                <div>
                  <Latex>{String.raw`r_{cp}`}</Latex>, real arrival after
                  one-cat-one-play-space cleanup (Step 4)
                </div>
                <div>
                  <Latex>{String.raw`\rho_c`}</Latex>, visiting fraction:
                  share of the day <Latex>{String.raw`c`}</Latex> is on the yard
                  (Step 5)
                </div>
                <div>
                  <Latex>{String.raw`\pi_p`}</Latex>, total occupancy of{" "}
                  <Latex>{String.raw`p`}</Latex> across cats (Step 6 builds it
                  as <Latex>{String.raw`\pi^{\mathrm{demand}}_p`}</Latex>)
                </div>
                <div>
                  <Latex>{String.raw`s`}</Latex>, mean stay length in
                  ticks (Step 5); <Latex>{String.raw`d_c`}</Latex>, cat{" "}
                  <Latex>{String.raw`c`}</Latex>&rsquo;s cooldown after a visit
                </div>
                <div>
                  <Latex>{String.raw`C`}</Latex>, the set of all cats;{" "}
                  <Latex>{String.raw`\mathcal C`}</Latex>, one conflict
                  component (a group of mutually overlapping play spaces)
                </div>
              </div>
            </div>
            </details>
            <details className="font-sans">
                  <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                    Reference: tracked quantities, model knobs, and benchmark yards
                  </summary>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 text-sm leading-relaxed space-y-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                      Three quantities the solver tracks
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      For every (cat, play space) pair the solver carries
                      three numbers, indexed by cat{" "}
                      <Latex>{String.raw`c`}</Latex> and play space{" "}
                      <Latex>{String.raw`p`}</Latex>:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                      <li>
                        <Latex>{String.raw`w_{cp}`}</Latex>, the{" "}
                        <em>draw weight</em>: the cat&rsquo;s slice of the
                        lottery wheel at this play space. Not a probability on
                        its own.
                      </li>
                      <li>
                        <Latex>{String.raw`v_{cp}`}</Latex>, the per-tick{" "}
                        <em>visit chance</em>: food staying power, charm, and
                        weather rolled into one probability between 0 and 1.
                      </li>
                      <li>
                        <Latex>{String.raw`\beta_{cp}`}</Latex>, the{" "}
                        <em>occupancy fraction</em>: what share of all ticks
                        in a day has this cat at this play space. Everything
                        the optimizer reports (expected fish, visit counts,
                        memento timing) is built from{" "}
                        <Latex>{String.raw`\beta_{cp}`}</Latex>.
                      </li>
                    </ul>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      A cat&rsquo;s{" "}
                      <Latex>{String.raw`\beta_{cp}`}</Latex> values do not
                      have to sum to 1 across play spaces. Any remainder is
                      idle or cooldown time, captured separately as the
                      cat&rsquo;s idle fraction.
                    </p>
                  </div>
                  <div className="border-t border-slate-200 pt-3 dark:border-slate-600">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                      Three knobs the Analyzer model panel controls
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 mb-2">
                      (The optimizer tool has an advanced <em>Analyzer model</em>{" "}
                      panel; the descriptions below correspond to its three
                      settings.) Each axis
                      replaces one formula in the loop below. Listed in step
                      order:
                    </p>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                      <li>
                        <strong>Chance a goodie is open (reachMode)</strong>:{" "}
                        Step 1. <em>Shared</em> uses the goodie&rsquo;s
                        overall open chance; <em>renormalized</em> also subtracts
                        the cat&rsquo;s own current visit, so a cat already there
                        does not block itself; <em>component-aware</em> uses
                        that subtraction where it is exact and the shared number
                        otherwise.
                      </li>
                      <li>
                        <strong>Which cat sits down (interactionMode)</strong>:{" "}
                        Step 2. <em>Mean-field</em> treats the other cats
                        as an average crowd; <em>cat-state-aware</em> averages
                        over which neighbors are actually present;{" "}
                        <em>sampled</em> estimates the same thing by simulation.
                      </li>
                      <li>
                        <strong>How cats split between overlapping goodies
                        (openGateMode)</strong>: Step 4.{" "}
                        <em>Per-goodie</em> treats each play space&rsquo;s gate on
                        its own; <em>whole-overlap-group</em> looks at which
                        goodies can be free together and gives partial credit
                        when an occupant leaves mid-tick.
                      </li>
                    </ul>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      The recommended combination on the panel, mean-field
                      draw, component-aware reach, and the whole-overlap-group
                      split (<code>meanField + componentAware + componentState</code>),
                      lands within about 0.41% of the Monte Carlo simulator on
                      a five-yard test set covering one real-world starting
                      layout, three high-yield yards the genetic optimizer
                      settles on, and a deliberate overlap-clique stress. The
                      yards are listed below.
                    </p>
                  </div>
                  <details>
                    <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                      Test yards used for the benchmark
                    </summary>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
                      <p>
                        Each yard fills both halves of a Neko Atsume yard
                        (one food bowl plus a few play spaces on the indoor
                        side, the same on the outdoor side; see &ldquo;What
                        are we even trying to do?&rdquo; at the top of the
                        page). The analyzer scores each yard, the Monte
                        Carlo simulator simulates it (96 runs × 35 in-game
                        days, fixed seed), and we compare. Two of the five
                        layouts are hand-picked stresses (a real-world
                        starting yard and a deliberate overlap clique). The
                        other three are produced by running the genetic
                        optimizer itself at fixed seeds and keeping the best
                        yard it finds, so the test bed includes the kind of
                        layout an actual Run-Optimizer session settles on.
                      </p>
                      <ol className="list-decimal pl-5 space-y-3">
                        <li>
                          <strong>Snyap&rsquo;s fav.</strong> A baseline
                          real-world layout with a few overlapping pairs.
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            <li>
                              <em>Indoor:</em> Deluxe Tuna Bitz (food bowl),
                              Tower of Treats, Instant Camera, Giant Cushion
                              (White), Stump House.
                            </li>
                            <li>
                              <em>Outdoor:</em> Ritzy Bitz (food bowl), Cat
                              Metropolis, Dice Cube, Bamboo House, Giant
                              Cushion.
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>GA-found high-yield (seed 42).</strong> A
                          layout the genetic optimizer settles on after a
                          fifty-generation, eighty-yard-pool run on the fish
                          objective, scored in net gold equivalent (gold plus the
                          gold value of silver fish, after food cost). Picks its
                          own foods.
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            <li>
                              <em>Indoor:</em> Ritzy Bitz (food bowl), Cat
                              Metropolis, Tiramisu Cube, Giant Cushion,
                              Dice Cube.
                            </li>
                            <li>
                              <em>Outdoor:</em> Thrifty Bitz (food bowl),
                              Shroom House (Green), Sushi Cushion (tuna),
                              Navy-blue Cube, Zanzibar Cushion, Christmas
                              Boots.
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>GA-found high-yield (seed 7).</strong>{" "}
                          Same optimizer budget at a different seed, so the
                          GA lands on a different overlap topology.
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            <li>
                              <em>Indoor:</em> Ritzy Bitz (food bowl), Cat
                              Metropolis, Bamboo House, Giant Cushion, Dice
                              Cube.
                            </li>
                            <li>
                              <em>Outdoor:</em> Frisky Bitz (food bowl),
                              Cardboard Train, Sushi Cushion (tuna),
                              Bamboo Rocket, Shroom House (Blue).
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>GA-found high-yield (seed 100).</strong>{" "}
                          Same budget again at a third seed.
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            <li>
                              <em>Indoor:</em> Ritzy Bitz (food bowl),
                              Bureau with Pot, Stump House, Dice Cube,
                              Giant Cushion (White).
                            </li>
                            <li>
                              <em>Outdoor:</em> Frisky Bitz (food bowl),
                              Cardboard Choo-choo, Shroom House (Red),
                              Pizza Cushion (Plain), Flower Basket.
                            </li>
                          </ul>
                        </li>
                        <li>
                          <strong>Cat trees and teasers on Sashimi Boat.</strong>{" "}
                          The indoor side packs one of the largest overlap
                          groups in the game (cat trees and condos all overlap
                          each other) and both bowls are stocked with one of the
                          priciest foods (Sashimi Boat). Stress-tests the clique case
                          and the high-attraction regime together.
                          <ul className="mt-1 list-disc pl-5 space-y-0.5">
                            <li>
                              <em>Indoor:</em> Sashimi Boat (food bowl),
                              Two-tier Cat Tree, Three-tier Cat Tree, Cat
                              Condo Complex, Cat Metropolis, Head Space.
                            </li>
                            <li>
                              <em>Outdoor:</em> Sashimi Boat (food bowl),
                              Tail-thing Teaser, Wing-thing Teaser, Mister
                              Mouse, Mister Dragonfly, Busy Bee.
                            </li>
                          </ul>
                        </li>
                      </ol>
                      <p>
                        Mean absolute error is averaged across the five
                        yards; per-yard numbers vary noticeably: the
                        GA-found high-yield yards (dense overlap) run hardest,
                        up to ~1.1% on a single yard, with the hand-curated ones
                        easier. The
                        simulator&rsquo;s own run-to-run noise is roughly
                        0.6&ndash;0.7% on these yards, so the recommended
                        bundle (~0.41%) sits below that floor.
                      </p>
                      <p>
                        <strong>Ablation methodology.</strong> Each badge on the
                        Analyzer model panel varies one option while the other
                        two stay recommended (mean-field draw, component-aware
                        reach, whole-overlap-group split), so the recommended
                        option on each axis matches the bundle baseline above and
                        each alternative shows the cost of swapping just that
                        axis. One side effect: under the recommended
                        overlap-group split, the state-conditional polynomial
                        absorbs almost all of the reach-axis effect, so the three
                        reach options score essentially the same here;
                        their differences appear only if the split is switched to
                        per-goodie, which is why the reach options carry no
                        accuracy badge.
                      </p>
                    </div>
                  </details>
                </div>
                </details>
            <div className="space-y-5">
              <section className="space-y-3">
                <p className="font-sans font-semibold">Repeat until the guesses settle</p>
                <p className="font-sans text-slate-600 dark:text-slate-300">
                  Follow one cat <Latex>{String.raw`c`}</Latex> and one play space{" "}
                  <Latex>{String.raw`p`}</Latex>. One loop pass has three
                  phases: estimate a raw visit claim, clean those claims into
                  real arrivals, then turn the arrivals back into the next
                  occupancy guess. The number the loop pins down is the
                  occupancy fraction <Latex>{String.raw`\beta_{cp}`}</Latex>{" "}
                  (what share of the day each cat spends at each play space), and
                  every result the optimizer reports (fish, visits, mementos) is
                  built from it. The six steps below unpack those phases.
                </p>
                <ol className="list-decimal pl-5 font-sans text-slate-600 dark:text-slate-300 space-y-4">
                  <li id="analytic-reach" className="scroll-mt-6">
                    <p>
                      <strong>Open opportunity.</strong> Start with how often
                      the play space itself has a chance to be filled
                      (we write the play space as{" "}
                      <Latex>{String.raw`p`}</Latex> in the formulas). It has an open opportunity
                      only when the component check can reach it: after possible
                      departures, shuffled fill order, and overlap rules. This
                      is a shared play-space-level question: if an overlapping
                      play space blocks this one, the game does not choose a cat
                      for this play space at all. The default solver then makes a
                      limited cat-specific correction so a cat&rsquo;s own current
                      visit is not counted again as an external blocker. The
                      output is this cat&rsquo;s open-chance for the play space
                      (the <Latex>{String.raw`G_{cp}`}</Latex> that Step 3
                      multiplies in).
                    </p>
                    <details>
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        How the solver decides whether a spot is open (reach modes)
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-4">
                        <p>
                          The symbols in this step are:{" "}
                          <Latex>{String.raw`c`}</Latex> for the cat,{" "}
                          <Latex>{String.raw`p`}</Latex> for the play space we
                          are checking, and <Latex>{String.raw`q`}</Latex> for
                          another play space that may conflict with it.{" "}
                          <Latex>{String.raw`O_p`}</Latex> is the shared
                          open-opportunity estimate: the current chance that
                          play space <Latex>{String.raw`p`}</Latex> is reachable
                          when its conflict component is checked, after possible
                          departures, earlier shuffled fills, and overlap rules.
                          It is not simply{" "}
                          <Latex>{String.raw`1-\text{occupancy}`}</Latex>.
                        </p>
                        <section className="space-y-2 border-l-4 border-blue-300 pl-4 dark:border-blue-500/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              Shared open opportunity
                            </p>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                              Used in the walkthrough
                            </span>
                          </div>
                          <FormulaTag
                            kind="definition"
                            note="just names the marginal open-opportunity that comes out of the component check"
                          />
                          <Latex display>{String.raw`O_p=\operatorname{openOpp}(p;\beta)`}</Latex>
                          <p>
                            Read this as &ldquo;the component check can reach this
                            play space.&rdquo; It does not depend on which cat will be
                            drawn. If an earlier fill or overlapping play space
                            blocks this play space, the play space is closed before any cat
                            is chosen. The cat-specific checks happen in the
                            following steps.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Renormalized (cat-conditioned) reach
                          </p>
                          <p>
                            For cat <Latex>{String.raw`c`}</Latex>, define its
                            current blocker mass around play space{" "}
                            <Latex>{String.raw`p`}</Latex>:
                          </p>
                          <FormulaTag kind="definition" />
                          <Latex display>{String.raw`
\begin{aligned}
B_{cp}
  &= \sum_{q\in \bar N(p)} \beta_{cq}.
\end{aligned}
`}</Latex>
                          <p>
                            Here <Latex>{String.raw`\bar N(p)`}</Latex> means{" "}
                            <Latex>{String.raw`p`}</Latex> plus any play spaces
                            that overlap it. The fully renormalized reach uses:
                          </p>
                          <FormulaTag
                            kind="mf-exact"
                            note="exact under the mean-field independence assumption: ‘p open’ and ‘c blocks p’ are mutually exclusive events, so conditioning rescales O_p"
                          />
                          <Latex display>{String.raw`
\begin{aligned}
G_{cp}^{\mathrm{norm}}
  &= \operatorname{clip}\!\left(
       \frac{O_p}{1-B_{cp}},0,1
     \right).
\end{aligned}
`}</Latex>
                          <p>
                            On an isolated play space this is the exact
                            self-availability correction: if the cat is currently
                            occupying that same play space, it is already
                            unavailable through the cooldown/visit cycle, so its
                            own occupancy should not also block its next
                            opportunity. (Whether dividing by{" "}
                            <Latex>{String.raw`1-B_{cp}`}</Latex> double-counts
                            downstream is settled at the row-win in Step 4.)
                          </p>
                        </section>
                        <section className="space-y-2 border-l-4 border-blue-300 pl-4 dark:border-blue-500/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">
                              Default component-aware rule
                            </p>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                              Current model
                            </span>
                          </div>
                          <FormulaTag
                            kind="approximation"
                            note="approximates each cat's true open chance at a play space. It uses the cat-specific renormalized reach G_cp^norm only where dividing by (1−B_cp) is provably safe: an isolated play space, zero cooldown, or a clique handled by the row-win. Elsewhere it falls back to one shared component open chance O_p. The gap: in that fallback every cat shares the component-average openness, so a cat blocked more or less than average is still treated as average."
                          />
                          <Latex display>{String.raw`
G_{cp}=
\begin{cases}
  G_{cp}^{\mathrm{norm}},
    & p\text{ is isolated, }d_c=0,\text{ or a clique under whole-overlap-group row-win},\\
  O_p,
    & \text{otherwise}.
\end{cases}
`}</Latex>
                          <p>
                            The renormalized form is exact on isolated play
                            spaces and when the cat&rsquo;s own cooldown{" "}
                            <Latex>{String.raw`d_c`}</Latex> is zero. The clique
                            branch only kicks in when Step 4 uses the
                            whole-overlap-group row-win; there the renormalization is
                            consistent with the state-conditional row average, so
                            the cat-conditioning is reapplied. Every other
                            component keeps the shared{" "}
                            <Latex>{String.raw`O_p`}</Latex>, because the scalar
                            denominator <Latex>{String.raw`1-B_{cp}`}</Latex>{" "}
                            collapses distinct multi-place open masks (V-shapes,
                            for instance) that the state-aware row-win can still
                            tell apart.
                          </p>
                        <section className="space-y-2 border-l-4 border-slate-300 pl-4 dark:border-slate-500/60">
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            The clique-under-whole-overlap-group branch above pairs
                            with the whole-overlap-group row-win in Step 4; that
                            section gives the polynomial and the mid-tick
                            &ldquo;occupant leaves&rdquo; credit that makes the
                            cat-conditioned reach consistent inside a clique.
                          </p>
                        </section>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Clique and non-clique conflict components
                          </p>
                          <p>
                            A clique component is a conflict group where every
                            play space conflicts with every other play space. A
                            two-play-space overlap is the smallest example:
                          </p>
                          <Latex display>{String.raw`
\begin{aligned}
\mathcal S_{\mathrm{pair}}=\{\emptyset,a,b\}.
\end{aligned}
`}</Latex>
                          <p>
                            A non-clique component can have more than one filled
                            play space at a time. In a V-shaped component, the two
                            leaves <Latex>{String.raw`L,R`}</Latex> do not
                            conflict, while the middle{" "}
                            <Latex>{String.raw`M`}</Latex> conflicts with both
                            (the component-projection fold derives this same
                            shape, writing the leaves{" "}
                            <Latex>{String.raw`a,b`}</Latex> and the middle{" "}
                            <Latex>{String.raw`m`}</Latex>):
                          </p>
                          <Latex display>{String.raw`
\begin{aligned}
L-M-R,\qquad
\mathcal S_{\mathrm V}=\{\emptyset,L,M,R,LR\}.
\end{aligned}
`}</Latex>
                          <p>
                            For a leaf, &ldquo;open because everything is empty&rdquo;
                            and &ldquo;open because the opposite leaf is filled&rdquo;
                            are different row-order situations. A single scalar
                            denominator collapses those states, so the default
                            keeps general non-clique components on the shared
                            component-level open chance instead of applying full
                            normalization everywhere.
                          </p>
                        </section>
                      </div>
                    </details>
                  </li>
                  <li id="analytic-draw" className="scroll-mt-6">
                    <p>
                      <strong>Draw chance.</strong> Estimate this cat&rsquo;s chance
                      of being chosen for the play space. The default draw method is
                      mean-field: it replaces the exact cats on sibling play spaces
                      with their average occupancy, then converts adjusted
                      attraction weights into chances that add up to 100%.
                    </p>
                    <FormulaTag
                      kind="approximation"
                      note="approximates this cat's true draw chance against whichever cats are actually on sibling play spaces. It swaps those real occupants for their average occupancy β and renormalizes the attraction weights to sum to 1. The gap: a sibling holds one specific cat per tick, not a blend, so averaging erases the link between which cats are present and who is drawn next."
                    />
                    <Latex display>{String.raw`
D_{cp}
  =
  \frac{\text{adjusted weight for cat }c\text{ on }p}
       {\text{total adjusted weight for }p}
`}</Latex>
                    <details>
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        How nearby cats change the draw chance (draw modes)
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-4">
                        <section className="space-y-3 border-l-4 border-blue-300 pl-4 dark:border-blue-500/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">
                              Mean-field
                            </p>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                              Used in the walkthrough
                            </span>
                          </div>
                          <p>
                            First, compute the average cat-relationship sum on cat{" "}
                            <Latex>{String.raw`c`}</Latex> at play space{" "}
                            <Latex>{String.raw`p`}</Latex>. Here{" "}
                            <Latex>{String.raw`\operatorname{sib}(p)`}</Latex> means the other
                            play spaces on the same multi-play-space goodie:
                          </p>
                          <div className="space-y-2">
                            <Latex display>{String.raw`
I_{cp}
  = \sum_{q\in \operatorname{sib}(p)}
     \sum_{k\in C}h_{ck}\beta_{kq}
`}</Latex>
                            <p>
                              Here <Latex>{String.raw`\beta_{kq}`}</Latex> is how
                              likely cat <Latex>{String.raw`k`}</Latex> is to be
                              on sibling play space{" "}
                              <Latex>{String.raw`q`}</Latex>, and{" "}
                              <Latex>{String.raw`h_{ck}`}</Latex> is that cat
                              pair&rsquo;s relationship value.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p>
                              Next, convert the cat-relationship sum into a
                              bounded multiplier:
                            </p>
                            <Latex display>{String.raw`
M_{cp}
  = \operatorname{clip}_{[0.30,4.00]}
     \left(1+\frac{I_{cp}}{100}\right)
`}</Latex>
                            <p>
                              A positive cat relationship raises the weight, a
                              negative one lowers it, and the clip keeps the
                              effect in the game-style range.
                            </p>
                          </div>
                          <div className="space-y-2">
                            <p>
                              Finally, adjust the base weights and normalize
                              them into a draw chance:
                            </p>
                            <Latex display>{String.raw`
D_{cp}
  = \frac{w_{cp}M_{cp}}
          {\sum_{j\in C}w_{jp}M_{jp}}
`}</Latex>
                            <p>
                              Cat <Latex>{String.raw`c`}</Latex>&rsquo;s adjusted
                              weight is compared with every cat that can draw
                              the same play space.
                            </p>
                          </div>
                        </section>
                        <p>
                          The rest of the loop only needs{" "}
                          <Latex>{String.raw`D_{cp}`}</Latex>, the draw chance,
                          so a variant draw method can swap in here without
                          changing the later steps. The walkthrough uses
                          mean-field; the two alternatives below,
                          cat-state-aware and its sampled approximation,
                          replace only this draw-chance step.
                        </p>
                            <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-600">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  Cat-state-aware
                                </p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  Comparison only
                                </span>
                              </div>
                              <p>
                                This design keeps two pieces of sibling-play-space
                                uncertainty: whether each nearby play space is
                                empty or occupied, and which cat is there. It
                                enumerates the states of the cats most likely to be
                                on those play spaces, up to a fixed cap (six by
                                default), averaging the draw over each layout by how
                                likely it is. When few cats are plausibly present
                                that cap covers them all, so the average is exact
                                under the current{" "}
                                <Latex>{String.raw`\beta`}</Latex> marginals; when
                                many are, it keeps the top few explicit and folds
                                the rest into an averaged tail.
                              </p>
                              <div className="space-y-2">
                                <p>
                                  First, name one possible sibling state and its
                                  probability:
                                </p>
                                <Latex display>{String.raw`
S_p\subseteq C,\qquad \mu_p(S)=\Pr(S_p=S)
`}</Latex>
                                <p>
                                  <Latex>{String.raw`S_p`}</Latex> is one possible
                                  nearby-play-space layout around play space{" "}
                                  <Latex>{String.raw`p`}</Latex>;{" "}
                                  <Latex>{String.raw`\mu_p(S)`}</Latex> is the
                                  chance of seeing that layout. For one- and
                                  two-sibling cases, the implementation keeps the
                                  play-space assignment exactly. For larger groups,
                                  it tracks the highest-mass cats explicitly and
                                  folds the rest into an averaged tail before the
                                  draw chance is averaged.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  Next, score cat <Latex>{String.raw`c`}</Latex>{" "}
                                  against the cats in that state:
                                </p>
                                <Latex display>{String.raw`
I_c(S)=\sum_{k\in S}h_{ck}
\quad\text{(plus an averaged tail for large groups)}
`}</Latex>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  Then, turn the state-specific cat-relationship sum
                                  into the same bounded weight multiplier used by
                                  the default method:
                                </p>
                                <Latex display>{String.raw`
M_c(S)
  = \operatorname{clip}_{[0.30,4.00]}
     \left(1+\frac{I_c(S)}{100}\right)
`}</Latex>
                                <p>
                                  This is the same boost-or-penalty step as
                                  mean-field, but now it is computed for one explicit
                                  sibling layout.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  For that one state, normalize the adjusted weights:
                                </p>
                                <Latex display>{String.raw`
\delta_{cp}(S)
  = \frac{w_{cp}M_c(S)}
          {\sum_{j\in C}w_{jp}M_j(S)}
`}</Latex>
                                <p>
                                  This gives the draw chance for cat{" "}
                                  <Latex>{String.raw`c`}</Latex> if the sibling
                                  layout is exactly <Latex>{String.raw`S`}</Latex>.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  Finally, average the state-level draw chances.
                                  For larger groups,{" "}
                                  <Latex>{String.raw`\mu_p`}</Latex> is the
                                  compressed explicit-cat state distribution plus
                                  an averaged tail, not the full exact state
                                  distribution.
                                </p>
                                <Latex display>{String.raw`
D_{cp}
  = \sum_S\mu_p(S)\delta_{cp}(S)
`}</Latex>
                                <p>
                                  Each state-level draw chance is weighted by how
                                  likely that sibling layout is.
                                </p>
                              </div>
                            <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-600">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-800 dark:text-slate-100">
                                  Sampled cat-state-aware
                                </p>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                  Comparison only
                                </span>
                              </div>
                              <p>
                                This design uses the same state-aware draw formula,
                                but estimates the average from{" "}
                                <Latex>{String.raw`N`}</Latex> sampled sibling
                                states. Each sibling play space is first sampled
                                as empty or occupied; occupied play spaces then
                                sample cats without reusing the same cat in two
                                sibling play spaces.
                              </p>
                              <div className="space-y-2">
                                <p>
                                  First, draw{" "}
                                  <Latex>{String.raw`N`}</Latex> possible sibling
                                  states from a sibling-state sampler based on
                                  the current <Latex>{String.raw`\beta`}</Latex>{" "}
                                  values.
                                </p>
                                <Latex display>{String.raw`
S^{(1)}_p,S^{(2)}_p,\ldots,S^{(N)}_p
  \sim\operatorname{sample}_{\beta,p}
`}</Latex>
                                <p>
                                  These sampled layouts stand in for the state
                                  average used by the cat-state-aware method.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  For each sibling play space, first decide whether
                                  that play space is occupied at all.
                                </p>
                                <Latex display>{String.raw`
\Pr(q\text{ is occupied})
  = \operatorname{clip}_{[0,1]}\!\left(\sum_k\beta_{kq}\right)
`}</Latex>
                                <p>
                                  The total occupancy estimate for sibling play space{" "}
                                  <Latex>{String.raw`q`}</Latex> becomes the chance
                                  that the sampled play space is filled.
                                </p>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  If a sibling play space is occupied, pick which
                                  cat is there using that play space&rsquo;s occupancy
                                  weights:
                                </p>
                                <Latex display>{String.raw`
\Pr(k\text{ chosen for occupied sibling }q\mid k\notin S)
  \propto\beta_{kq}
`}</Latex>
                              </div>
                              <div className="space-y-2">
                                <p>
                                  Finally, run the state-aware draw formula on each
                                  sampled state and average the results:
                                </p>
                                <Latex display>{String.raw`
D_{cp}
  = \frac{1}{N}\sum_{n=1}^N
     \delta_{cp}\!\left(S^{(n)}_p\right)
`}</Latex>
                                <p>
                                  This approximates the state-aware average with
                                  sampled layouts instead of enumerating or
                                  compressing all of them.
                                </p>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/30">
                                <p className="mb-1 font-semibold text-slate-800 dark:text-slate-100">
                                  Short formula version
                                </p>
                                <Latex display>{String.raw`
\begin{aligned}
S^{(1)}_p,S^{(2)}_p,\ldots,S^{(N)}_p
  &\sim\operatorname{sample}_{\beta,p}, \\
\Pr(q\text{ is occupied})
  &= \operatorname{clip}_{[0,1]}\!\left(\sum_k\beta_{kq}\right), \\
\Pr(k\text{ chosen for occupied sibling }q\mid k\notin S)
  &\propto\beta_{kq}, \\
D_{cp}
  &= \frac{1}{N}\sum_{n=1}^N
     \delta_{cp}\!\left(S^{(n)}_p\right).
\end{aligned}
`}</Latex>
                              </div>
                            <p className="border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-600 dark:text-slate-400">
                              An exposed <strong>debugging</strong> variant drops the
                              one-cat-per-play-space check from the sampler above,
                              letting two sibling play spaces draw the same cat
                              (impossible in the simulator). It biases the draw
                              toward the highest-occupancy cat, so it is available
                              as an experimental analyzer option but is not the
                              recommended setting.
                            </p>
                            </section>
                            </section>
                          </div>
                        </details>
                  </li>
                  <li>
                    <p>
                      <strong>Raw claim.</strong> Multiply the three pieces this
                      stage owns: the play space has an open opportunity, this cat is
                      drawn for the play space, and the visit roll succeeds.
                    </p>
                    <FormulaTag kind="definition" />
                    <Latex display>{String.raw`u_{cp}=G_{cp}D_{cp}v_{cp}`}</Latex>
                    <p>
                      That is all <Latex>{String.raw`u_{cp}`}</Latex> means
                      here: cat-conditioned open opportunity, drawn cat,
                      successful visit roll.
                      Step 4 keeps one cat from taking two play spaces in the same
                      tick, and Step 5 turns those arrivals into on-yard
                      visiting time.
                    </p>
                  </li>
                  <li id="analytic-row-win" className="scroll-mt-6">
                    <p>
                      <strong>Real arrival.</strong> Fix double-counting: this
                      is the row-win step (the panel&rsquo;s &ldquo;how cats
                      split between overlapping goodies&rdquo;). In one
                      lottery round, the same cat cannot take two play spaces, so if
                      several play spaces want the same cat, only one gets to count.
                      This is not the optimization target; it is a scoring
                      correction that keeps the visit estimate physically
                      possible. The real-arrival chance starts from the raw
                      claim, then adjusts it so one cat wins only one play space.
                    </p>
                    <details>
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        How ties between play spaces are broken
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-4">
                        <section className="space-y-2 border-t border-slate-200 pt-4 first:border-t-0 first:pt-0 dark:border-slate-600">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              Sample shuffled order
                            </p>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              Intuition only
                            </span>
                          </div>
                          <p>
                            A sampled alternative repeatedly shuffles the play
                            spaces and, in each shuffle, keeps only cat{" "}
                            <Latex>{String.raw`c`}</Latex>&rsquo;s first
                            successful claim, discarding the rest:
                          </p>
                          <Latex display>{String.raw`
\widehat{r}_{cp}
=\frac{1}{N}\sum_{n=1}^N
  \mathbf{1}\{p\text{ is the first successful claim for }c
  \text{ in shuffle }n\}
`}</Latex>
                          <p>
                            Averaging many shuffles estimates the tie-broken
                            chance for play space <Latex>{String.raw`p`}</Latex>.
                          </p>
                        </section>
                        <section className="space-y-2 border-l-4 border-blue-300 pl-4 dark:border-blue-500/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">
                              Per-goodie exact row average
                            </p>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                              openGateMode = perPlace
                            </span>
                          </div>
                          <p>
                            The calculator instead computes the exact average for
                            this row of claim chances:
                          </p>
                          <FormulaTag
                            kind="mf-exact"
                            note="shuffled-row average is exact in closed form given the per-play-space u_{cq} from the previous steps"
                          />
                          <Latex display>{String.raw`
r_{cp}
=u_{cp}\int_0^1\prod_{q\neq p}(1-u_{cq}t)\,dt
`}</Latex>
                          <p>
                            This removes Monte Carlo noise from the tie-break
                            step, though it does not make the earlier mean-field
                            estimates exact. Start with{" "}
                            <Latex>{String.raw`u_{cp}`}</Latex>, the rough
                            chance that cat <Latex>{String.raw`c`}</Latex> wants
                            play space <Latex>{String.raw`p`}</Latex>; the
                            product runs over the cat&rsquo;s other successful
                            claims.
                          </p>
                          <details className="font-sans text-slate-600 dark:text-slate-300">
                            <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                              Why the integral is the earliest-claim chance
                            </summary>
                            <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
                              <p>
                                Let <Latex>{String.raw`K`}</Latex> be the number
                                of other successful claims for the same cat under
                                the current row of claim chances{" "}
                                <Latex>{String.raw`u_{cq}`}</Latex>.
                              </p>
                              <FormulaTag
                                kind="identity"
                                note="purely algebraic: the order-statistic expectation has this closed-form integral representation"
                              />
                              <Latex display>{String.raw`
\mathbf{E}\!\left[\frac{1}{K+1}\right]
=\int_0^1\prod_{q\neq p}(1-u_{cq}t)\,dt
`}</Latex>
                              <p>
                                Play space <Latex>{String.raw`p`}</Latex> wins
                                only when it is earliest among the{" "}
                                <Latex>{String.raw`K+1`}</Latex> successful
                                claims, so the integral is exactly that expected
                                earliest-claim chance, in closed form. The
                                variable <Latex>{String.raw`t \in [0,1]`}</Latex>{" "}
                                is <Latex>{String.raw`p`}</Latex>&rsquo;s position
                                in the shuffle: <Latex>{String.raw`t=0`}</Latex>{" "}
                                means <Latex>{String.raw`p`}</Latex> is picked
                                first (no other place has fired yet), and{" "}
                                <Latex>{String.raw`t=1`}</Latex> means last (every
                                other place has had its full shot at the cat).
                              </p>
                            </div>
                          </details>
                        </section>
                        <section className="space-y-3 border-l-4 border-blue-300 pl-4 dark:border-blue-500/80">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-slate-900 dark:text-slate-50">
                              Whole-overlap-group row average
                            </p>
                            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800 dark:bg-blue-900/70 dark:text-blue-100">
                              openGateMode = componentState
                            </span>
                          </div>
                          <p>
                            The per-goodie row average treats each play space&rsquo;s
                            open opportunity as independent across the shuffled
                            visit order. In a conflict component the gates are
                            actually correlated: in a clique only one play space
                            can be open at a time, and in a V-shape the two
                            leaves move together with the center. The
                            whole-overlap-group row-win replaces that independence
                            with the component&rsquo;s actual joint state
                            distribution{" "}
                            <Latex>{String.raw`m_z = \Pr(\text{state}=z)`}</Latex>{" "}
                            taken from the mean-field component solver
                            (component-state mass, not to be confused with the
                            per-play-space occupancy{" "}
                            <Latex>{String.raw`\pi_p`}</Latex> from Step 6).
                          </p>
                          <p>
                            For each component <Latex>{String.raw`\mathcal C`}</Latex>,
                            cat <Latex>{String.raw`c`}</Latex>, and start-of-tick
                            state <Latex>{String.raw`z`}</Latex>, define the
                            in-state per-play-space success rate:
                          </p>
                          <Latex display>{String.raw`
\sigma_{cp}^{(z)} = o_{zp}\,D_{cp}\,v_{cp}\qquad\text{for }p\in\mathcal C
`}</Latex>
                          <p>
                            Inside a component the joint-state quantity{" "}
                            <Latex>{String.raw`o_{zp}`}</Latex> takes over from
                            the marginal cat-conditioned gate{" "}
                            <Latex>{String.raw`G_{cp}`}</Latex> used in Step 1,
                            so <Latex>{String.raw`\sigma_{cp}^{(z)}`}</Latex>{" "}
                            multiplies only <Latex>{String.raw`D_{cp}v_{cp}`}</Latex>{" "}
                            instead of the full{" "}
                            <Latex>{String.raw`u_{cp}`}</Latex>: each state-row
                            re-supplies the gate term directly.{" "}
                            <Latex>{String.raw`o_{zp}`}</Latex> is the component
                            summary&rsquo;s &ldquo;probability play space p is
                            available during this tick given start-of-tick state
                            z.&rdquo; This already includes the mid-tick
                            departure: even when state z shows{" "}
                            <Latex>{String.raw`p`}</Latex> occupied at the start,
                            the entry credits the chance the occupant&rsquo;s
                            stay timer ran out before the visit attempts ran.
                            For an isolated singleton (with{" "}
                            <Latex>{String.raw`s`}</Latex> the stay duration from
                            Step 5):
                          </p>
                          <FormulaTag
                            kind="approximation"
                            note="approximates the chance an occupied singleton frees up this tick by giving the cat a flat 1/s leave chance every tick (geometric departures). Instead, the simulator draws each stay as a bounded length, uniform on 5 to 14 ticks. The gap: a flat per-tick chance lets some stays end almost at once and others run long, while a real stay is always 5 to 14 ticks. Both average s = 9.5, so they differ only in the spread."
                          />
                          <Latex display>{String.raw`
\begin{aligned}
o_{\,\emptyset,p} &= 1,\qquad
o_{\,p,p} = \tfrac{1}{s}.
\end{aligned}
`}</Latex>
                          <p>
                            The row average then runs per-state and is
                            re-weighted by the state&rsquo;s probability
                            conditional on cat <Latex>{String.raw`c`}</Latex>{" "}
                            not occupying anything in the component:
                          </p>
                          <FormulaTag
                            kind="approximation"
                            note="the shuffled-row integral is exact under mean-field for each state; the state reweighting uses the mean-field replacement m_z(1−B_c^(z)), so the full expression remains an approximation"
                          />
                          <Latex display>{String.raw`
\begin{aligned}
\widetilde{m}_z
  &= m_z\,\mathbf 1\!\left[\text{no occupied place in state }z
       \text{ is held by cat }c\right]
   \approx m_z\,(1-B_{c}^{(z)}),\\
r_{cp}^{(\mathrm{cs})}
  &= \frac{1}{\sum_z \widetilde{m}_z}
     \sum_z \widetilde{m}_z\,\sigma_{cp}^{(z)}
     \int_0^1
       \prod_{q\in\mathcal C,\,q\neq p}\bigl(1-\sigma_{cq}^{(z)}t\bigr)
       \prod_{q\notin\mathcal C}\bigl(1-u_{cq}t\bigr)\,dt.
\end{aligned}
`}</Latex>
                          <p>
                            The first line replaces the indicator by its
                            mean-field expectation: under independence,{" "}
                            <Latex>{String.raw`B_{c}^{(z)}`}</Latex> is the
                            chance one of state{" "}
                            <Latex>{String.raw`z`}</Latex>&rsquo;s occupied
                            places is held by cat{" "}
                            <Latex>{String.raw`c`}</Latex> (a state-conditional
                            companion to <Latex>{String.raw`B_{cp}`}</Latex>,
                            indexed by state rather than place). For a clique
                            mask with at most one occupied place this is{" "}
                            <Latex>{String.raw`\beta_{cp}/\pi_p`}</Latex> (here{" "}
                            <Latex>{String.raw`\pi_p`}</Latex> is the realized
                            feasible occupancy of the play space, which equals
                            the demand sum <Latex>{String.raw`\pi^{\mathrm{demand}}_p`}</Latex>{" "}
                            only at the fixed point); for
                            non-clique masks the joint &ldquo;one cat → one
                            place&rdquo; correction does not cleanly factor and
                            the code skips the rescaling
                            (<Latex>{String.raw`B_{c}^{(z)}=0`}</Latex>),
                            keeping the raw state distribution.
                          </p>
                          <p>
                            Outside the row&rsquo;s component, attempts in other
                            components are independent of the cat&rsquo;s state,
                            so the integral picks up the same{" "}
                            <Latex>{String.raw`\prod_{q\notin\mathcal C}(1-u_{cq}t)`}</Latex>{" "}
                            factor that the per-goodie row average uses.
                          </p>
                          <p>
                            The combined effect: in a clique{" "}
                            <Latex>{String.raw`r_{cp}^{(\mathrm{cs})}`}</Latex>{" "}
                            collapses to &ldquo;all clique places empty&rdquo;
                            times{" "}
                            <Latex>{String.raw`D_{cp}v_{cp}`}</Latex> plus
                            mid-tick-departure credit; in a V-shape it
                            distinguishes &ldquo;everything empty&rdquo; from
                            &ldquo;the opposite leaf is occupied,&rdquo; which a
                            single scalar{" "}
                            <Latex>{String.raw`O_p`}</Latex> collapses. On the
                            five-yard test set in the reference fold above, the
                            mean absolute gap between the
                            fixed-point solver and the simulator falls from
                            about 0.61% of gold-equiv fish per day to about
                            0.41%, at roughly 2.8× the per-goodie row-win
                            cost.
                          </p>
                          <p>
                            That 2.8× is the cost of one solve. A full
                            optimization barely pays it: the genetic search
                            explores on the cheap per-goodie row-win and only
                            re-scores the final shortlist of survivors with the
                            whole-overlap-group model, so total search time is about
                            1.06× the per-goodie baseline, not 2×.
                          </p>
                        </section>
                      </div>
                    </details>
                    <details className="font-sans text-slate-600 dark:text-slate-300">
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        Why Step 1&rsquo;s reach correction does not cascade here
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-3">
                        <p>
                          Step 1&rsquo;s renormalized reach divides{" "}
                          <Latex>{String.raw`O_p`}</Latex> by{" "}
                          <Latex>{String.raw`1-B_{cp}`}</Latex>, where{" "}
                          <Latex>{String.raw`B_{cp}`}</Latex> is the chance{" "}
                          <Latex>{String.raw`c`}</Latex> is already in{" "}
                          <Latex>{String.raw`p`}</Latex> or an overlapping play
                          space. A natural worry: does that division leak into the
                          tie-break here? No. Conditioned on{" "}
                          <Latex>{String.raw`c`}</Latex> being available the claim
                          is{" "}
                          <Latex>{String.raw`u_{cp}^{\mathrm{cond}}=\tfrac{O_p}{1-B_{cp}}D_{cp}v_{cp}`}</Latex>,
                          but the tie-break needs the <em>unconditional</em> claim,
                          how often it exists at all, so it weights back by the
                          same <Latex>{String.raw`1-B_{cp}`}</Latex>:
                        </p>
                        <Latex display>{String.raw`\bar u_{cp}=(1-B_{cp})\,u_{cp}^{\mathrm{cond}}=O_pD_{cp}v_{cp},`}</Latex>
                        <p>
                          exactly the shared-open{" "}
                          <Latex>{String.raw`u_{cp}`}</Latex> the row-win already
                          uses. The factor divides in and multiplies back out, so
                          it never reaches Steps 4&ndash;6; feeding the conditional
                          claim in unweighted would double-count and overstate
                          arrivals. That cancellation is the motivation, not a
                          literal claim about every mode: per-goodie feeds the
                          clipped, case-split{" "}
                          <Latex>{String.raw`G_{cp}D_{cp}v_{cp}`}</Latex> straight
                          into the row-win, while the default whole-overlap-group
                          row-win re-supplies the gate per state as{" "}
                          <Latex>{String.raw`o_{zp}`}</Latex>, so{" "}
                          <Latex>{String.raw`G_{cp}`}</Latex> does not propagate
                          there.
                        </p>
                      </div>
                    </details>
                  </li>
                  <li>
                    <p>
                      <strong>Visiting fraction.</strong> Add up the cat&rsquo;s
                      real arrivals. Then estimate what fraction of the day the
                      cat is on the yard visiting. Cooldown is not counted as
                      visiting time, but it appears in the denominator because it
                      keeps the cat out of the lottery before the next visit.
                    </p>
                    <FormulaTag
                      kind="approximation"
                      note="approximates the visiting fraction of the day by treating every wait→visit→cooldown cycle as the same average length, so ρ_c is stay over mean cycle. The gap: real waits and stays vary run to run, and using only their means is exact only if every cycle were the average length."
                    />
                    <Latex display>{String.raw`
\begin{aligned}
r_c &= \sum_p r_{cp}, \\
\rho_c &= \frac{s}{\frac{1-r_c}{r_c}+s+d_c}.
\end{aligned}
`}</Latex>
                    <p>
                      <Latex>{String.raw`r_c`}</Latex> is the cat&rsquo;s total
                      real-arrival chance after same-cat cleanup;{" "}
                      <Latex>{String.raw`\rho_c`}</Latex> is the share of the day it
                      spends on the yard. The denominator adds waiting time, visit
                      time, and cooldown time, so cooldown lowers the visiting
                      fraction without counting as visiting. Step 6 multiplies both
                      in.
                    </p>
                    <details>
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        Visiting-fraction derivation
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-4">
                        <p>
                          The two formulas above come from treating each cat&rsquo;s
                          visits as a renewal cycle. Here is the build-up.
                        </p>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Arrival chance
                          </p>
                          <p>
                            First add the successful arrival chances across all
                            play spaces:
                          </p>
                          <Latex display>{String.raw`
\begin{aligned}
r_c&=\sum_p r_{cp}
\end{aligned}
`}</Latex>
                          <p>
                            This per-tick arrival chance is what the renewal
                            approximation below uses for cat{" "}
                            <Latex>{String.raw`c`}</Latex>.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Cycle view
                          </p>
                          <p>
                            Think of one cycle as waiting while the cat is
                            available, then spending{" "}
                            <Latex>{String.raw`s`}</Latex> ticks visiting, then
                            spending <Latex>{String.raw`d_c`}</Latex> ticks in
                            cooldown. The average available waiting time before a
                            successful arrival is{" "}
                            <Latex>{String.raw`(1-r_c)/r_c`}</Latex>.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Visiting fraction
                          </p>
                          <Latex display>{String.raw`
\begin{aligned}
\rho_c
&=
\frac{s}{\frac{1-r_c}{r_c}+s+d_c} \\
&=
\frac{s r_c}{1-r_c+r_c(s+d_c)}.
\end{aligned}
`}</Latex>
                          <p>
                            <Latex>{String.raw`\rho_c`}</Latex> is the visiting
                            fraction: the fraction of time cat{" "}
                            <Latex>{String.raw`c`}</Latex> is on the yard. The
                            numerator is the visiting part of the cycle.
                            The denominator is waiting time, visit time, and
                            cooldown time together, so cooldown reduces the
                            visiting fraction without being counted as visiting.
                          </p>
                        </section>
                      </div>
                    </details>
                  </li>
                  <li>
                    <p>
                      <strong>Next occupancy guess.</strong> Use the new
                      visiting-fraction estimate to update where cats are
                      probably sitting. Step 1 used last pass&rsquo;s open-opportunity
                      estimate; this step rebuilds that estimate for the next
                      pass. First sum the requested visiting occupancy per play space,
                      then keep only possible overlap states, then give each cat
                      back its share. The next guess is mostly the old guess plus
                      a small step toward the new estimate.
                    </p>
                    <details>
                      <summary className="cursor-pointer font-semibold text-slate-800 dark:text-slate-100">
                        How the new occupancy estimate is built
                      </summary>
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/50 p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900/25 space-y-4">
                        <p>
                          Each group of overlapping play spaces is solved as a
                          tiny yard of its own: the allowed states include empty
                          and compatible filled play spaces, but never two filled
                          play spaces that overlap.
                        </p>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Demand by cat and play space
                          </p>
                          <p>
                            Start by assigning cat <Latex>{String.raw`c`}</Latex>
                            &rsquo;s visiting fraction to each play space:
                          </p>
                          <FormulaTag kind="definition" />
                          <Latex display>{String.raw`
\begin{aligned}
\beta^{\mathrm{demand}}_{cp}
  &=
  \begin{cases}
    r_{cp}\dfrac{\rho_c}{r_c}, & r_c > 0, \\
    0, & r_c = 0,
  \end{cases}
\end{aligned}
`}</Latex>
                          <p>
                            This is the cat&rsquo;s claim on each play space before
                            checking whether the yard can actually fit everyone.
                            A cat&rsquo;s on-yard visiting time is split across the
                            play spaces where it is expected to arrive.
                          </p>
                          <Latex display>{String.raw`
\begin{aligned}
\pi^{\mathrm{demand}}_p
  &= \sum_c\beta^{\mathrm{demand}}_{cp}
\end{aligned}
`}</Latex>
                          <p>
                            Now all cats&rsquo; claims are added for one play space. This
                            can still be physically impossible if overlapping
                            play spaces all have high demand.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Feasible conflict states
                          </p>
                          <FormulaTag kind="definition" />
                          <Latex display>{String.raw`
\begin{aligned}
\mathcal{S}_g
  &= \{x\in\{0,1\}^{P_g}: x_i+x_j\le 1
      \text{ whenever } i\sim j\}
\end{aligned}
`}</Latex>
                          <p>
                            For each conflict group, keep only the yard snapshots
                            that can really happen. If two play spaces overlap, a
                            snapshot with both filled is not allowed.
                          </p>
                        </section>
                        <section className="space-y-2">
                          <p className="font-semibold text-slate-800 dark:text-slate-100">
                            Projection and share-back
                          </p>
                          <p>
                            Now the solver picks local fill chances for those
                            valid snapshots. Their stationary occupancy tries
                            to match the requested occupancy while allowing only
                            non-overlapping states. When the request is
                            physically impossible, the update backs off to
                            feasible occupancy.
                          </p>
                          <p>
                            Here <Latex>{String.raw`\mathbf q_g`}</Latex> is a
                            vector of local fill chances, one{" "}
                            <Latex>{String.raw`q_{g,p}`}</Latex> per play space
                            in conflict group <Latex>{String.raw`g`}</Latex>.
                            The solver repeatedly projects that vector through
                            the valid yard snapshots, compares the projected
                            occupancy with the requested occupancy, and nudges
                            the fill chances toward the correction.
                          </p>
                          <ComponentSolverShortcutsDetails />
                          <ComponentSolverDampedUpdate />
                        </section>
                      </div>
                    </details>
                  </li>
                </ol>
                <SolverLoopSummaryFormulas />
              </section>

            </div>
          </Disclosure>

        </Section>

        <Section
          id="scale"
          eyebrow="Act II &middot; Then, optimization"
          title="There are too many yards to try them all"
        >
          <p>
            Great. We can now turn one yard into numbers we can compare: check
            the rules, estimate your objective, and use the secondary objective as a
            tie-breaker. A harder question follows:{" "}
            <em>how many yards are there to even compare?</em>
          </p>
          <p>
            This rough count treats each side as either one large plus three
            small goodies, or five small goodies. The count prevents reusing a goodie
            across sides and tries 7 food choices per side.
          </p>
          <div className="grid sm:grid-cols-3 gap-3">
            <StatTile value={String(N_TOY)} label="non-food goodies in the pool" />
            <StatTile value={SIDE_TOY_LAYOUTS_LABEL} label="ways to fill one side of the yard" />
            <StatTile value={YARD_ORDER_MAG_LABEL} label="candidate yards in this counting model" />
          </div>
          <p>
            Even at a billion layouts per second, checking them all would take
            about <strong>{YARD_BRUTE_FORCE_YEARS_LABEL} years</strong>. The
            counting below is where that huge number comes from.
          </p>
          <p>
            That is the whole point of this section: the optimizer cannot try
            everything.
          </p>
          <Disclosure title="Where the huge number comes from" subtitle="Optional counting details">
            <p>
              That 10²⁰ is the size of this counting model, not just a guess. It
              already treats a goodie as something you can place only once in
              the full yard.
            </p>
            <p>
              Each yard side has 5 play spaces, and a large goodie uses 2. So each
              side is either <strong>1 large + 3 small</strong> or{" "}
              <strong>0 large + 5 small</strong>. Of the {N_TOY} goodies in the pool,{" "}
              {N_LARGE} are large and {N_SMALL} are small.
            </p>
            <p>
              <em>C</em>({N_SMALL}, 3) means &ldquo;choose 3 small goodies
              from {N_SMALL}.&rdquo; The count gets huge because each side
              chooses a handful of goodies from a large pool. The two sides also
              cannot reuse the same goodie.
            </p>
            <ul className="list-disc pl-6 space-y-1">
              <li>
                <strong>1 large + 3 small:</strong> {N_LARGE} ×{" "}
                <em>C</em>({N_SMALL}, 3) = {N_LARGE} ×{" "}
                {C_NSMALL_3.toLocaleString()} ≈{" "}
                <strong>{(ONE_LARGE_THREE_SMALL_LAYOUTS / 1e7).toFixed(1)} × 10⁷</strong>{" "}
                goodie sets
              </li>
              <li>
                <strong>0 large + 5 small:</strong> <em>C</em>({N_SMALL}, 5) ={" "}
                {C_NSMALL_5.toLocaleString()} ≈{" "}
                <strong>{(C_NSMALL_5 / 1e9).toFixed(1)} × 10⁹</strong> goodie sets
              </li>
            </ul>
            <p>
              One side already has about{" "}
              <strong>{(SIDE_TOY_LAYOUTS / 1e9).toFixed(1)} billion</strong> goodie
              sets. For a full yard, the count also removes pairings that reuse
              the same goodie on both sides, then multiplies by both food bowls.
              Dropping the duplicates pulls the two-side total below one side
              squared:
            </p>
            <p className="font-mono text-sm pl-4 border-l-2 border-slate-300 dark:border-slate-600 leading-relaxed">
              ≈ {(TWO_SIDE_TOY_LAYOUTS_NO_DUPES / 1e18).toFixed(2)} × 10¹⁸{" "}
              no-duplicate two-side goodie sets × 7 × 7 ≈{" "}
              <strong>{(YARD_COUNT_ORDER / 1e20).toFixed(2)} × 10²⁰</strong>{" "}
              candidate yards.
            </p>
          </Disclosure>
          <p>
            So the search needs to be clever, and we have to accept that the
            tool is looking for a <em>great</em> yard rather than proving the
            single perfect yard.
          </p>
        </Section>

        <Section
          id="search"
          eyebrow="Act II &middot; Then, optimization"
          title="OK, you can rank one yard. Now find a great one."
        >
          <p>
            Given a way to rank a single yard, how do you find a great one
            among 10²⁰ possibilities without checking them all? This is{" "}
            <strong>search</strong>, and it&rsquo;s one of the most
            beautiful corners of computer science.
          </p>
          <p>
            Two natural ideas come up first, and both are lessons in their
            own right:
          </p>
          <ul className="space-y-2">
            <li>
              <strong>Random search.</strong> Just sample yards. Easy! Also
              terrible: with this many goodie-and-food combinations, the chance
              of randomly bumping into a great layout for your objective is
              astronomically small. But random yards still make excellent{" "}
              <em>starting points</em>.
            </li>
            <li>
              <strong>Greedy / hill climbing.</strong> Start anywhere, then
              repeatedly swap one goodie or food for whichever single change
              improves the ranking the most. It&rsquo;s much smarter, and it
              works until your yard is only the best version of its
              current neighborhood, not the best yard overall. This is called a{" "}
              <strong>local maximum</strong>, and it&rsquo;s the central trap in
              optimization.
            </li>
          </ul>
          <p>
            In the public optimizer, the search uses a{" "}
            <strong>genetic algorithm</strong>.
            The name sounds grander than the mechanism. Keep a population,
            meaning a batch of layouts, rank them, and make new layouts from
            the better ones.
            Occasionally inject randomness so the search can escape a bad
            neighborhood.
          </p>
          <CrossoverExample />

          <div className="grid sm:grid-cols-2 gap-3">
            <StepCard number="1" title="Start with many valid layouts">
              <p>
                Generate a population that already
                obeys your required goodies, forbidden goodies, food choices,
                and yard-side constraints.
              </p>
            </StepCard>
            <StepCard number="2" title="Rank each layout">
              <p>
                During the search, each candidate uses the same scoring family
                with cheaper analyzer settings. That lets the optimizer compare
                many yards and decide whether this one should stay in the
                population.
              </p>
            </StepCard>
            <StepCard number="3" title="Prefer the winners">
              <p>
                Tournament selection is a small contest among a few layouts. It
                makes better-ranked layouts more likely to become parents,
                meaning layouts used to make the next batch, while still giving
                the search some variety.
              </p>
            </StepCard>
            <StepCard number="4" title="Mix and mutate">
              <p>
                Crossover mixes parts of two good yards, such as useful indoor
                and outdoor halves. Mutation makes one small random change, like
                swapping a goodie or food type.
              </p>
            </StepCard>
            <StepCard number="5" title="Repeat, then rescore">
              <p>
                After many generations, the best candidates are scored again
                with the slower, more careful fixed-point settings described
                above, so the final report uses the full-tier estimates.
              </p>
            </StepCard>
          </div>
          <Callout tone="amber" title="A pattern to remember">
            <p>
              The optimizer keeps doing the same yard-building rhythm: try a
              spread of different yards, keep the promising ones, and make
              small changes around them. If the search gets stuck, spread out
              again. In plainer words: explore broadly, improve locally,
              repeat.
            </p>
          </Callout>
        </Section>

        <Section
          id="tricks"
          eyebrow="Act II &middot; Then, optimization"
          title="How it stays fast enough"
        >
          <p>
            The browser keeps the search usable with a few practical shortcuts:
          </p>
          <ul className="space-y-2">
            <li>
              <strong>Reuse scores.</strong> If the search comes back to a yard
              it has already checked with the same settings, it reuses that
              score instead of doing the work again.
            </li>
            <li>
              <strong>Skip duplicate yards.</strong> The same set of goodies can
              be reached in more than one order. Duplicate yards are skipped, so
              more time goes to genuinely new candidates.
            </li>
            <li>
              <strong>Check simple rules first.</strong> The search can reject
              impossible shapes and required/forbidden goodie misses before it
              spends time estimating visits and fish.
            </li>
            <li>
              <strong>Score in batches.</strong> When there are enough yards to
              compare, the browser can score groups of yards in the background
              when possible, so long runs feel less blocking.
            </li>
          </ul>
          <p>
            These shortcuts avoid repeated work; they do not give duplicate
            yards extra credit or change the final scoring rule.
          </p>
        </Section>

        <Section
          id="tubbs"
          eyebrow="Postscript"
          title="A note on Tubbs and the outdoor bowl"
        >
          <p>
            One <em>fluffy</em> cat earns his own note. When{" "}
            <strong>
              <CatFace catId={108} name="Tubbs" size="inline" />
            </strong>{" "}
            stops by the outdoor food bowl, he eats the whole thing in one
            sitting and leaves a big pile of fish as a thank-you. The bowl
            then sits empty until you refill it, and two costs follow. You
            buy more outdoor refills, so your food bill rises. While the
            bowl is empty, the whole outdoor area draws fewer cats, because
            outdoor visitors come for the food, not for the bowl alone. The
            loss stays modest. Cats already in the yard finish their visits,
            and on a busy yard the freed spots fill fast, so a crowded
            outdoor area barely notices the gap.
          </p>
          <p>
            The optimizer scores Tubbs at the outdoor food bowl. Its search
            setting,{" "}
            <strong>How to handle Tubbs at the outdoor food bowl</strong>,
            lets you describe how you actually play, with five choices:
          </p>
          <ul className="list-disc space-y-1 pl-6 my-4">
            <li>
              <strong>Ignore Tubbs</strong>: leave scoring alone.
            </li>
            <li>
              <strong>Let him eat, refill once he leaves</strong>: keeps his
              full gift (silver and gold).
            </li>
            <li>
              <strong>Never shoo, top up at your next bowl refill</strong>:
              keeps his full gift, and you only top up when you next tend a
              bowl. This is the default.
            </li>
            <li>
              <strong>Shoo on sight</strong>: he never gets a real meal, so the
              bowl stays full for other cats; you keep only the silver from his
              brief stay, no gold.
            </li>
            <li>
              <strong>Shoo at your next bowl refill</strong>: he eats once, then
              you clear him the next time you tend a bowl; again silver only, no
              gold.
            </li>
          </ul>
          <p>
            Shooing him off early starts his cooldown sooner, so he drifts back
            a little more often; that lifts both his silver and your food bill,
            and the optimizer accounts for it. With foods that do not tempt
            Tubbs, the setting changes nothing.
          </p>
          <p>
            The optimizer uses quick formulas for those choices, then checks
            them against a step-by-step simulation that plays out thousands of
            random cat visits. They are still estimates, so treat any mismatch
            with your real yard as a lead to test.
          </p>

          <div className="mt-6">
            <Disclosure
              title="The math behind the Tubbs setting"
              subtitle="Optional derivation"
            >
              <p>
                This is a small layer on top of the solver loop, not a new one.
                Above, the loop in &ldquo;Why the optimizer uses averages&rdquo;
                settles every cat-and-spot estimate; the Tubbs adjustment then
                nudges the outdoor food cost and income that feed the final
                score. The colored tags below use the same{" "}
                <a
                  href="#formula-legend"
                  className="underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:hover:text-white"
                >
                  badge legend
                </a>{" "}
                as that section, whose{" "}
                <a
                  href="#symbol-glossary"
                  className="underline decoration-dotted underline-offset-2 hover:text-slate-900 dark:hover:text-white"
                >
                  symbol list
                </a>{" "}
                covers the shared symbols. The Tubbs-specific symbols are
                defined inline here as they appear.
              </p>
              <p>
                The outdoor bowl empties when Tubbs clears it or its own food
                runs out, whichever comes first. Write{" "}
                <Latex>{String.raw`R_o`}</Latex> for the times a day its food
                would run out on its own and <Latex>{String.raw`R_t`}</Latex>{" "}
                for how often Tubbs visits.
              </p>
              <p>
                Shooing him changes <Latex>{String.raw`R_t`}</Latex> itself. A
                cat cannot return until a cooldown passes, and that clock starts
                the moment he leaves the bowl. Shoo him early and the clock
                starts early, so he comes back sooner and visits more often.
                Write <Latex>{String.raw`o`}</Latex> for the fraction of his
                stay that passes before you shoo him: zero if you shoo the
                moment he lands, the whole stay (so no change) if you never
                shoo. Here{" "}
                <Latex>{String.raw`S`}</Latex> is a cat&rsquo;s mean stay in
                ticks, and one day holds 288 ticks. The boosted rate is:
              </p>
              <FormulaTag
                kind="approximation"
                note="approximates the extra visits an early shoo buys. Removing Tubbs after a fraction o of his stay shortens his visit cycle by the lost stay S(1−o), so the rate scales by cycle/(cycle−lost), and it is exactly 1 for the keep-gift settings, which never shoo. The simulator produces the same effect on its own: kicking sends him to cooldown sooner. The gap: the formula uses one mean stay and a smooth cycle, while the simulator draws each stay and cooldown fresh, so its measured visit bump wanders by about a percentage point around the formula, within Monte-Carlo noise."
              />
              <Latex display>{String.raw`R_t^{\text{eff}} = \frac{R_t}{1 - S\,(1 - o)\,R_t/288}`}</Latex>
              <p>
                From here on, <Latex>{String.raw`R_t`}</Latex> means this
                effective rate; for the keep-gift settings, which never shoo, it
                stays the base rate. The race between his visits and the food
                timer sets how often the bowl goes empty, a rate{" "}
                <Latex>{String.raw`\lambda_{\text{empty}}`}</Latex> a little
                above <Latex>{String.raw`R_o`}</Latex>, since Tubbs often eats
                before the food would have run out:
              </p>
              <FormulaTag
                kind="approximation"
                note="approximates the true bowl emptying rate by assuming Tubbs's visits are a rate-R_t Poisson process (memoryless gaps between visits) racing the food timer. The gap: the simulator gives every cat a post-visit cooldown of 8 to 23 ticks before it can return, which a Poisson process does not have, so the formula is exact only under that Poisson model (a stricter check matches it to about 0.3% at realistic Tubbs load). As R_t→0 the rate reduces to just R_o."
              />
              <Latex display>{String.raw`\lambda_{\text{empty}} = \frac{R_t}{1 - e^{-R_t/R_o}} \ \ge\ R_o`}</Latex>
              <p>
                How fast you put food back, <Latex>{String.raw`r`}</Latex>,
                depends on how you handle him. Here{" "}
                <Latex>{String.raw`R_i`}</Latex> is your indoor refill rate,
                and <Latex>{String.raw`m = R_t\,S/288`}</Latex> is the share of
                the day Tubbs sits on the bowl. Two settings refill promptly:
              </p>
              <FormulaTag
                kind="approximation"
                note="approximates the true refill rate r for the two prompt-refill settings. Shoo-on-sight kicks Tubbs off and refills after his arrival empties the bowl, so r equals the emptying rate. Waiting Tubbs out stretches each cycle by his occupancy m, giving ÷(1+m). The gap: when the food timer expires under a non-Tubbs bowl occupant, the simulator still waits for that cat to leave, a small tick-level correction the renewal formula leaves out."
              />
              <Latex display>{String.raw`
r = \begin{cases}
\lambda_{\text{empty}} & \text{shoo on sight} \\
\lambda_{\text{empty}}/(1+m) & \text{eat, refill when he leaves}
\end{cases}`}</Latex>
              <p>
                The two food-round modes refill only when you next tend the yard, which
                happens whenever either bowl is due. So checks fire at the
                faster food&rsquo;s rate, capped by the emptying rate. If Tubbs or
                another cat is still on the bowl spot, the check waits instead
                of replacing food underneath that cat. Both share the same
                refill cadence, but shoo-at-refill pays only Tubbs&rsquo;s
                stay-based silver while the never-shoo default (graze) keeps his
                full gift:
              </p>
              <FormulaTag
                kind="approximation"
                note="approximates the refill rate for shoo-at-a-refill and graze by max(R_i,R_o) capped at the emptying rate, assuming yard checks are spread evenly through time. The simulator uses the tick clock instead: an indoor refill, or the outdoor food's own duration elapsing, and it blocks the refill while any cat occupies the bowl spot. The gap between the two is mostly timing granularity and the Poisson-Tubbs idealization."
              />
              <Latex display>{String.raw`r = \min(\max(R_i, R_o),\ \lambda_{\text{empty}}) \quad \text{(shoo at a refill, or graze)}`}</Latex>
              <p>
                So the bowl stays full a fraction{" "}
                <Latex>{String.raw`f`}</Latex> of the time, and your outdoor
                food bill scales by the cost factor:
              </p>
              <FormulaTag
                kind="identity"
                note="rate balance over the full-plus-refill cycle"
              />
              <Latex display>{String.raw`f = \min\!\left(1,\ \frac{r}{\lambda_{\text{empty}}}\right), \qquad \text{cost factor} = \frac{r}{R_o}`}</Latex>
              <p>
                Income is the subtle part. An empty bowl draws no outdoor cats
                anywhere, so you might expect outdoor income to scale by{" "}
                <Latex>{String.raw`f`}</Latex>. It does not. A busy yard
                recovers: with a few cats missing, the ones who stay meet less
                competition for spots and each earns more. Let{" "}
                <Latex>{String.raw`\theta`}</Latex> be the average occupancy of
                an outdoor spot (how often it is busy), which the
                optimizer&rsquo;s loop already computes per spot. The kept
                fraction <Latex>{String.raw`\phi`}</Latex> (the share of outdoor
                income you keep) then comes out above{" "}
                <Latex>{String.raw`f`}</Latex>:
              </p>
              <FormulaTag
                kind="approximation"
                note="approximates the retained outdoor income while the bowl cycles full and empty. It leans on two simplifications. First, the fast-cycle limit: the bowl flips full and empty quickly versus how fast cats come and go, so a steady-state average replaces the real timing. Second, a diminishing-returns curve for a spot's income as the occupancy θ rises, steeper when θ is low and flattening as θ approaches 1. The gap: real income tracks occupancy only roughly like that curve, and the cycle is not infinitely fast."
              />
              <Latex display>{String.raw`\phi = \frac{f}{1 - \theta\,(1 - f)} \ \ge\ f`}</Latex>
              <p>
                Check the ends. When outdoor spots sit empty there is no
                competition to relieve, so <Latex>{String.raw`\theta\to 0`}</Latex>{" "}
                gives <Latex>{String.raw`\phi = f`}</Latex>; when the yard is
                saturated a freed spot is retaken at once, so{" "}
                <Latex>{String.raw`\theta\to 1`}</Latex> gives{" "}
                <Latex>{String.raw`\phi = 1`}</Latex>.
              </p>
              <p>
                Non-bowl outdoor income keeps the fraction{" "}
                <Latex>{String.raw`\phi`}</Latex>. The two shoo settings count
                Tubbs&rsquo;s gift as silver-only, but keep the silver fish implied
                by his stay, including the extra visits the early shoo buys (the
                same <Latex>{String.raw`R_t`}</Latex> boost). Helper and graze
                keep his full gift. On the Tubbs benchmark, the shoo and graze
                settings land within about 3.7% of the simulator.
              </p>
            </Disclosure>
          </div>
        </Section>

        <Section
          id="not-perfect"
          eyebrow="Postscript"
          title="What the optimizer does not know"
        >
          <p>
            Most special visit rules are modeled, Tubbs at the outdoor bowl
            among them (see the note just above). One quirk still slips past
            the math.
          </p>
          <p>
            The{" "}
            <strong>
              <InlineGoodieName goodieId={337} name="Instant Camera" />
            </strong>{" "}
            carries a tiny gotcha: the optimizer scores it like an
            always-ready goodie, but in-game it takes four photo snaps and then
            breaks until you repair it. A camera-heavy layout can still be
            adorable; just treat it as a lead to test in your real yard, not a
            promise from the math.
          </p>
          <p>
            More generally: this is an <em>approximate</em> optimizer for an{" "}
            <em>approximate</em> model of a game. It&rsquo;s a tool for
            ideas and exploration, not an oracle. The fun is partly in
            comparing what it suggests with what you observe in your real
            yard.
          </p>
        </Section>

        <Section
          id="learn-more"
          eyebrow="Postscript"
          title="Where to go next"
        >
          <p>
            Every concept in this page is a doorway into a larger field.
            None of them require a math degree to start, just
            curiosity and a willingness to try things. Here are a few gentle
            next steps, depending on which part was most interesting. For any
            topic, start tiny: ask for a small example, a plain-language map, or
            a few terms to look up next. You do not need any of these topics to
            use the optimizer above.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 p-4 space-y-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                For combinatorics &amp; counting
              </h3>
              <p className="text-sm">
                Khan Academy&rsquo;s combinatorics unit is a gentle, free
                start. On this page, the key move is counting goodie sets: how
                many ways can one yard side hold one large goodie and three
                small goodies, or five small goodies? From there,{" "}
                <FormattedLink
                  href="https://en.wikipedia.org/wiki/Combinatorial_optimization"
                  target="_blank"
                  location="/yard-optimizer/how-it-works"
                >
                  combinatorial optimization
                </FormattedLink>{" "}
                is the larger field that studies searches like this.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 p-4 space-y-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                For search &amp; AI
              </h3>
              <p className="text-sm">
                <em>Artificial Intelligence: A Modern Approach</em> by
                Russell &amp; Norvig introduces ways to choose the next state to
                try, including hill climbing, simulated annealing, beam search,
                A*, and genetic algorithms. For this page, read those as
                different ways of deciding which yard to try next.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 p-4 space-y-1">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                For probability, averages, and fixed points
              </h3>
              <p className="text-sm">
                The average-crowd shortcut on this page is one example of a
                broader idea called{" "}
                <FormattedLink
                  href="https://en.wikipedia.org/wiki/Variational_Bayesian_methods"
                  target="_blank"
                  location="/yard-optimizer/how-it-works"
                >
                  variational inference
                </FormattedLink>{" "}
                for probabilistic models. Here, the plain meaning is simple:
                instead of replaying every exact visit, estimate how often each
                cat and play space is occupied. A fixed-point idea shows up
                whenever an estimate is fed back into itself until it stabilizes.
              </p>
            </div>
            <TinyOptimizerExample />
          </div>
          <Callout tone="violet" title="Most importantly">
            <p>
              The cool part is not that an algorithm picked your goodies
              for you. It is that you can read this page, see the
              moving parts, and start asking sharper questions about why one
              Neko Atsume layout beats another.
            </p>
          </Callout>
        </Section>

        <footer className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <div className="space-y-2 text-center text-sm text-slate-600 dark:text-slate-400">
            <p className="flex flex-wrap items-baseline justify-center gap-x-1.5 gap-y-1">
              <span>Made with love for</span>
              <FooterDedicationCats />
              <span>by</span>
              <span className="inline-flex items-baseline gap-x-0.5">
                <FormattedLink
                  href="https://www.reddit.com/user/Infamous-Shop1615"
                  target="_blank"
                  location="/yard-optimizer/how-it-works"
                >
                  u/Infamous-Shop1615
                </FormattedLink>
                <span>.</span>
              </span>
            </p>
            <p>
              Thanks to{" "}
              <FormattedLink
                href="https://github.com/Tibowl"
                target="_blank"
                location="/yard-optimizer/how-it-works"
              >
                Tibowl
              </FormattedLink>
              {" "}for creating NekoDB and the original yard optimizer.
            </p>
          </div>
        </footer>
      </div>
    </main>
  )
}
