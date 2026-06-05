import CatNames from "../../../NekoAtsume2Data/localization/en/Cat.json"
import GoodsNames from "../../../NekoAtsume2Data/localization/en/Goods.json"
import {
  cats,
  catVsCat,
  goodies,
  playSpaces,
  playSpaceVsCat,
} from "../../../utils/yardOptimizer/gameData"
import { defaultItemPools } from "../../../utils/yardOptimizer/yardCore"

export type PlaySpaceRow = { Id: number; ItemId: number; ConflictIndices?: number[] }
type PlaySpaceCatRow = {
  Id: number
  Dict?: Record<string, number | number[] | undefined>
}
type CatRelationshipRow = { Id: number; Dict?: Record<string, number | undefined> }
type GoodieRow = { Id: number; Category: number }

export type RelationshipExample = {
  catId: number
  otherCatId: number
  cat: string
  otherCat: string
  goodie: string
  goodieId: number
  slotCount: number
  baseDrawPercent: number
  adjustedDrawPercent: number
  modifier: number
}

const PLAY_SPACE_ROWS = playSpaces as PlaySpaceRow[]
const GOODIE_ROWS = goodies as GoodieRow[]
const PLAY_SPACE_CAT_ROWS = playSpaceVsCat as PlaySpaceCatRow[]
const CAT_RELATIONSHIP_ROWS = catVsCat as CatRelationshipRow[]

const CAT_NAME_LOOKUP = CatNames as Record<string, string>
const GOODIE_NAME_LOOKUP = GoodsNames as Record<string, string>

export function catName(id: number): string {
  return CAT_NAME_LOOKUP[`CatName${id}`] ?? `cat #${id}`
}

export function goodieName(id: number): string {
  return GOODIE_NAME_LOOKUP[`GoodsName${id}`] ?? `goodie #${id}`
}

