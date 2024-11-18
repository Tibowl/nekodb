import CatRecordTable from "../NekoAtsume2Data/tables/CatRecordTable.json"
import CatVsFoodTable from "../NekoAtsume2Data/tables/CatVsFoodTable.json"
import GoodsRecordTable from "../NekoAtsume2Data/tables/GoodsRecordTable.json"
import PlaySpaceRecordTable from "../NekoAtsume2Data/tables/PlaySpaceRecordTable.json"
import PlaySpaceVsCatTable from "../NekoAtsume2Data/tables/PlaySpaceVsCatTable.json"
import WallpaperRecordTable from "../NekoAtsume2Data/tables/WallpaperRecordTable.json"

import { translate } from "./localization"

export const cats = CatRecordTable
export function getCat(id: number) {
    return cats.find(cat => cat.Id == id)   
}
export function getSmallCat(cat: typeof cats[number]) {
    return {
        id: cat.Id,
        name: translate("Cat", `CatName${cat.Id}`, "en"),
    }   
}

export const catVsFood = CatVsFoodTable as {
    Id: number
    Dict: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "99", number>>
}[]
export function getCatVsFood(cat: typeof cats[number]) {
    return catVsFood.find(food => food.Id == cat.Id)
}


export const goodies = GoodsRecordTable
export function getGoodie(id: number) {
    return goodies.find(goodie => goodie.Id == id)   
}
export function getSmallGoodie(goodie: typeof goodies[number]) {
    return {
        id: goodie.Id,
        name: translate("Goods", `GoodsName${goodie.Id}`, "en"),
        anime: goodie.AnimePngs[0]
    }
}

export const playSpaces = PlaySpaceRecordTable
export function getPlaySpace(id: number) {
    return playSpaces.find(playSpace => playSpace.Id == id)   
}

export const playSpaceVsCat = PlaySpaceVsCatTable as {
    Id: number
    Dict: Partial<Record<number, number[]>>
}[]
export function getPlaySpaceVsCat(playSpace: typeof playSpaces[number]) {
    return playSpaceVsCat.find(ps => ps.Id == playSpace.Id)
}

export const wallpapers = WallpaperRecordTable