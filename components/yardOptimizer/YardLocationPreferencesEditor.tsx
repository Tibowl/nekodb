import type { Dispatch, SetStateAction } from "react"
import {
  PLACES_INDOOR,
  PLACES_OUTDOOR,
} from "../../utils/yardOptimizer/config"
import {
  isFixedSlotValue,
  type FixedIndoorDraft,
  type FixedOutdoorDraft,
  type YardPreset,
} from "../../utils/yardOptimizer/layoutDrafts"
import type { ItemPools } from "../../utils/yardOptimizer/yardCore"
import {
  OptionalFoodSlotSelect,
  OptionalGoodieSlotSelect,
  OptionalSmallGoodieSlotSelect,
  SettingsChoice,
} from "./primitives"

export type YardLocationSummarySlice = {
  locationSummary: string
  fixedLocations: string
}

export type YardLocationPreferencesEditorProps = {
  locationEditorOpen: boolean
  setLocationEditorOpen: Dispatch<SetStateAction<boolean>>
  compiledYardPreset: YardLocationSummarySlice
  yardPreset: YardPreset
  onSelectFullYard: () => void
  onSelectOutdoorOnly: () => void
  onSelectCustomLayout: () => void
  fixedIndoorDraft: FixedIndoorDraft
  setFixedIndoorDraft: Dispatch<SetStateAction<FixedIndoorDraft>>
  fixedOutdoorDraft: FixedOutdoorDraft
  setFixedOutdoorDraft: Dispatch<SetStateAction<FixedOutdoorDraft>>
  selectedFoodsIndoor: number[]
  selectedFoodsOutdoor: number[]
  pools: ItemPools
  fixedIndoorSmallSlotCount: number
  fixedOutdoorSmallSlotCount: number
  foodDisplayName: (foodTypeId: number) => string
}

