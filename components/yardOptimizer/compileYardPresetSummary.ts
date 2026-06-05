import type { ItemPools } from "../../utils/yardOptimizer/types"
import {
  type FixedIndoorDraft,
  type FixedOutdoorDraft,
  type SlotDraftValue,
  type YardDraftPinFlags,
  type YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import { searchChangesLabel } from "./optimizerRunSnapshot"

export type YardPresetSummaryLabels = {
  openFoodLabel: string
  closedFoodLabel: string
  openLargeLabel: string
  closedLargeLabel: string
  openSmallLabel: string
  closedSmallLabel: string
}

export type CompileYardPresetSummaryInput = {
  yardPreset: YardPreset
  draftPinFlags: YardDraftPinFlags
  fixedIndoorDraft: FixedIndoorDraft
  fixedOutdoorDraft: FixedOutdoorDraft
  fixedIndoorSmallSlotCount: number
  fixedOutdoorSmallSlotCount: number
  selectedFoodsIndoor: readonly number[]
  selectedFoodsOutdoor: readonly number[]
  pools: ItemPools
  fixedLocationFoodTypes: readonly number[]
  fixedLocationGoodieIds: readonly number[]
  fixedIndoorGoodieIds: readonly number[]
  fixedOutdoorGoodieIds: readonly number[]
  requiredGoodieIds: readonly number[]
  forbiddenGoodieIds: readonly number[]
  seasonalPoolOnly: boolean
  offSeasonSeasonalCount: number
  labels: YardPresetSummaryLabels
  foodDisplayName: (foodTypeId: number) => string
  goodieDisplayName: (goodieId: number) => string
}

export type CompiledYardPresetSummary = {
  presetLabel: string
  optimizerChanges: string
  locationSummary: string
  fixedLocations: string
  optimizerChoices: string
  pool: {
    foodsIndoor: string
    foodsOutdoor: string
    largeCount: number
    smallCount: number
    required: string
    requiredIndoor: string
    requiredOutdoor: string
    forbidden: string
    seasonal: string
  }
  indoor: {
    food: string
    large: string
    small: string
  }
  outdoor: {
    food: string
    large: string
    small: string
  }
}

export function compileYardPresetSummary(
  input: CompileYardPresetSummaryInput
): CompiledYardPresetSummary {
  const {
    yardPreset,
    draftPinFlags,
    fixedIndoorDraft,
    fixedOutdoorDraft,
    fixedIndoorSmallSlotCount,
    fixedOutdoorSmallSlotCount,
    selectedFoodsIndoor,
    selectedFoodsOutdoor,
    pools,
    fixedLocationFoodTypes,
    fixedLocationGoodieIds,
    fixedIndoorGoodieIds,
    fixedOutdoorGoodieIds,
    requiredGoodieIds,
    forbiddenGoodieIds,
    seasonalPoolOnly,
    offSeasonSeasonalCount,
    labels,
    foodDisplayName,
    goodieDisplayName,
  } = input
  const { pinIndoor, pinOutdoor } = draftPinFlags

  const presetLabel =
    yardPreset === "full"
      ? "Both yards"
      : yardPreset === "outdoor_only"
        ? "Outdoor only"
        : "Custom"
  const optimizerChanges = searchChangesLabel(pinIndoor, pinOutdoor)

  const foodLabel = (foodId: SlotDraftValue) =>
    foodId === "open"
      ? labels.openFoodLabel
      : foodId == null
        ? labels.closedFoodLabel
        : foodDisplayName(foodId)

  const goodieLabel = (
    goodieId: SlotDraftValue,
    openLabel: string,
    closedLabel: string
  ) =>
    goodieId === "open"
      ? openLabel
      : goodieId == null
        ? closedLabel
        : goodieDisplayName(goodieId)

  const namedGoodieList = (ids: readonly number[]) =>
    ids.length > 0
      ? ids.map((id) => `${goodieDisplayName(id)} (#${id})`).join(", ")
      : "none"

  const namedFoodList = (ids: readonly number[]) =>
    ids.length > 0
      ? ids.map((id) => `${foodDisplayName(id)} (${id})`).join(", ")
      : "none"

  const smallSlots = (
    slots: readonly SlotDraftValue[],
    count: number,
    openLabel: string,
    closedLabel: string
  ) =>
    Array.from({ length: count })
      .map((_, idx) => goodieLabel(slots[idx] ?? null, openLabel, closedLabel))
      .join(", ")

  return {
    presetLabel,
    optimizerChanges,
    locationSummary:
      yardPreset === "full"
        ? "Indoor and outdoor can both change."
        : yardPreset === "outdoor_only"
          ? "Indoor is closed; outdoor can change."
          : "Custom play space pins and open play spaces from your layout editor.",
    fixedLocations:
      fixedLocationFoodTypes.length > 0 || fixedLocationGoodieIds.length > 0
        ? `Fixed food: ${namedFoodList(fixedLocationFoodTypes)}. Fixed goodies: ${namedGoodieList(
            fixedLocationGoodieIds
          )}.`
        : "Fixed food: none. Fixed goodies: none.",
    optimizerChoices:
      pinIndoor && !pinOutdoor
        ? "Optimizer chooses the outdoor food and outdoor goodie play spaces."
        : !pinIndoor && pinOutdoor
          ? "Optimizer chooses the indoor food and indoor goodie play spaces."
          : pinIndoor && pinOutdoor
            ? "Both halves are held fixed for this layout."
            : "Optimizer chooses indoor and outdoor food and goodie play spaces.",
    pool: {
      foodsIndoor: namedFoodList(selectedFoodsIndoor),
      foodsOutdoor: namedFoodList(selectedFoodsOutdoor),
      largeCount: pools.largeItems.length,
      smallCount: pools.smallItems.length,
      required: namedGoodieList(requiredGoodieIds),
      requiredIndoor: namedGoodieList(fixedIndoorGoodieIds),
      requiredOutdoor: namedGoodieList(fixedOutdoorGoodieIds),
      forbidden: namedGoodieList(forbiddenGoodieIds),
      seasonal: seasonalPoolOnly
        ? `excluding ${offSeasonSeasonalCount} off-season seasonal shop goodies`
        : "all shop goodies allowed",
    },
    indoor: {
      food: foodLabel(fixedIndoorDraft.foodIndoor),
      large: goodieLabel(
        fixedIndoorDraft.indoorLarge,
        labels.openLargeLabel,
        labels.closedLargeLabel
      ),
      small: smallSlots(
        fixedIndoorDraft.indoorSmallSlots,
        fixedIndoorSmallSlotCount,
        labels.openSmallLabel,
        labels.closedSmallLabel
      ),
    },
    outdoor: {
      food: foodLabel(fixedOutdoorDraft.foodOutdoor),
      large: goodieLabel(
        fixedOutdoorDraft.outdoorLarge,
        labels.openLargeLabel,
        labels.closedLargeLabel
      ),
      small: smallSlots(
        fixedOutdoorDraft.outdoorSmallSlots,
        fixedOutdoorSmallSlotCount,
        labels.openSmallLabel,
        labels.closedSmallLabel
      ),
    },
  }
}
