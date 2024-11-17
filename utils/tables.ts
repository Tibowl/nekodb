import CatRecordTable from "../NekoAtsume2Data/tables/CatRecordTable.json"
import CatVsFoodTable from "../NekoAtsume2Data/tables/CatVsFoodTable.json"

export const cats = CatRecordTable
export const catVsFood = CatVsFoodTable as {
    Id: number
    Dict: Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "7" | "99", number>>
}[]

export function getCat(id: number) {
    return cats.find(cat => cat.Id == id)   
}
export function getCatVsFood(cat: typeof cats[number]) {
    return catVsFood.find(food => food.Id == cat.Id)
}