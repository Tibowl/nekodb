/**
 * JSON-only game data for the yard optimizer (avoids importing `utils/tables`,
 * which pulls server-only image helpers into the client bundle).
 */
import CatRecordTable from "../../NekoAtsume2Data/tables/CatRecordTable.json"
import GoodsRecordTable from "../../NekoAtsume2Data/tables/GoodsRecordTable.json"
import PlaySpaceRecordTable from "../../NekoAtsume2Data/tables/PlaySpaceRecordTable.json"
import CatVsFoodTable from "../../NekoAtsume2Data/tables/CatVsFoodTable.json"
import PlaySpaceVsCatTable from "../../NekoAtsume2Data/tables/PlaySpaceVsCatTable.json"
import CatVsCatTable from "../../NekoAtsume2Data/tables/CatVsCatTable.json"
import PlaySpaceVsWeatherTable from "../../NekoAtsume2Data/tables/PlaySpaceVsWeatherTable.json"

export const cats = CatRecordTable
export const goodies = GoodsRecordTable
export const playSpaces = PlaySpaceRecordTable
export const catVsFood = CatVsFoodTable
export const playSpaceVsCat = PlaySpaceVsCatTable
export const catVsCat = CatVsCatTable
export const playSpaceVsWeather = PlaySpaceVsWeatherTable

/** Lookup table for `goodies` keyed by `Id`. Shared by yardSlotBuilder, itemPools, etc. */
export const goodieById = new Map(goodies.map((g) => [g.Id, g]))
