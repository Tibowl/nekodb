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

const iconOverrides = new Map<number, string>()
iconOverrides.set(101, "s05")
iconOverrides.set(103, "s09")
iconOverrides.set(104, "s03")
iconOverrides.set(105, "s01")
iconOverrides.set(106, "s04")
iconOverrides.set(107, "s06")
iconOverrides.set(108, "s07")
iconOverrides.set(109, "s08")

export function getIconId(cat: SmallCat): string {
    if (iconOverrides.has(cat.id)) {
        return iconOverrides.get(cat.id)!
    }

    let iconId = cat.id.toString().padStart(2, "0")
    if (cat.id > 99 && cat.id < 200) {
        iconId = `s${(cat.id - 100).toString().padStart(2, "0")}`
    }
    return iconId
}

export function getIconLink(cat: SmallCat) {
    return getIconURL(getIconId(cat))
}

export function getIconURL(id: string) {
    return `/cat/SpriteAtlas/icon_cat.spriteatlas/${id}.png`
}
