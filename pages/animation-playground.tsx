import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { useEffect, useState } from "react"
import AnimationViewer, {
  AnimationMeta,
  PlayingAnimation,
} from "../components/AnimationViewer"
import CatLink from "../components/CatLink"
import GoodieLink from "../components/GoodieLink"
import { NumberInput } from "../components/NumberInput"
import SelectInput from "../components/SelectInput"
import { getDefaultAnimation } from "../utils/animation/getDefaultAnimation"
import { getCatAnimations } from "../utils/animation/server/getCatAnimations"
import { getGoodieAnimations } from "../utils/animation/server/getGoodieAnimations"
import { getSuffixes } from "../utils/goodie/getSuffixes"
import createRange from "../utils/math/createRange"
import { cats, getSmallCat, getSmallGoodie, goodies } from "../utils/tables"
import { SmallCat } from "./cats/[catId]"
import { SmallGoodie } from "./goodies/[goodieId]"

type AnimationsList = {
  catAnimations: {
    thing: SmallCat;
    animations: AnimationMeta[];
  }[];
  goodieAnimations: {
    thing: SmallGoodie;
    animations: AnimationMeta[];
  }[];
};

export const getStaticProps = (async () => {
  const mappedGoodies = (await Promise.all(
    goodies
      .filter((goodie) => goodie.Category != 0)
      .sort(
        (a, b) =>
          a.DisplayOrder - b.DisplayOrder ||
          a.DisplayOrderInShopRaw - b.DisplayOrderInShopRaw ||
          a.DisplayOrderInTrade - b.DisplayOrderInTrade
      )
      .map(async (goodie) => {
        const smallGoodie = await getSmallGoodie(goodie)
        smallGoodie.name = `${smallGoodie.id} - ${smallGoodie.name}`
        const suffixes = getSuffixes(goodie)
        return {
          thing: smallGoodie,
          animations: await getGoodieAnimations(goodie, suffixes),
        }
      })
  )).filter((goodie) => goodie.animations.length > 0)

  const mappedCats = (await Promise.all(
    cats.map(async (cat) => {
      const smallCat = await getSmallCat(cat)
      smallCat.name = `${smallCat.id} - ${smallCat.name}`
      return {
        thing: smallCat,
        animations: await getCatAnimations(smallCat, cat),
      }
    })
  )).filter((cat) => cat.animations.length > 0)

  return {
    props: {
      goodieAnimations: mappedGoodies,
      catAnimations: mappedCats,
    },
  }
}) satisfies GetStaticProps<AnimationsList>

type AnimationLayer = PlayingAnimation & {
  type: "Cat" | "Goodie";
  index: number;
};

