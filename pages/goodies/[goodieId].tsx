import { GetStaticProps, InferGetStaticPropsType } from "next";
import FoodIcon from "../../components/FoodIcon";
import { getCatIconLink, getCatIconURL } from "../../utils/cat_utils";
import { translate } from "../../utils/localization";
import { cats, catVsFood, getCat, getCatVsFood, getGoodie, getSmallGoodie, goodies } from "../../utils/tables";
import { getGoodieIconLink, getGoodieIconURL } from "../../utils/goodie_utils";

export type SmallGoodie = {
  id: number;
  name: string;
  anime: string;
};

export type Goodie = SmallGoodie & {
};

export const getStaticProps = (async (context) => {
  const goodie = getGoodie(Number(context.params?.goodieId))

  if (!goodie) {
    return {
      notFound: true,
    };
  }

  return {
    props: getSmallGoodie(goodie),
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
            <div className="text-sm">TODO {goodie.id}</div>
          </div>
        </div>
      </div>
  </div>
  );
}
