import { SmallCat } from "../../pages/cats/[catId]"
import { CatType } from "./catType"

export function getCatType(cat: SmallCat): CatType {
    return getCatTypeById(cat.id)
}

/** Same id rule as {@link getCatType}, accepting just the cat id (no `SmallCat` lookup). */
export function getCatTypeById(catId: number): CatType {
    if (catId < 100)
        return CatType.Normal
    if (catId == 122)
        return CatType.Other
    if (catId < 200)
        return CatType.Rare
    if (catId > 700)
        return CatType.Myneko
    throw new Error("Unknown cat type")
}

/**
 * Same predicate as `App_CatRecord__get_IsRareCat` (`Type == 1`) — cats with id in `[100, 200)`
 * minus the "Other" cat at 122. Used by the memento lottery (rare cats use the −8 come-count
 * offset instead of −30).
 */
export function isRareCatId(catId: number): boolean {
    return getCatTypeById(catId) === CatType.Rare
}
