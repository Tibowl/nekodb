import SpecialGoodsRecordTable from "../../NekoAtsume2Data/tables/SpecialGoodsRecordTable.json"
import { goodies } from "../../utils/yardOptimizer/gameData"
import { goodieIsLargeForYard } from "../../utils/yardOptimizer/yardCore"

const SHOP_CELLS_PER_GAME_PAGE = 4
const SHOP_CURRENT_MONTH = new Date().getMonth() + 1

export type OptimizerGoodieRecord = {
  Id: number
  IsDebug: boolean
  IsForceNotForSale: boolean
  Silver: number
  Gold: number
  Attribute: number
  AnimePngs?: string[]
  AnimeXmls?: string[]
  BackActionIds?: number[] | null
  FrontActionIds?: number[] | null
  Toughness?: number
  RepairPattern?: number
  Category: number
  DisplayOrder: number
  DisplayOrderInTrade: number
  StampCard?: number
  SellableMonths?: number[] | null
}

type OptimizerSpecialShopRecord = {
  Id: number
  IsDebug: boolean
  Silver: number
  Gold: number
  StampCard: number
  IapId: number
  DisplayOrderInShop: number
  DisplayOrderInTrade: number
}

export type GoodieGameFinderInfo = {
  sourceLabel: string
  filterOptions: string[]
  hint: string
  sourceRank: number
  sourceIndex: number
}

const OPTIMIZER_GOODIE_RECORDS = goodies as OptimizerGoodieRecord[]
const OPTIMIZER_SPECIAL_SHOP_RECORDS =
  SpecialGoodsRecordTable as OptimizerSpecialShopRecord[]

export const GOODIE_RECORD_BY_ID = new Map(
  OPTIMIZER_GOODIE_RECORDS.map((goodie) => [goodie.Id, goodie])
)

export const GOODIE_CATEGORY_FILTER_OPTIONS = [
  { bit: 2, label: "Balls" },
  { bit: 4, label: "Cardboards" },
  { bit: 8, label: "Cushions" },
  { bit: 16, label: "Athletic" },
  { bit: 32, label: "Toys" },
  { bit: 64, label: "Cold" },
  { bit: 128, label: "Warm" },
  { bit: 256, label: "Container" },
  { bit: 512, label: "Outdoor" },
  { bit: 1024, label: "Other" },
]

function goodieIsVisibleInCurrentShopMonth(
  goodie: OptimizerGoodieRecord
): boolean {
  return !goodie.SellableMonths || goodie.SellableMonths.includes(SHOP_CURRENT_MONTH)
}

export const SHOP_ITEMS_IN_ORDER = [
  ...OPTIMIZER_GOODIE_RECORDS
    .filter(
      (goodie) =>
        goodie.DisplayOrder > 0 &&
        !goodie.IsDebug &&
        !goodie.IsForceNotForSale &&
        goodieIsVisibleInCurrentShopMonth(goodie) &&
        (goodie.Silver >= 0 || goodie.Gold >= 0 || (goodie.StampCard ?? -1) >= 0)
    )
    .map((goodie) => ({
      kind: "goodie" as const,
      id: goodie.Id,
      displayOrder: goodie.DisplayOrder,
      secondaryOrder: goodie.DisplayOrderInTrade,
    })),
  ...OPTIMIZER_SPECIAL_SHOP_RECORDS
    .filter(
      (item) =>
        item.DisplayOrderInShop > 0 &&
        !item.IsDebug &&
        (item.Silver >= 0 ||
          item.Gold >= 0 ||
          item.StampCard >= 0 ||
          item.IapId >= 0)
    )
    .map((item) => ({
      kind: "special" as const,
      id: item.Id,
      displayOrder: item.DisplayOrderInShop,
      secondaryOrder: item.DisplayOrderInTrade,
    })),
]
  .sort(
    (a, b) =>
      a.displayOrder - b.displayOrder ||
      a.secondaryOrder - b.secondaryOrder ||
      a.id - b.id
  )

export const SHOP_GOODIE_IDS_IN_ORDER = SHOP_ITEMS_IN_ORDER
  .filter((item) => item.kind === "goodie")
  .map((item) => item.id)

export function goodieFilterOptions(goodieId: number): string[] {
  const record = GOODIE_RECORD_BY_ID.get(goodieId)
  return record
    ? [
        goodieIsLargeForYard(record) ? "Large" : "Small",
        ...GOODIE_CATEGORY_FILTER_OPTIONS.filter(({ bit }) => (record.Category & bit) !== 0)
          .map(({ label }) => label),
        ...(record.SellableMonths ? ["Limited"] : []),
      ]
    : []
}

export function goodieGameFinderInfo(goodieId: number): GoodieGameFinderInfo {
  const record = GOODIE_RECORD_BY_ID.get(goodieId)
  const filterOptions = goodieFilterOptions(goodieId)
  const shopIndex = SHOP_ITEMS_IN_ORDER.findIndex(
    (item) => item.kind === "goodie" && item.id === goodieId
  )
  const filters = filterOptions.length > 0
    ? `Goodies filter: ${filterOptions.join(", ")}`
    : "Goodies filter: check game list"
  if (record && (record.StampCard ?? -1) > 0 && record.DisplayOrderInTrade > 0) {
    return {
      sourceLabel: `Stamp trade ${record.DisplayOrderInTrade}`,
      filterOptions,
      hint: `Stamp trade item ${record.DisplayOrderInTrade}; ${filters}`,
      sourceRank: 1,
      sourceIndex: record.DisplayOrderInTrade,
    }
  }
  if (shopIndex >= 0) {
    const shopPage = Math.floor(shopIndex / SHOP_CELLS_PER_GAME_PAGE) + 1
    return {
      sourceLabel: `Shop page ${shopPage}`,
      filterOptions,
      hint: `Shop page ${shopPage}; ${filters}`,
      sourceRank: 0,
      sourceIndex: shopPage,
    }
  }
  return {
    sourceLabel: "Special/trade list",
    filterOptions,
    hint: `Check special or trade lists; ${filters}`,
    sourceRank: 2,
    sourceIndex: Number.MAX_SAFE_INTEGER,
  }
}
