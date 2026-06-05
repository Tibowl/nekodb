import { PLACES_INDOOR, PLACES_OUTDOOR } from "./config"
import type { YardState } from "./types"

/**
 * Human-readable reason the yard fails **structural** rules (slot counts, duplicates),
 * or `null` if the layout is valid. Matches `validateYard` in `yardCore.ts`.
 */
export function yardStructureError(
  y: YardState,
  placesIndoor = PLACES_INDOOR,
  placesOutdoor = PLACES_OUTDOOR
): string | null {
  if (y.indoorLarge.size > 1) {
    return `indoor_large invalid: ${[...y.indoorLarge]}`
  }
  if (y.indoorSmall.size + y.indoorLarge.size * 2 > placesIndoor) {
    return `indoor slots: large=${[...y.indoorLarge]} small=${[...y.indoorSmall]}`
  }
  if (y.outdoorLarge.size > 1) {
    return `outdoor_large invalid: ${[...y.outdoorLarge]}`
  }
  if (y.outdoorSmall.size + y.outdoorLarge.size * 2 > placesOutdoor) {
    return `outdoor slots: large=${[...y.outdoorLarge]} small=${[...y.outdoorSmall]}`
  }
  const n =
    y.indoorLarge.size +
    y.indoorSmall.size +
    y.outdoorLarge.size +
    y.outdoorSmall.size
  const used = new Set([
    ...y.indoorLarge,
    ...y.indoorSmall,
    ...y.outdoorLarge,
    ...y.outdoorSmall,
  ])
  if (used.size !== n) return "duplicate items across yard"
  return null
}

export function yardHasInvalidStructure(
  y: YardState,
  placesIndoor = PLACES_INDOOR,
  placesOutdoor = PLACES_OUTDOOR
): boolean {
  return yardStructureError(y, placesIndoor, placesOutdoor) !== null
}
