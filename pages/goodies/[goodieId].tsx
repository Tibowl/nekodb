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
import { translate } from "../../utils/localization/translate"
import { parseBitMap } from "../../utils/math/parseBitMap"
import { getCat, getFood, getGoodie, getPlaySpaceVsCat, getSmallCat, getSmallGoodie, goodies, playSpaces } from "../../utils/tables"
import { SmallCat } from "../cats/[catId]"

export type SmallGoodie = {
  id: number
  name: string
  image: ImageMetaData | null
};

export type Goodie = SmallGoodie & {
  shopDesc: string
  yardDesc: string
  warning: string | null

  attributes: number
  category: string[]
  toughness: number
  foodInfo: FoodInfo | null

  silver: number
  gold: number
  stampcard: number
  repairCost: number

  gallery: ({name: string} & ImageMetaData)[]
  playSpaces: PlaySpaceInfo[]

  animations: AnimationMeta[]
};

type PlaySpaceInfo = {
  playSpaceId: number
  conflicts: number[]

  charm: number
  niboshi: number
  gomenne: boolean
  grooming: boolean

  catWeights: Record<number, number[]>
  catAnimations: Action[]
  altAnimations: Action[]
  weatherWeights: Record<string, number>
}

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

  const catgories = parseBitMap(goodie.Category).map(id => translate("Program", `Category${id+1}`, "en"))

  const catIds: number[] = []
  const spaces = playSpaces.filter(ps => ps.ItemId == goodie.Id)
    .map(ps => {
      const psVsCat = getPlaySpaceVsCat(ps)
      if (!psVsCat) return null // Myneko spaces don't have a play space vs cat

      const catWeights: Record<string, number[]> = {}
      Object.entries(psVsCat.Dict).forEach(([catId, weight]) => {
        if (catIds.every(cat => cat != Number(catId))) {
          catIds.push(+catId)
        }
        catWeights[catId] = weight!
      })

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
        weatherWeights: {}, // TODO
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

        shopDesc: translate("Goods", `GoodsShop${goodie.Id}`, "en"),
        yardDesc: translate("Goods", `GoodsYard${goodie.Id}`, "en"),
        warning: goodie.WarningKey == null ? null : translate("Goods", goodie.WarningKey, "en"),

        attributes: goodie.Attribute,
        category: catgories,
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
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>{`${goodie.name} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${goodie.name} - NekoDB`} />
        <meta property="og:description" content={`Discover all the cats that can visit ${goodie.name} in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all the cats that can visit ${goodie.name} in Neko Atsume 2!`} />
        <meta property="og:image" content={goodie.image?.url} />
      </Head>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="w-24 h-24 flex flex-col items-center justify-center">
            {goodie.image && <DisplayImage img={goodie.image} alt={goodie.name} className="max-h-full max-w-full" />}
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{goodie.name}</h1>
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm">{goodie.attributes == 0 ? "Small" : "Large"}</div>
              <div>&middot;</div>
              {goodie.category.map((cat, i) => {
                if (i > 0) return <div key={i} className="flex flex-row items-center gap-2">
                  <div>&middot;</div>
                  <div key={i} className="text-sm">{cat}</div>
                </div>
                return <div key={i} className="text-sm">{cat}</div>
              })}
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold" id="description">Description</h2>
        <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-2">
          <div className="font-semibold">Shop description</div>
          <div className="text-sm whitespace-pre-wrap"><RenderText text={goodie.shopDesc} /></div>

          <div className="font-semibold">Yard description</div>
          <div className="text-sm whitespace-pre-wrap"><RenderText text={goodie.yardDesc} /></div>

          {goodie.warning && <>
            <div className="font-semibold">Warning</div>
            <div className="text-sm whitespace-pre-wrap"><RenderText text={goodie.warning} /></div>
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
            {Object.entries(ps.catWeights).map(([catId, weights]) => {
              const cat = cats.find(cat => cat.id == Number(catId))
              const link = cat ? <CatLink cat={cat}></CatLink> : <div className="text-sm">Unknown cat #{catId}</div>

              if (weights.length == 1 || weights.every(weight => weight == weights[0]))
                return <div key={catId} className="flex flex-row items-center">{link} {weights[0]}</div>
              else if (weights.length == 3)
                return <div key={catId} className="flex flex-row items-center gap-2">
                  {link}
                  <div className="flex flex-col">
                    <div>{weights[0]} (intact)</div>
                    <div>{weights[1]} (broken)</div>
                    <div>{weights[2]} (fixed)</div>
                  </div>
                </div>
              else
                return <div key={catId} className="flex flex-row items-center">{link} {weights.join(" / ")}</div>
            })}
          </div>

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
