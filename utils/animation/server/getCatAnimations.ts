import { readdir } from "fs/promises"
import { AnimationMeta } from "../../../components/AnimationViewer"
import { SmallCat } from "../../../pages/cats/[catId]"
import { CatType } from "../../cat/catType"
import { getCatIconId } from "../../cat/getCatIconId"
import { getCatType } from "../../cat/getCatType"
import { CatRecord } from "../../tables"
import { catAnimationPaths } from "../goodieAnimationPaths"
import { getAnimation } from "./getAnimation"

export async function getCatAnimations(smallCat: SmallCat, cat: CatRecord): Promise<AnimationMeta[]> {
  const animations: AnimationMeta[] = []
  const type = getCatType(smallCat)
  const match = cat.Id.toString().padStart(3, "0")
  const images = (await readdir(`public/na2-assets/png/neko/${match}`)).filter(x => x.endsWith(".png"))

  const sharedXml = type == CatType.Normal || type == CatType.Myneko
  const perCatXml = type == CatType.Rare || type == CatType.Other

  animations.push(...(await Promise.all(images.map(async (image) => {
    if (!sharedXml && !perCatXml) {
      return null
    }
    const paths = catAnimationPaths(match, image.replace(".png", ""), { sharedXml })
    return await getAnimation(image, paths.image, paths.xml)
  }))).filter(x => x != null))

  return animations
}
