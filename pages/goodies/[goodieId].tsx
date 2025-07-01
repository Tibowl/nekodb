import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import AnimationGallery from "../../components/AnimationGallery"
import { AnimationMeta } from "../../components/AnimationViewer"
import CatLink from "../../components/CatLink"
import Cost from "../../components/Cost"
import DisplayImage, { ImageMetaData } from "../../components/DisplayImage"
import { RenderText } from "../../components/TextRenderer"
import { getGoodieAnimations } from "../../utils/animation/server/getGoodieAnimations"
import { getGoodieIconURL } from "../../utils/goodie/getGoodieIconURL"
import { getRepairCost } from "../../utils/goodie/getRepairCost"
import { getSuffixes } from "../../utils/goodie/getSuffixes"
import getImageInfo from "../../utils/image/getImageInfo"
import { translate, TranslationTable } from "../../utils/localization/translate"
import { parseBitMap } from "../../utils/math/parseBitMap"
import { getCat, getFood, getGoodie, getPlaySpaceVsCat, getPlaySpaceVsWeather, getSmallCat, getSmallGoodie, goodies, playSpaces, WeatherType } from "../../utils/tables"
import { SmallCat } from "../cats/[catId]"
import { useLanguage } from "../../contexts/LanguageContext"
import WikiTextBox from "../../components/WikiTextBox"

export type SmallGoodie = {
  id: number
  name: TranslationTable
  image: ImageMetaData | null
}

export type Goodie = SmallGoodie & {
  shopDesc: TranslationTable
  yardDesc: TranslationTable
  warning: TranslationTable | null

  attributes: number
  category: TranslationTable[]
  toughness: number
  foodInfo: FoodInfo | null

  silver: number
  gold: number
  stampcard: number
  repairCost: number

  gallery: ({name: string} & ImageMetaData)[]
  playSpaces: PlaySpaceInfo[]

  animations: AnimationMeta[]
}

type PlaySpaceInfo = {
  playSpaceId: number
  conflicts: number[]

  charm: number
  niboshi: number
  gomenne: boolean
  grooming: boolean

  catWeights: CatWeight
  catAnimations: Action[]
  altAnimations: Action[]
  weatherWeights: Partial<Record<WeatherType, number>>
}

type CatWeightType = 1 | 2
type CatWeight = Record<number,  {
  weights: number[],
  type: CatWeightType
}>

type Action = {
  name: string
  actionIndex: number
  weight: number | null
  goodieAction: number | null
}

type FoodInfo = {
  duration: number
  mementoRate: number
}

type GoodieInfo = {
  goodie: Goodie
  cats: SmallCat[]
}

export const getStaticProps = (async (context) => {
  const goodie = getGoodie(Number(context.params?.goodieId))

  if (!goodie) {
    return {
      notFound: true,
    }
  }

  const catgories = parseBitMap(goodie.Category).map(id => translate("Program", `Category${id+1}`))

  const catIds: number[] = []
  const spaces = playSpaces.filter(ps => ps.ItemId == goodie.Id)
    .map(ps => {
      const psVsCat = getPlaySpaceVsCat(ps)
      if (!psVsCat) return null // Myneko spaces don't have a play space vs cat

      const psVsWeather = getPlaySpaceVsWeather(ps)

      const catWeights: CatWeight = {}
      const processCatWeights = (dict: Partial<Record<string, number[]>>, type: CatWeightType) => {
        Object.entries(dict).forEach(([catId, weight]) => {
          const catIdNum = +catId

          if (catIds.every(cat => cat != catIdNum)) {
            catIds.push(catIdNum)
          }
          catWeights[catIdNum] = {
            weights: weight!,
            type: type
          }
        })
      }

      processCatWeights(psVsCat.Dict, 1)
      processCatWeights(psVsCat.Dict2, 2)

      return {
        playSpaceId: ps.Id,
        conflicts: ps.ConflictIndices,
        charm: ps.Charm,
        niboshi: ps.Niboshi,
        gomenne: ps.Gomenne,
        grooming: ps.Grooming,
        catWeights,
        catAnimations: createActions(ps.ActionNames, ps.ActionIds, ps.ActionWeights, ps.GoodsAnimeId),
        altAnimations: createActions(ps.ActionNames2, ps.ActionIds2, ps.ActionWeights2, ps.GoodsAnimeId2),
        weatherWeights: (psVsWeather?.Dict ?? {}) as Partial<Record<WeatherType, number>>,
      }
    }).filter(ps => ps) as PlaySpaceInfo[]

  const suffixes = getSuffixes(goodie)
  const animations: AnimationMeta[] = await getGoodieAnimations(goodie, suffixes)

  const food = getFood(goodie.Id)
  const foodInfo = food && {
    duration: food.DurationMinutes,
    mementoRate: food.MementoRate
  } || null

  return {
    props: {
      goodie: {
        ...await getSmallGoodie(goodie),
        shopDesc: translate("Goods", `GoodsShop${goodie.Id}`),
        yardDesc: translate("Goods", `GoodsYard${goodie.Id}`),
        warning: goodie.WarningKey == null ? null : translate("Goods", goodie.WarningKey),

        sellableMonths: goodie.SellableMonths,

        attributes: goodie.Attribute,
        category: catgories.map(cat => cat),
        toughness: goodie.Toughness,

        silver: goodie.Silver,
        gold: goodie.Gold,
        stampcard: goodie.StampCard,

        repairCost: goodie.RepairSilver,

        foodInfo,

        gallery: await Promise.all(
          suffixes
            .map(x => `${goodie.AnimePngs[0]}${x}`)
            .filter(x => x != "90ground")
            .map(async g => ({
              name: g,
              ...await getImageInfo(getGoodieIconURL(g))
            }))
        ),

        playSpaces: spaces,
        animations
      },
      cats: await Promise.all(catIds.map(id => {
        const cat = getCat(id)
        return getSmallCat(cat!)
      }))
    },
  }
}) satisfies GetStaticProps<GoodieInfo>

