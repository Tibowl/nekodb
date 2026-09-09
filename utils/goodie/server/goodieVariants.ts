import { readdir } from "fs/promises"
import { takesDamage, type GoodieDamageInfo } from "../getSuffixes"

/**
 * Damage variants read off the assets. The game resolves them the same way (see
 * `goodieAssetSuffix`) and never consults RepairPattern, which doesn't predict
 * them: four RepairPattern-0 goodies ship a `_repair_break`, and the cushion
 * domes (183-185) have one as an animation but not as an icon.
 */

/** Exact match only, or `03cushion_dome_bl_break` looks like a variant of 183. */
const DAMAGE_TAIL = /^(_break|_repair|_repair_break|_repair_\d+|_repair_\d+_break)$/

async function pngNames(dir: string) {
  const files = await readdir(`public/na2-assets/${dir}`)
  return files.filter((f) => f.endsWith(".png")).map((f) => f.slice(0, -4))
}

let assetNames: Promise<{ anime: string[]; icon: string[] }> | null = null

function names() {
  assetNames ??= (async () => ({
    anime: await pngNames("png/goods"),
    icon: await pngNames("spriteatlas/icon_goods_big"),
  }))()
  return assetNames
}

function variantsOf(all: string[], goodie: GoodieDamageInfo) {
  const base = goodie.AnimePngs?.[0]
  if (!base || !takesDamage(goodie)) return [""]
  const found = all
    .filter((name) => name.startsWith(base) && DAMAGE_TAIL.test(name.slice(base.length)))
    .map((name) => name.slice(base.length))
    .sort()
  return ["", ...found]
}

/** Animation variants for a goodie, undamaged first. */
export async function goodieAnimeVariants(goodie: GoodieDamageInfo) {
  return variantsOf((await names()).anime, goodie)
}

/** Shop-icon variants for a goodie, undamaged first. */
export async function goodieIconVariants(goodie: GoodieDamageInfo) {
  return variantsOf((await names()).icon, goodie)
}
