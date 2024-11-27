import CatRecordTable from "../NekoAtsume2Data/tables/CatRecordTable.json"
import CatVsCatTable from "../NekoAtsume2Data/tables/CatVsCatTable.json"
import CatVsFoodTable from "../NekoAtsume2Data/tables/CatVsFoodTable.json"
import FoodRecordTable from "../NekoAtsume2Data/tables/FoodRecordTable.json"
import GoodsRecordTable from "../NekoAtsume2Data/tables/GoodsRecordTable.json"
import PlaySpaceRecordTable from "../NekoAtsume2Data/tables/PlaySpaceRecordTable.json"
import PlaySpaceVsCatTable from "../NekoAtsume2Data/tables/PlaySpaceVsCatTable.json"
import WallpaperRecordTable from "../NekoAtsume2Data/tables/WallpaperRecordTable.json"
import { SmallCat } from "../pages/cats/[catId]"
import { SmallGoodie } from "../pages/goodies/[goodieId]"
import { getCatIconLink } from "./cat/getCatIconLink"
import { getGoodieIconURL } from "./goodie/getGoodieIconURL"
import getImageInfo from "./image/getImageInfo"
import { translate } from "./localization/translate"

export const cats = CatRecordTable
export function getCat(id: number) {
    return cats.find(cat => cat.Id == id)   
}
export type CatRecord = typeof cats[number]
export async function getSmallCat(cat: typeof cats[number]): Promise<SmallCat> {
    return {
        id: cat.Id,
        name: translate("Cat", `CatName${cat.Id}`, "en"),
        image: await getImageInfo(getCatIconLink({ id: cat.Id }))
    }   
}

export const catVsFood = CatVsFoodTable as {
    Id: number
    Dict: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "99", number>>
}[]
export function getCatVsFood(cat: typeof cats[number]) {
    return catVsFood.find(entry => entry.Id == cat.Id)
}

export const catVsCat = CatVsCatTable as {
    Id: number
    Dict: Partial<Record<number, number>>
}[]
export function getCatVsCat(cat: typeof cats[number]) {
    return catVsCat.find(entry => entry.Id == cat.Id)
}


export const goodies = GoodsRecordTable
export function getGoodie(id: number) {
    return goodies.find(goodie => goodie.Id == id)   
}
export type GoodieRecord = typeof goodies[number]
export async function getSmallGoodie(goodie: typeof goodies[number]): Promise<SmallGoodie> {
    const anime = goodie.AnimePngs[0]
    return {
        id: goodie.Id,
        name: translate("Goods", `GoodsName${goodie.Id}`, "en"),
        image: anime && anime != "90ground" ? await getImageInfo(getGoodieIconURL(anime)) : null
    }
}

export const foods = FoodRecordTable
export function getFood(id: number) {
    return foods.find(food => food.Id == id)   
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