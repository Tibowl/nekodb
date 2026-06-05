import DisplayImage, { type ImageMetaData } from "../DisplayImage"
import { goodieIconImageMeta } from "../../utils/yardOptimizer/clientAssets"
import { goodieIsLargeForYard } from "../../utils/yardOptimizer/yardCore"
import {
  GOODIE_CATEGORY_FILTER_OPTIONS,
  GOODIE_RECORD_BY_ID,
  SHOP_GOODIE_IDS_IN_ORDER,
} from "./goodieShopData"

function representativeGoodieForFilter(label: string): ImageMetaData | null {
  const candidateId = SHOP_GOODIE_IDS_IN_ORDER.find((id) => {
    const record = GOODIE_RECORD_BY_ID.get(id)
    if (!record) return false
    if (label === "Large") return goodieIsLargeForYard(record)
    if (label === "Small") return !goodieIsLargeForYard(record)
    if (label === "Limited") return Boolean(record.SellableMonths)
    const category = GOODIE_CATEGORY_FILTER_OPTIONS.find((option) => option.label === label)
    return category ? (record.Category & category.bit) !== 0 : false
  })
  return candidateId ? goodieIconImageMeta(candidateId) : null
}

export function GoodieFilterChip({ label }: { label: string }) {
  const img = representativeGoodieForFilter(label)
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
      {img ? (
        <DisplayImage
          img={img}
          alt=""
          className="h-5 w-6 shrink-0 object-contain"
        />
      ) : null}
      <span>{label}</span>
    </span>
  )
}
