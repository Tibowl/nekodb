import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { useState } from "react"
import CatLink from "../../components/CatLink"
import { CheckboxInput } from "../../components/CheckboxInput"
import DisplayImage, { ImageMetaData } from "../../components/DisplayImage"
import FoodIcon from "../../components/FoodIcon"
import FormattedLink from "../../components/FormattedLink"
import GoodieLink from "../../components/GoodieLink"
import { RenderText } from "../../components/TextRenderer"
import { getCatIconLink, getCatIconURL } from "../../utils/cat_utils"
import getImageInfo from "../../utils/image_util"
import { translate } from "../../utils/localization"
import { cats, catVsCat, catVsFood, getCat, getCatVsCat, getCatVsFood, getGoodie, getPlaySpace, getSmallCat, getSmallGoodie, playSpaceVsCat } from "../../utils/tables"
import { SmallGoodie } from "../goodies/[goodieId]"

export type SmallCat = {
  id: number
  name: string
  image: ImageMetaData
};

export type Cat = SmallCat & {
  power: number
  weatherImpact: number
  niboshi: number
  gomenneRate: number
  groomingRate: number

  color: string
  personality: string

  memento: Memento | null

  food: CatVsFood | null
  catVsCat: CatVsCat | null
  playSpaces: PlaySpaceWeight[] | null
}

type PlaySpaceWeight = {
  playSpaceId: number
  weight: number[]
}

type Props = {
  cat: Cat
  goodies: (SmallGoodie & { playSpaces: number[] })[]
}

export type CatVsFood = typeof catVsFood[number]["Dict"]
export type CatVsCat = typeof catVsCat[number]["Dict"]

export const getStaticProps = (async (context) => {
  const cat = getCat(Number(context.params?.catId))

  if (!cat) {
    return {
      notFound: true,
    }
  }

  const food = getCatVsFood(cat)
  const catVsCat = getCatVsCat(cat) ?? null
  const cats = await Promise.all(catVsCat ? Object.keys(catVsCat.Dict).map(id => getSmallCat(getCat(Number(id))!)) : [])

  const playSpaces = playSpaceVsCat.map(playSpaceVsCat => {
    if (playSpaceVsCat.Dict[cat.Id]) return {
      playSpaceId: playSpaceVsCat.Id,
      weight: playSpaceVsCat.Dict[cat.Id]!
    }
  }).filter(playSpace => playSpace) as PlaySpaceWeight[]

  // Goodie ID => Play space IDs
  const goodieMap = new Map<number, number[]>()

  playSpaces.forEach(info => {
    const playSpace = getPlaySpace(info.playSpaceId)
    if (!playSpace) return
    if (!goodieMap.has(playSpace.ItemId))
      goodieMap.set(playSpace.ItemId, [])
    goodieMap.get(playSpace.ItemId)!.push(info.playSpaceId)
  })

  const goodies = await Promise.all([...goodieMap.entries()].map(async ([goodieId, playSpaceIds]) => {
    const goodie = getGoodie(goodieId)
    if (!goodie) return {
      id: goodieId,
      name: `Upcoming #${goodieId}`,
      image: null,
      playSpaces: playSpaceIds
    }
    const smallGoodie = await getSmallGoodie(goodie)
    return {
      ...smallGoodie,
      playSpaces: playSpaceIds
    }
  }))

  return {
    props: {
      cat: {
        ...await getSmallCat(cat),

        power: cat.Power,
        weatherImpact: cat.WeatherImpact,
        niboshi: cat.Niboshi,
        gomenneRate: cat.GomenneRate,
        groomingRate: cat.GroomingRate,

        color: translate("Cat", `CatColor${cat.Id}`, "en"),
        personality: translate("Cat", `CatChar${cat.Id}`, "en"),
        memento: await getMemento(cat.MementoId),

        food: food?.Dict ?? null,
        playSpaces,
        catVsCat: catVsCat?.Dict ?? null
      },
      goodies,
      cats
    },
  }
}) satisfies GetStaticProps<Props>

async function getMemento(mementoId: number): Promise<Memento | null> {
  if (mementoId == 0) return null

  let mementoComment = translate("Cat", `TakaraComment${mementoId}`, "en")
  if (mementoId == 62) {
    mementoComment = mementoComment.replace(
      "{0}",
      translate("Cat", `TakaraComment${mementoId}_2`, "en").replace("{0}", "X").replace("{1}", "Y")
    )
  }

  return {
    id: mementoId,
    name: translate("Cat", `TakaraName${mementoId}`, "en"),
    comment: mementoComment,
    img: await getImageInfo(getCatIconURL(`takara_${mementoId.toString().padStart(3, "0")}`))
  }
}

type Memento = {
  id: number
  name: string
  comment: string
  img: ImageMetaData
}

export const getStaticPaths = (async () => {
  return {
    paths: cats.map((cat) => ({ params: { catId: cat.Id.toString() } })),
    fallback: false,
  }
})


