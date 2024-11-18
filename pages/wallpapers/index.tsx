import { GetStaticProps, InferGetStaticPropsType } from "next"
import Head from "next/head"
import { wallpapers } from "../../utils/tables"
import { getWallpaperLink } from "../../utils/wallpaper_utils"
import Image from "next/image"

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
      wallpapers: wallpapers.map(wallpaper => {
        return {
            id: wallpaper.Id,
            gold: wallpaper.Gold,
            silver: wallpaper.Silver
        }
      })
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
        {wallpapers.map((wallpaper) => (
          <div key={wallpaper.id} className="bg-gray-100 dark:bg-slate-800 rounded-md flex flex-col items-center justify-center gap-2 p-2">
            <div className="max-w-96">
                <a href={getWallpaperLink(wallpaper)} target="_blank" rel="noreferrer">
                    <Image src={getWallpaperLink(wallpaper)} alt={`Wallpaper #${wallpaper.id}`} width={1382} height={2048}  className="rounded-md"/>
                </a>
            </div>
            <div className="text-sm">
                {wallpaper.silver > 0 && <><span className="font-bold">{wallpaper.silver}</span> silver fish</>}
                {wallpaper.gold > 0 && <><span className="font-bold">{wallpaper.gold}</span> gold fish</>}
            </div>
        </div>
        ))}
      </div>
    </main>
  )
}
