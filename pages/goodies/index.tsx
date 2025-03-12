import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { useMemo, useState } from "react"
import { CheckboxInput } from "../../components/CheckboxInput"
import GoodieLink from "../../components/GoodieLink"
import { translate } from "../../utils/localization/translate"
import { parseBitMap } from "../../utils/math/parseBitMap"
import { getSmallGoodie, goodies } from "../../utils/tables"
import { SmallGoodie } from "./[goodieId]"

type GoodieList = {
  goodies: (SmallGoodie & { categories: string[] })[];
  categories: string[];
};

export const getStaticProps = (async () => {
  const allCategories = []
  for (let i = 0; i < 32; i++) {
    allCategories.push(translate("Program", `Category${i + 1}`, "en"))
  }

  const mappedGoodies = await Promise.all(goodies
    .filter((goodie) => goodie.Category != 0)
    .sort((a, b) => a.DisplayOrder - b.DisplayOrder || a.DisplayOrderInShopRaw - b.DisplayOrderInShopRaw || a.DisplayOrderInTrade - b.DisplayOrderInTrade)
    .map(async (goodie) => {
      const categories = parseBitMap(goodie.Category).map((id) =>
        translate("Program", `Category${id + 1}`, "en")
      )
      return { ...await getSmallGoodie(goodie), categories, shopSort: goodie.DisplayOrder, tradeSort: goodie.DisplayOrderInTrade, new: goodie.IsNew }
    })
  )

  return {
    props: {
      goodies: mappedGoodies,
      categories: allCategories.filter((category) =>
        mappedGoodies.some((goodie) => goodie.categories.includes(category))
      ),
    },
  }
}) satisfies GetStaticProps<GoodieList>

export default function GoodiesList({
  goodies,
  categories,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const [groupByCategory, setGroupByCategory] = useState(false)
  const shopGoodies = useMemo(() => goodies.filter((goodie) => goodie.shopSort > 0), [goodies])
  const tradeGoodies = useMemo(() => goodies.filter((goodie) => goodie.tradeSort > 0), [goodies])
  const newGoodies = useMemo(() => goodies.filter((goodie) => goodie.new), [goodies])

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Goodies - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Goodies - NekoDB" />
        <meta property="og:description" content={`Discover all ${goodies.length} goodies in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${goodies.length} goodies in Neko Atsume 2!`} />
      </Head>
      <h1 className="text-4xl font-bold">Goodies</h1>
      {newGoodies.length > 0 && <div>
        <h2 className="text-xl font-bold" id="new">New goodies ({newGoodies.length})</h2>
        <div className="flex flex-row flex-wrap">
          {newGoodies.map((goodie) => (
            <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
          ))}
        </div>
      </div>}
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
        <h2 className="text-xl font-bold" id="goodies">Store goodies ({shopGoodies.length})</h2>
        <div className="flex flex-row flex-wrap">
          {shopGoodies.map((goodie) => (
            <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
          ))}
        </div>

        {tradeGoodies.length > 0 && <>
          <h2 className="text-xl font-bold" id="goodies">Trade goodies ({tradeGoodies.length})</h2>
          <div className="flex flex-row flex-wrap">
            {tradeGoodies.map((goodie) => (
              <GoodieLink key={goodie.id} goodie={goodie}></GoodieLink>
            ))}
          </div>
        </>}
      </div>}
    </main>
  )
}
