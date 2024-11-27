import { SmallCat } from "../../pages/cats/[catId]"

const catIconOverrides = new Map<number, string>()
catIconOverrides.set(101, "s05")
catIconOverrides.set(103, "s09")
catIconOverrides.set(104, "s03")
catIconOverrides.set(105, "s01")
catIconOverrides.set(106, "s04")
catIconOverrides.set(107, "s06")
catIconOverrides.set(108, "s07")
catIconOverrides.set(109, "s08")

export function getCatIconId(cat: Pick<SmallCat, "id">): string {
    if (catIconOverrides.has(cat.id)) {
        return catIconOverrides.get(cat.id)!
    }

    let iconId = cat.id.toString().padStart(2, "0")
    if (cat.id > 99 && cat.id < 200) {
        iconId = `s${(cat.id - 100).toString().padStart(2, "0")}`
    }
    return iconId
}
