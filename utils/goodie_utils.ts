import { SmallGoodie } from "../pages/goodies/[goodieId]"

export function getGoodieIconLink(goodie: SmallGoodie | { anime: string }) {
    return getGoodieIconURL(goodie.anime)
}

export function getGoodieIconURL(id: string) {
    return `/cat/SpriteAtlas/icon_goods_big.spriteatlas/${id}.png`
}
