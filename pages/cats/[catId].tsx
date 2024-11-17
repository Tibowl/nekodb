import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats, catVsFood, getCat, getCatVsFood } from "../../utils/tables";
import { getCatIconLink, getCatIconURL } from "../../utils/cat_utils";
import { getGoodieIconURL } from "../../utils/goodie_utils";

export type SmallCat = {
  id: number;
  name: string;
};

export type Cat = SmallCat & {
  power: number
  weatherImpact: number
  niboshi: number
  gomenneRate: number
  groomingRate: number

  color: string
  personality: string

  mementoId: number
  mementoName: string
  mementoComment: string

  food?: CatVsFood
};

export type CatVsFood = typeof catVsFood[number]["Dict"]

export const getStaticProps = (async (context) => {
  const cat = getCat(Number(context.params?.catId))

  if (!cat) {
    return {
      notFound: true,
    };
  }

  let mementoComment = translate("Cat", `TakaraComment${cat.MementoId}`, "en")
  if (cat.MementoId == 62) {
    mementoComment = mementoComment.replace(
      "{0}", 
      translate("Cat", `TakaraComment${cat.MementoId}_2`, "en").replace("{0}", "X").replace("{1}", "Y")
    )
  }

  const food = getCatVsFood(cat)

  return {
    props: {
      id: cat.Id,
      name: translate("Cat", `CatName${cat.Id}`, "en"),

      power: cat.Power,
      weatherImpact: cat.WeatherImpact,
      niboshi: cat.Niboshi,
      gomenneRate: cat.GomenneRate,
      groomingRate: cat.GroomingRate,

      color: translate("Cat", `CatColor${cat.Id}`, "en"),
      personality: translate("Cat", `CatChar${cat.Id}`, "en"),
      mementoId: cat.MementoId,
      mementoName: translate("Cat", `TakaraName${cat.MementoId}`, "en"),
      mementoComment,

      food: food?.Dict
    },
  };
}) satisfies GetStaticProps<Cat>;

export const getStaticPaths = (async () => {
  return {
    paths: cats.map((cat) => ({ params: { catId: cat.Id.toString() } })),
    fallback: false,
  };
})


export default function Cat(cat: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-row items-center gap-2">
        <div className="w-24 h-24 flex flex-col items-center justify-center">
          <img src={getCatIconLink(cat)} className="max-h-full max-w-full" />
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

      {cat.mementoId > 0 && <>
        <h2 className="text-xl font-bold">Memento</h2>
        <div className="flex flex-row items-center gap-2">
          <div className="w-16 h-16 flex flex-col items-center justify-center">
            <img src={getCatIconURL(`takara_${cat.mementoId.toString().padStart(3, "0")}`)} className="max-h-full max-w-full" />
          </div>
          <div className="flex flex-col">
            <div className="text-xl font-bold">{cat.mementoName}</div>
            <div className="text-sm whitespace-pre-wrap">{cat.mementoComment}</div>
          </div>
        </div>
      </>}


      <h2 className="text-xl font-bold">Base stats</h2>
      <div className="grid grid-cols-2 w-fit ml-4">
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
        <h2 className="text-xl font-bold">Food modifiers</h2>
        <div className="flex flex-row flex-wrap">
          {(["1", "2", "3", "4", "5", "6", "7"] as (keyof CatVsFood)[]).map(foodId => <FoodIcon key={foodId} food={foodId}>{cat.food![foodId] ?? "❌"}</FoodIcon>)}
        </div>
      </>}
  </div>
  );
}

const foodMapping: Record<string, string> = {
  "1": "08meshi_karikari",
  "2": "08meshi_karikari_high",
  "3": "08meshi_nekokan",
  "4": "08meshi_f00",
  "5": "08meshi_nekokan_high",
  "6": "08meshi_sashimi",
  "7": "08meshi_sashimi2",
}


function FoodIcon({food, children}: {food: string, children: React.ReactNode}) {
  
  return <div className="flex flex-row items-center gap-2 p-2">
    <img src={getGoodieIconURL(foodMapping[food])} className="max-h-8 max-w-8" />
    <div>{children}</div>
  </div>
}