export default function Cat({ cat, cats, goodies }: InferGetStaticPropsType<typeof getStaticProps>) {
  const [upcomingGoodies, setUpcomingGoodies] = useState(false)

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>{`${cat.name} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${cat.name} - NekoDB`} />
        <meta property="og:description" content={`Discover ${cat.name}'s favorite goodies and snacks in Neko Atsume 2! ${cat.name} is a ${cat.color.toLowerCase()} cat with a ${cat.personality.toLowerCase()} personality and a power level of ${cat.power}.`} />
        <meta property="description" content={`Discover ${cat.name}'s favorite goodies and snacks in Neko Atsume 2! ${cat.name} is a ${cat.color.toLowerCase()} cat with a ${cat.personality.toLowerCase()} personality and a power level of ${cat.power}.`} />
        <meta property="og:image" content={getCatIconLink(cat)} />
      </Head>

      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="w-24 h-24 flex flex-col items-center justify-center">
            <DisplayImage img={cat.image} alt={cat.name} loading="eager" className="max-h-full max-w-full" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{cat.name}</h1>
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm">{cat.color}</div>
              <div>&middot;</div>
              <div className="text-sm">{cat.personality}</div>
              <div>&middot;</div>
              <div className="text-sm">Power level {cat.power}</div>
            </div>
          </div>
        </div>

        {cat.memento && <>
          <h2 className="text-xl font-bold" id="memento">Memento</h2>
          <div className="flex flex-row items-center gap-2">
            <div className="w-16 h-16 flex flex-col items-center justify-center">
              <DisplayImage img={cat.memento.img} alt={cat.memento.name} className="max-h-full max-w-full" />
            </div>
            <div className="flex flex-col">
              <div className="text-xl font-bold">{cat.memento.name}</div>
              <div className="text-sm whitespace-pre-wrap"><RenderText text={cat.memento.comment} /></div>
            </div>
          </div>
        </>}


        <h2 className="text-xl font-bold" id="base-stats">Base stats</h2>
        <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
            <div className="font-semibold">Seasonal modifier factor</div>
            <div className="text-right">{cat.weatherImpact}</div>

            <div className="font-semibold">Fish gift factor</div>
            <div className="text-right">{cat.niboshi}</div>

            <div className="font-semibold">Gomenne Rate</div>
            <div className="text-right">{cat.gomenneRate}</div>

            <div className="font-semibold">Grooming Rate</div>
            <div className="text-right">{cat.groomingRate}</div>
        </div>

        {cat.food && <>
          <h2 className="text-xl font-bold" id="food-modifiers">Food modifiers</h2>
          <div className="flex flex-row flex-wrap gap-2">
            {(["1", "2", "3", "4", "5", "6", "7"] as (keyof CatVsFood)[]).map(foodId =>
              <div key={foodId} className="bg-gray-100 dark:bg-slate-800 rounded-md">
                <FoodIcon food={foodId} gray={!cat.food![foodId]}>{cat.food![foodId] ?? "❌"}</FoodIcon>
              </div>
            )}
          </div>
        </>}

        {!!cat.playSpaces?.length && <>
          <h2 className="text-xl font-bold" id="play-spaces">Goodies</h2>
          {goodies.some(x => !x.image) && <CheckboxInput label="Show upcoming" set={setUpcomingGoodies} value={upcomingGoodies} />}

          <div className="flex flex-row flex-wrap gap-2">
            {goodies.filter(goodie => cat.playSpaces.some(playSpace => goodie.playSpaces.includes(playSpace.playSpaceId)) && (upcomingGoodies || goodie.image))
              .map(goodie => {
                const playSpaces = cat.playSpaces.filter(playSpace => goodie.playSpaces.includes(playSpace.playSpaceId))
                return <div key={goodie.id}>
                  <div className="bg-gray-100 dark:bg-slate-800 rounded-md">
                    <GoodieLink goodie={goodie}></GoodieLink>
                    <div className="text-sm p-2 pt-0 flex flex-col gap-1">
                      {playSpaces.map(playSpace => {
                        const weights = playSpace.weight
                        const link = goodie.image ?
                          <FormattedLink href={`/goodies/${goodie.id}#play-space-${playSpace.playSpaceId}`}>Space #{playSpace.playSpaceId}:</FormattedLink>
                        :
                          <span>Space #{playSpace.playSpaceId}:</span>

                        if (weights.length == 1 || weights.every(weight => weight == weights[0]))
                          return <div key={playSpace.playSpaceId}>{link} {weights[0]}</div>
                        else if (weights.length == 3)
                          return <div key={playSpace.playSpaceId} className="flex flex-row items-center gap-2">
                            {link}
                            <div className="flex flex-col">
                              <div>{weights[0]} (intact)</div>
                              <div>{weights[1]} (broken)</div>
                              <div>{weights[2]} (fixed)</div>
                            </div>
                          </div>
                        else
                          return <div key={playSpace.playSpaceId}>{link} {weights.join(" / ")}</div>
                      })}
                    </div>
                  </div>
                </div>
              })
            }
          </div>
        </>}

        {cat.catVsCat && Object.entries(cat.catVsCat).length > 0 && <>
          <h2 className="text-xl font-bold" id="food-modifiers">Cat vs cat weights</h2>
          <div className="flex flex-row flex-wrap gap-2">
            {Object.entries(cat.catVsCat).map(([catId, weight]) => {
              const cat = cats.find(cat => cat.id == Number(catId))
              const link = cat ? <CatLink cat={cat}></CatLink> : <div className="text-sm">Unknown cat #{catId}</div>

              return <div key={catId} className="bg-gray-100 dark:bg-slate-800 rounded-md flex flex-row items-center pr-2">
                <div>{link}</div>
                <div>{weight}</div>
              </div>
            })}
          </div>
        </>}
    </div>
  </main>
  )
}
