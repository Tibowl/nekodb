import { YARD_TOTAL_KEY } from "./constants"
import { isFoodItemId } from "../visitRules"

/**
 * Mirrors `CustomGrouping` in `groups.py` (only `custom` mode is used for the yard optimizer).
 */
export class CustomGrouping {
  playspaceToItemId: Record<number, number>
  itemsOfInterestIndoors: number[]
  itemsOfInterestOutdoors: number[]
  playspaceToGroup: Record<number, string> = {}

  constructor(
    playspaceToItemId: Record<number, number>,
    itemsOfInterestIndoors: number[],
    itemsOfInterestOutdoors: number[]
  ) {
    this.playspaceToItemId = playspaceToItemId
    this.itemsOfInterestIndoors = itemsOfInterestIndoors ?? []
    this.itemsOfInterestOutdoors = itemsOfInterestOutdoors ?? []
    this.createGroupMapping()
  }

  createGroupMapping(): void {
    const mapping: Record<number, string> = {}
    for (const idStr of Object.keys(this.playspaceToItemId)) {
      const id = Number(idStr)
      const itemId = this.playspaceToItemId[id]
      if (
        this.itemsOfInterestIndoors.includes(itemId) ||
        this.itemsOfInterestOutdoors.includes(itemId)
      ) {
        mapping[id] = YARD_TOTAL_KEY
      }
    }
    this.playspaceToGroup = mapping
  }

  getCorrespondingGroup(playspaceId: number): string | undefined {
    return this.playspaceToGroup[playspaceId]
  }

  getIsIndoors(playspaceId: number): boolean {
    const itemId = this.playspaceToItemId[playspaceId]!
    const isIndoor = this.itemsOfInterestIndoors.includes(itemId)
    if (!isIndoor) return false
    if (isFoodItemId(itemId) && this.itemsOfInterestOutdoors.includes(itemId)) {
      return false
    }
    return true
  }

  /** Mirrors `transform_to_item_group` in `groups.py`. */
  transformToItemGroup(
    sameCatInteractionTermCalcSpace: Record<
      string,
      Record<number, [number, number, number][]>
    >
  ): Record<string, Record<number, [number, number, number][]>> {
    const out: Record<string, Record<number, [number, number, number][]>> = {}
    const keys = Object.keys(sameCatInteractionTermCalcSpace)
    if (keys.length !== 1) {
      throw new Error("Expected single group for transform")
    }
    const catDict = sameCatInteractionTermCalcSpace[keys[0]!]!
    for (const catIdStr of Object.keys(catDict)) {
      const catId = Number(catIdStr)
      const catData = catDict[catId]!
      for (const record of catData) {
        const playspaceId = record[2]
        const itemId = this.playspaceToItemId[playspaceId]!
        const itemKey = String(itemId)
        if (!out[itemKey]) out[itemKey] = {}
        if (!out[itemKey]![catId]) out[itemKey]![catId] = []
        out[itemKey]![catId]!.push([record[0], record[1], playspaceId])
      }
    }
    return out
  }

  applyGroupValues(
    groupExpectedValuesItems: Record<string | number, number>,
    groupExpectedValuesOverall: Record<string | number, number>,
    items: Record<string | number, number>
  ): void {
    for (const [groupId, value] of Object.entries(groupExpectedValuesItems)) {
      const k = coerceKey(groupId)
      items[k] = (items[k] ?? 0) + value
    }
    for (const [groupId, value] of Object.entries(groupExpectedValuesOverall)) {
      const k = coerceKey(groupId)
      items[k] = (items[k] ?? 0) + value
    }
  }
}

function coerceKey(groupId: string): string | number {
  if (groupId === YARD_TOTAL_KEY) return groupId
  const n = Number(groupId)
  return Number.isFinite(n) && String(n) === groupId ? n : groupId
}
