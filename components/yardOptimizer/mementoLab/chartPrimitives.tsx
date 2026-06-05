import {
  useLayoutEffect,
  useRef,
  useState,
  type DependencyList,
  type ReactNode,
  type RefObject,
  type SVGProps,
} from "react"

export const CHART_VB_H = 280
export const CHART_MIN_W = 580
export const SVG_CHART_TEXT = {
  title: 11,
  axis: 10,
  tick: 9,
  marker: 8.5,
  badge: 7.5,
} as const
export type SvgChartTextVariant = keyof typeof SVG_CHART_TEXT
const SVG_CHART_TEXT_CLASS: Record<SvgChartTextVariant, string> = {
  title: "fill-slate-700 dark:fill-slate-300 font-semibold",
  axis: "fill-slate-600 dark:fill-slate-400",
  tick: "fill-slate-500 dark:fill-slate-500",
  marker: "fill-slate-700 dark:fill-slate-300 font-semibold",
  badge: "fill-yellow-700 dark:fill-yellow-200 font-semibold",
}
export const SVG_CHART_TITLE_Y = 16
export const SVG_CHART_PLOT_TOP = 32
export const SVG_CHART_X_TICK_GAP = 14
export const SVG_CHART_X_LABEL_GAP = 30
export const SVG_CHART_BOTTOM_PAD = 38
/** Right padding can be tight — we no longer paint a visits right-axis. */
export const CH_PAD = { l: 56, r: 18, t: SVG_CHART_PLOT_TOP, b: SVG_CHART_BOTTOM_PAD }
/** Hazard mini-chart sizing — shares the days x-axis of the main chart. */
export const HAZARD_CHART_VB_H = 144
export const HAZARD_PAD = { l: 56, r: 18, t: SVG_CHART_PLOT_TOP, b: CH_PAD.b }

export type SvgChartPad = { l: number; r: number; t: number; b: number }

export function chartLayout(width: number, height: number, pad: SvgChartPad) {
  const iw = width - pad.l - pad.r
  const ih = height - pad.t - pad.b
  const plotBottom = pad.t + ih
  return {
    iw,
    ih,
    plotBottom,
    xTickY: plotBottom + SVG_CHART_X_TICK_GAP,
    xLabelY: plotBottom + SVG_CHART_X_LABEL_GAP,
    yMid: pad.t + ih / 2,
  }
}

export function useMeasuredChartWidth(minWidth: number, deps: DependencyList = []) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return

    const update = () => {
      const nextWidth = Math.max(
        minWidth,
        Math.round(el.getBoundingClientRect().width)
      )
      setMeasuredWidth((prev) => (prev === nextWidth ? prev : nextWidth))
    }

    update()
    let raf2 = 0
    const raf1 = window.requestAnimationFrame(() => {
      update()
      raf2 = window.requestAnimationFrame(update)
    })
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update)
      return () => {
        window.cancelAnimationFrame(raf1)
        if (raf2) window.cancelAnimationFrame(raf2)
        window.removeEventListener("resize", update)
      }
    }

    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => {
      window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minWidth, ...deps])

  return {
    frameRef,
    width: measuredWidth ?? minWidth,
    isMeasured: measuredWidth !== null,
  }
}

export function MeasuredChartSvg({
  frameRef,
  isMeasured,
  width,
  height,
  minWidth,
  frameClassName = "w-full overflow-x-auto",
  svgClassName = "block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900",
  placeholderClassName = "rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-900",
  children,
  ...svgProps
}: {
  frameRef?: RefObject<HTMLDivElement | null>
  isMeasured: boolean
  width: number
  height: number
  minWidth: number
  frameClassName?: string
  svgClassName?: string
  placeholderClassName?: string
  children: ReactNode
} & Omit<SVGProps<SVGSVGElement>, "children" | "height" | "width">) {
  return (
    <div ref={frameRef} className={frameClassName}>
      {isMeasured ? (
        <svg
          {...svgProps}
          viewBox={`0 0 ${width} ${height}`}
          className={svgClassName}
          style={{ height, minWidth, ...svgProps.style }}
        >
          {children}
        </svg>
      ) : (
        <div
          className={placeholderClassName}
          style={{ height, minWidth }}
          aria-hidden="true"
        />
      )}
    </div>
  )
}

export function SvgChartText({
  variant = "axis",
  children,
  className,
  fill,
  style,
  ...textProps
}: {
  variant?: SvgChartTextVariant
  children: ReactNode
} & Omit<SVGProps<SVGTextElement>, "children">) {
  const mergedClassName = className
    ? `${SVG_CHART_TEXT_CLASS[variant]} ${className}`
    : SVG_CHART_TEXT_CLASS[variant]
  const fillStyle = typeof fill === "string" ? { fill } : null
  return (
    <text
      {...textProps}
      className={mergedClassName}
      style={{ fontSize: SVG_CHART_TEXT[variant], ...fillStyle, ...style }}
    >
      {children}
    </text>
  )
}
