import { XMLParser } from "fast-xml-parser"

export const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "", // Don't add prefixes to attribute names
  isArray: (tagName) => {
    return tagName === "Sequence" || tagName === "Action" || tagName === "Module" || tagName === "Frame" || tagName === "Sprite"
  }
})