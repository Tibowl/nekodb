import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats, getSmallGoodie, goodies } from "../../utils/tables";
import CatLink from "../../components/CatLink";
import { CatType, getCatType } from "../../utils/cat_utils";
import { SmallGoodie } from "./[goodieId]";
import GoodieLink from "../../components/GoodieLink";
import { parseBitMap } from "../../utils/bit_math";
import { useState } from "react";
import { CheckboxInput } from "../../components/CheckboxInput";

type GoodieList = {
  goodies: (SmallGoodie & { categories: string[] })[];
  categories: string[];
};

export const getStaticProps = (async () => {
  const allCategories = [];
  for (let i = 0; i < 32; i++) {
    allCategories.push(translate("Program", `Category${i + 1}`, "en"));
  }

  const mappedGoodies = goodies
    .filter((goodie) => goodie.Category != 0)
    .sort((a, b) => a.DisplayOrderInShop - b.DisplayOrderInShop)
    .map((goodie) => {
      const categories = parseBitMap(goodie.Category).map((id) =>
        translate("Program", `Category${id + 1}`, "en")
      );
      return { ...getSmallGoodie(goodie), categories };
    });

  return {
    props: {
      goodies: mappedGoodies,
      categories: allCategories.filter((category) =>
        mappedGoodies.some((goodie) => goodie.categories.includes(category))
      ),
    },
  };
}) satisfies GetStaticProps<GoodieList>;

export default function GoodiesList({
  goodies,
  categories,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [groupByCategory, setGroupByCategory] = useState(false);

  return (
    <div>
      <h1 className="text-4xl font-bold">Goodies</h1>
      <CheckboxInput label="Group by category" set={setGroupByCategory} value={groupByCategory} />

      {groupByCategory && categories.map((category) => {
        const filtered = goodies.filter((goodie) => goodie.categories.includes(category))
      
        return <div key={category}>
          <h2 className="text-xl font-bold" id={category}>
            {category} ({filtered.length})
          </h2>
          <div className="flex flex-row flex-wrap">
            {filtered.map((goodie) => (
              <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
            ))}
          </div>
        </div>
      })}

      {!groupByCategory && <div>
        <h2 className="text-xl font-bold" id="goodies">All goodies ({goodies.length})</h2>
        <div className="flex flex-row flex-wrap">
          {goodies.map((goodie) => (
            <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
          ))}
        </div>
      </div>}
    </div>
  );
}