function joinNames(items: readonly string[]): string {
  if (items.length <= 2) return items.join(" and ")
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`
}

function firstWeight(raw: number | number[] | undefined): number {
  if (Array.isArray(raw)) return raw[0] ?? 0
  return raw ?? 0
}

export function sampleGoodieNames(
  ids: readonly number[],
  count: number,
  seed: number,
  exclude = new Set<number>()
): string[] {
  const usable = ids.filter((id) => !exclude.has(id) && goodieName(id) !== `goodie #${id}`)
  if (usable.length === 0) return []
  const picked: string[] = []
  for (let i = 0; picked.length < count && i < usable.length * 2; i++) {
    const id = usable[(seed + i * 17) % usable.length]
    const name = goodieName(id)
    if (!picked.includes(name)) picked.push(name)
  }
  return picked
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function canCoexistWithAnotherSlot(rows: PlaySpaceRow[], row: PlaySpaceRow): boolean {
  const index = rows.findIndex((candidate) => candidate.Id === row.Id)
  if (index < 0) return false

  return rows.some((other, otherIndex) => {
    if (otherIndex === index) return false
    const rowConflicts = row.ConflictIndices ?? []
    const otherConflicts = other.ConflictIndices ?? []
    return !rowConflicts.includes(otherIndex) && !otherConflicts.includes(index)
  })
}

function maxConcurrentSlots(rows: PlaySpaceRow[]): number {
  if (rows.length === 0) return 0

  let best = 1
  const totalMasks = 1 << rows.length
  for (let mask = 1; mask < totalMasks; mask++) {
    let ok = true
    let count = 0
    for (let i = 0; i < rows.length && ok; i++) {
      if ((mask & (1 << i)) === 0) continue
      count++
      const conflicts = rows[i]?.ConflictIndices ?? []
      for (let j = i + 1; j < rows.length; j++) {
        if ((mask & (1 << j)) === 0) continue
        if (conflicts.includes(j) || (rows[j]?.ConflictIndices ?? []).includes(i)) {
          ok = false
          break
        }
      }
    }
    if (ok) best = Math.max(best, count)
  }
  return best
}

function buildRelationshipExamples(): RelationshipExample[] {
  const playSpaceById = new Map(PLAY_SPACE_ROWS.map((playSpace) => [playSpace.Id, playSpace]))
  const goodieById = new Map(GOODIE_ROWS.map((goodie) => [goodie.Id, goodie]))
  const relationshipByCat = new Map(
    CAT_RELATIONSHIP_ROWS.map((row) => [row.Id, row.Dict ?? {}])
  )
  const playSpacesByGoodie = new Map<number, PlaySpaceRow[]>()
  for (const playSpace of PLAY_SPACE_ROWS) {
    const rows = playSpacesByGoodie.get(playSpace.ItemId) ?? []
    rows.push(playSpace)
    playSpacesByGoodie.set(playSpace.ItemId, rows)
  }

  const examples: Array<RelationshipExample & { score: number }> = []

  for (const row of PLAY_SPACE_CAT_ROWS) {
    const playSpace = playSpaceById.get(row.Id)
    const goodie = playSpace ? goodieById.get(playSpace.ItemId) : null
    const siblingSlots = playSpace ? playSpacesByGoodie.get(playSpace.ItemId) ?? [] : []
    const slotCount = maxConcurrentSlots(siblingSlots)
    if (
      !playSpace ||
      !goodie ||
      goodie.Category === 1 ||
      slotCount < 2 ||
      !canCoexistWithAnotherSlot(siblingSlots, playSpace)
    ) {
      continue
    }

    const candidateWeights = Object.entries(row.Dict ?? {})
      .map(([catIdRaw, rawWeight]) => ({
        catId: Number(catIdRaw),
        weight: firstWeight(rawWeight),
      }))
      .filter((entry) => entry.weight > 0)
    const totalWeight = candidateWeights.reduce((sum, entry) => sum + entry.weight, 0)
    if (totalWeight <= 0) continue

    for (const { catId, weight } of candidateWeights) {
      const relationships = relationshipByCat.get(catId) ?? {}

      for (const [otherCatIdRaw, modifier] of Object.entries(relationships)) {
        const otherCatId = Number(otherCatIdRaw)
        if (otherCatId === catId || !modifier || modifier <= 0) continue

        const adjustedWeight = weight * (1 + modifier / 100)
        const baseDrawPercent = (weight / totalWeight) * 100
        const adjustedDrawPercent =
          (adjustedWeight / (totalWeight - weight + adjustedWeight)) * 100
        const score = adjustedDrawPercent - baseDrawPercent + modifier / 1000
        examples.push({
          catId,
          otherCatId,
          cat: catName(catId),
          otherCat: catName(otherCatId),
          goodie: goodieName(playSpace.ItemId),
          goodieId: playSpace.ItemId,
          slotCount,
          baseDrawPercent,
          adjustedDrawPercent,
          modifier,
          score,
        })
      }
    }
  }

  const fallback: RelationshipExample = {
    catId: 0,
    otherCatId: 1,
    cat: catName(0),
    otherCat: catName(1),
    goodie: goodieName(232),
    goodieId: 232,
    slotCount: 2,
    baseDrawPercent: 40,
    adjustedDrawPercent: 57,
    modifier: 50,
  }

  return examples
    .sort((a, b) => b.score - a.score)
    .filter(
      (example, index, all) =>
        index ===
        all.findIndex(
          (other) =>
            other.catId === example.catId &&
            other.otherCatId === example.otherCatId &&
            other.goodieId === example.goodieId
        )
    )
    .slice(0, 24)
    .map(({ score: _score, ...example }) => example)
    .concat(examples.length === 0 ? [fallback] : [])
}

function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let kk = k
  if (kk > n / 2) kk = n - kk
  let r = 1
  for (let i = 0; i < kk; i++) r = (r * (n - i)) / (i + 1)
  return Math.round(r)
}

export const FULL_TOY_POOL = defaultItemPools({ seasonalOnly: false })
export const N_TOY =
  FULL_TOY_POOL.largeItems.length + FULL_TOY_POOL.smallItems.length
