export function getWallpaperLink(wallpaper: {id: number}) {
    return `/na2-assets/Wallpaper/kabe_${wallpaper.id.toString().padStart(3, "0")}.png`
}