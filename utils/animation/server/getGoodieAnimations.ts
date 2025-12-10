import { AnimationMeta } from "../../../components/AnimationViewer"
import { GoodieRecord } from "../../tables"
import { getAnimation } from "./getAnimation"

const groups = [
  "01ball",
  "02danbo",
  "03cushion",
  "04tower",
  "05tunnel",
  "06jarashi",
  "07fukuro",
  "08meshi",
  "09tsume",
  "10hachi",
  "11hot",
  "12cube",
  "13blanket",
  "90other"
]

export async function getGoodieAnimations(goodie: GoodieRecord, suffixes: string[]) {
  const animations: AnimationMeta[] = []
  for (const anime of goodie.AnimeXmls.filter((x, i, arr) => arr.indexOf(x) === i)) {
    const img = goodie.AnimePngs[0]
    for (const suffix of suffixes) {
      const groupId = img.match(/^\d+/)
      const group = groups.find((g) => g.startsWith(groupId ? groupId[0] : ""))
      const imgPath = `/na2-assets/goods/${group}/${img}${suffix}.png`
      const xmlPath = `/na2-assets/goods/${group}/${anime}${suffix}.xml`
      const animation = await getAnimation(`${anime}${suffix}`, imgPath, xmlPath)
      if (animation) {
        animations.push(animation)
      }
    }
  }
  return animations
}
