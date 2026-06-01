import { readdir } from "fs/promises"
import { AnimationMeta } from "../../../components/AnimationViewer"
import { SmallCat } from "../../../pages/cats/[catId]"
import { CatType } from "../../cat/catType"
import { getCatIconId } from "../../cat/getCatIconId"
import { getCatType } from "../../cat/getCatType"
import { CatRecord } from "../../tables"
import { getAnimation } from "./getAnimation"

export async function getCatAnimations(smallCat: SmallCat, cat: CatRecord): Promise<AnimationMeta[]> {
  const animations: AnimationMeta[] = []
  const type = getCatType(smallCat)
  const match = cat.Id.toString().padStart(3, "0")
  const images = (await readdir(`public/na2-assets/png/neko/${match}`)).filter(x => x.endsWith(".png"))

  animations.push(...(await Promise.all(images.map(async (image) => {
    const imagePath = `/na2-assets/png/neko/${match}/${image}`
    let xmlPath: string

    if (type == CatType.Normal || type == CatType.Myneko) {
      xmlPath = `/na2-assets/xml/anime/master_xml/${image.replace(".png", "")}`
    } else if (type == CatType.Rare || type == CatType.Other) {
      xmlPath = `/na2-assets/xml/anime/neko/${match}/${image.replace(".png", "")}`
    } else {
      return null
    }
    return await getAnimation(image, imagePath, xmlPath)
  }))).filter(x => x != null))

  return animations
}
