import { GetStaticProps, InferGetStaticPropsType } from "next";
import { translate } from "../../utils/localization";
import { cats, getSmallCat } from "../../utils/tables";
import { SmallCat } from "./[catId]";
import FormattedLink from "../../components/FormattedLink";
import CatLink from "../../components/CatLink";
import { CatType, getCatType } from "../../utils/cat_utils";
import Head from "next/head";

type CatList = {
  cats: SmallCat[];
};

export const getStaticProps = (async () => {
  return {
    props: {
      cats: cats.map(cat => getSmallCat(cat)),
    },
  };
}) satisfies GetStaticProps<CatList>;

export default function CatList({
  cats,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Cats - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Cats - NekoDB" />
        <meta property="og:description" content={`Discover all ${cats.length} cats in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${cats.length} cats in Neko Atsume 2!`} />
      </Head>

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
    </main>
  );
}
