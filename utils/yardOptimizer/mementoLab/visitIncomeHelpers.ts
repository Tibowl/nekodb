import { VISIT_CAT_COLORS } from "./constants"

export function visitCatColor(catId: number, activeCatId: number | null): string {
  if (activeCatId !== null && catId === activeCatId) return VISIT_CAT_COLORS[0]
  return VISIT_CAT_COLORS[Math.abs(catId) % VISIT_CAT_COLORS.length]!
}

export function visitCatLabel(
  catId: number,
  activeCatId: number | null,
  activeCatLabel: string,
  catLabelForId: (catId: number) => string
): string {
  return activeCatId !== null && catId === activeCatId
    ? activeCatLabel
    : catLabelForId(catId)
}

export function evenlySpacedIndices(len: number, max: number): number[] {
  if (len <= 0) return []
  if (len <= max) return Array.from({ length: len }, (_, i) => i)
  const xs: number[] = []
  for (let j = 0; j < max; j++) {
    xs.push(Math.min(len - 1, Math.floor((j + 0.5) * (len / max))))
  }
  return [...new Set(xs)].sort((a, b) => a - b)
}
