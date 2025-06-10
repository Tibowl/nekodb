import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import FormattedLink from "../../components/FormattedLink"
import { getSmallYard, yards } from "../../utils/tables"
import { SmallYard } from "./[yardId]"
import { useLanguage } from "../../hooks/useLanguage"

type YardList = {
  yards: SmallYard[]
};

export const getStaticProps = (async () => {
  return {
    props: {
      yards: yards.map(yard => getSmallYard(yard)),
    },
  }
}) satisfies GetStaticProps<YardList>

export default function GoodiesList({
  yards,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { translate } = useLanguage()

  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Yards - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Yards - NekoDB" />
        <meta property="og:description" content={`Discover all ${yards.length} yards in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${yards.length} yards in Neko Atsume 2!`} />
      </Head>
      <h1 className="text-4xl font-bold">Yards</h1>
      <div className="flex flex-row flex-wrap">
      <ul>
      {yards.map((yard) => (
        <li key={yard.id} className="flex flex-col gap-2">
          <FormattedLink href={`/yards/${yard.id}`}>
            {translate(yard.name)}
          </FormattedLink>
        </li>
      ))}
      </ul>
      </div>
    </main>
  )
}
