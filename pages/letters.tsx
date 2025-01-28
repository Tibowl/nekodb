import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { letters } from "../utils/tables"

type SmallLetter = {
  id: number
  word: string
}

type LetterList = {
  letters: SmallLetter[];
};

export const getStaticProps = (async () => {
  return {
    props: {
      letters: letters.map(letter => ({
        id: letter.Id,
        word: letter.Word.join(""),
      })),
    },
  }
}) satisfies GetStaticProps<LetterList>

export default function LetterList({
  letters,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Words - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Words - NekoDB" />
        <meta property="og:description" content={`Discover all ${letters.length} words in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${letters.length} words in Neko Atsume 2!`} />
      </Head>

      <h1 className="text-4xl font-bold">Words</h1>

      <h2 className="text-xl font-bold">Japanese</h2>
      <div className="flex flex-col flex-wrap">
        {letters.filter(letter => letter.id < 1000).map((letter) => (
          <div key={letter.id} className="font-mono">
            #{letter.id} - {letter.word}
          </div>
        ))}
      </div>

      <h2 className="text-xl font-bold">English</h2>
      <div className="flex flex-col flex-wrap">
        {letters.filter(letter => letter.id >= 1000).map((letter) => (
          <div key={letter.id} className="font-mono">
            #{letter.id} - {letter.word}
          </div>
        ))}
      </div>
    </main>
  )
}
