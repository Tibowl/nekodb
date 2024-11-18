import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats, goodies } from "../../utils/tables";
import CatLink from "../../components/CatLink";
import { CatType, getCatType } from "../../utils/cat_utils";
import { SmallGoodie } from "./[goodieId]";
import GoodieLink from "../../components/GoodieLink";

type GoodieList = {
  goodies: SmallGoodie[];
};

export const getStaticProps = (async () => {
  return {
    props: {
      goodies: goodies.map((goodie) => ({
        id: goodie.Id,
        name: translate("Goods", `GoodsName${goodie.Id}`, "en"),
        anime: goodie.AnimePngs[0]
      })),
    },
  };
}) satisfies GetStaticProps<GoodieList>;

export default function GoodiesList({
  goodies,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div>
      <h1 className="text-4xl font-bold">Goodies</h1>

      <h2 className="text-xl font-bold">Normal cats</h2>
      <div className="flex flex-row flex-wrap">
        {goodies.map((goodie) => (
          <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
        ))}
      </div>
    </div>
  );
}
