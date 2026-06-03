import { useState } from "react"
import { catIconImageMeta } from "../../utils/yardOptimizer/clientAssets"
import { cats } from "../../utils/yardOptimizer/gameData"
import DisplayImage, { type ImageMetaData } from "../DisplayImage"
import FormattedLink from "../FormattedLink"

export type WalkthroughPage = "objective" | "blocked"

const WALKTHROUGH_FISH_SPRITE: ImageMetaData = {
  url: "/yard-optimizer/niboshi-unknown.png",
  width: 175,
  height: 109,
}
const WALKTHROUGH_MEMENTO_SPRITE: ImageMetaData = {
  url: "/na2-assets/spriteatlas/ui/takara_hatena.png",
  width: 126,
  height: 112,
}

export function YardOptimizerWalkthrough({
  initialPage,
  onPickFish,
  onPickMemento,
  onSkip,
}: {
  initialPage?: WalkthroughPage
  onPickFish: () => void
  onPickMemento: () => void
  onSkip: () => void
}) {
  const [page, setPage] = useState<WalkthroughPage>(initialPage ?? "objective")
  const [blockerCatId] = useState<number | null>(() => {
    const randomCat = cats[Math.floor(Math.random() * cats.length)]
    return randomCat?.Id ?? null
  })
  const blockerCatIcon = blockerCatId == null ? null : catIconImageMeta(blockerCatId)

  if (page === "blocked") {
    return (
      <section
        className="rounded-xl border border-emerald-200 dark:border-emerald-800/70 p-6 sm:p-8 bg-emerald-50/85 dark:bg-emerald-950/30 space-y-6"
        aria-labelledby="yard-walkthrough-blocked-heading"
      >
        <div className="max-w-2xl mx-auto text-center space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
            Cozy mode
          </p>
          <h2
            id="yard-walkthrough-blocked-heading"
            className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100"
          >
            Keep the yard cozy.
          </h2>
          <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            No rankings and no pressure. Keep playing by feel, or wander through the reference
            pages when you want names and pictures without optimization.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <FormattedLink
            href="/cats"
            location="/yard-optimizer"
            className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/80 dark:bg-slate-900/40 px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Browse cats
          </FormattedLink>
          <FormattedLink
            href="/goodies"
            location="/yard-optimizer"
            className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white/80 dark:bg-slate-900/40 px-4 py-2 text-sm font-semibold shadow-sm"
          >
            Browse goodies
          </FormattedLink>
          <button
            type="button"
            onClick={() => setPage("objective")}
            className="rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800/70"
          >
            Use optimizer anyway
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      className="rounded-xl border border-slate-200 dark:border-slate-600 p-6 sm:p-8 bg-gradient-to-b from-slate-50 to-white dark:from-slate-900/80 dark:to-slate-800/50 space-y-6"
      aria-labelledby="yard-walkthrough-heading"
    >
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <h2
          id="yard-walkthrough-heading"
          className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100"
        >
          How do you want to use the yard optimizer?
        </h2>
        <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
          The optimizer can make Neko Atsume feel more like a numbers game. You can also
          keep choosing by cuteness.
        </p>
      </div>

      <div className="max-w-3xl mx-auto space-y-4">
        <button
          type="button"
          onClick={() => setPage("blocked")}
          className="block w-full text-left rounded-2xl border-2 border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800/80 p-6 shadow-sm hover:border-emerald-400 dark:hover:border-emerald-500 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 sm:mx-auto sm:w-[calc((100%-1rem)/2)]"
        >
          {blockerCatIcon ? (
            <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-emerald-100 dark:border-emerald-800 bg-emerald-50/80 dark:bg-slate-900/40">
              <DisplayImage img={blockerCatIcon} alt="" className="max-h-10 max-w-10" />
            </span>
          ) : null}
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
            Keep choosing by cuteness
          </h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Skip the rankings and keep browsing cats and goodies.
          </p>
        </button>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={onPickFish}
            className="text-left rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-6 shadow-sm hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <div className="h-12 mb-3 flex items-center" aria-hidden>
              <DisplayImage
                img={WALKTHROUGH_FISH_SPRITE}
                alt=""
                className="max-h-12 w-auto object-contain"
              />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              Earn more fish
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Find goodies and food that earn the most fish each day, after food costs.
            </p>
          </button>

          <button
            type="button"
            onClick={onPickMemento}
            className="text-left rounded-2xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800/80 p-6 shadow-sm hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
          >
            <div className="h-12 mb-3 flex items-center" aria-hidden>
              <DisplayImage
                img={WALKTHROUGH_MEMENTO_SPRITE}
                alt=""
                className="max-h-12 w-auto object-contain"
              />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">
              Collect mementos
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Choose cats you care about; we&apos;ll favor layouts that help you get their
              mementos faster.
            </p>
          </button>
        </div>
      </div>

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={onSkip}
          className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline underline-offset-2"
        >
          Skip and open all settings
        </button>
      </div>
    </section>
  )
}
