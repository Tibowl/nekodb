import { GetStaticProps, InferGetStaticPropsType } from "next";
import { getGoodieIconLink } from "../../utils/goodie_utils";
import { getGoodie, getSmallGoodie, goodies } from "../../utils/tables";
import { translate } from "../../utils/localization";
import { parseBitMap } from "../../utils/bit_math";

export type SmallGoodie = {
  id: number;
  name: string;
  anime: string;
};

export type Goodie = SmallGoodie & {
  shopDesc: string
  yardDesc: string

  attributes: number
  category: string[]
  toughness: number
  repairPattern: number

  silver: number
  gold: number
};

export const getStaticProps = (async (context) => {
  const goodie = getGoodie(Number(context.params?.goodieId))

  if (!goodie) {
    return {
      notFound: true,
    };
  }

  const catgories = parseBitMap(goodie.Category).map(id => translate("Program", `Category${id+1}`, "en"))

  return {
    props: {
      ...getSmallGoodie(goodie),

      shopDesc: translate("Goods", `GoodsShop${goodie.Id}`, "en"),
      yardDesc: translate("Goods", `GoodsYard${goodie.Id}`, "en"),

      attributes: goodie.Attribute,
      category: catgories,

      toughness: goodie.Toughness,
      repairPattern: goodie.RepairPattern,

      silver: goodie.Silver,
      gold: goodie.Gold,
    },
  };
}) satisfies GetStaticProps<Goodie>;

export const getStaticPaths = (async () => {
  return {
    paths: goodies.map((goodie) => ({ params: { goodieId: goodie.Id.toString() } })),
    fallback: false,
  };
})


export default function Goodie(goodie: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-row items-center gap-2">
        <div className="w-24 h-24 flex flex-col items-center justify-center">
          <img src={getGoodieIconLink(goodie)} className="max-h-full max-w-full" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-4xl font-bold">{goodie.name}</h1>
          <div className="flex flex-row items-center gap-2">
            <div className="text-sm">{goodie.attributes == 0 ? "Small" : "Large"}</div>
            <div>&middot;</div>
            <div className="text-sm">{goodie.category.join(",")}</div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold" id="description">Description</h2>
      <div className="grid grid-cols-2 w-fit ml-4 gap-y-2">
        <div className="font-semibold">Shop description</div>
        <div className="text-sm whitespace-pre">{goodie.shopDesc}</div>

        <div className="font-semibold">Yard description</div>
        <div className="text-sm whitespace-pre">{goodie.yardDesc}</div>
      </div>
  </div>
  );
}
