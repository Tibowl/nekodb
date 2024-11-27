import { AnimationMeta } from "../../../components/AnimationViewer"
import { GoodieRecord } from "../../tables"
import { getAnimation } from "./getAnimation"

export async function getGoodieAnimations(goodie: GoodieRecord, suffixes: string[]) {
  const animations: AnimationMeta[] = []
  for (const anime of goodie.AnimeXmls.filter((x, i, arr) => arr.indexOf(x) === i)) {
    const img = goodie.AnimePngs[0]
    for (const suffix of suffixes) {
      const imgPath = `/na2-assets/goods/${img}${suffix}.png`
      const xmlPath = `/na2-assets/goods/${anime}${suffix}.xml`
      const animation = await getAnimation(`${anime}${suffix}`, imgPath, xmlPath)
      if (animation) {
        animations.push(animation)
      }
    }
  }
  return animations
}