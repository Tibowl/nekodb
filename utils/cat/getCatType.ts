import { SmallCat } from "../../pages/cats/[catId]"
import { CatType } from "./catType"

export function getCatType(cat: SmallCat): CatType {
    if (cat.id < 100)
        return CatType.Normal
    if (cat.id == 122)
        return CatType.Other
    if (cat.id < 200)
        return CatType.Rare
    if (cat.id > 700)
        return CatType.Myneko
    throw new Error("Unknown cat type")
}
