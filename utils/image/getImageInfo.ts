import { readFile } from "fs/promises"
import { getImageSize } from "next/dist/server/image-optimizer"

export default async function getImageInfo(image: string) {
    if (image.includes("..")) {
        throw new Error("Invalid image path for " + image)
    }

    const imageDimensions = await getImageSize(await readFile(`public/${image}`))
    if (imageDimensions.width == undefined || imageDimensions.height == undefined) {
        throw new Error("Invalid image dimensions for " + image)
    }

    return {
        url: image,
        width: imageDimensions.width,
        height: imageDimensions.height
    }
}