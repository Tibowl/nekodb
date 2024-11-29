import { readdir } from "fs/promises"
import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { useState } from "react"
import { CheckboxInput } from "../../components/CheckboxInput"
import Cost from "../../components/Cost"
import DisplayImage, { ImageMetaData } from "../../components/DisplayImage"
import getImageInfo from "../../utils/image/getImageInfo"
import { parseBitMap } from "../../utils/math/parseBitMap"
import { getSmallYard, getYard, yards } from "../../utils/tables"

export type SmallYard = {
  id: number
  name: string
};

export type Yard = SmallYard & {
  silver: number
  gold: number

  places: ParsedPlace[]
  otherPlaces: ParsedOtherPlace[]
  view: ViewConfig[]

  assets: ImageMetaData[]
};

type YardInfo = { yard: Yard }

type Vector3 = {
  "x": number
  "y": number
  "z": number
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
}
type ParsedPlace = {
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
}
type ParsedOtherPlace = {
  id: number
  attributes: (keyof typeof OtherPlaceAttribute)[]
  position: Vector3
  state: number
}

type ViewConfig = {
  x: number
  y: number
  width: number
  height: number
}
export const getStaticProps = (async (context) => {
  const yard = getYard(Number(context.params?.yardId))

  if (!yard) {
    return {
      notFound: true,
    }
  }

  const idPrefix = yard.Id.toString().padStart(3, "0")

  const bgPath = `/na2-assets/bg/${idPrefix}/`
  const yardAssets = await readdir(`public/${bgPath}`)
  const assets = yardAssets.map(async (asset) => {return { name: asset.replace(".png", ""), ...await getImageInfo(`${bgPath}${asset}`) }})

  const places = require(`../../public/na2-assets/Scenes/Yard/Data/${idPrefix}_places.json`)
  const yardOtherPlaces = require(`../../public/na2-assets/Scenes/Yard/Data/${idPrefix}_otherplaces.json`)
  const view = require(`../../public/na2-assets/Scenes/Yard/Data/${idPrefix}_view.json`)

  const parsedPlaces: ParsedPlace[] = (places.places as PlaceConfig[]).map(place => {
    const attributes = parseBitMap(place["<Attribute>k__BackingField"]).map(attribute => PlaceAttribute[1 << attribute]) as (keyof typeof PlaceAttribute)[]
    return {
      id: place["<Id>k__BackingField"],
      attributes,
      foodPlaceId: place["<FoodPlaceId>k__BackingField"],
      position: place["<Position>k__BackingField"],
      cleanupPlaceIds: place["<CleanupPlaceIds>k__BackingField"],
    }
  })

  const parsedOtherPlaces: ParsedOtherPlace[] = (yardOtherPlaces.places as OtherPlaceConfig[]).map(place => {
    const attributes = parseBitMap(place["<Attribute>k__BackingField"]).map(attribute => OtherPlaceAttribute[1 << attribute]) as (keyof typeof OtherPlaceAttribute)[]
    return {
      id: place["<Id>k__BackingField"],
      attributes,
      position: place["<Position>k__BackingField"],
      state: place["<State>k__BackingField"],
    }
  })

  const parsedView = [...(view.areas as ViewConfig[])].reverse()

  return {
    props: {
      yard: {
        ...getSmallYard(yard),

        silver: yard.Silver,
        gold: yard.Gold,

        places: parsedPlaces,
        otherPlaces: parsedOtherPlaces,
        view: parsedView,

        assets: await Promise.all(assets)
      },
    },
  }
}) satisfies GetStaticProps<YardInfo>


export const getStaticPaths = (async () => {
  return {
    paths: yards.map((yard) => ({ params: { yardId: yard.Id.toString() } })),
    fallback: false,
  }
})


function viewColors(i: number) {
  return `hsl(${i * 360 / 8}, 100%, 50%)`
}
function viewFillColors(i: number) {
  return `hsla(${i * 360 / 8}, 100%, 50%, 0.1)`
}
function placeColor(place: ParsedPlace) {
  // Indoor
  // Expanded
  // Large
  // Myneko
  // Food

  if (place.attributes.includes("Food")) {
    return "yellow"
  }
  if (place.attributes.includes("Myneko")) {
    if (place.attributes.includes("Large")) {
      return "darkblue"
    }
    return "gray"
  }
  if (place.attributes.includes("Large")) {
    return "blue"
  }
  return "red"
}
function otherPlaceColor(place: ParsedOtherPlace) {
  if (place.attributes.includes("RemodelPreviewOrigin")) {
    return "purple"
  }
  if (place.attributes.includes("RemodelPreviewSlot")) {
    return "magenta"
  }
  return "pink"
}


