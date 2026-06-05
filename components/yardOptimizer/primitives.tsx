import type { ReactNode } from "react"
import { translate as translateTable } from "../../utils/localization/translate"
import { useLanguage } from "../../hooks/useLanguage"
import {
  foodIconImageMeta,
  goodieIconImageMeta,
} from "../../utils/yardOptimizer/clientAssets"
import {
  isFixedSlotValue,
  type SlotDraftValue,
} from "../../utils/yardOptimizer/layoutDrafts"
import CatFaceName from "../CatFaceName"
import DisplayImage from "../DisplayImage"
import FormattedLink from "../FormattedLink"

export function GoodieRow({
  id,
  location,
}: {
  id: number
  location: string
}) {
  const { translate } = useLanguage()
  const name = translate(translateTable("Goods", `GoodsName${id}`))
  const img = goodieIconImageMeta(id)
  return (
    <FormattedLink href={`/goodies/${id}`} location={location}>
      <div className="flex flex-row items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/80">
        {img ? (
          <DisplayImage
            img={img}
            alt={name}
            className="max-h-8 max-w-12 w-auto object-contain shrink-0"
          />
        ) : (
          <span className="inline-block w-8 h-8 shrink-0 rounded bg-slate-200 dark:bg-slate-600" />
        )}
        <span>
          {name} <span className="text-slate-500">#{id}</span>
        </span>
      </div>
    </FormattedLink>
  )
}

export function CatPickerTile({
  id,
  label,
  selected,
  onToggle,
}: {
  id: number
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded transition-colors ${
        selected
          ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-950/50"
          : "hover:bg-slate-100 dark:hover:bg-slate-700/80"
      }`}
    >
      <div className="p-2">
        <CatFaceName catId={id} name={label} size="compact" />
      </div>
    </button>
  )
}

export function FoodPickerTile({
  id,
  label,
  selected,
  onToggle,
}: {
  id: number
  label: string
  selected: boolean
  onToggle: () => void
}) {
  const meta = foodIconImageMeta(id)
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded transition-colors ${
        selected
          ? "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-950/50"
          : "hover:bg-slate-100 dark:hover:bg-slate-700/80"
      }`}
    >
      <div className="flex flex-row items-center gap-2 p-2">
        <DisplayImage img={meta} alt={label} />
        <div>{label}</div>
      </div>
    </button>
  )
}

export function GoodiePickerTile({
  id,
  label,
  state,
  onCycle,
  blockedBySetting = false,
}: {
  id: number
  label: string
  state: "neutral" | "required" | "forbidden"
  onCycle: () => void
  blockedBySetting?: boolean
}) {
  const img = goodieIconImageMeta(id)
  // Blue = in the pool (default, same as a selected food). Amber = forced in
  // (must include). No box = removed from the pool. A goodie blocked by a
  // setting (e.g. the off-season toggle) is greyed out with no box and is not
  // clickable — change the setting to use it.
  const ring = blockedBySetting
    ? "opacity-50 grayscale cursor-not-allowed"
    : state === "required"
      ? "ring-2 ring-amber-500 bg-amber-100 dark:bg-amber-950/50"
      : state === "forbidden"
        ? "hover:bg-slate-100 dark:hover:bg-slate-700/80"
        : "ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-950/50"
  const title = blockedBySetting
    ? "Blocked by the off-season seasonal setting above. Turn that off to use it."
    : state === "required"
      ? "Click: remove this goodie from the pool"
      : state === "forbidden"
        ? "Click: add this goodie back to the pool"
        : "Click: must-include this goodie"
  return (
    <button type="button" onClick={onCycle} disabled={blockedBySetting} title={title} className={`text-left rounded transition-colors ${ring}`}>
      <div className="flex flex-row items-center gap-2 p-2">
        {img ? (
          <DisplayImage img={img} alt={label} />
        ) : (
          <span className="inline-block w-7 h-7 shrink-0 rounded bg-slate-200 dark:bg-slate-600" />
        )}
        <div>
          {label}
          <span className="text-slate-500"> #{id}</span>
        </div>
      </div>
    </button>
  )
}

export function SmallGoodieSlotSelect({
  value,
  disabled,
  poolIds,
  onChange,
}: {
  value: number
  disabled: boolean
  poolIds: readonly number[]
  onChange: (nextId: number) => void
}) {
  const { translate } = useLanguage()
  const img = goodieIconImageMeta(value)
  const selName = translate(translateTable("Goods", `GoodsName${value}`))
  return (
    <div className="flex items-center gap-2 min-w-0">
      {img ? (
        <DisplayImage
          img={img}
          alt={selName}
          className="max-h-8 max-w-12 w-auto object-contain shrink-0"
        />
      ) : (
        <span
          className="inline-block w-8 h-8 shrink-0 rounded bg-slate-200 dark:bg-slate-600"
          aria-hidden
        />
      )}
      <select
        className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 min-w-[11rem] max-w-[min(100%,20rem)]"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {poolIds.map((id) => (
          <option key={id} value={id}>
            #{id} · {translate(translateTable("Goods", `GoodsName${id}`))}
          </option>
        ))}
      </select>
    </div>
  )
}

function EmptySlotBadge({ label }: { label: string }) {
  const isOpen = label.startsWith("Open")
  return (
    <span
      className={[
        "inline-flex w-8 h-8 shrink-0 items-center justify-center rounded border border-dashed",
        isOpen
          ? "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 text-[10px]"
          : "border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 text-xl font-black leading-none",
      ].join(" ")}
      aria-hidden
    >
      {isOpen ? "Open" : "X"}
    </span>
  )
}