export function YardLocationPreferencesEditor({
  locationEditorOpen,
  setLocationEditorOpen,
  compiledYardPreset,
  yardPreset,
  onSelectFullYard,
  onSelectOutdoorOnly,
  onSelectCustomLayout,
  fixedIndoorDraft,
  setFixedIndoorDraft,
  fixedOutdoorDraft,
  setFixedOutdoorDraft,
  selectedFoodsIndoor,
  selectedFoodsOutdoor,
  pools,
  fixedIndoorSmallSlotCount,
  fixedOutdoorSmallSlotCount,
  foodDisplayName,
}: YardLocationPreferencesEditorProps) {
  const openFoodLabel = "Open food play space"
  const closedFoodLabel = "Closed food play space"
  const openLargeLabel = "Open large play space"
  const closedLargeLabel = "Closed large play space"
  const openSmallLabel = "Open play space"
  const closedSmallLabel = "Closed play space"

  return (
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3 space-y-3">
        <button
          type="button"
          aria-expanded={locationEditorOpen}
          onClick={() => setLocationEditorOpen((open) => !open)}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-start justify-between gap-3 rounded px-1 py-1 text-left text-sm hover:bg-white/40 dark:hover:bg-slate-900/20"
        >
          <span>
            <strong>Location preferences</strong>
            <span className="block text-slate-600 dark:text-slate-400 font-normal mt-0.5">
              Open, closed, and fixed spaces are active even when this section is closed.
            </span>
          </span>
          <span
            className={`mt-0.5 shrink-0 text-xs text-slate-400 transition-transform ${
              locationEditorOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          <p>Current: {compiledYardPreset.locationSummary}</p>
          <p>{compiledYardPreset.fixedLocations}</p>
        </div>
      {locationEditorOpen ? (
      <div className="border-t border-slate-200 dark:border-slate-600 pt-3 space-y-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
            Available locations
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Choose which yard spaces the optimizer may fill.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <SettingsChoice>
            <input
              type="radio"
              name="yardPreset"
              checked={yardPreset === "full"}
              onChange={() => {
                onSelectFullYard()
              }}
              className="mt-1"
            />
            <span>
              <strong>Both yards:</strong> indoor and outdoor can both change.
            </span>
          </SettingsChoice>
          <SettingsChoice>
            <input
              type="radio"
              name="yardPreset"
              checked={yardPreset === "outdoor_only"}
              onChange={() => {
                onSelectOutdoorOnly()
              }}
              className="mt-1"
            />
            <span>
              <strong>Outdoor only:</strong> indoor play spaces stay closed; outdoor is optimized.
            </span>
          </SettingsChoice>
          <SettingsChoice>
            <input
              type="radio"
              name="yardPreset"
              checked={yardPreset === "custom"}
              onChange={() => {
                onSelectCustomLayout()
              }}
              className="mt-1"
            />
            <span>
              <strong>Custom:</strong> choose food and play spaces yourself.
            </span>
          </SettingsChoice>
        </div>
        <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3">
            <div>
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Layout play spaces
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Open means the optimizer may choose it. Closed means nothing is placed there.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Indoor layout
                </h5>
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Indoor food play space
              </span>
              <OptionalFoodSlotSelect
                value={fixedIndoorDraft.foodIndoor}
                openLabel={openFoodLabel}
                closedLabel={closedFoodLabel}
                poolIds={selectedFoodsIndoor}
                foodDisplayName={foodDisplayName}
                onChange={(nextId) =>
                  setFixedIndoorDraft((d) => ({
                    ...d,
                    foodIndoor: nextId,
                  }))
                }
              />
            </label>
            <label className="flex flex-col gap-1 max-w-xs">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Indoor large goodie
              </span>
              <OptionalGoodieSlotSelect
                value={fixedIndoorDraft.indoorLarge}
                disabled={false}
                openLabel={openLargeLabel}
                closedLabel={closedLargeLabel}
                poolIds={pools.largeItems}
                onChange={(indoorLarge) => {
                  const keepSmall = PLACES_INDOOR - (isFixedSlotValue(indoorLarge) ? 2 : 0)
                  setFixedIndoorDraft((d) => ({
                    ...d,
                    indoorLarge,
                    indoorSmallSlots: d.indoorSmallSlots
                      .slice(0, keepSmall)
                      .concat(
                        Array.from(
                          {
                            length: Math.max(
                              0,
                              keepSmall - d.indoorSmallSlots.length
                            ),
                          },
                          () => null
                        )
                      ),
                  }))
                }}
              />
            </label>
            <div className="space-y-1">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Indoor small play spaces
              </span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: fixedIndoorSmallSlotCount }).map((_, idx) => (
                  <OptionalSmallGoodieSlotSelect
                    key={`fixed-indoor-small-${idx}`}
                    disabled={false}
                    openLabel={openSmallLabel}
                    closedLabel={closedSmallLabel}
                    poolIds={pools.smallItems}
                    value={fixedIndoorDraft.indoorSmallSlots[idx] ?? null}
                    onChange={(nextId) =>
                      setFixedIndoorDraft((d) => {
                        const indoorSmallSlots = d.indoorSmallSlots.slice(
                          0,
                          fixedIndoorSmallSlotCount
                        )
                        while (indoorSmallSlots.length < fixedIndoorSmallSlotCount) {
                          indoorSmallSlots.push(null)
                        }
                        indoorSmallSlots[idx] = nextId
                        return { ...d, indoorSmallSlots }
                      })
                    }
                  />
                ))}
              </div>
            </div>
              </div>
              <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3">
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Outdoor layout
                </h5>
                <label className="flex flex-col gap-1 max-w-xs">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Outdoor food play space
                  </span>
                  <OptionalFoodSlotSelect
                    value={fixedOutdoorDraft.foodOutdoor}
                    openLabel={openFoodLabel}
                    closedLabel={closedFoodLabel}
                    poolIds={selectedFoodsOutdoor}
                    foodDisplayName={foodDisplayName}
                    onChange={(nextId) =>
                      setFixedOutdoorDraft((d) => ({
                        ...d,
                        foodOutdoor: nextId,
                      }))
                    }
                  />
                </label>
                <label className="flex flex-col gap-1 max-w-xs">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Outdoor large goodie
                  </span>
                  <OptionalGoodieSlotSelect
                    value={fixedOutdoorDraft.outdoorLarge}
                    disabled={false}
                    openLabel={openLargeLabel}
                    closedLabel={closedLargeLabel}
                    poolIds={pools.largeItems}
                    onChange={(outdoorLarge) => {
                      const keepSmall =
                        PLACES_OUTDOOR - (isFixedSlotValue(outdoorLarge) ? 2 : 0)
                      setFixedOutdoorDraft((d) => ({
                        ...d,
                        outdoorLarge,
                        outdoorSmallSlots: d.outdoorSmallSlots
                          .slice(0, keepSmall)
                          .concat(
                            Array.from(
                              {
                                length: Math.max(
                                  0,
                                  keepSmall - d.outdoorSmallSlots.length
                                ),
                              },
                              () => null
                            )
                          ),
                      }))
                    }}
                  />
                </label>
                <div className="space-y-1">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Outdoor small play spaces
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: fixedOutdoorSmallSlotCount }).map((_, idx) => (
                      <OptionalSmallGoodieSlotSelect
                        key={`fixed-outdoor-small-${idx}`}
                        disabled={false}
                        openLabel={openSmallLabel}
                        closedLabel={closedSmallLabel}
                        poolIds={pools.smallItems}
                        value={fixedOutdoorDraft.outdoorSmallSlots[idx] ?? null}
                        onChange={(nextId) =>
                          setFixedOutdoorDraft((d) => {
                            const outdoorSmallSlots = d.outdoorSmallSlots.slice(
                              0,
                              fixedOutdoorSmallSlotCount
                            )
                            while (
                              outdoorSmallSlots.length < fixedOutdoorSmallSlotCount
                            ) {
                              outdoorSmallSlots.push(null)
                            }
                            outdoorSmallSlots[idx] = nextId
                            return { ...d, outdoorSmallSlots }
                          })
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>
      ) : null}
      </div>
  )
}
