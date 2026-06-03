import { foodIconMetaForId } from "../utils/yardOptimizer/clientAssets"
import DisplayImage from "./DisplayImage"

export default function FoodIcon({ food, children, extraClasses = "" }: { food: string, children: React.ReactNode, extraClasses?: string }) {
  const foodId = Number(food)
  const resolved =
    food === "8" || (Number.isFinite(foodId) && foodId > 0)
      ? foodIconMetaForId(food === "8" ? 8 : foodId)
      : null

  if (!resolved) {
    const label = food ? `Food #${food}` : "Food"

    return <div className="flex flex-row items-center gap-2 p-2">
      <span aria-hidden="true" className="inline-flex h-6 min-w-9 items-center justify-center rounded bg-gray-200 px-1 text-xs font-semibold text-gray-700 dark:bg-slate-700 dark:text-slate-100">
        {label}
      </span>
      <div>{children}</div>
    </div>
  }

  return <div className="flex flex-row items-center gap-2 p-2">
    <DisplayImage img={{
      url: resolved.url,
      width: resolved.width,
      height: resolved.height,
    }} alt={resolved.name} className={`max-h-6 max-w-9 w-auto ${extraClasses}`} />
    <div>{children}</div>
  </div>
}
