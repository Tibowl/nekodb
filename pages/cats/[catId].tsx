import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats } from "../../utils/tables";
import { getIconLink, getIconURL } from "../../utils/cat_utils";

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
};

export const getStaticProps = (async (context) => {
  const cat = cats.find((cat) => cat.Id == Number(context.params?.catId));

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
          <img src={getIconLink(cat)} className="max-h-full max-w-full" />
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
      

      {cat.mementoId > 0 && <>
        <h2 className="text-xl font-bold">Memento</h2>
        <div className="flex flex-row items-center gap-2">
          <div className="w-16 h-16 flex flex-col items-center justify-center">
            <img src={getIconURL(`takara_${cat.mementoId.toString().padStart(3, "0")}`)} className="max-h-full max-w-full" />
          </div>
          <div className="flex flex-col">
            <div className="text-xl font-bold">{cat.mementoName}</div>
            <div className="text-sm whitespace-pre-wrap">{cat.mementoComment}</div>
          </div>
        </div>
      </>}
    
  </div>
  );
}
