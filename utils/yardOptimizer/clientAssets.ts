import type { ImageMetaData } from "../../components/DisplayImage"
import { getCatIconId } from "../cat/getCatIconId"
import { getCatIconURL } from "../cat/getCatIconURL"
import { getCatTypeById } from "../cat/getCatType"
import { CatType } from "../cat/catType"
import { getGoodieIconURL } from "../goodie/getGoodieIconURL"
import { goodies } from "./gameData"

/** Food bowl sprites (types 1–7) shared with `FoodIcon`. */
const FOOD_ICON_BY_TYPE: Record<number, ImageMetaData> = {
  1: { url: getGoodieIconURL("08meshi_karikari"), width: 220, height: 111 },
  2: { url: getGoodieIconURL("08meshi_karikari_high"), width: 220, height: 111 },
  3: { url: getGoodieIconURL("08meshi_nekokan"), width: 162, height: 118 },
  4: { url: getGoodieIconURL("08meshi_f00"), width: 164, height: 125 },
  5: { url: getGoodieIconURL("08meshi_nekokan_high"), width: 162, height: 117 },
  6: { url: getGoodieIconURL("08meshi_sashimi"), width: 263, height: 98 },
  7: { url: getGoodieIconURL("08meshi_sashimi2"), width: 364, height: 149 },
}

const FOOD_DISPLAY_NAMES: Record<number, string> = {
  1: "Thrifty Bitz",
  2: "Frisky Bitz",
  3: "Ritzy Bitz",
  4: "Bonito Bitz",
  5: "Deluxe Tuna Bitz",
  6: "Sashimi",
  7: "Sashimi Boat",
  8: "Small Glass Bottle",
}

const BOTTLE_FOOD_ICON: ImageMetaData = {
  url: getCatIconURL(`takara_${String(62).padStart(3, "0")}`),
  width: 108,
  height: 145,
}

/** Resolve food icon metadata for ids 1–8 (8 = glass bottle). */
export function foodIconMetaForId(foodId: number): ImageMetaData & { name: string } | null {
  if (foodId === 8) {
    return { ...BOTTLE_FOOD_ICON, name: FOOD_DISPLAY_NAMES[8]! }
  }
  const icon = FOOD_ICON_BY_TYPE[foodId]
  if (!icon) return null
  return {
    ...icon,
    name: FOOD_DISPLAY_NAMES[foodId] ?? `Food #${foodId}`,
  }
}

/** Static sprite for a food type id 1–7 (same layout hook as `catIconImageMeta`). */
export function foodIconImageMeta(foodId: number): ImageMetaData {
  return FOOD_ICON_BY_TYPE[foodId] ?? FOOD_ICON_BY_TYPE[1]!
}

/** Static sprite URL for a cat icon (same assets as the Cats tab). */
export function catIconImageMeta(catId: number): ImageMetaData {
  const url = getCatIconURL(getCatIconId({ id: catId }))
  return { url, width: 48, height: 48 }
}

/** First shop icon for a goodie id, or null (e.g. placeholder ground). */
export function goodieIconImageMeta(goodieId: number): ImageMetaData | null {
  const g = goodies.find((x) => x.Id === goodieId)
  const anime = g?.AnimePngs?.[0]
  if (!anime || anime === "90ground") return null
  return {
    url: getGoodieIconURL(anime),
    width: 220,
    height: 111,
  }
}

/** Match `pages/cats` grouping (Normal / Rare / Other). */
export type CatGroup = "normal" | "rare" | "other"

export function catGroupForId(id: number): CatGroup {
  // Defer to the canonical cat-type rule in utils/cat/getCatType. That helper
  // throws for IDs outside the known ranges (e.g. [200, 700]); preserve the
  // previous silent-fallback to "other" for those.
  try {
    const type = getCatTypeById(id)
    if (type === CatType.Normal) return "normal"
    if (type === CatType.Rare) return "rare"
    return "other" // Other or Myneko
  } catch {
    return "other"
  }
}
