import {
  cats,
  catVsCat,
  catVsFood,
  playSpaceVsWeather,
  playSpaces,
} from "../gameData"

export type AnalyzerStaticData = {
  playspaceRecordIds: Set<number>
  playspaceMappings: {
    silverMul: Record<number, number>
    itemId: Record<number, number>
    charm: Record<number, number>
    conflictedIdxs: Record<number, number[]>
  }
  catToSilverMul: Record<number, number>
  catToWeatherImpact: Record<number, number>
  catVsCatAll: Record<number, Record<string, number>>
}

let cached: AnalyzerStaticData | null = null

export function getAnalyzerStaticData(): AnalyzerStaticData {
  if (cached) return cached

  const playspaceRecordIds = new Set<number>()
  const silverMul: Record<number, number> = {}
  const itemId: Record<number, number> = {}
  const charm: Record<number, number> = {}
  const conflictedIdxs: Record<number, number[]> = {}

  for (const ps of playSpaces) {
    playspaceRecordIds.add(ps.Id)
    silverMul[ps.Id] = ps.Niboshi
    itemId[ps.Id] = ps.ItemId
    charm[ps.Id] = ps.Charm
    const ci = ps.ConflictIndices
    conflictedIdxs[ps.Id] = Array.isArray(ci) ? ci : []
  }

  const catToSilverMul: Record<number, number> = {}
  const catToWeatherImpact: Record<number, number> = {}
  for (const c of cats) {
    catToSilverMul[c.Id] = c.Niboshi
    catToWeatherImpact[c.Id] = c.WeatherImpact
  }

  const catVsCatAll: Record<number, Record<string, number>> = {}
  for (const row of catVsCat) {
    catVsCatAll[row.Id] = (row.Dict ?? {}) as Record<string, number>
  }

  cached = {
    playspaceRecordIds,
    playspaceMappings: { silverMul, itemId, charm, conflictedIdxs },
    catToSilverMul,
    catToWeatherImpact,
    catVsCatAll,
  }
  return cached
}

function createCatVsFoodDict(foodType: number): Record<number, number> {
  const out: Record<number, number> = {}
  for (const row of catVsFood) {
    const v = row.Dict?.[String(foodType) as keyof typeof row.Dict]
    out[row.Id] = v ?? 0
  }
  return out
}

/** Only ~7 food types; reuse the same dict across analyzer instances. */
const catVsFoodCache = new Map<number, Record<number, number>>()
export function getCatVsFoodDictCached(foodType: number): Record<number, number> {
  let d = catVsFoodCache.get(foodType)
  if (!d) {
    d = createCatVsFoodDict(foodType)
    catVsFoodCache.set(foodType, d)
  }
  return d
}

function createPlayspaceWeatherDict(weather: string): Record<number, number> {
  const out: Record<number, number> = {}
  for (const row of playSpaceVsWeather) {
    const v = row.Dict?.[weather as keyof typeof row.Dict]
    out[row.Id] = v ?? 0
  }
  return out
}

const weatherMulCache = new Map<string, Record<number, number>>()
export function getPlayspaceWeatherDictCached(
  weather: string
): Record<number, number> {
  let d = weatherMulCache.get(weather)
  if (!d) {
    d = createPlayspaceWeatherDict(weather)
    weatherMulCache.set(weather, d)
  }
  return d
}
