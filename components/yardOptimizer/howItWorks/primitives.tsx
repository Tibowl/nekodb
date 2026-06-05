import { useMemo, type ReactNode } from "react"
import { renderToString } from "katex"

export function Latex({
  children,
  display = false,
}: {
  children: string
  display?: boolean
}) {
  const html = useMemo(
    () =>
      renderToString(children, {
        displayMode: display,
        throwOnError: false,
        strict: "ignore",
      }),
    [children, display]
  )
  return (
    <span
      className={display ? "block py-1 overflow-x-auto" : undefined}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export function Callout({
  tone = "blue",
  title,
  action,
  children,
}: {
  tone?: "blue" | "violet" | "amber" | "emerald"
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  const palette = {
    blue: "border-blue-200 dark:border-blue-800/70 bg-blue-50/80 dark:bg-blue-950/30",
    violet:
      "border-violet-200 dark:border-violet-800/70 bg-violet-50/80 dark:bg-violet-950/30",
    amber:
      "border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30",
    emerald:
      "border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/80 dark:bg-emerald-950/30",
  }[tone]
  return (
    <aside className={`rounded-xl border ${palette} px-4 py-3 text-sm`}>
      <div className="mb-1 flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-800 dark:text-slate-100">
          {title}
        </p>
        {action}
      </div>
      <div className="text-slate-700 dark:text-slate-300 space-y-2">{children}</div>
    </aside>
  )
}

export function RerollButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-md border border-slate-300 bg-white/70 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-600 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900"
    >
      Reroll
    </button>
  )
}
