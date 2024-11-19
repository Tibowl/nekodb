import { XMLParser } from "fast-xml-parser"

export const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "", // Don't add prefixes to attribute names
    isArray: (tagName, jPath, isLeafNode, isAttribute) => {
        // Treat 'Sequence' as an array
        return tagName === "Sequence" || tagName === "Action" || tagName === "Module" || tagName === "Frame" || tagName === "Sprite"
    }
})

export function drawSequence(ctx: CanvasRenderingContext2D, img: HTMLImageElement, xml: any, frameNumber: number) {
    const frame = xml.Animation.Frames.Frame[frameNumber]

    for (const sprite of frame.Sprite) {
        ctx.setTransform(sprite.m00, sprite.m10, sprite.m01, sprite.m11, sprite.m02, sprite.m12)
        const module = xml.Animation.Modules.Module[sprite.module_id]
        // console.log(sprite, module)
        ctx.drawImage(img, module.x, module.y, module.w, module.h, ctx.canvas.width/2, ctx.canvas.height/2, module.w, module.h)
    }
}