export default function AnimationPlayground({
  goodieAnimations,
  catAnimations,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const goodieIndex = (id: number) => goodieAnimations.findIndex(goodie => goodie.thing.id == id)
  const catIndex = (id: number) => catAnimations.findIndex(cat => cat.thing.id == id)
  const [layers, setLayers] = useState<AnimationLayer[]>([
    { "type":"Goodie", "index":goodieIndex(258), "actionIndex":2,                               "animation":{ "name":"06jarashi_rail", "url_img":"/na2-assets/goods/06jarashi_rail.png", "url_xml":"/na2-assets/goods/06jarashi_rail.xml", "actions":5, "defaultAction":2 } },
    { "type":"Cat",    "index":   catIndex(  1), "actionIndex":0, "xOffset": -6, "yOffset": 51, "animation":{ "name":"06jarashi_rail", "url_img":"/na2-assets/neko/normal/01_kuroneko_san/06jarashi_rail.png", "url_xml":"/na2-assets/neko/normal/master_xml/06jarashi_rail.xml", "actions":1, "defaultAction":0 } },
    { "type":"Cat",    "index":   catIndex(  0), "actionIndex":0, "xOffset":300, "yOffset":-15, "animation":{ "name":"01ball_pingpong", "url_img":"/na2-assets/neko/normal/00_sironeko_san/01ball_pingpong.png", "url_xml":"/na2-assets/neko/normal/master_xml/01ball_pingpong.xml", "actions":1, "defaultAction":0 } },
    { "type":"Goodie", "index":goodieIndex(106), "actionIndex":3, "xOffset":300, "yOffset":-15, "animation":{ "name":"01ball_pingpong", "url_img":"/na2-assets/goods/01ball_pingpong.png", "url_xml":"/na2-assets/goods/01ball_pingpong.xml", "actions":5, "defaultAction":3 } },
    { "type":"Cat",    "index":   catIndex( 24), "actionIndex":0, "xOffset":350, "yOffset":135, "animation":{ "name":"01ball_soccer", "url_img":"/na2-assets/neko/normal/24_cream_san/01ball_soccer.png", "url_xml":"/na2-assets/neko/normal/master_xml/01ball_soccer.xml", "actions":1, "defaultAction":0 } },
    { "type":"Goodie", "index":goodieIndex(111), "actionIndex":3, "xOffset":350, "yOffset":135, "animation":{ "name":"01ball_soccer_mari", "url_img":"/na2-assets/goods/01ball_soccer_mari.png", "url_xml":"/na2-assets/goods/01ball_soccer_mari.xml", "actions":5, "defaultAction":3 } }
  ])

  useEffect(() => {
    console.log("layers", layers)

    let needChange = false
    for (const layer of layers) {
      const availableEntries =
        layer.type == "Cat" ? catAnimations : goodieAnimations
      const { animations } = availableEntries[layer.index]
      const { animation } = layer

      if (
        animations.includes(layer.animation) &&
        layer.actionIndex >= animation.actions
      ) {
        layer.actionIndex = animation.defaultAction
        needChange = true
      }
      if (!animations.includes(layer.animation) && animations.length > 0) {
        const animation = animations.find(x => x.name == layer.animation.name)
        if (!animation) {
          layer.animation = getDefaultAnimation(animations)
          layer.actionIndex = layer.animation.defaultAction
        } else
          layer.animation = animation
        needChange = true
      }
    }
    if (needChange) setLayers([...layers])
  }, [layers, goodieAnimations, catAnimations])

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Goodies - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Animation playground - NekoDB" />
        <meta
          property="og:description"
          content={
            "Play with animations for cats and goodies in Neko Atsume 2!"
          }
        />
        <meta
          property="description"
          content={
            "Play with animations for cats and goodies in Neko Atsume 2!"
          }
        />
      </Head>
      <h1 className="text-4xl font-bold">Animation playground</h1>

      <h2 className="text-2xl font-bold">Layers</h2>
      <div className="flex flex-col gap-4">
        {layers.map((layer, index) => {
          const availableEntries =
            layer.type == "Cat" ? catAnimations : goodieAnimations
          const { thing, animations } = availableEntries[layer.index]
          const { animation } = layer

          return (
            <div
              key={index}
              className="bg-slate-300 dark:bg-slate-600 rounded-xl p-1 my-2 flex flex-row gap-2"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <div>
                  <button
                    className="bg-slate-900 text-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center rounded-lg px-2 py-1"
                    disabled={!(layers.length > 1 && index > 0)}
                    onClick={() => {
                      // Move index up
                      const newLayers = [...layers]
                      newLayers[index] = layers[index - 1]
                      newLayers[index - 1] = layers[index]
                      setLayers(newLayers)
                    }}
                  >
                    &uarr;
                  </button>
                </div>
                <div>
                  <button
                    className="bg-red-700 text-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center rounded-lg px-2 py-1"
                    disabled={!(layers.length > 1)}
                    onClick={() => setLayers(layers.filter((_, i) => i != index)) }
                  >
                    &times;
                  </button>
                </div>
                <div>
                  <button
                    className="bg-slate-900 text-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-center rounded-lg px-2 py-1"
                    disabled={!(layers.length > 1 && index < layers.length - 1)}
                    onClick={() => {
                      // Move index down
                      const newLayers = [...layers]
                      newLayers[index] = layers[index + 1]
                      newLayers[index + 1] = layers[index]
                      setLayers(newLayers)
                    }}
                  >
                    &darr;
                  </button>
                </div>
              </div>
              <div>
                <div className="flex flex-row items-baseline">
                  <SelectInput
                    value={thing.name}
                    set={(newValue) => {
                      const layersCopy = [...layers]
                      layer.index = availableEntries.findIndex(
                        (entry) => entry.thing.name == newValue
                      )
                      setLayers(layersCopy)
                    }}
                    label={layer.type}
                    options={availableEntries.map((entry) => entry.thing.name)}
                  />
                  {layer.type == "Cat" && <CatLink cat={thing as SmallCat} />}
                  {layer.type == "Goodie" && (
                    <GoodieLink goodie={thing as SmallGoodie} />
                  )}
                </div>
                <SelectInput
                  label="Animation"
                  value={layer.animation.name}
                  set={(newValue) => {
                    const layersCopy = [...layers]
                    layer.animation = animations.find(
                      (a) => a.name == newValue
                    )!
                    setLayers(layersCopy)
                  }}
                  options={animations.map((a) => a.name)}
                />

                <div className="flex flex-row items-baseline gap-2">
                  <SelectInput
                    label="Action"
                    value={`${layer.actionIndex + 1}`}
                    set={(x) => {
                      const layersCopy = [...layers]
                      layer.actionIndex = +x - 1
                      setLayers(layersCopy)
                    }}
                    options={createRange(animation?.actions ?? 0).map((i) =>
                      (i + 1).toString()
                    )}
                  />
                  / {animation?.actions}
                </div>

                <NumberInput label="X offset" value={layer.xOffset ?? 0} set={(x) => {
                  const layersCopy = [...layers]
                  layer.xOffset = x
                  setLayers(layersCopy)
                }} />
                <NumberInput label="Y offset" value={layer.yOffset ?? 0} set={(y) => {
                  const layersCopy = [...layers]
                  layer.yOffset = y
                  setLayers(layersCopy)
                }} />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          className="bg-green-600 text-slate-50 w-fit px-3 py-1 text-center rounded-lg mt-2 cursor-pointer"
          onClick={() =>
            setLayers([
              ...layers,
              {
                type: "Cat",
                index: 0,
                animation: catAnimations[0].animations[0],
                actionIndex: catAnimations[0].animations[0].defaultAction,
              },
            ])
          }
        >
          Add new cat layer
        </button>
        <button
          className="bg-green-600 text-slate-50 w-fit px-3 py-1 text-center rounded-lg mt-2 cursor-pointer"
          onClick={() =>
            setLayers([
              ...layers,
              {
                type: "Goodie",
                index: 0,
                animation: goodieAnimations[0].animations[0],
                actionIndex: goodieAnimations[0].animations[0].defaultAction,
              },
            ])
          }
        >
          Add new goodie layer
        </button>
      </div>
      <h2 className="text-2xl font-bold my-2">Preview</h2>
      <div className="flex flex-wrap gap-2">
        <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
          <AnimationViewer animations={layers} />
        </div>
      </div>
    </main>
  )
}
