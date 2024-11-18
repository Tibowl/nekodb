export function getWallpaperLink(wallpaper: {id: number}) {
    return `/cat/Wallpaper/kabe_${wallpaper.id.toString().padStart(3, "0")}.png`
}