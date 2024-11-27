import { PlayingAnimation } from "../../components/AnimationViewer"

export function getRecommendedSize(animations: PlayingAnimation[], xmls: any[]) {
  if (!xmls || xmls.some(x => x == null)) return {
    width: 128, height: 128,
    x: 0, y: 0
  }
  
  const response = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
  }

  for (let i = 0; i < animations.length; i++) {
    const xml = xmls[i]
    const animation = animations[i]
    if (!xml) continue

    for (const frame of xml.Animation.Frames.Frame) {
      for (const sprite of frame.Sprite) {
        const module = xml.Animation.Modules.Module[sprite.module_id]
        const corners = [
          [0, 0],
          [+module.w, 0],
          [+module.w, +module.h],
          [0, +module.h],
        ].map(([x, y]) => [x + (animation.xOffset ?? 0), y + (animation.yOffset ?? 0)])

        for (const corner of corners) {
          // Check transformation matrix sprite.m00, sprite.m10, sprite.m01, sprite.m11, sprite.m02, sprite.m12
          const x = corner[0] * +sprite.m00 + corner[1] * +sprite.m01 + +sprite.m02
          const y = corner[0] * +sprite.m10 + corner[1] * +sprite.m11 + +sprite.m12

          // console.log(corner, x, y)

          if (x < response.minX) response.minX = x
          if (x > response.maxX) response.maxX = x
          if (y < response.minY) response.minY = y
          if (y > response.maxY) response.maxY = y
        }
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