function createActions(names: string[] | null, ids: number[] | null, weights: number[] | null, goodieActions: number[] | null = null): Action[] {
  if (!names || !ids) return []

  if (names.length != ids.length) throw new Error("names and ids must be the same length")
  if (weights && weights.length != ids.length) throw new Error("weights and ids must be the same length")
  return names.map((name, index) => {
    return {
      name,
      actionIndex: ids[index],
      weight: weights ? weights[index] : null,
      goodieAction: goodieActions ? goodieActions[index] : null,
    }
  })
}

export const getStaticPaths = (async () => {
  return {
    paths: goodies.map((goodie) => ({ params: { goodieId: goodie.Id.toString() } })),
    fallback: false,
  }
})


export default function Goodie({ goodie, cats }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { translate } = useLanguage()
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>{`${translate(goodie.name)} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${translate(goodie.name)} - NekoDB`} />
        <meta property="og:description" content={`Discover all the cats that can visit ${translate(goodie.name)} in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all the cats that can visit ${translate(goodie.name)} in Neko Atsume 2!`} />
        <meta property="og:image" content={goodie.image?.url} />
      </Head>
      <WikiTextBox text={formatWikiText({ goodie, cats })} url={`https://nekoatsume.fandom.com/wiki/${goodie.name.en}`} />
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="w-24 h-24 flex flex-col items-center justify-center">
            {goodie.image && <DisplayImage img={goodie.image} alt={translate(goodie.name)} className="max-h-full max-w-full" />}
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{translate(goodie.name)}</h1>
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm">{goodie.attributes == 0 ? "Small" : "Large"}</div>
              <div>&middot;</div>
              {goodie.category.map((cat, i) => {
                if (i > 0) return <div key={i} className="flex flex-row items-center gap-2">
                  <div>&middot;</div>
                  <div key={i} className="text-sm">{translate(cat)}</div>
                </div>
                return <div key={i} className="text-sm">{translate(cat)}</div>
              })}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold" id="description">Description</h2>
        <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-2">
          <div className="font-semibold">Shop description</div>
          <div className="text-sm whitespace-pre-wrap"><RenderText text={translate(goodie.shopDesc)} /></div>

          <div className="font-semibold">Yard description</div>
          <div className="text-sm whitespace-pre-wrap"><RenderText text={translate(goodie.yardDesc)} /></div>

          {goodie.warning && <>
            <div className="font-semibold">Warning</div>
            <div className="text-sm whitespace-pre-wrap"><RenderText text={translate(goodie.warning)} /></div>
          </>}
        </div>

        <h2 className="text-xl font-bold" id="base-stats">Base stats</h2>
        <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
            {goodie.silver > 0 && <>
              <div className="font-semibold">Silver cost</div>
              <div className="text-right"><Cost count={goodie.silver} type="silver" /></div>
            </>}

            {goodie.gold > 0 && <>
              <div className="font-semibold">Gold cost</div>
              <div className="text-right"><Cost count={goodie.gold} type="gold" /></div>
            </>}

            {goodie.stampcard > 0 && <>
              <div className="font-semibold">Stampcard cost</div>
              <div className="text-right"><Cost count={goodie.stampcard} type="stamp" /></div>
            </>}

            {goodie.sellableMonths && <>
              <div className="font-semibold">Sellable months</div>
              <div className="text-right">{goodie.sellableMonths.join(", ")}</div>
            </>}

            <div className="font-semibold">Toughness</div>
            <div className="text-right">{goodie.toughness == 0 ? "Unbreakable" : goodie.toughness}</div>

            {goodie.toughness > 0 && <>
              <div className="font-semibold">Repair cost</div>
              {getRepairCost(goodie) == 0 ?
                <div className="text-right">Free!</div> :
                <div className="text-right"><Cost count={getRepairCost(goodie)} type="silver" /></div>
              }
            </>}

            {goodie.foodInfo && <>
              <div className="font-semibold">Duration</div>
              <div className="text-right">{goodie.foodInfo.duration / 60} {goodie.foodInfo.duration / 60 > 1 ? "hours" : "hour"}</div>

              <div className="font-semibold">Memento rate</div>
              <div className="text-right">{goodie.foodInfo.mementoRate}</div>
            </>}
        </div>

        {goodie.gallery.length > 0 &&<>
          <h2 className="text-xl font-bold" id="gallery">Icon gallery</h2>
          <div className="flex flex-row flex-wrap gap-2">
            {goodie.gallery.map((gallery, i) => <div key={i}>
              <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
                <DisplayImage img={gallery} alt={gallery.name} className="max-h-full max-w-full" />
                <div className="text-sm p-2 pt-0 flex flex-col gap-1 text-center">{gallery.name}</div>
              </div>
            </div>)}
          </div>
        </>}

        <AnimationGallery animations={goodie.animations} />

        <h2 className="text-xl font-bold" id="play-spaces">Play spaces</h2>
        {goodie.playSpaces.map((ps, i) => <div key={i} className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
          <h3 className="text-lg font-semibold" id={`play-space-${ps.playSpaceId}`}>Play space #{ps.playSpaceId}</h3>
          <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
            <div className="font-medium">Conflicts</div>
            <div className="text-right">{ps.conflicts.length == 0 ? "None" : ps.conflicts.join(", ")}</div>

            <div className="font-medium">Charm</div>
            <div className="text-right">{ps.charm}</div>

            <div className="font-medium">Fish gift factor</div>
            <div className="text-right">{ps.niboshi}</div>


            <div className="font-medium">Gommenne</div>
            <div className="text-right">{ps.gomenne ? "✅" : "❌"}</div>

            <div className="font-medium">Grooming</div>
            <div className="text-right">{ps.grooming ? "✅" : "❌"}</div>
          </div>

          <h4 className="text-lg font-thin">Cat weights</h4>
          <div className="flex flex-row flex-wrap gap-x-2">
            {Object.entries(ps.catWeights).map(([catId, catWeights]) => {
              const { weights, type } = catWeights
              const cat = cats.find(cat => cat.id == Number(catId))
              const link = cat ? <CatLink cat={cat}></CatLink> : <div className="text-sm">Unknown cat #{catId}</div>

              let suffix = ""
              if (type == 2)
                suffix = " (special)"
              if (weights.length == 1 || weights.every(weight => weight == weights[0]))
                return <div key={catId} className="flex flex-row items-center">{link} {weights[0]}{suffix}</div>
              else if (weights.length == 3)
                return <div key={catId} className="flex flex-row items-center gap-2">
                  {link}
                  <div className="flex flex-col">
                    <div>{weights[0]} (intact){suffix}</div>
                    <div>{weights[1]} (broken){suffix}</div>
                    <div>{weights[2]} (fixed){suffix}</div>
                  </div>
                </div>
              else
                return <div key={catId} className="flex flex-row items-center">{link} {weights.join(" / ")}{suffix}</div>
            })}
          </div>

          {ps.weatherWeights && Object.entries(ps.weatherWeights).length > 0 && <>
            <h4 className="text-lg font-thin">Weather weights</h4>
            <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
              {Object.entries(ps.weatherWeights).map(([weather, weight]) => {
                const weatherType = weather == "Autum" ? "Autumn" : weather
                return <div key={weather} className="contents">
                  <div className="font-medium">{weatherType}</div>
                  <div className={`text-right ${weight < 0 ? "text-red-700 dark:text-red-400" : ""}`}>{weight}</div>
                </div>
              })}
            </div>
          </>}

          {ps.catAnimations.length > 0 && <>
            <h4 className="text-lg font-thin">Cat animations</h4>
            <CatAnimations actions={ps.catAnimations} />
          </>}
          {ps.altAnimations.length > 0 && <>
            <h4 className="text-lg font-thin">Broken animations</h4>
            <CatAnimations actions={ps.altAnimations} />
          </>}
        </div>)}
    </div>
  </main>
  )
}