export function OptionalGoodieSlotSelect({
  value,
  disabled,
  openLabel = "Open play space",
  closedLabel = "Closed play space",
  poolIds,
  onChange,
}: {
  value: SlotDraftValue
  disabled: boolean
  openLabel?: string
  closedLabel?: string
  poolIds: readonly number[]
  onChange: (nextId: SlotDraftValue) => void
}) {
  const { translate } = useLanguage()
  const img = isFixedSlotValue(value) ? goodieIconImageMeta(value) : null
  const selName =
    isFixedSlotValue(value)
      ? translate(translateTable("Goods", `GoodsName${value}`))
      : value === "open"
        ? openLabel
        : closedLabel
  return (
    <div className="flex items-center gap-2 min-w-0">
      {img ? (
        <DisplayImage
          img={img}
          alt={selName}
          className="max-h-8 max-w-12 w-auto object-contain shrink-0"
        />
      ) : (
        <EmptySlotBadge label={value === "open" ? openLabel : closedLabel} />
      )}
      <select
        className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-800 min-w-[11rem] max-w-[min(100%,20rem)]"
        disabled={disabled}
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            e.target.value === "open"
              ? "open"
              : e.target.value === ""
                ? null
                : Number(e.target.value)
          )
        }
      >
        <option value="open">{openLabel}</option>
        <option value="">{closedLabel}</option>
        {poolIds.map((id) => (
          <option key={id} value={id}>
            #{id} · {translate(translateTable("Goods", `GoodsName${id}`))}
          </option>
        ))}
      </select>
    </div>
  )
}

export function OptionalFoodSlotSelect({
  value,
  openLabel,
  closedLabel,
  poolIds,
  foodDisplayName,
  onChange,
}: {
  value: SlotDraftValue
  openLabel: string
  closedLabel: string
  poolIds: readonly number[]
  foodDisplayName: (foodTypeId: number) => string
  onChange: (nextId: SlotDraftValue) => void
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      {!isFixedSlotValue(value) ? (
        <EmptySlotBadge label={value === "open" ? openLabel : closedLabel} />
      ) : (
        <span
          className="inline-flex w-8 h-8 shrink-0 items-center justify-center rounded border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-600 dark:text-slate-300"
          aria-hidden
        >
          #{value}
        </span>
      )}
      <select
        className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800 min-w-[14rem] max-w-[min(100%,24rem)]"
        value={value ?? ""}
        onChange={(e) =>
          onChange(
            e.target.value === "open"
              ? "open"
              : e.target.value === ""
                ? null
                : Number(e.target.value)
          )
        }
      >
        <option value="open">{openLabel}</option>
        <option value="">{closedLabel}</option>
        {poolIds.map((id) => (
          <option key={id} value={id}>
            Fix food · #{id} · {foodDisplayName(id)}
          </option>
        ))}
      </select>
    </div>
  )
}

export function OptionalSmallGoodieSlotSelect({
  value,
  disabled,
  openLabel = "Open play space",
  closedLabel = "Closed play space",
  poolIds,
  onChange,
}: {
  value: SlotDraftValue
  disabled: boolean
  openLabel?: string
  closedLabel?: string
  poolIds: readonly number[]
  onChange: (nextId: SlotDraftValue) => void
}) {
  return (
    <OptionalGoodieSlotSelect
      value={value}
      disabled={disabled}
      openLabel={openLabel}
      closedLabel={closedLabel}
      poolIds={poolIds}
      onChange={onChange}
    />
  )
}

export function ConfigFold({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <details className="group/config-fold rounded-lg border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 list-none">
        <span>{title}</span>
        <span
          className="text-slate-400 text-xs shrink-0 transition-transform group-open/config-fold:rotate-180"
          aria-hidden
        >
          ▼
        </span>
      </summary>
      <div className="border-t border-slate-200 dark:border-slate-600 px-4 pb-4 pt-2 space-y-3">
        {description ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        ) : null}
        {children}
      </div>
    </details>
  )
}

export function AdvancedSubcard({
  title,
  description,
  children,
}: {
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <details className="group/advanced-subcard rounded-lg border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/20 [&_summary::-webkit-details-marker]:hidden">
      <summary className="cursor-pointer px-3 py-2.5 font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between gap-2 list-none">
        <span>{title}</span>
        <span
          className="text-slate-400 text-xs shrink-0 transition-transform group-open/advanced-subcard:rotate-180"
          aria-hidden
        >
          ▼
        </span>
      </summary>
      <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-3">
        {description ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        ) : null}
        {children}
      </div>
    </details>
  )
}

export function SettingsChoice({
  children,
  align = "start",
  boxed = false,
  className = "",
}: {
  children: ReactNode
  align?: "start" | "center"
  boxed?: boolean
  className?: string
}) {
  const alignClass = align === "center" ? "items-center" : "items-start"
  const boxedClass = boxed
    ? "rounded-md border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-900/20 px-3 py-2"
    : ""
  return (
    <label
      className={`flex ${alignClass} gap-2 cursor-pointer text-sm ${boxedClass} ${className}`}
    >
      {children}
    </label>
  )
}

export function ConfigSection({
  title,
  description,
  children,
  id,
  className,
}: {
  title: string
  description?: string
  children: ReactNode
  id?: string
  className?: string
}) {
  return (
    <div
      id={id}
      className={`rounded-lg border border-slate-200 dark:border-slate-600 bg-white/50 dark:bg-slate-800/50 ${className ?? ""}`}
    >
      <div className="px-4 py-3 space-y-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
        {description ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        ) : null}
        {children}
      </div>
    </div>
  )
}
