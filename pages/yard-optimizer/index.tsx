import Head from "next/head"
import YardOptimizerClient from "../../components/YardOptimizerClient"

export default function YardOptimizerPage() {
  return (
    <main className="w-full max-w-5xl">
      <Head>
        <title>Yard optimizer - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Yard optimizer - NekoDB" />
        <meta
          property="og:description"
          content="Try lots of yard layouts in your browser and keep the best for fish, visits, or mementos."
        />
        <meta
          name="description"
          content="Try lots of yard layouts in your browser and keep the best for fish, visits, or mementos."
        />
      </Head>
      <YardOptimizerClient />
    </main>
  )
}
