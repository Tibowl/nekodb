import { SmallCat } from "../pages/cats/[catId]"

export function isNormalCat(cat: SmallCat) {
    return cat.id < 100
}

export function isRareCat(cat: SmallCat) {
    return cat.id >= 100 && cat.id < 200
}

export function isMyNeko(cat: SmallCat) {
    cat.id > 700
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

export function getIconId(cat: SmallCat) {
    if (iconOverrides.has(cat.id)) {
        return iconOverrides.get(cat.id)
    }

    let iconId = cat.id.toString().padStart(2, "0")
    if (cat.id > 99 && cat.id < 200) {
        iconId = `s${(cat.id - 100).toString().padStart(2, "0")}`
    }
    return iconId
}