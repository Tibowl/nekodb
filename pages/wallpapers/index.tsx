import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import Cost from "../../components/Cost"
import DisplayImage from "../../components/DisplayImage"
import getImageInfo from "../../utils/image/getImageInfo"
import { wallpapers } from "../../utils/tables"
import { getWallpaperLink } from "../../utils/wallpaper/getWallpaperLink"

type Wallpapers = {
  wallpapers: Wallpaper[];
};

type Wallpaper = {
    id: number
    gold: number
    silver: number
}

export const getStaticProps = (async () => {
  return {
    props: {
      wallpapers: await Promise.all(wallpapers.map(async wallpaper => {
        return {
            id: wallpaper.Id,
            img: await getImageInfo(getWallpaperLink(wallpaper.Id)),
            gold: wallpaper.Gold,
            silver: wallpaper.Silver
        }
      }))
    },
  }
}) satisfies GetStaticProps<Wallpapers>

export default function CatList({
  wallpapers,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return (
    <main className="w-full max-w-7xl">
      <Head>
        <title>Wallpapers - NekoDB</title>
        <meta name="twitter:card" content="summary" />
        <meta property="og:title" content="Cats - NekoDB" />
        <meta property="og:description" content={`Discover all ${wallpapers.length} wallpapers in Neko Atsume 2!`} />
        <meta property="description" content={`Discover all ${wallpapers.length} wallpapers in Neko Atsume 2!`} />
      </Head>

      <h1 className="text-4xl font-bold">Wallpapers</h1>
      <div className="flex flex-row flex-wrap gap-2">
        {wallpapers.map((wallpaper, index) => (
          <div key={wallpaper.id} className="bg-gray-100 dark:bg-slate-800 rounded-md flex flex-col items-center justify-center gap-2 p-2">
            <div className="max-w-96">
                <a href={wallpaper.img.url} target="_blank" rel="noreferrer">
                  <DisplayImage img={wallpaper.img} alt={`Wallpaper #${wallpaper.id}`} className="rounded-md" loading={index < 2 ? "eager" : "lazy"}/>
                </a>
            </div>
            {wallpaper.silver > 0 && <Cost count={wallpaper.silver} type="silver" />}
            {wallpaper.gold > 0 && <Cost count={wallpaper.gold} type="gold" />}
        </div>
        ))}
      </div>
    </main>
  )
}
