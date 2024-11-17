import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats } from "../../utils/tables";
import { SmallCat } from "./[catId]";
import FormattedLink from "../../components/FormattedLink";
import CatLink from "../../components/CatLink";
import { CatType, getCatType } from "../../utils/cat_utils";

type CatList = {
  cats: SmallCat[];
};

export const getStaticProps = (async () => {
  return {
    props: {
      cats: cats.map((cat) => ({
        id: cat.Id,
        name: translate("Cat", `CatName${cat.Id}`, "en"),
      })),
    },
  };
}) satisfies GetStaticProps<CatList>;

export default function CatList({
  cats,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <div>
      <h1 className="text-4xl font-bold">Cats</h1>

      <h2 className="text-xl font-bold">Normal cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Normal).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>

      <h2 className="text-xl font-bold">Rare cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Rare).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>

      <h2 className="text-xl font-bold">Other cats</h2>
      <div className="flex flex-row flex-wrap">
        {cats.filter(cat => getCatType(cat) == CatType.Other || getCatType(cat) == CatType.Myneko).map((cat) => (
          <CatLink key={cat.id} cat={cat}></CatLink>
        ))}
      </div>
    </div>
  );
}
