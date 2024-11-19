import { XMLParser } from "fast-xml-parser"

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "", // Don't add prefixes to attribute names
  isArray: (tagName) => {
    return tagName === "Sequence" || tagName === "Action" || tagName === "Module" || tagName === "Frame" || tagName === "Sprite"
  }
})

export function drawSequence(ctx: CanvasRenderingContext2D, img: HTMLImageElement, xml: any, frameNumber: number, x: number, y: number) {
  const frame = xml.Animation.Frames.Frame[frameNumber]

  for (const sprite of frame.Sprite) {
    ctx.setTransform(+sprite.m00, +sprite.m10, +sprite.m01, +sprite.m11, +sprite.m02, +sprite.m12)
    const module = xml.Animation.Modules.Module[sprite.module_id]
    // console.log(sprite, module)
    ctx.drawImage(img, +module.x, +module.y, +module.w, +module.h, -x, -y, +module.w, +module.h)
  }
}

export function getRecommendedSize(xml: any) {
  if (!xml) return {
    width: 128, height: 128,
    x: 0, y: 0
  }
  
  const response = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }

  for (const frame of xml.Animation.Frames.Frame) {
    for (const sprite of frame.Sprite) {
      const module = xml.Animation.Modules.Module[sprite.module_id]
      const corners = [
        [0, 0],
        [+module.w, 0],
        [+module.w, +module.h],
        [0, +module.h],
      ]

      for (const corner of corners) {
        // Check transformation matrix sprite.m00, sprite.m10, sprite.m01, sprite.m11, sprite.m02, sprite.m12
        const x = corner[0] * +sprite.m00 + corner[1] * +sprite.m01 + +sprite.m02
        const y = corner[0] * +sprite.m10 + corner[1] * +sprite.m11 + +sprite.m12

        console.log(corner, x, y)

        if (x < response.minX) response.minX = x
        if (x > response.maxX) response.maxX = x
        if (y < response.minY) response.minY = y
        if (y > response.maxY) response.maxY = y
      }
    }
  }

  // Convert into width, height and x, y
  let width = response.maxX - response.minX
  let height = response.maxY - response.minY
  let x = response.minX
  let y = response.minY

  console.log(response, { width, height, x, y })
  
  return { width, height, x, y }
}