/** Shared constants for the memento lottery lab UI and simulations. */
import { TICKS_PER_DAY as ANALYZER_TICKS_PER_DAY, visitsPerDayFromHorizon } from "../analyzer/constants"

export { ANALYZER_TICKS_PER_DAY as TICKS_PER_DAY, visitsPerDayFromHorizon }

export const BAR_BINS = 60
export const QUANTILE_TARGETS = [0.5, 0.75, 0.9, 0.95] as const
export const CDF_AVG_MARKER_COLOR = "rgb(253 224 71)"
export const CDF_QUANTILE_MARKER_COLOR = "rgb(252 211 77)"
export const DAYS_GRID_POINTS = 200
export const HAZARD_WINDOWS = [1, 3, 7] as const
export type HazardWindow = (typeof HAZARD_WINDOWS)[number]

export const CONTROL_BUBBLE_CLASS =
  "max-w-5xl rounded-lg border border-slate-200 bg-white/70 px-3 py-3 dark:border-slate-600 dark:bg-slate-900/35"
export const CONTROL_ROW_CLASS = "flex max-w-5xl flex-wrap items-end gap-4"

export const SIM_RUNS_CHUNK = 40
export const SIM_CI_REFRESH_MS = 5000
export const FISH_PLOT_GRID_POINTS = 48
export const FISH_PLOT_RUNS_CHUNK = 8

export const MINUTES_PER_DAY = 24 * 60

export const CI_Z: Record<90 | 95 | 99, number> = {
  90: 1.645,
  95: 1.96,
  99: 2.576,
}

export const JOINT_MEMENTO_CURVE_COLOR = "#9333ea"
export const MEMENTO_CAT_CURVE_COLORS = [
  "#0f766e",
  "#e11d48",
  "#2563eb",
  "#d97706",
  "#0891b2",
  "#65a30d",
] as const

export const FISH_PLOT_VB_H = 280
export const FISH_PLOT_MIN_W = 580

export const SINGLE_YARD_INCOME_VB_H = 232
export const SINGLE_YARD_INCOME_MIN_W = 528
export const VISIT_MARKER_LINE_CAP = 420
export const VISIT_CAT_COLORS = [
  "#e11d48",
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#65a30d",
] as const

export const TILE_THEMES = {
  amber:
    "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/45 text-amber-900 dark:text-amber-100",
  rose:
    "bg-slate-50/80 dark:bg-slate-950/25 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100",
  sky:
    "bg-sky-50/80 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/45 text-sky-900 dark:text-sky-100",
  yellow:
    "bg-yellow-50/80 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800/45 text-yellow-900 dark:text-yellow-100",
  slate:
    "bg-slate-50/80 dark:bg-slate-950/25 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200",
} as const
