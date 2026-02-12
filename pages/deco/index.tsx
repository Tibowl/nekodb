import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import GoodieLink from "../../components/GoodieLink"
import { useLanguage } from "../../contexts/LanguageContext"
import { decos, getSmallDeco } from "../../utils/tables"
import { SmallDeco } from "./[decoId]"
import DecoLink from "../../components/DecoLink"
import { useMemo } from "react"

export enum DecoType {
  None = 0,
  Bg = 1,
  Deco = 2,
}
export const DecoTypeNames: Record<DecoType, string> = {
  [DecoType.None]: "None",
  [DecoType.Bg]: "Background",
  [DecoType.Deco]: "Decoration",
}

type DecoList = {
  decos: (SmallDeco & {
    new: boolean
  })[];
};

export const getStaticProps = (async () => {
  const mappedDecos = await Promise.all(decos
    .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
    .map(async (deco) => {
      return { ...await getSmallDeco(deco), new: deco.IsNew }
    })
  )
  return {
    props: {
      decos: mappedDecos,
    },
  }
}) satisfies GetStaticProps<DecoList>

export default function DecosList({ decos }: InferGetStaticPropsType<typeof getStaticProps>) {
  const categories = [DecoType.Bg, DecoType.Deco]
  const newDecos = useMemo(() => decos.filter((deco) => deco.new), [decos])

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Decos - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Decos - NekoDB" />
        <meta property="og:description" content={`Discover all ${decos.length} decos in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${decos.length} decos in Neko Atsume 2!`} />
      </Head>
      <h1 className="text-4xl font-bold">Decos</h1>
      {newDecos.length > 0 && <div>
        <h2 className="text-xl font-bold" id="new">New decos ({newDecos.length})</h2>
        <div className="flex flex-row flex-wrap">
          {newDecos.map((deco) => (
              <DecoLink key={deco.id} deco={deco}></DecoLink>
          ))}
        </div>
      </div>}
      {categories.map((category) => {
        const filtered = decos.filter((deco) => deco.type == category)

        return <div key={category}>
          <h2 className="text-xl font-bold" id={`category-${category}`}>
            {DecoTypeNames[category]} ({filtered.length})
          </h2>
          <div className="flex flex-row flex-wrap">
            {filtered.map((deco) => (
              <DecoLink key={deco.id} deco={deco}></DecoLink>
            ))}
          </div>
        </div>
      })}
    </main>
  )
}
