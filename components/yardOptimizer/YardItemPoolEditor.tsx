import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react"
import {
  DEFAULT_ALLOWED_FOODS_INDOOR,
  DEFAULT_ALLOWED_FOODS_OUTDOOR,
} from "../../utils/yardOptimizer/config"
import {
  defaultItemPools,
  inactiveSeasonalToyIdsForMonth,
  seasonalToyIdsForMonth,
} from "../../utils/yardOptimizer/yardCore"
import { goodies } from "../../utils/yardOptimizer/gameData"
import { useLanguage } from "../../hooks/useLanguage"
import { translate as translateTable } from "../../utils/localization/translate"
import { FOOD_TYPE_IDS } from "../yardOptimizerDisplay"
import {
  FoodPickerTile,
  GoodiePickerTile,
  SettingsChoice,
} from "./primitives"
import { formatCompactList, goodieConstraintStateForId, sortGoodieIds, sortedUniqueNumbers } from "./clientHelpers"
import { GOODIE_RECORD_BY_ID } from "./goodieShopData"

const SEASON_GROUPS: { label: string; months: number[] }[] = [
  { label: "Spring", months: [3, 4, 5] },
  { label: "Summer", months: [6, 7, 8] },
  { label: "Autumn", months: [9, 10, 11] },
  { label: "Winter", months: [12, 1, 2] },
]

export type YardItemPoolEditorProps = {
  poolEditorOpen: boolean
  setPoolEditorOpen: Dispatch<SetStateAction<boolean>>
  selectedFoodsIndoor: number[]
  setSelectedFoodsIndoor: Dispatch<SetStateAction<number[]>>
  selectedFoodsOutdoor: number[]
  setSelectedFoodsOutdoor: Dispatch<SetStateAction<number[]>>
  seasonalPoolOnly: boolean
  setSeasonalPoolOnly: Dispatch<SetStateAction<boolean>>
  requiredGoodieIds: number[]
  setRequiredGoodieIds: Dispatch<SetStateAction<number[]>>
  forbiddenGoodieIds: number[]
  setForbiddenGoodieIds: Dispatch<SetStateAction<number[]>>
}

