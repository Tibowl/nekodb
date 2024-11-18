import type { NextPage } from "next"
import Head from "next/head"
import Image, { StaticImageData } from "next/image"
import FormattedLink from "../components/FormattedLink"
import Snowball from "../public/na2-assets/SpriteAtlas/icon_cat.spriteatlas/00.png"
import CatTree from "../public/na2-assets/SpriteAtlas/icon_goods_big.spriteatlas/04tower_2dan.png"

const Home: NextPage = () => {
  const desc = "NekoDB is a database of Neko Atsume 2's data."
  return (
    <main>
      <Head>
        <title>NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="NekoDB" />
        <meta property="og:description" content={desc} />
        <meta name="description" content={desc} />
        <meta name="twitter:title" content="NekoDB" />
      </Head>
      <div className="flex flex-col items-center justify-center w-full flex-1 text-center">
        <h1 className="text-6xl font-bold mt-6">
          Welcome to NekoDB
        </h1>

        <p className="m-3 text-2xl">
          A Neko Atsume 2 database site
        </p>
        <div className="grid items-center justify-around max-w-4xl mt-1">
          <div className="md:flex md:flex-row items-center max-w-4xl">
            <Card href="/cats" title="Cats &rarr;" desc="Want to know what goodies and snacks a cat needs or their play spaces?" location={"/"} src={Snowball} />
            <Card href="/goodies" title="Goodies &rarr;" desc="Or the opposite, what cats can visit a goodie and with what priority?" location={"/"} src={CatTree} />
          </div>
        </div>
      </div>
    </main>
  )
}

export default Home

function Card({ href, src, title, desc, location, colors = "bg-slate-300 dark:bg-slate-800" }: { href?: string, src: StaticImageData, title: string, desc: string, colors?: string, location: string }) {
  const className = `px-6 py-1.5 m-1.5 h-full text-left border max-w-full items-start justify-center flex flex-col rounded-2xl ${colors}`
  const inner = <>
    <h3 className="text-3xl font-semibold flex flex-row items-center gap-2">
      <div>{src && <Image src={src} alt="Icon" className="max-h-8 max-w-8" />}</div>
      <div>{title}</div>
    </h3>

    <p className="mt-2 text-lg">
      {desc}
    </p>
  </>

  if (href)
    return <FormattedLink
      href={href}
      className={className}
      style={{ minHeight: "12rem" }}
      location={location}
    >
      {inner}
    </FormattedLink>
  else
    return <div className={className} style={{ minHeight: "12rem" }}>
      {inner}
    </div>
}
