import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { DecoType, DecoTypeNames } from "."
import Cost from "../../components/Cost"
import DisplayImage, { ImageMetaData } from "../../components/DisplayImage"
import { useLanguage } from "../../contexts/LanguageContext"
import { TranslationTable } from "../../utils/localization/translate"
import { decos, getDeco, getSmallDeco } from "../../utils/tables"

export type SmallDeco = {
  id: number
  name: TranslationTable
  image: ImageMetaData | null

  type: DecoType
}

export type Deco = SmallDeco & {

  silver: number
  gold: number
}

type DecoInfo = {
  deco: Deco
}


export const getStaticProps = (async (context) => {
  const deco = getDeco(Number(context.params?.decoId))

  if (!deco) {
    return {
      notFound: true,
    }
  }

  return {
    props: {
      deco: {
        ...await getSmallDeco(deco),

        silver: deco.Silver,
        gold: deco.Gold,
      },
    },
  }
}) satisfies GetStaticProps<DecoInfo>


export const getStaticPaths = (async () => {
  return {
    paths: decos.map((deco) => ({ params: { decoId: deco.Id.toString() } })),
    fallback: false,
  }
})


export default function Deco({ deco }: InferGetStaticPropsType<typeof getStaticProps>) {
  const { translate } = useLanguage()
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>{`${translate(deco.name)} - NekoDB`}</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content={`${translate(deco.name)} - NekoDB`} />
        <meta property="og:description" content={`Discover all the cats that can visit ${translate(deco.name)} in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all the cats that can visit ${translate(deco.name)} in Neko Atsume 2!`} />
        <meta property="og:image" content={deco.image?.url} />
      </Head>
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row items-center gap-2">
          <div className="w-24 h-24 flex flex-col items-center justify-center">
            {deco.image && <DisplayImage img={deco.image} alt={translate(deco.name)} className="max-h-full max-w-full" />}
          </div>
          <div className="flex flex-col">
            <h1 className="text-4xl font-bold">{translate(deco.name)}</h1>
            <div className="flex flex-row items-center gap-2">
              <div className="text-sm">{DecoTypeNames[deco.type]}</div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold" id="base-stats">Cost</h2>
        <div className="grid grid-cols-[auto_1fr] w-fit ml-4 gap-x-2">
            {deco.silver > 0 && <>
              <div className="font-semibold">Silver cost</div>
              <div className="text-right"><Cost count={deco.silver} type="silver" /></div>
            </>}

            {deco.gold > 0 && <>
              <div className="font-semibold">Gold cost</div>
              <div className="text-right"><Cost count={deco.gold} type="gold" /></div>
            </>}

            {deco.silver <= 0 && deco.gold <= 0 && <div className="col-span-2">Free</div>}
        </div>

        <h2 className="text-xl font-bold" id="base-stats">Image</h2>
        {deco.image && <div className="flex flex-col items-start">
          <div className="bg-gray-100 dark:bg-slate-800 rounded-md  gap-2 p-2">
            <a href={deco.image.url} target="_blank" rel="noreferrer">
              <DisplayImage img={deco.image} alt={translate(deco.name)} className="rounded-md" />
            </a>
          </div>
        </div>}
    </div>
  </main>
  )
}
