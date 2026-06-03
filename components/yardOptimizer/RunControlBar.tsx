type RunControlBarProps = {
  runButtonText: string
  continueButtonText: string
  pauseButtonText: string
  running: boolean
  runUnavailableText: string | null
  continueUnavailableText: string | null
  hasContinuation: boolean
  canPauseRun: boolean
  showRunCelebration: boolean
  onRun: () => void
  onContinue: () => void
  onPause: () => void
  variant?: "inline" | "sticky"
}

export default function RunControlBar({
  runButtonText,
  continueButtonText,
  pauseButtonText,
  running,
  runUnavailableText,
  continueUnavailableText,
  hasContinuation,
  canPauseRun,
  showRunCelebration,
  onRun,
  onContinue,
  onPause,
  variant = "inline",
}: RunControlBarProps) {
  const isSticky = variant === "sticky"
  const runClass = isSticky
    ? "px-3.5 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm font-medium"
    : "px-6 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium"
  const secondaryClass = isSticky
    ? "px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-sm font-medium"
    : "px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 font-medium"
  const pauseClass = isSticky
    ? "px-3.5 py-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 text-sm font-medium text-amber-900 dark:text-amber-200"
    : "px-6 py-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 disabled:opacity-50 font-medium text-amber-900 dark:text-amber-200"

  return (
    <div className={isSticky ? "flex flex-wrap items-center gap-2 shrink-0" : "flex flex-wrap gap-3 items-center"}>
      <button
        type="button"
        onClick={(e) => {
          e.currentTarget.blur()
          onRun()
        }}
        disabled={running || runUnavailableText != null}
        className={runClass}
      >
        {runButtonText}
      </button>
      {!running ? (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur()
            onContinue()
          }}
          disabled={!hasContinuation || runUnavailableText != null}
          className={secondaryClass}
        >
          {continueButtonText}
        </button>
      ) : null}
      {running ? (
        <button
          type="button"
          onClick={(e) => {
            e.currentTarget.blur()
            onPause()
          }}
          disabled={!canPauseRun}
          className={pauseClass}
        >
          {pauseButtonText}
        </button>
      ) : null}
      {!isSticky && continueUnavailableText ? (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {continueUnavailableText}
        </span>
      ) : null}
      {!isSticky && showRunCelebration ? (
        <span
          className="run-complete-status inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 dark:border-emerald-800/70 dark:bg-emerald-950/30 dark:text-emerald-200"
          role="status"
          aria-live="polite"
        >
          <span className="text-2xl leading-none" aria-hidden>
            😺
          </span>
          <span>Done. Showing recommended layout.</span>
        </span>
      ) : null}
    </div>
  )
}
