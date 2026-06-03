/** Public URL paths for a cat animation spritesheet + XML. */
export function catAnimationPaths(
  idPrefix: string,
  imageName: string,
  opts: { sharedXml: boolean }
): { image: string; xml: string } {
  const xmlDir = opts.sharedXml
    ? "/na2-assets/xml/anime/master_xml"
    : `/na2-assets/xml/anime/neko/${idPrefix}`
  return {
    image: `/na2-assets/png/neko/${idPrefix}/${imageName}.png`,
    xml: `${xmlDir}/${imageName}`,
  }
}

/** Public URL paths for a goodie animation spritesheet + XML. */
export function goodieAnimationPaths(
  imageName: string,
  xmlName: string,
  suffix: string
): { image: string; xml: string } {
  return {
    image: `/na2-assets/png/goods/${imageName}${suffix}.png`,
    xml: `/na2-assets/xml/anime/goods/${xmlName}${suffix}`,
  }
}
