import { AnimationMeta } from "../../../components/AnimationViewer"
import { GoodieRecord } from "../../tables"
import { goodieAnimationPaths } from "../goodieAnimationPaths"
import { getAnimation } from "./getAnimation"

export async function getGoodieAnimations(goodie: GoodieRecord, suffixes: string[]) {
  const animations: AnimationMeta[] = []
  for (const anime of goodie.AnimeXmls.filter((x, i, arr) => arr.indexOf(x) === i)) {
    const img = goodie.AnimePngs[0]
    for (const suffix of suffixes) {
      const paths = goodieAnimationPaths(img, anime, suffix)
      const animation = await getAnimation(`${anime}${suffix}`, paths.image, paths.xml)
      if (animation) {
        animations.push(animation)
      }
    }
  }
  return animations
}
