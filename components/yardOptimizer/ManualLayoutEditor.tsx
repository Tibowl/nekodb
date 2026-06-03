import type { Dispatch, SetStateAction } from "react"
import { PLACES_INDOOR, PLACES_OUTDOOR } from "../../utils/yardOptimizer/config"
import type { ItemPools } from "../../utils/yardOptimizer/yardCore"
import type {
  ManualYardDraft,
  YardDraftPinFlags,
} from "../../utils/yardOptimizer/layoutDrafts"
import { useLanguage } from "../../hooks/useLanguage"
import { translate as translateTable } from "../../utils/localization/translate"
import { ConfigFold, SmallGoodieSlotSelect } from "./primitives"

export type ManualLayoutEditorRunMeta = {
  pinIndoor: boolean
  pinOutdoor: boolean
  allowedFoodsIndoor: number[]
  allowedFoodsOutdoor: number[]
}

export type ManualLayoutEditorProps = {
  manualDraft: ManualYardDraft | null
  setManualDraft: Dispatch<SetStateAction<ManualYardDraft | null>>
  layoutManualNote: string | null
  editPinFlags: YardDraftPinFlags
  indoorTitle: string
  outdoorTitle: string
  needEditIndoorSmall: number
  needEditOutdoorSmall: number
  pools: ItemPools
  runMeta: ManualLayoutEditorRunMeta | null
  running: boolean
  hasContinuation: boolean
  foodDisplayName: (foodTypeId: number) => string
  applyManualLayout: () => void
}

