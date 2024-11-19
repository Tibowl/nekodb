import { readFile } from "fs/promises"
import { xmlParser } from "./animation_utils"

export async function getAnimation(image: string, imagePath: string, xmlPath: string) {
  try {
    const xmlData = await readFile(`public/${xmlPath}`)
    const parsed = xmlParser.parse(xmlData)

    return {
      name: image.replace(".png", ""),
      url_img: imagePath,
      url_xml: xmlPath,
      actions: parsed.Animation.Actions.Action.length
    }
  } catch (error) {
    console.error("Failed to parse " + imagePath)
  }
  return null
}
