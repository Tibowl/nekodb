export function getWallpaperLink(id: number) {
    return `/na2-assets/png/wallpaper/${id.toString().padStart(3, "0")}.png`
}