const nameReplacements: Record<string, string|undefined> = {
  "RemodelPreviewSlot": "RPS",
  "RemodelPreviewOrigin": "RPO",
  // "MynekoGoodsPos": "MGP",
}
export default function Goodie({ yard }: InferGetStaticPropsType<typeof getStaticProps>) {
  const largestView = yard.view.reduce((prev, current) => {
    return (prev.width * prev.height) > (current.width * current.height) ? prev : current
  })
  const hasExpansion = yard.places.some(predicate => predicate.attributes.includes("Expanded"))

  const [showText, setShowText] = useState(true)

  const misc = yard.assets.filter(asset => !asset.name.match(/^[0-9]+/))
  const assetsGroupedByType = yard.assets.reduce((prev, current) => {
    const type = current.name.split("_")[0]
    if (type.match(/^[0-9]+$/)) {
      if (!prev[type]) {
        prev[type] = []
      }
      prev[type].push(current)
    }
    return prev
  }, {} as Record<string, (ImageMetaData & {name: string})[]>)
  assetsGroupedByType["Misc"] = misc

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>{`${yard.name} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${yard.name} - NekoDB`} />
        <meta property="og:description" content={`Discover all locations and their attributes in ${yard.name} in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all locations and their attributes in ${yard.name} in Neko Atsume 2!`} />
      </Head>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{yard.name}</h1>
          </div>
        </div>
      </div>
      <h2 className="text-xl font-bold" id="base-stats">Base stats</h2>
      <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
        {yard.silver > 0 && <>
          <div className="font-semibold">Silver cost</div>
          <div className="text-right"><Cost count={yard.silver} type="silver" /></div>
        </>}

        {yard.gold > 0 && <>
          <div className="font-semibold">Gold cost</div>
          <div className="text-right"><Cost count={yard.gold} type="gold" /></div>
        </>}
      </div>

      <h2 className="text-xl font-bold" id="places">Places</h2>
      <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
        <CheckboxInput label="Show text" set={setShowText} value={showText} />
        <div className={showText ? "": "opacity-50"}>
          <h3 className="font-bold">Legend</h3>
          <div className="flex flex-row flex-wrap gap-4">
            {Object.entries(nameReplacements).map(([key, value], i) => <div key={i} className="flex flex-row gap-2 items-center">
              <div className="font-semibold">{value ?? key}</div>
              <div className="text-right">{key}</div>
            </div>)}
          </div>
        </div>
        <svg viewBox={`${largestView.x} ${largestView.y} ${largestView.width} ${largestView.height}`} className="w-full h-full">
          {yard.view.map((view, i) => <g key={i}>
            <rect x={view.x} y={view.y} width={view.width} height={view.height} visibility={!hasExpansion && i == 2 ? "hidden" : "visible"}
              vectorEffect="non-scaling-stroke" fill={viewFillColors(yard.view.length - 1 - i)} stroke={viewColors(yard.view.length - 1 - i)} strokeWidth="5"/>
          </g>)}
          {yard.otherPlaces.map((place, i) => <YardOtherPlace key={i} place={place} places={yard.places} showText={showText} />)}
          <YardPlaces places={yard.places} showText={showText} />
        </svg>
      </div>

      <h2 className="text-xl font-bold" id="assets">Assets</h2>
      <div className="flex flex-col flex-wrap gap-2">
        {Object.entries(assetsGroupedByType).sort(([a], [b]) => Number(a) - Number(b)).map(([_, assets], i) =>
          <div className="flex flex-row flex-wrap gap-2" key={i}>
            {assets.map((asset, i) =>
              <div key={i}>
                <div className="bg:gray-100 dark:bg-slate-800 rounded-md flex flex-col items-center justify-center gap-2 p-2">
                  <div className="max-w-96">
                    <a href={asset.url} target="_blank" rel="noreferrer">
                      <DisplayImage key={i} img={asset} alt={asset.url} />
                    </a>
                  </div>
                  <div>{asset.name}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

function YardPlaces({ places, showText }: { places: ParsedPlace[], showText: boolean }) {
  return <g>
    {places.map((place, i) => <YardPlaceLines key={i} place={place} places={places} />)}
    {places.map((place, i) => <YardPlace key={i} place={place} showText={showText} />)}
  </g>
}

function YardPlaceLines({ place, places }: { place: ParsedPlace, places: ParsedPlace[] }) {
  const foodPlace = places.find(predicate => predicate.id == place.foodPlaceId)
  const cleanupPlaces = places.filter(predicate => place.cleanupPlaceIds.includes(predicate.id))

  return <g>
    {foodPlace && <path d={`M ${place.position.x} ${-place.position.y} L ${foodPlace.position.x} ${-foodPlace.position.y}`} vectorEffect="non-scaling-stroke" stroke="yellow" strokeWidth="2" strokeLinecap="round"/>}
    {cleanupPlaces.map((cleanupPlace, i) => <path key={i} d={`M ${place.position.x} ${-place.position.y} L ${cleanupPlace.position.x} ${-cleanupPlace.position.y}`} vectorEffect="non-scaling-stroke" stroke="blue" strokeWidth="1" strokeLinecap="round"/>)}
  </g>
}

function YardPlace({ place, showText }: { place: ParsedPlace, showText: boolean }) {
  return <g>
    <path d={`M ${place.position.x} ${-place.position.y} l 0.0001 0`} vectorEffect="non-scaling-stroke" stroke={placeColor(place)} strokeWidth="10" strokeLinecap="round"/>
    {showText && <text x={place.position.x} y={-place.position.y + 0.75} textAnchor="middle" alignmentBaseline="middle" fill="white" fontSize="0.5px">{mappedAttributes(place.attributes)}</text>}
  </g>
}

function YardOtherPlace({ place, places, showText }: { place: ParsedOtherPlace, places: ParsedPlace[], showText: boolean }) {
  if (place.attributes.includes("MynekoGoodsPos")) {
    const target = places.find(predicate => predicate.id == place.state)
    if (target)
      return <path d={`M ${place.position.x} ${-place.position.y} L ${target.position.x} ${-target.position.y}`} vectorEffect="non-scaling-stroke" stroke="gray" strokeWidth="1" strokeLinecap="round"/>
  }
  return <g>
    <path d={`M ${place.position.x} ${-place.position.y} l 0.0001 0`} vectorEffect="non-scaling-stroke" stroke={otherPlaceColor(place)} strokeWidth="10" strokeLinecap="round"/>
    {showText && <text x={place.position.x} y={-place.position.y + 0.75} textAnchor="middle" alignmentBaseline="middle" fill="white" fontSize="0.5px">{mappedAttributes(place.attributes)}: {place.state}</text>}
  </g>
}

function mappedAttributes(attributes: string[]) {
  return attributes.map(attribute => nameReplacements[attribute] ?? attribute).join(", ")
}