export function YardItemPoolEditor({
  poolEditorOpen,
  setPoolEditorOpen,
  selectedFoodsIndoor,
  setSelectedFoodsIndoor,
  selectedFoodsOutdoor,
  setSelectedFoodsOutdoor,
  seasonalPoolOnly,
  setSeasonalPoolOnly,
  requiredGoodieIds,
  setRequiredGoodieIds,
  forbiddenGoodieIds,
  setForbiddenGoodieIds,
}: YardItemPoolEditorProps) {
  const { translate } = useLanguage()

  const fullPoolsForPicker = useMemo(
    () => defaultItemPools({ seasonalOnly: false }),
    []
  )

  const foodDisplayName = useCallback(
    (foodTypeId: number) =>
      translate(translateTable("Goods", `GoodsName${foodTypeId}`)),
    [translate]
  )

  const goodiePickerList = useMemo(() => {
    const ids = [...new Set([...fullPoolsForPicker.largeItems, ...fullPoolsForPicker.smallItems])]
    return ids
      .map((id) => ({
        id,
        label: translate(translateTable("Goods", `GoodsName${id}`)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [fullPoolsForPicker, translate])

  const allGoodieIds = useMemo(
    () => goodiePickerList.map((goodie) => goodie.id),
    [goodiePickerList]
  )

  const {
    currentSeasonGoodiePickerList,
    offSeasonGoodiePickerList,
    stampTradeGoodiePickerList,
    otherGoodiePickerList,
  } = useMemo(() => {
    const currentSeasonalSet = new Set(seasonalToyIdsForMonth())
    const offSeasonalSet = new Set(inactiveSeasonalToyIdsForMonth())
    const stampTradeSet = new Set(
      (goodies as { Id: number; StampCard?: number }[])
        .filter((g) => (g.StampCard ?? -1) > 0)
        .map((g) => g.Id)
    )
    return {
      currentSeasonGoodiePickerList: goodiePickerList.filter((g) =>
        currentSeasonalSet.has(g.id)
      ),
      offSeasonGoodiePickerList: goodiePickerList.filter((g) =>
        offSeasonalSet.has(g.id)
      ),
      stampTradeGoodiePickerList: goodiePickerList.filter(
        (g) =>
          stampTradeSet.has(g.id) &&
          !currentSeasonalSet.has(g.id) &&
          !offSeasonalSet.has(g.id)
      ),
      otherGoodiePickerList: goodiePickerList.filter(
        (g) =>
          !currentSeasonalSet.has(g.id) &&
          !offSeasonalSet.has(g.id) &&
          !stampTradeSet.has(g.id)
      ),
    }
  }, [goodiePickerList])

  const seasonalSeasonGroups = useMemo(() => {
    const seasonalSet = new Set([
      ...seasonalToyIdsForMonth(),
      ...inactiveSeasonalToyIdsForMonth(),
    ])
    const seasonalGoodies = goodiePickerList.filter((goodie) =>
      seasonalSet.has(goodie.id)
    )
    return SEASON_GROUPS.map((season) => {
      const monthSet = new Set(season.months)
      return {
        label: season.label,
        goodies: seasonalGoodies.filter((goodie) => {
          const months = GOODIE_RECORD_BY_ID.get(goodie.id)?.SellableMonths ?? []
          return months.some((month) => monthSet.has(month))
        }),
      }
    }).filter((season) => season.goodies.length > 0)
  }, [goodiePickerList])

  const offSeasonSeasonalCount = useMemo(
    () => inactiveSeasonalToyIdsForMonth().length,
    []
  )

  // "Block all" should not re-forbid goodies the off-season setting already
  // greys out, so those stay grey instead of flipping to rose.
  const blockableGoodieIds = useMemo(() => {
    if (!seasonalPoolOnly) return allGoodieIds
    const offSeasonSet = new Set(offSeasonGoodiePickerList.map((goodie) => goodie.id))
    return allGoodieIds.filter((id) => !offSeasonSet.has(id))
  }, [allGoodieIds, offSeasonGoodiePickerList, seasonalPoolOnly])

  const isCustomized = useMemo(() => {
    const sameSet = (a: readonly number[], b: readonly number[]) =>
      a.length === b.length && a.every((value) => b.includes(value))
    return (
      requiredGoodieIds.length > 0 ||
      forbiddenGoodieIds.length > 0 ||
      !seasonalPoolOnly ||
      !sameSet(selectedFoodsIndoor, DEFAULT_ALLOWED_FOODS_INDOOR) ||
      !sameSet(selectedFoodsOutdoor, DEFAULT_ALLOWED_FOODS_OUTDOOR)
    )
  }, [
    requiredGoodieIds,
    forbiddenGoodieIds,
    seasonalPoolOnly,
    selectedFoodsIndoor,
    selectedFoodsOutdoor,
  ])

  const poolSummaryLine = useMemo(() => {
    const nIn = selectedFoodsIndoor.length
    const nOut = selectedFoodsOutdoor.length
    const req = requiredGoodieIds.length
    const forb = forbiddenGoodieIds.length
    const food = `Indoor ${nIn}/7 · outdoor ${nOut}/7 food types`
    const good =
      req === 0 && forb === 0
        ? "no goodie rules"
        : `${req} required · ${forb} forbidden`
    const toys = seasonalPoolOnly
      ? `toy pool: exclude ${offSeasonSeasonalCount} off-season seasonal shop goodies`
      : "toy pool: all shop goodies"
    return `${food}. ${good}. ${toys}.`
  }, [
    selectedFoodsIndoor,
    selectedFoodsOutdoor,
    requiredGoodieIds,
    forbiddenGoodieIds,
    seasonalPoolOnly,
    offSeasonSeasonalCount,
  ])

  const cycleGoodieConstraint = useCallback((id: number) => {
    const req = requiredGoodieIds.includes(id)
    const forb = forbiddenGoodieIds.includes(id)
    if (!req && !forb) {
      setRequiredGoodieIds((r) => sortGoodieIds([...r, id]))
    } else if (req) {
      setRequiredGoodieIds((r) => r.filter((x) => x !== id))
      setForbiddenGoodieIds((f) => sortGoodieIds([...f, id]))
    } else {
      setForbiddenGoodieIds((f) => f.filter((x) => x !== id))
    }
  }, [requiredGoodieIds, forbiddenGoodieIds, setRequiredGoodieIds, setForbiddenGoodieIds])

  const forbidGoodieGroup = useCallback((ids: readonly number[]) => {
    setRequiredGoodieIds((prev) => prev.filter((id) => !ids.includes(id)))
    setForbiddenGoodieIds((prev) => sortedUniqueNumbers([...prev, ...ids]))
  }, [setRequiredGoodieIds, setForbiddenGoodieIds])

  const allowGoodieGroup = useCallback((ids: readonly number[]) => {
    setForbiddenGoodieIds((prev) => prev.filter((id) => !ids.includes(id)))
  }, [setForbiddenGoodieIds])

  const toggleIndoorFood = useCallback((id: number) => {
    setSelectedFoodsIndoor((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return sortGoodieIds([...prev, id])
    })
  }, [setSelectedFoodsIndoor])

  const toggleOutdoorFood = useCallback((id: number) => {
    setSelectedFoodsOutdoor((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return sortGoodieIds([...prev, id])
    })
  }, [setSelectedFoodsOutdoor])

  const resetAvailableItems = useCallback(() => {
    setSelectedFoodsIndoor([...DEFAULT_ALLOWED_FOODS_INDOOR])
    setSelectedFoodsOutdoor([...DEFAULT_ALLOWED_FOODS_OUTDOOR])
    setRequiredGoodieIds([])
    setForbiddenGoodieIds([])
    setSeasonalPoolOnly(true)
  }, [
    setSelectedFoodsIndoor,
    setSelectedFoodsOutdoor,
    setRequiredGoodieIds,
    setForbiddenGoodieIds,
    setSeasonalPoolOnly,
  ])

  return (
      <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/30 p-3 space-y-3">
        <button
          type="button"
          aria-expanded={poolEditorOpen}
          onClick={() => setPoolEditorOpen((open) => !open)}
          className="-m-1 flex w-[calc(100%+0.5rem)] items-start justify-between gap-3 rounded px-1 py-1 text-left text-sm hover:bg-white/40 dark:hover:bg-slate-900/20"
        >
          <span>
            <strong>Item preferences</strong>
            <span className="block text-slate-600 dark:text-slate-400 font-normal mt-0.5">
              Food choices and goodie rules are active even when this section is closed.
            </span>
          </span>
          <span
            className={`mt-0.5 shrink-0 text-xs text-slate-400 transition-transform ${
              poolEditorOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        </button>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Current: {poolSummaryLine}
          {isCustomized ? (
            <span className="ml-1.5 rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
              customized
            </span>
          ) : null}
        </p>
        {poolEditorOpen ? (
        <div className="space-y-4 border-t border-slate-200 dark:border-slate-600 pt-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Tap food tiles to turn them on or off (at least one per side). For goodies, tap to
              cycle: available →{" "}
              <span className="text-amber-700 dark:text-amber-300">must include</span> → off.
            </p>
            <div className="flex items-center gap-2 self-start shrink-0">
              <span
                className={`text-xs ${
                  isCustomized
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-slate-400"
                }`}
              >
                {isCustomized ? "Customized (not default)" : "Default"}
              </span>
              <button
                type="button"
                onClick={resetAvailableItems}
                disabled={!isCustomized}
                className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-2 disabled:no-underline disabled:opacity-50"
              >
                Reset to default
              </button>
            </div>
          </div>
          <SettingsChoice
            boxed
            className="rounded-lg border-slate-600 dark:border-slate-600"
          >
            <input
              type="checkbox"
              className="mt-0.5 rounded border-slate-300"
              checked={seasonalPoolOnly}
              onChange={(e) => setSeasonalPoolOnly(e.target.checked)}
            />
            <span>
              <strong>Exclude off-season seasonal shop toys</strong>
              <span className="block text-slate-600 dark:text-slate-400 font-normal mt-0.5">
                Off-season seasonal goodies are blocked for this search. Turn this off to choose
                them individually (
                {offSeasonSeasonalCount > 0
                  ? `${offSeasonSeasonalCount} blocked`
                  : "none blocked"}
                ).
              </span>
            </span>
          </SettingsChoice>
          <h4 className="text-lg font-bold">Indoor bowl</h4>
          <div className="flex flex-row flex-wrap mb-2">
            {FOOD_TYPE_IDS.map((id) => (
              <FoodPickerTile
                key={`food-in-${id}`}
                id={id}
                label={foodDisplayName(id)}
                selected={selectedFoodsIndoor.includes(id)}
                onToggle={() => toggleIndoorFood(id)}
              />
            ))}
          </div>
          <h4 className="text-lg font-bold">Outdoor bowl</h4>
          <div className="flex flex-row flex-wrap mb-2">
            {FOOD_TYPE_IDS.map((id) => (
              <FoodPickerTile
                key={`food-out-${id}`}
                id={id}
                label={foodDisplayName(id)}
                selected={selectedFoodsOutdoor.includes(id)}
                onToggle={() => toggleOutdoorFood(id)}
              />
            ))}
          </div>
          <h4 className="text-lg font-bold">Goodies</h4>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-950/20 p-3 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h5 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  Block goodies you may not own yet
                </h5>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Blocked goodies are never picked. New here? <strong>Block all</strong>,
                  then allow what you own.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => forbidGoodieGroup(blockableGoodieIds)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Block all
                </button>
                <button
                  type="button"
                  onClick={() => allowGoodieGroup(allGoodieIds)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Allow all
                </button>
              </div>
            </div>
            {seasonalSeasonGroups.length > 0 ? (
              <details className="group/season-groups [&_summary::-webkit-details-marker]:hidden">
                <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Block seasonal goodies by season</span>
                  <span
                    className="text-slate-400 transition-transform group-open/season-groups:rotate-180"
                    aria-hidden
                  >
                    ▼
                  </span>
                </summary>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Started playing recently? Block the seasons you haven&rsquo;t reached yet.
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {seasonalSeasonGroups.map((group) => {
                    const ids = group.goodies.map((goodie) => goodie.id)
                    return (
                      <div
                        key={group.label}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {group.label}{" "}
                            <span className="font-normal text-slate-400">
                              ({group.goodies.length})
                            </span>
                          </span>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => forbidGoodieGroup(ids)}
                              className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Block
                            </button>
                            <button
                              type="button"
                              onClick={() => allowGoodieGroup(ids)}
                              className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                            >
                              Allow
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {formatCompactList(group.goodies.map((goodie) => goodie.label))}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </details>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">Key:</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3.5 w-3.5 rounded ring-2 ring-blue-500 bg-blue-100 dark:bg-blue-950/50" />
              available
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3.5 w-3.5 rounded ring-2 ring-amber-500 bg-amber-100 dark:bg-amber-950/50" />
              must include
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3.5 w-3.5 rounded bg-slate-300 dark:bg-slate-600 opacity-50" />
              blocked by a setting
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600 p-2 bg-white/80 dark:bg-slate-900/30 space-y-4">
            {currentSeasonGoodiePickerList.length > 0 ? (
              <div>
                <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Seasonal shop this month
                </h5>
                <div className="flex flex-row flex-wrap">
                  {currentSeasonGoodiePickerList.map(({ id, label }) => (
                    <GoodiePickerTile
                      key={id}
                      id={id}
                      label={label}
                      state={goodieConstraintStateForId(
                        id,
                        requiredGoodieIds,
                        forbiddenGoodieIds
                      )}
                      onCycle={() => cycleGoodieConstraint(id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {offSeasonGoodiePickerList.length > 0 ? (
              <div>
                <h5 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Off-season seasonal shop
                </h5>
                <div className="flex flex-row flex-wrap">
                  {offSeasonGoodiePickerList.map(({ id, label }) => (
                    <GoodiePickerTile
                      key={id}
                      id={id}
                      label={label}
                      state={goodieConstraintStateForId(
                        id,
                        requiredGoodieIds,
                        forbiddenGoodieIds
                      )}
                      blockedBySetting={seasonalPoolOnly}
                      onCycle={() => cycleGoodieConstraint(id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            {stampTradeGoodiePickerList.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Stamp trade goodies
                  </h5>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() =>
                        forbidGoodieGroup(stampTradeGoodiePickerList.map((goodie) => goodie.id))
                      }
                      className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        allowGoodieGroup(stampTradeGoodiePickerList.map((goodie) => goodie.id))
                      }
                      className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      Allow
                    </button>
                  </div>
                </div>
                <div className="flex flex-row flex-wrap">
                  {stampTradeGoodiePickerList.map(({ id, label }) => (
                    <GoodiePickerTile
                      key={id}
                      id={id}
                      label={label}
                      state={goodieConstraintStateForId(
                        id,
                        requiredGoodieIds,
                        forbiddenGoodieIds
                      )}
                      onCycle={() => cycleGoodieConstraint(id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
            <div>
              <h5 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                {currentSeasonGoodiePickerList.length > 0 ||
                offSeasonGoodiePickerList.length > 0 ||
                stampTradeGoodiePickerList.length > 0
                  ? "Regular goodies"
                  : "All goodies"}
              </h5>
              <div className="flex flex-row flex-wrap">
                {otherGoodiePickerList.map(({ id, label }) => (
                  <GoodiePickerTile
                    key={id}
                    id={id}
                    label={label}
                    state={goodieConstraintStateForId(
                      id,
                      requiredGoodieIds,
                      forbiddenGoodieIds
                    )}
                    onCycle={() => cycleGoodieConstraint(id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </div>
  )
}
