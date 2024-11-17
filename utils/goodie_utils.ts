type SmallGoodie = { id: number, anime: string }

export function getGoodieIconLink(goodie: SmallGoodie) {
    return getGoodieIconURL(goodie.anime)
}

export function getGoodieIconURL(id: string) {
    return `/cat/SpriteAtlas/icon_goods_big.spriteatlas/${id}.png`
}