export const N_LARGE = FULL_TOY_POOL.largeItems.length
export const N_SMALL = FULL_TOY_POOL.smallItems.length
export const C_NSMALL_3 = binomial(N_SMALL, 3)
export const C_NSMALL_5 = binomial(N_SMALL, 5)
export const ONE_LARGE_THREE_SMALL_LAYOUTS = N_LARGE * C_NSMALL_3
export const SIDE_TOY_LAYOUTS = ONE_LARGE_THREE_SMALL_LAYOUTS + C_NSMALL_5
export const TWO_SIDE_TOY_LAYOUTS_NO_DUPES =
  N_LARGE * C_NSMALL_3 * (N_LARGE - 1) * binomial(N_SMALL - 3, 3) +
  2 * N_LARGE * C_NSMALL_3 * binomial(N_SMALL - 3, 5) +
  C_NSMALL_5 * binomial(N_SMALL - 5, 5)
export const YARD_COUNT_ORDER = TWO_SIDE_TOY_LAYOUTS_NO_DUPES * 7 * 7
export const SIDE_TOY_LAYOUTS_LABEL = `≈ ${(SIDE_TOY_LAYOUTS / 1e9).toFixed(1)}B`
export const YARD_ORDER_MAG_LABEL =
  YARD_COUNT_ORDER >= 1e20
    ? `≈ ${(YARD_COUNT_ORDER / 1e20).toFixed(1)}×10²⁰`
    : `≈ ${YARD_COUNT_ORDER.toExponential(1)}`
// Brute-force time at a billion layouts/second, rounded to a friendly
// magnitude. Derived from YARD_COUNT_ORDER so it can never drift from the
// candidate-count tile that renders the same constant.
const YARD_BRUTE_FORCE_YEARS = YARD_COUNT_ORDER / 1e9 / (365.25 * 24 * 3600)
export const YARD_BRUTE_FORCE_YEARS_LABEL = (
  Math.round(YARD_BRUTE_FORCE_YEARS / 100) * 100
).toLocaleString()

export const RELATIONSHIP_EXAMPLES = buildRelationshipExamples()
export const TINY_OPTIMIZER_FOOD = goodieName(2)
export const FOOTER_DEDICATION_CATS = [24, 120, 133].map((id) => ({
  id,
  name: catName(id),
}))

export function relationshipExampleAt(index: number): RelationshipExample {
  return RELATIONSHIP_EXAMPLES[index % RELATIONSHIP_EXAMPLES.length]!
}

export function sampledGoodieListForExample(
  example: RelationshipExample,
  index: number,
  pool: readonly number[],
  count: number
): string {
  return joinNames([
    example.goodie,
    ...sampleGoodieNames(
      pool,
      count - 1,
      example.catId + example.otherCatId + index * 11,
      new Set([example.goodieId])
    ),
  ])
}

export function sampledOutdoorGoodiesForExample(
  example: RelationshipExample,
  index: number
): string {
  return joinNames(
    sampleGoodieNames(
      FULL_TOY_POOL.largeItems,
      2,
      example.otherCatId + index * 13,
      new Set([example.goodieId])
    )
  )
}

export function sampledCats(index: number, count: number): Array<{ id: number; name: string }> {
  const realCats = cats.filter((cat) => !cat.IsDebug && cat.Id < 700)
  const picked: Array<{ id: number; name: string }> = []
  for (let i = 0; picked.length < count && i < realCats.length * 2; i++) {
    const cat = realCats[(index * 7 + i * 5) % realCats.length]
    const name = cat ? catName(cat.Id) : null
    if (cat && name && !picked.some((entry) => entry.id === cat.Id)) {
      picked.push({ id: cat.Id, name })
    }
  }
  return picked
}

export function randomCats(count: number): Array<{ id: number; name: string }> {
  const pool = cats.filter((cat) => !cat.IsDebug && cat.Id < 700)
  const picked: Array<{ id: number; name: string }> = []

  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length)
    const [cat] = pool.splice(index, 1)
    if (cat) picked.push({ id: cat.Id, name: catName(cat.Id) })
  }

  return picked
}