function CatAnimations({ actions }: { actions: Action[] }) {
  return <div className="grid grid-cols-[auto_auto_auto_auto] w-fit ml-4 gap-x-4">
    <div className="font-bold">Animation</div>
    <div className="font-bold">Action</div>
    <div className="font-bold">Weight</div>
    <div className="font-bold">Goodie pose override</div>
    {actions.map((action, i) => <div key={i} className="contents">
      <div>{action.name}</div>
      <div>{action.actionIndex + 1}</div>
      {action.weight !== null ? <div>{action.weight}</div> : <div>/</div>}
      {action.goodieAction !== null ? <div>{action.goodieAction}</div> : <div>/</div>}
    </div>)}
  </div>
}

function formatWikiText({ goodie, cats }: InferGetStaticPropsType<typeof getStaticProps>) {
  const prices: string[] = []
  if (goodie.silver > 0) prices.push(`${goodie.gold} [[File:GoldFish.png|link=|18px]]`)
  if (goodie.gold > 0) prices.push(`${goodie.silver} [[File:SilverFish.png|link=|18px]]`)
  if (goodie.stampcard > 0) prices.push(`${goodie.stampcard} [[File:StampCard.png|link=|18px]]`)
  const price = prices.join(" or ")

  const size = goodie.attributes === 0 ? "[[File:Small_icon.png|15px|link=Category:Small]]" : "[[File:Large_icon.png|15px|link=Category:Large]]"
  const categories = goodie.category.map(cat => cat.en.replace(/s$/, ""))
  const catsIds = goodie.playSpaces.map(ps => ps.catWeights).flatMap(catWeight => Object.keys(catWeight)).filter((id, index, self) => self.indexOf(id) === index)

  const uniqueSpots = goodie.playSpaces.filter((ps, index, self) => {
    const conflictIndex = self.findIndex(p => p.conflicts.includes(ps.playSpaceId))
    return conflictIndex === -1 || conflictIndex > index
  })

  const wikiTemplate = `{{Goody Infobox
|Sprite             = [[File:${goodie.name.en} Original.png|100px]]
|Price              = ${price}
|Size               = ${size}
|Fit                = ${uniqueSpots.length}
|Type               = ${categories.map(cat => `[[:Category:${cat}|${cat}]]`).join(", ")}
|Rare Cats          = ${catsIds.filter(x => +x > 100).map(id => cats.find(cat => cat.id == +id)?.name.en || `Unknown Cat #${id}`).sort().map(name => `[[${name}]]`).join("<br>") || "None"}
|Regular Cats       = ${catsIds.filter(x => +x <= 100).map(id => cats.find(cat => cat.id == +id)?.name.en || `Unknown Cat #${id}`).sort().map(name => `[[${name}]]`).join("<br>") || "None"}
|Japanese name      = ${goodie.name["ja"]}
|Romanji name       = [XXX]
|Translated name    = [XXX]
}}
__NOTOC__
The ${goodie.name.en} is a ${categories.join(", ")} type goodie in [[Neko Atsume 2]] that can be purchased at the [[Shop]]${goodie.sellableMonths ? " for a limited time" : ""}. 

${goodie.sellableMonths ? `It is available during ${goodie.sellableMonths.map(monthIndex => ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][monthIndex]).join(", ")} each year. ` : ""}

== Description ==
;Shop Description
:${goodie.shopDesc.en.replace(/\n/g, " ").replace(/<(.*?)>/g, (match, p1) => `''${p1}''`)}

;Goody Description
:${goodie.yardDesc.en.replace(/\n/g, " ").replace(/<(.*?)>/g, (match, p1) => `''${p1}''`)}

${goodie.warning ? `=== Warning ===\n:${goodie.warning.en.replace(/\\n/g, " ")}\n` : ""}

==Durability==
{{DurabilityDesc}}
{{GoodiesStatusBox
| Cost      = {{SilverFish|${getRepairCost(goodie)}}}
| Toughness = ${goodie.toughness}
}}

{{GoodiesNav}}
${categories.map(cat => `[[Category:${cat}]]`).join("\n")}
[[Category:Goody]]
[[Category:${goodie.attributes === 0 ? "Small" : "Large"}]]

`.replace(/\n\n+/g, "\n\n")

  return wikiTemplate
}
