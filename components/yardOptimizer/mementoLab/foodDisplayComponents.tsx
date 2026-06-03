import type { ReactNode } from "react"
import DisplayImage, { type ImageMetaData } from "../../DisplayImage"
import type { MementoTimeDisplayScale } from "../../../utils/yardOptimizer/foodBowlEconomy"
import {
  SVG_CHART_TEXT,
  type SvgChartTextVariant,
} from "./chartPrimitives"
import {
  fmtDisplayTick,
} from "../../../utils/yardOptimizer/mementoLab/chartFormatters"

type FoodRefillInlineSpacing = "prose" | "chart"
const FOOD_REFILL_INLINE_SPACING: Record<
  FoodRefillInlineSpacing,
  { prefix: string; suffix: string }
> = {
  prose: { prefix: "mr-1", suffix: "ml-1" },
  chart: { prefix: "mr-1.5", suffix: "ml-2" },
}

export function FoodRefillInline({
  foodMeta,
  prefix,
  suffix,
  className = "",
  iconClassName = "h-4 w-auto shrink-0",
  iconAlt = "",
  spacing = "prose",
}: {
  foodMeta: ImageMetaData
  prefix?: ReactNode
  suffix?: ReactNode
  className?: string
  iconClassName?: string
  iconAlt?: string
  spacing?: FoodRefillInlineSpacing
}) {
  const spacingClass = FOOD_REFILL_INLINE_SPACING[spacing]
  return (
    <span className={`inline-flex items-center whitespace-nowrap ${className}`}>
      {prefix ? <span className={spacingClass.prefix}>{prefix}</span> : null}
      <DisplayImage
        img={foodMeta}
        alt={iconAlt}
        className={iconClassName}
      />
      {suffix ? <span className={spacingClass.suffix}>{suffix}</span> : null}
    </span>
  )
}

export function FoodRefillUnit({
  foodMeta,
  className = "",
}: {
  foodMeta: ImageMetaData
  className?: string
}) {
  return (
    <FoodRefillInline
      foodMeta={foodMeta}
      className={className}
      iconClassName="inline-block h-4 w-auto align-[-3px] shrink-0"
      iconAlt="food"
    />
  )
}

function InlineTimeUnit({
  timeDisplay,
  foodMeta,
  className = "",
  quantity,
}: {
  timeDisplay: MementoTimeDisplayScale
  foodMeta: ImageMetaData
  className?: string
  quantity?: number
}) {
  return timeDisplay.basis === "gameDay" ? (
    <span className={className}>
      food {Math.abs(quantity ?? 2) === 1 ? "day" : "days"}
    </span>
  ) : (
    <FoodRefillUnit foodMeta={foodMeta} className={className} />
  )
}

export function DisplayTimeValue({
  gameDays,
  timeDisplay,
  foodMeta,
  suffix,
}: {
  gameDays: number
  timeDisplay: MementoTimeDisplayScale
  foodMeta: ImageMetaData
  suffix?: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span>{fmtDisplayTick(gameDays, timeDisplay.displayMul)}</span>
      <InlineTimeUnit
        timeDisplay={timeDisplay}
        foodMeta={foodMeta}
        quantity={gameDays * timeDisplay.displayMul}
      />
      {suffix}
    </span>
  )
}

export function SvgFoodAxisLabel({
  x,
  y,
  text,
  suffix = "",
  variant = "axis",
  foodMeta,
  width,
  align = "middle",
}: {
  x: number
  y: number
  text: string
  suffix?: string
  variant?: SvgChartTextVariant
  foodMeta: ImageMetaData
  width?: number
  align?: "start" | "middle"
}) {
  const labelW = width ?? (suffix ? 360 : 240)
  const fontSize = SVG_CHART_TEXT[variant]
  const left = align === "start" ? x : x - labelW / 2
  const contentClass =
    align === "start"
      ? "inline-flex items-center gap-1.5 leading-none"
      : "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 leading-none"

  return (
    <foreignObject
      x={left}
      y={y - 15}
      width={labelW}
      height={22}
      aria-label={suffix ? `${text} ${suffix}` : text}
    >
      <div
        className={`flex h-full items-center whitespace-nowrap text-slate-600 dark:text-slate-400 ${
          align === "start" ? "justify-start" : "justify-center"
        }`}
        style={{ fontSize }}
      >
        <span className={contentClass}>
          <FoodRefillInline
            foodMeta={foodMeta}
            prefix={text}
            suffix={suffix}
            spacing="chart"
          />
        </span>
      </div>
    </foreignObject>
  )
}

export function SvgFoodInlineLabel({
  x,
  y,
  text,
  suffix,
  foodMeta,
  width,
}: {
  x: number
  y: number
  text: string
  suffix: string
  foodMeta: ImageMetaData
  width: number
}) {
  return (
    <foreignObject
      x={x}
      y={y - 15}
      width={width}
      height={22}
      aria-label={`${text} ${suffix}`}
    >
      <div
        className="flex h-full items-center whitespace-nowrap text-emerald-700 dark:text-emerald-300"
        style={{ fontSize: SVG_CHART_TEXT.axis, fontWeight: 500 }}
      >
        <span className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 leading-none">
          <FoodRefillInline
            foodMeta={foodMeta}
            prefix={text}
            suffix={suffix}
            spacing="chart"
          />
        </span>
      </div>
    </foreignObject>
  )
}
