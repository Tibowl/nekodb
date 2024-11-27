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
  if (type == CatType.Normal) {
    const normalCats = await readdir("public/na2-assets/neko/normal")
    const match = normalCats.find(f => f.startsWith(getCatIconId({ id: cat.Id }) + "_"))
    if (!match) throw new Error("No animations found for " + smallCat.name)
    const images = await readdir(`public/na2-assets/neko/normal/${match}`)

    animations.push(...(await Promise.all(images.map(async (image) => {
      const imagePath = `/na2-assets/neko/normal/${match}/${image}`
      const xmlPath = `/na2-assets/neko/normal/master_xml/${image.replace(".png", ".xml")}`
      return await getAnimation(image, imagePath, xmlPath)
    }))).filter(x => x != null))
  } else if (type == CatType.Myneko) {
    const myNekoCats = await readdir("public/na2-assets/neko/myneko")
    const match = myNekoCats.find(f => f.startsWith(cat.Id.toString().slice(1) + "_"))
    if (!match) throw new Error("No animations found for " + smallCat.name)
    const images = await readdir(`public/na2-assets/neko/myneko/${match}`)

    animations.push(...(await Promise.all(images.map(async (image) => {
      const imagePath = `/na2-assets/neko/myneko/${match}/${image}`
      const xmlPath = `/na2-assets/neko/normal/master_xml/${image.replace(".png", ".xml")}`
      return await getAnimation(image, imagePath, xmlPath)
    }))).filter(x => x != null))
  } else if (type == CatType.Rare || type == CatType.Other) {
    const rareCats = await readdir("public/na2-assets/neko/special/png")
    const match = rareCats.filter(f => f.startsWith(getCatIconId({ id: cat.Id }).replace("s", "sp") + "_"))
    if (match.length == 0) throw new Error("No animations found for " + smallCat.name)

    animations.push(...(await Promise.all(match.map(async (image) => {
      const imagePath = `/na2-assets/neko/special/png/${image}`
      const xmlPath = `/na2-assets/neko/special/xml/${image.replace(".png", ".xml")}`
      return await getAnimation(image, imagePath, xmlPath)
    }))).filter(x => x != null))
  }
  return animations
}
