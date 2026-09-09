/** Atlas blocks the game splits the seal decos into (App.SealDecoAtlasResolver). */
const ATLASES = [
    { name: "sealdeco_bg", firstId: 1001, blockSize: 12 },
    { name: "sealdeco_sticker", firstId: 2001, blockSize: 48 },
]

export function getDecoIconURL(id: number) {
    const atlas = ATLASES.filter(a => id >= a.firstId).pop() ?? ATLASES[0]
    const block = Math.floor((id - atlas.firstId) / atlas.blockSize)
    return `/na2-assets/spriteatlas/${atlas.name}_${String(block).padStart(2, "0")}/${id}.png`
}