export function ManualLayoutEditor({
  manualDraft,
  setManualDraft,
  layoutManualNote,
  editPinFlags,
  indoorTitle,
  outdoorTitle,
  needEditIndoorSmall,
  needEditOutdoorSmall,
  pools,
  runMeta,
  running,
  hasContinuation,
  foodDisplayName,
  applyManualLayout,
}: ManualLayoutEditorProps) {
  const { translate } = useLanguage()

  return (
          <ConfigFold
            title="Edit layout manually"
            description={
              <>
                Bowls and goodies must satisfy play space counts (each large goodie uses two play spaces per side),
                unique goodies across the yard, and your required/forbidden rules.{" "}
                  <strong>Apply layout changes</strong> recalculates the preview score below.
                  With <strong>Continue</strong> available, the search will try more layouts starting
                  from your edited layout.
              </>
            }
          >
            {manualDraft ? (
              <div className="space-y-4 max-w-4xl">
                {layoutManualNote ? (
                  <p className="text-sm text-amber-800 dark:text-amber-200">{layoutManualNote}</p>
                ) : null}
                {!editPinFlags.pinIndoor ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-slate-50/60 dark:bg-slate-900/30">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {indoorTitle}
                    </h4>
                    <label className="flex flex-col gap-1 max-w-xs">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Indoor food
                      </span>
                      <select
                        className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        value={manualDraft.foodIndoor}
                        disabled={running}
                        onChange={(e) =>
                          setManualDraft((d) =>
                            d ? { ...d, foodIndoor: Number(e.target.value) } : d
                          )
                        }
                      >
                        {(runMeta?.allowedFoodsIndoor ?? pools.allowedFoodsIndoor).map(
                          (id) => (
                            <option key={id} value={id}>
                              #{id} · {foodDisplayName(id)}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 max-w-xs">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Indoor large goodie (optional)
                      </span>
                      <select
                        className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        value={manualDraft.indoorLarge ?? ""}
                        disabled={running}
                        onChange={(e) => {
                          const v =
                            e.target.value === "" ? null : Number(e.target.value)
                          const need = PLACES_INDOOR - (v != null ? 2 : 0)
                          setManualDraft((d) => {
                            if (!d) return d
                            let small = [...d.indoorSmall]
                            if (small.length > need) small = small.slice(0, need)
                            while (small.length < need) {
                              const pick = pools.smallItems.find(
                                (id) => !small.includes(id)
                              )
                              small.push(pick ?? pools.smallItems[0]!)
                            }
                            return { ...d, indoorLarge: v, indoorSmall: small }
                          })
                        }}
                      >
                        <option value="">
                          None: {PLACES_INDOOR} small-only play spaces
                        </option>
                        {pools.largeItems.map((id) => (
                          <option key={id} value={id}>
                            #{id}{" "}
                            {translate(translateTable("Goods", `GoodsName${id}`))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Indoor small goodies ({needEditIndoorSmall} picks)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: needEditIndoorSmall }).map((_, idx) => (
                          <SmallGoodieSlotSelect
                            key={`ins-${idx}`}
                            disabled={running}
                            poolIds={pools.smallItems}
                            value={
                              manualDraft.indoorSmall[idx] ?? pools.smallItems[0]!
                            }
                            onChange={(nextId) =>
                              setManualDraft((d) => {
                                if (!d) return d
                                const small = [...d.indoorSmall]
                                while (small.length < needEditIndoorSmall) {
                                  small.push(pools.smallItems[0]!)
                                }
                                small[idx] = nextId
                                return { ...d, indoorSmall: small }
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {!editPinFlags.pinOutdoor ? (
                  <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-600 p-3 bg-slate-50/60 dark:bg-slate-900/30">
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {outdoorTitle}
                    </h4>
                    <label className="flex flex-col gap-1 max-w-xs">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Outdoor food
                      </span>
                      <select
                        className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        value={manualDraft.foodOutdoor}
                        disabled={running}
                        onChange={(e) =>
                          setManualDraft((d) =>
                            d ? { ...d, foodOutdoor: Number(e.target.value) } : d
                          )
                        }
                      >
                        {(runMeta?.allowedFoodsOutdoor ?? pools.allowedFoodsOutdoor).map(
                          (id) => (
                            <option key={id} value={id}>
                              #{id} · {foodDisplayName(id)}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 max-w-xs">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Outdoor large goodie (optional)
                      </span>
                      <select
                        className="border rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-800"
                        value={manualDraft.outdoorLarge ?? ""}
                        disabled={running}
                        onChange={(e) => {
                          const v =
                            e.target.value === "" ? null : Number(e.target.value)
                          const need = PLACES_OUTDOOR - (v != null ? 2 : 0)
                          setManualDraft((d) => {
                            if (!d) return d
                            let small = [...d.outdoorSmall]
                            if (small.length > need) small = small.slice(0, need)
                            while (small.length < need) {
                              const pick = pools.smallItems.find(
                                (id) => !small.includes(id)
                              )
                              small.push(pick ?? pools.smallItems[0]!)
                            }
                            return { ...d, outdoorLarge: v, outdoorSmall: small }
                          })
                        }}
                      >
                        <option value="">
                          None: {PLACES_OUTDOOR} small-only play spaces
                        </option>
                        {pools.largeItems.map((id) => (
                          <option key={id} value={id}>
                            #{id}{" "}
                            {translate(translateTable("Goods", `GoodsName${id}`))}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        Outdoor small goodies ({needEditOutdoorSmall} picks)
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: needEditOutdoorSmall }).map((_, idx) => (
                          <SmallGoodieSlotSelect
                            key={`outs-${idx}`}
                            disabled={running}
                            poolIds={pools.smallItems}
                            value={
                              manualDraft.outdoorSmall[idx] ??
                              pools.smallItems[0]!
                            }
                            onChange={(nextId) =>
                              setManualDraft((d) => {
                                if (!d) return d
                                const small = [...d.outdoorSmall]
                                while (small.length < needEditOutdoorSmall) {
                                  small.push(pools.smallItems[0]!)
                                }
                                small[idx] = nextId
                                return { ...d, outdoorSmall: small }
                              })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    type="button"
                    disabled={running}
                    onClick={(e) => {
                      e.currentTarget.blur()
                      applyManualLayout()
                    }}
                    className="text-sm px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white dark:bg-slate-600 dark:hover:bg-slate-500 font-medium"
                  >
                    Apply layout changes
                  </button>
                  {hasContinuation ? (
                    <span className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
                      <strong>Continue</strong> merges the edited layout into the genetic
                      algorithm pool first (after validation), then runs more generations.
                    </span>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Layout draft loads after each optimizer result.
              </p>
            )}
          </ConfigFold>
  )
}
