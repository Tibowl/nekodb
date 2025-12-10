import { readFile } from "fs/promises"
import { AnimationMeta } from "../../../components/AnimationViewer"
import { xmlParser } from "../xmlParser"

export async function getAnimation(image: string, imagePath: string, xmlPath: string): Promise<AnimationMeta | null> {
  try {
    const xmlData = await readFile(`public/${xmlPath}`)
    const parsed = xmlParser.parse(xmlData)

    const actions = parsed.Animation.Actions.Action
    const maxFrames = actions.reduce((max: any, action: any) => Math.max(max, action.Sequence.length), 0)
    const index = actions.findIndex((action: any) => action.Sequence.length == maxFrames)

    return {
      name: image.replace(".png", ""),
      url_img: imagePath,
      url_xml: xmlPath,
      actions: actions.length,
      defaultAction: index,
    }
  } catch (error) {
    console.error("Failed to parse " + imagePath)
  }
  return null
}
