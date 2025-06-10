import { readdir } from "fs/promises"
import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { translate, TranslationTable } from "../utils/localization/translate"
import { mynekoParts } from "../utils/tables"
import { useLanguage } from "../hooks/useLanguage"

type MyNekoList = {
  parts: MynekoPart[]
  // animations: string[]
}

type MynekoPart = {
  id: number
  urlPath: string
  name: TranslationTable
  kind: keyof typeof MynekoPartsKind
  priority: number
  ignoreParts: number[]
}

enum MynekoPartsKind {
  Base = 0,
  Pattern = 1,
  Eye = 2,
  Accessory = 3,
  Stand = 4,
  Default = 5,
  Outline = 6,
}

export const getStaticProps = (async () => {
  const files = await readdir("public/na2-assets/neko/parts")

  return {
    props: {
      parts: mynekoParts.sort((a, b) => a.DisplayOrder - b.DisplayOrder).map(part => {
        return {
          id: part.Id,
          urlPath: files.find(x => x.startsWith(part.Id.toString().padStart(3, "0"))) ?? "?",
          name: translate("Myneko", `PartsName${part.Id}`),
          kind: MynekoPartsKind[part.Kind] as keyof typeof MynekoPartsKind,
          priority: part.Priority,
          ignoreParts: part.IgnoreParts,
        }
      })
    },
  }
}) satisfies GetStaticProps<MyNekoList>

export default function PartList({
  parts,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { translate } = useLanguage();

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>MyNeko - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="MyNeko - NekoDB" />
        <meta property="og:description" content={`Discover all ${parts.length} MyNeko parts in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${parts.length} MyNeko parts in Neko Atsume 2!`} />
      </Head>
      <h1 className="text-4xl font-bold">Parts</h1>
      {parts.map(part => <div key={part.id} id={part.id.toString()}>
        <h2 className="text-xl font-bold">{translate(part.name)} #{part.id}</h2>
        <div className="flex flex-row flex-wrap gap-2">
          <img src={`/na2-assets/neko/parts/${part.urlPath}/00kihon_grooming.png`} alt={translate(part.name)} className="max-h-full max-w-full" />
        </div>
        <div className="text-sm">{part.kind}</div>
        <div className="text-sm">{part.priority}</div>
        <div className="text-sm">{part.ignoreParts.map(x => parts.find(y => y.id == x)).filter(x => x?.kind != part.kind).map(x => <a key={x?.id} href={`#${x?.id}`}>{translate(x?.name!)}</a>)}</div>
      </div>)}
    </main>
  )
}
