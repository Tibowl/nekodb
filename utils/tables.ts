import CatRecordTable from "../NekoAtsume2Data/tables/CatRecordTable.json"
import CatVsCatTable from "../NekoAtsume2Data/tables/CatVsCatTable.json"
import CatVsFoodTable from "../NekoAtsume2Data/tables/CatVsFoodTable.json"
import FoodRecordTable from "../NekoAtsume2Data/tables/FoodRecordTable.json"
import GoodsRecordTable from "../NekoAtsume2Data/tables/GoodsRecordTable.json"
import LetterRecordTable from "../NekoAtsume2Data/tables/LetterRecordTable.json"
import MynekoPartsRecordTable from "../NekoAtsume2Data/tables/MynekoPartsRecordTable.json"
import PlaySpaceRecordTable from "../NekoAtsume2Data/tables/PlaySpaceRecordTable.json"
import PlaySpaceVsCatTable from "../NekoAtsume2Data/tables/PlaySpaceVsCatTable.json"
import PlaySpaceVsWeatherTable from "../NekoAtsume2Data/tables/PlaySpaceVsWeatherTable.json"
import SealDecoRecordTable from "../NekoAtsume2Data/tables/SealDecoRecordTable.json"
import WallpaperRecordTable from "../NekoAtsume2Data/tables/WallpaperRecordTable.json"
import YardRecordTable from "../NekoAtsume2Data/tables/YardRecordTable.json"
import { SmallCat } from "../pages/cats/[catId]"
import { DecoType } from "../pages/deco"
import { SmallDeco } from "../pages/deco/[decoId]"
import { SmallGoodie } from "../pages/goodies/[goodieId]"
import { SmallYard } from "../pages/yards/[yardId]"
import { getCatIconLink } from "./cat/getCatIconLink"
import { getDecoIconURL } from "./goodie/getDecoIconURL"
import { getGoodieIconURL } from "./goodie/getGoodieIconURL"
import getImageInfo from "./image/getImageInfo"
import { translate } from "./localization/translate"

export const cats = CatRecordTable
export function getCat(id: number) {
    return cats.findLast(cat => cat.Id == id)
}
export type CatRecord = typeof cats[number]
export async function getSmallCat(cat: typeof cats[number]): Promise<SmallCat> {
    return {
        id: cat.Id,
        name: translate("Cat", `CatName${cat.Id}`),
        image: await getImageInfo(getCatIconLink({ id: cat.Id }))
    }
}

export const catVsFood = CatVsFoodTable as {
    Id: number
    Dict: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "8", number>>
}[]
export function getCatVsFood(cat: typeof cats[number]) {
    return catVsFood.findLast(entry => entry.Id == cat.Id)
}

export const catVsCat = CatVsCatTable as {
    Id: number
    Dict: Partial<Record<number, number>>
}[]
export function getCatVsCat(cat: typeof cats[number]) {
    return catVsCat.findLast(entry => entry.Id == cat.Id)
}


export const goodies = GoodsRecordTable
export function getGoodie(id: number) {
    return goodies.find(goodie => goodie.Id == id)
}
export type GoodieRecord = typeof goodies[number]
export function getGoodieName(goodieId: number) {
    return translate("Goods", `GoodsName${goodieId}`)
}
export async function getSmallGoodie(goodie: typeof goodies[number]): Promise<SmallGoodie> {
    const anime = goodie.AnimePngs[0]
    return {
        id: goodie.Id,
        name: getGoodieName(goodie.Id),
        image: anime && anime != "90ground" ? await getImageInfo(getGoodieIconURL(anime)) : null
    }
}

export const foods = FoodRecordTable
export function getFood(id: number) {
    return foods.findLast(food => food.Id == id)
}

export const playSpaces = PlaySpaceRecordTable
export function getPlaySpace(id: number) {
    return playSpaces.findLast(playSpace => playSpace.Id == id)
}

export const playSpaceVsCat = PlaySpaceVsCatTable as {
    Id: number
    Dict: Partial<Record<number, number[]>>
    Dict2: Partial<Record<number, number[]>>
}[]
export function getPlaySpaceVsCat(playSpace: typeof playSpaces[number]) {
    return playSpaceVsCat.findLast(ps => ps.Id == playSpace.Id)
}
export type WeatherType = "Spring" | "Summer" | "Winter" | "Snow" | "Autum" | "Burning"
export const playSpaceVsWeather = PlaySpaceVsWeatherTable as {
    Id: number
    Dict: Partial<Record<WeatherType, number[]>>
}[]
export function getPlaySpaceVsWeather(playSpace: typeof playSpaces[number]) {
    return playSpaceVsWeather.findLast(ps => ps.Id == playSpace.Id)
}

export const wallpapers = WallpaperRecordTable

export const yards = YardRecordTable.filter((yard, index, self) => self.findLastIndex(predicate => predicate.Id == yard.Id) == index)
export function getYard(id: number) {
    return yards.findLast(yard => yard.Id == id)
}
export type YardRecord = typeof yards[number]
export function getSmallYard(yard: YardRecord): SmallYard {
    return {
        id: yard.Id,
        name: translate("Yard", `YardName${yard.Id}`)
    }
}


export const mynekoParts = MynekoPartsRecordTable
export function getMynekoPart(id: number) {
    return mynekoParts.findLast(part => part.Id == id)
}
export type MynekoPartRecord = typeof mynekoParts[number]

export const letters = LetterRecordTable
export type LetterRecord = typeof letters[number]


export const decos = SealDecoRecordTable
export function getDeco(id: number) {
    return decos.find(deco => deco.Id == id)
}
export type DecoRecord = typeof decos[number]
export function getDecoName(decoId: number) {
    return translate("Seal", `SealDecoName${decoId}`)
}
export async function getSmallDeco(deco: typeof decos[number]): Promise<SmallDeco> {
    const type = deco.DecoTypeInt == 1 ? DecoType.Bg : DecoType.Deco
    return {
        id: deco.Id,
        name: getDecoName(deco.Id),
        image: await getImageInfo(getDecoIconURL(deco.Id)),
        type
    }
}
