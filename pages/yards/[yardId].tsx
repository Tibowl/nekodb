import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { useState } from "react"
import { CheckboxInput } from "../../components/CheckboxInput"
import Cost from "../../components/Cost"
import DisplayImage, { ImageMetaData } from "../../components/DisplayImage"
import {
  YardPanelLegend,
  YardPanelSvg,
} from "../../components/YardPanelView"
import getImageInfo from "../../utils/image/getImageInfo"
import { getSmallYard, getYard, yards } from "../../utils/tables"
import {
  isSnowLayer,
  loadYardLayout,
  type ParsedOtherPlace,
  type ParsedPlace,
  type ViewConfig,
  type YardPrefab,
} from "../../utils/yardLayout"
import { TranslationTable } from "../../utils/localization/translate"
import { useLanguage } from "../../hooks/useLanguage"

export type SmallYard = {
  id: number
  name: TranslationTable
};

type YardAsset = ImageMetaData & {name: string}

export type Yard = SmallYard & {
  silver: number
  gold: number

  places: ParsedPlace[]
  otherPlaces: ParsedOtherPlace[]
  view: ViewConfig[]

  assets: YardAsset[]
  prefab: YardPrefab
  pixelsToUnits: Record<string, number>
};

type YardInfo = { yard: Yard }

export const getStaticProps = (async (context) => {
  const yard = getYard(Number(context.params?.yardId))

  if (!yard) {
    return {
      notFound: true,
    }
  }

  const idPrefix = yard.Id.toString().padStart(3, "0")
  const config = await loadYardLayout(idPrefix, { includeOtherPlaces: true })
  const assets = config.assets.map(async (asset) => ({
    ...asset,
    ...await getImageInfo(asset.url),
  }))

  return {
    props: {
      yard: {
        ...getSmallYard(yard),

        silver: yard.Silver,
        gold: yard.Gold,

        places: config.places,
        otherPlaces: config.otherPlaces,
        view: config.view,

        assets: await Promise.all(assets),
        prefab: config.prefab,
        pixelsToUnits: config.pixelsToUnits,
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


export default function Yard({ yard }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { translate } = useLanguage()

  const [showText, setShowText] = useState(true)
  const [points, setPoints] = useState(true)
  const [layers, setLayers] = useState(true)

  const [enabledAssets, setEnabledAssets] = useState<boolean[]>(yard.assets.map(asset => !isSnowLayer(asset.name) && asset.name != "summer"))

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
        <title>{`${translate(yard.name)} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${translate(yard.name)} - NekoDB`} />
        <meta property="og:description" content={`Discover all locations and their attributes in ${translate(yard.name)} in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all locations and their attributes in ${translate(yard.name)} in Neko Atsume 2!`} />
      </Head>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{translate(yard.name)}</h1>
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
        <div className="flex flex-row flex-wrap gap-12">
          <CheckboxInput label="Show layers" set={setLayers} value={layers} />
          <CheckboxInput label="Show points" set={setPoints} value={points} />
          {points && <CheckboxInput label="Show text" set={setShowText} value={showText} />}
        </div>
        <div className={(showText && points) ? "": "opacity-50"}>
          <YardPanelLegend />
        </div>
        <YardPanelSvg
          places={yard.places}
          otherPlaces={yard.otherPlaces}
          view={yard.view}
          prefab={yard.prefab.nodes}
          pixelsToUnits={yard.pixelsToUnits}
          nodes={yard.prefab.scenes[yard.prefab.scene].nodes}
          assets={yard.assets.filter((_, i) => enabledAssets[i])}
          showLayers={layers}
          showPoints={points}
          showText={showText}
        />
      </div>

      <h2 className="text-xl font-bold" id="assets">Assets</h2>
      <div className="flex gap-2 mb-2">
        <button
          className="bg-green-600 text-slate-50 w-fit px-3 py-1 text-center rounded-lg mt-2 cursor-pointer"
          onClick={() =>
            setEnabledAssets(prev => prev.map((x, i) => isSnowLayer(yard.assets[i].name) ? true : x))
          }
        >
          Enable all winter/snow layers
        </button>
        <button
          className="bg-red-700 text-slate-50 w-fit px-3 py-1 text-center rounded-lg mt-2 cursor-pointer"
          onClick={() =>
            setEnabledAssets(prev => prev.map((x, i) => isSnowLayer(yard.assets[i].name) ? false : x))
          }
        >
          Disable all winter/snow layers
        </button>
      </div>

      <div className="flex flex-col flex-wrap gap-2">
        {Object.entries(assetsGroupedByType).sort(([a], [b]) => Number(a) - Number(b)).map(([_, assets], i) =>
          <div className="flex flex-row flex-wrap gap-2" key={i}>
            {assets.map((asset, i) =>
              <div key={i}>
                <div className="bg:gray-100 dark:bg-slate-800 rounded-md flex flex-col items-center justify-center gap-2 p-2">
                  <div className="max-w-96">
                    <a href={asset.url} target="_blank" rel="noreferrer">
                      <DisplayImage key={i} img={asset} alt={asset.url} className="max-h-full max-w-full"/>
                    </a>
                  </div>
                  <div>{asset.name}</div>
                  <CheckboxInput label="Show" set={value => setEnabledAssets(prev => {
                    const index = yard.assets.indexOf(asset)
                    const copy = [...prev]
                    copy[index] = value
                    return copy
                  })} value={enabledAssets[yard.assets.indexOf(asset)]} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
