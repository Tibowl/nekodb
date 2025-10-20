import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import GoodieLink from "../../components/GoodieLink"
import { useLanguage } from "../../contexts/LanguageContext"
import { decos, getSmallDeco } from "../../utils/tables"
import { SmallDeco } from "./[decoId]"
import DecoLink from "../../components/DecoLink"

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
  decos: SmallDeco[];
};

export const getStaticProps = (async () => {
  const mappedDecos = await Promise.all(decos
    .sort((a, b) => a.DisplayOrder - b.DisplayOrder)
    .map(async (deco) => {
      return await getSmallDeco(deco)
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
