import { parseBitMap } from "./math/parseBitMap"

export type Vector3 = {
  x: number
  y: number
  z: number
}

type PlaceConfig = {
  "<Id>k__BackingField": number
  "<Attribute>k__BackingField": number
  "<FoodPlaceId>k__BackingField": number
  "<Position>k__BackingField": Vector3
  "<CleanupPlaceIds>k__BackingField": number[]
}

enum PlaceAttribute {
  None = 0,
  Indoor = 1,
  Expanded = 2,
  Large = 4,
  Myneko = 8,
  Food = 16,
  EatMotion = 32,
}

export type ParsedPlace = {
  id: number
  attributes: (keyof typeof PlaceAttribute)[]
  foodPlaceId: number
  position: Vector3
  cleanupPlaceIds: number[]
}

type OtherPlaceConfig = {
  "<Id>k__BackingField": number
  "<Attribute>k__BackingField": number
  "<Position>k__BackingField": Vector3
  "<State>k__BackingField": number
}

enum OtherPlaceAttribute {
  None = 0,
  Indoor = 1,
  Expanded = 2,
  MynekoArea = 4,
  Shinobu = 8,
  Johoya = 16,
  Enquete = 32,
  Helper = 64,
  Zukin = 128,
  Myneko = 256,
  MynekoGoodsPos = 512,
  RemodelPreviewOrigin = 1024,
  RemodelPreviewSlot = 2048,
  Santa = 4096,
  Tamago = 8192,
  Omaturi = 16384,
  Akindo = 32768,
  Coin = 65536,
  Jack = 131072,
  Sit = 262144,
  Stretch = 524288,
  Startle = 1048576,
  Walk = 2097152,
  Run = 4194304
}

export type ParsedOtherPlace = {
  id: number
  attributes: (keyof typeof OtherPlaceAttribute)[]
  position: Vector3
  state: number
}

export type ViewConfig = {
  x: number
  y: number
  width: number
  height: number
}

export type YardAsset = {
  name: string
  url: string
  width: number
  height: number
}

export type YardPrefab = {
  nodes: unknown
  scene: number
  scenes: Array<{ nodes: number[] }>
}

export type YardLayout = {
  idPrefix: string
  places: ParsedPlace[]
  otherPlaces: ParsedOtherPlace[]
  view: ViewConfig[]
  prefab: YardPrefab
  pixelsToUnits: Record<string, number>
  assets: YardAsset[]
}

export function parseYardPlaces(places: PlaceConfig[]): ParsedPlace[] {
  return places.map((place) => {
    const attributes = parseBitMap(place["<Attribute>k__BackingField"]).map(
      (attribute) => PlaceAttribute[1 << attribute] ?? `UnknownBit${attribute}`
    ) as (keyof typeof PlaceAttribute)[]
    return {
      id: place["<Id>k__BackingField"],
      attributes,
      foodPlaceId: place["<FoodPlaceId>k__BackingField"],
      position: place["<Position>k__BackingField"],
      cleanupPlaceIds: place["<CleanupPlaceIds>k__BackingField"],
    }
  })
}

export function parseYardOtherPlaces(places: OtherPlaceConfig[]): ParsedOtherPlace[] {
  return places.map((place) => {
    const attributes = parseBitMap(place["<Attribute>k__BackingField"]).map(
      (attribute) => OtherPlaceAttribute[1 << attribute] ?? `UnknownBit${attribute}`
    ) as (keyof typeof OtherPlaceAttribute)[]
    return {
      id: place["<Id>k__BackingField"],
      attributes,
      position: place["<Position>k__BackingField"],
      state: place["<State>k__BackingField"],
    }
  })
}

export function parseYardView(areas: ViewConfig[]): ViewConfig[] {
  return [...areas].reverse()
}

export function parseYardConfig(
  rawPlaces: { places: PlaceConfig[] },
  rawView: { areas: ViewConfig[] }
): { places: ParsedPlace[]; view: ViewConfig[] } {
  return {
    places: parseYardPlaces(rawPlaces.places),
    view: parseYardView(rawView.areas),
  }
}

export function isSnowLayer(name: string) {
  return name == "winter" || name.endsWith("_winter") || name == "snow" || name.endsWith("_snow")
}

export function yardBgPublicDir(idPrefix: string): string {
  return `/na2-assets/png/bg/${idPrefix}/`
}

export function yardBgAssetsFromPixelsToUnits(
  idPrefix: string,
  pixelsToUnits: Record<string, number>,
  options: { defaultVisibleOnly?: boolean } = {}
): YardAsset[] {
  const names = options.defaultVisibleOnly
    ? Object.keys(pixelsToUnits).filter((name) => !isSnowLayer(name) && name !== "summer")
    : Object.keys(pixelsToUnits)
  return names.map((name) => ({
    name,
    url: `${yardBgPublicDir(idPrefix)}${name}.png`,
    width: 0,
    height: 0,
  }))
}

export async function loadYardLayout(
  idPrefix: string,
  options: {
    includeOtherPlaces?: boolean
    defaultVisibleAssetsOnly?: boolean
  } = {}
): Promise<YardLayout> {
  const [placesMod, otherPlacesMod, viewMod, prefabMod, pixelsMod] = await Promise.all([
    import(`../NekoAtsume2Data/yards/${idPrefix}_places.json`),
    options.includeOtherPlaces
      ? import(`../NekoAtsume2Data/yards/${idPrefix}_otherplaces.json`)
      : Promise.resolve({ default: { places: [] } }),
    import(`../NekoAtsume2Data/yards/${idPrefix}_view.json`),
    import(`../NekoAtsume2Data/prefabs/${idPrefix}_bg.json`),
    import(`../public/na2-assets/png/bg/${idPrefix}/m_PixelsToUnits.json`),
  ])
  const pixelsToUnits = pixelsMod.default as Record<string, number>
  const { places, view } = parseYardConfig(placesMod.default, viewMod.default)
  return {
    idPrefix,
    places,
    otherPlaces: parseYardOtherPlaces(otherPlacesMod.default.places),
    view,
    prefab: prefabMod.default as YardPrefab,
    pixelsToUnits,
    assets: yardBgAssetsFromPixelsToUnits(idPrefix, pixelsToUnits, {
      defaultVisibleOnly: options.defaultVisibleAssetsOnly,
    }),
  }
}
