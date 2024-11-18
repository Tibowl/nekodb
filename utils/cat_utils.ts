import { SmallCat } from "../pages/cats/[catId]"

export enum CatType {
    Normal,
    Rare,
    Myneko,
    Other,
}

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

const catIconOverrides = new Map<number, string>()
catIconOverrides.set(101, "s05")
catIconOverrides.set(103, "s09")
catIconOverrides.set(104, "s03")
catIconOverrides.set(105, "s01")
catIconOverrides.set(106, "s04")
catIconOverrides.set(107, "s06")
catIconOverrides.set(108, "s07")
catIconOverrides.set(109, "s08")

export function getCatIconId(cat: SmallCat): string {
    if (catIconOverrides.has(cat.id)) {
        return catIconOverrides.get(cat.id)!
    }

    let iconId = cat.id.toString().padStart(2, "0")
    if (cat.id > 99 && cat.id < 200) {
        iconId = `s${(cat.id - 100).toString().padStart(2, "0")}`
    }
    return iconId
}

export function getCatIconLink(cat: SmallCat) {
    return getCatIconURL(getCatIconId(cat))
}

export function getCatIconURL(id: string) {
    return `/na2-assets/SpriteAtlas/icon_cat.spriteatlas/${id}.png`
}
