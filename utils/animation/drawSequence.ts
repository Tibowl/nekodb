
export function drawSequence(ctx: CanvasRenderingContext2D, img: HTMLImageElement, xml: any, frameNumber: number, x: number, y: number) {
  const frame = xml.Animation.Frames.Frame[frameNumber]

  for (const sprite of frame.Sprite) {
    ctx.setTransform(+sprite.m00, +sprite.m10, +sprite.m01, +sprite.m11, +sprite.m02, +sprite.m12)
    const module = xml.Animation.Modules.Module[sprite.module_id]
    // console.log(sprite, module)
    ctx.drawImage(img, +module.x, +module.y, +module.w, +module.h, -x, -y, +module.w, +module.h)
  }
}