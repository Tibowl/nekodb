import { useEffect, useMemo, useState } from "react"
import YardRecordTable from "../../NekoAtsume2Data/tables/YardRecordTable.json"
import { goodieAnimationPaths } from "../../utils/animation/goodieAnimationPaths"
import { goodieAssetSuffix } from "../../utils/goodie/getSuffixes"
import {
  foodIconImageMeta,
  goodieIconImageMeta,
} from "../../utils/yardOptimizer/clientAssets"
import type { YardState } from "../../utils/yardOptimizer/types"
import { YardPanelSvg } from "../YardPanelView"
import {
  loadYardLayout,
  type ParsedPlace,
  type ViewConfig,
  type YardAsset,
  type YardLayout,
} from "../../utils/yardLayout"
import { GOODIE_RECORD_BY_ID } from "./goodieShopData"

export const YARD_PREVIEW_OPTIONS = YardRecordTable
  .filter((yard, index, self) => self.findLastIndex((candidate) => candidate.Id === yard.Id) === index)
  .map((yard) => yard.Id)
  .sort((a, b) => a - b)

function yardIdPrefix(yardId: number) {
  return yardId.toString().padStart(3, "0")
}

function yardPreviewViewAreas(view: ViewConfig[], places: ParsedPlace[]): ViewConfig[] {
  const normalPlaces = places.filter((place) => !place.attributes.includes("Myneko"))
  if (normalPlaces.length === 0) return view
  const containsNormalYard = (area: ViewConfig) =>
    normalPlaces.every((place) => {
      const x = place.position.x
      const y = place.position.y
      return (
        x >= area.x &&
        x <= area.x + area.width &&
        y >= area.y &&
        y <= area.y + area.height
      )
    })
  return [...view]
    .filter(containsNormalYard)
    .sort((a, b) => a.width * a.height - b.width * b.height)
    .slice(0, 1)
}

async function loadYardPreviewConfig(yardId: number): Promise<YardLayout> {
  const config = await loadYardLayout(yardIdPrefix(yardId), {
    defaultVisibleAssetsOnly: true,
  })
  return {
    ...config,
    view: yardPreviewViewAreas(config.view, config.places),
  }
}

function loadYardAssetSize(asset: YardAsset): Promise<YardAsset> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({ ...asset, width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => resolve(asset)
    image.src = asset.url
  })
}

type YardPlacement = {
  key: string
  id: number
  place: ParsedPlace
  kind: "food" | "large" | "small"
  label: string
}

type AnimationModule = {
  x: number
  y: number
  w: number
  h: number
}

type AnimationSprite = {
  moduleId: string
  m00: number
  m10: number
  m01: number
  m11: number
  m02: number
  m12: number
}

type AnimationRender = {
  image: string
  imageWidth: number
  imageHeight: number
  modules: AnimationModule[]
  layers: AnimationSprite[][]
}

function goodieAnimationAssetPaths(
  goodieId: number,
  itemDamageState: 0 | 1 | 2
): { image: string; xml: string } | null {
  const goodie = GOODIE_RECORD_BY_ID.get(goodieId)
  const img = goodie?.AnimePngs?.[0]
  const xml = goodie?.AnimeXmls?.[0]
  if (!img || !xml) return null
  const suffix = goodieAssetSuffix(goodie, itemDamageState)
  return goodieAnimationPaths(img, xml, suffix)
}

function goodieDefaultActionIds(goodieId: number): number[] {
  const goodie = GOODIE_RECORD_BY_ID.get(goodieId)
  const backAction = goodie?.BackActionIds?.[0]
  const frontAction = goodie?.FrontActionIds?.[0]
  return [
    backAction != null && backAction >= 0 ? backAction : 0,
    frontAction != null && frontAction >= 0 ? frontAction : 1,
  ]
}

function animationRenderFromXml(
  goodieId: number,
  xmlText: string,
  image: string,
  imageWidth: number,
  imageHeight: number
): AnimationRender | null {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml")
  const modules: AnimationModule[] = []
  for (const node of Array.from(doc.querySelectorAll("Modules Module"))) {
    modules.push({
      x: Number(node.getAttribute("x") ?? 0),
      y: Number(node.getAttribute("y") ?? 0),
      w: Number(node.getAttribute("w") ?? 0),
      h: Number(node.getAttribute("h") ?? 0),
    })
  }

  const frames = Array.from(doc.querySelectorAll("Frames Frame"))
  const actions = Array.from(doc.querySelectorAll("Actions Action"))
  const readSprites = (frame: Element | null): AnimationSprite[] =>
    frame
      ? Array.from(frame.querySelectorAll("Sprite")).map((sprite): AnimationSprite => ({
        moduleId: sprite.getAttribute("module_id") ?? "",
        m00: Number(sprite.getAttribute("m00") ?? 1),
        m10: Number(sprite.getAttribute("m10") ?? 0),
        m01: Number(sprite.getAttribute("m01") ?? 0),
        m11: Number(sprite.getAttribute("m11") ?? 1),
        m02: Number(sprite.getAttribute("m02") ?? 0),
        m12: Number(sprite.getAttribute("m12") ?? 0),
      }))
      : []
  const layers = goodieDefaultActionIds(goodieId)
    .map((actionId) => {
      const action = actions[actionId] ?? null
      const frameId =
        action?.querySelector("Sequence")?.getAttribute("id") ??
        frames[0]?.getAttribute("id") ??
        "0"
      const frame =
        frames.find((node, index) =>
          node.getAttribute("id") != null
            ? node.getAttribute("id") === frameId
            : String(index) === frameId
        ) ?? frames[Number(frameId)] ?? frames[0] ?? null
      return readSprites(frame)
    })
    .filter((sprites) => sprites.length > 0)

  if (layers.length === 0) return null

  return {
    image,
    imageWidth,
    imageHeight,
    modules,
    layers,
  }
}

function loadAnimationImageSize(image: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = reject
    img.src = image
  })
}

function animationModuleSourceRect(
  module: AnimationModule,
  render: AnimationRender
): { x: number; y: number; w: number; h: number } {
  const usesMostImage =
    module.w >= render.imageWidth * 0.8 || module.h >= render.imageHeight * 0.8
  return {
    x: usesMostImage && module.x + module.w > render.imageWidth ? 0 : module.x,
    y: usesMostImage && module.y + module.h > render.imageHeight ? 0 : module.y,
    w: module.w,
    h: module.h,
  }
}

function copyYardSidePlaces(
  places: ParsedPlace[],
  side: "indoor" | "outdoor",
  kind: "food" | "large" | "small"
): ParsedPlace[] {
  return places.filter((place) => {
    const indoor = place.attributes.includes("Indoor")
    const myneko = place.attributes.includes("Myneko")
    const large = place.attributes.includes("Large")
    const food = place.attributes.includes("Food")
    if (myneko) return false
    const sideMatches = side === "indoor" ? indoor : !indoor
    if (!sideMatches) return false
    if (kind === "food") return food
    if (food) return false
    if (kind === "large") return large
    return !large
  })
}

function copyYardPlacements(yard: YardState, places: ParsedPlace[]): YardPlacement[] {
  const indoorFood = copyYardSidePlaces(places, "indoor", "food")
  const outdoorFood = copyYardSidePlaces(places, "outdoor", "food")
  const indoorLarge = copyYardSidePlaces(places, "indoor", "large")
  const outdoorLarge = copyYardSidePlaces(places, "outdoor", "large")
  const indoorLargePlace = yard.indoorLarge.size > 0 ? indoorLarge[0] : undefined
  const outdoorLargePlace = yard.outdoorLarge.size > 0 ? outdoorLarge[0] : undefined
  const indoorBlocked = new Set(indoorLargePlace?.cleanupPlaceIds ?? [])
  const outdoorBlocked = new Set(outdoorLargePlace?.cleanupPlaceIds ?? [])
  const indoorSmall = copyYardSidePlaces(places, "indoor", "small")
    .filter((place) => !indoorBlocked.has(place.id))
  const outdoorSmall = copyYardSidePlaces(places, "outdoor", "small")
    .filter((place) => !outdoorBlocked.has(place.id))

  const out: YardPlacement[] = []
  const add = (
    id: number,
    place: ParsedPlace | undefined,
    kind: YardPlacement["kind"],
    label: string
  ) => {
    if (!place) return
    out.push({ key: `${label}-${id}-${place.id}`, id, place, kind, label })
  }

  add(yard.foodTypeIndoor, indoorFood[0], "food", "Indoor food")
  add(yard.foodTypeOutdoor, outdoorFood[0], "food", "Outdoor food")
  Array.from(yard.indoorLarge).forEach((id, index) =>
    add(id, indoorLargePlace, "large", `Indoor large ${index + 1}`)
  )
  Array.from(yard.outdoorLarge).forEach((id, index) =>
    add(id, outdoorLargePlace, "large", `Outdoor large ${index + 1}`)
  )
  Array.from(yard.indoorSmall).forEach((id, index) =>
    add(id, indoorSmall[index], "small", `Indoor small ${index + 1}`)
  )
  Array.from(yard.outdoorSmall).forEach((id, index) =>
    add(id, outdoorSmall[index], "small", `Outdoor small ${index + 1}`)
  )
  return out
}

function CopyYardPlacementSprite({
  placement,
  render,
}: {
  placement: YardPlacement
  render: AnimationRender | null
}) {
  const img =
    placement.kind === "food"
      ? foodIconImageMeta(placement.id)
      : goodieIconImageMeta(placement.id)
  const goodieRender = render
  if (!goodieRender && !img) return null

  const fallback =
    placement.kind === "food"
      ? { width: 1.35, height: 0.6 }
      : { width: 0.9, height: 0.8 }
  if (goodieRender) {
    return (
      <g transform={`translate(${placement.place.position.x} ${-placement.place.position.y}) scale(0.01)`}>
        {goodieRender.layers.map((sprites, layerIndex) => (
          <g key={layerIndex}>
            {sprites.map((sprite, index) => {
              const spriteModule = goodieRender.modules[Number(sprite.moduleId)]
              if (!spriteModule) return null
              const sourceRect = animationModuleSourceRect(spriteModule, goodieRender)
              return (
                <g
                  key={index}
                  transform={`matrix(${sprite.m00} ${sprite.m10} ${sprite.m01} ${sprite.m11} ${sprite.m02} ${sprite.m12})`}
                >
                  <svg
                    x={0}
                    y={0}
                    width={spriteModule.w}
                    height={spriteModule.h}
                    viewBox={`${sourceRect.x} ${sourceRect.y} ${sourceRect.w} ${sourceRect.h}`}
                    overflow="hidden"
                  >
                    <image
                      href={goodieRender.image}
                      x={0}
                      y={0}
                      width={goodieRender.imageWidth}
                      height={goodieRender.imageHeight}
                    />
                  </svg>
                </g>
              )
            })}
          </g>
        ))}
        <title>{placement.label}</title>
      </g>
    )
  }

  const x = placement.place.position.x - fallback.width / 2
  const y = -placement.place.position.y - fallback.height * 0.9
  return (
    <g>
      <image
        href={img!.url}
        x={x}
        y={y}
        width={fallback.width}
        height={fallback.height}
        preserveAspectRatio="xMidYMid meet"
      />
      <title>{placement.label}</title>
    </g>
  )
}

export function YardPreviewView({
  yard,
  yardId,
  itemDamageState,
}: {
  yard: YardState
  yardId: number
  itemDamageState: 0 | 1 | 2
}) {
  const [animationState, setAnimationState] = useState<{
    itemDamageState: 0 | 1 | 2
    renders: Record<number, AnimationRender>
  }>(() => ({ itemDamageState, renders: {} }))
  const [previewState, setPreviewState] = useState<{
    yardId: number
    config: YardLayout
  } | null>(null)
  const animationRenders = useMemo(
    () =>
      animationState.itemDamageState === itemDamageState
        ? animationState.renders
        : {},
    [animationState, itemDamageState]
  )
  const previewConfig =
    previewState?.yardId === yardId ? previewState.config : null
  const placements = useMemo(
    () =>
      previewConfig
        ? copyYardPlacements(yard, previewConfig.places)
            .sort((a, b) => b.place.position.y - a.place.position.y)
        : [],
    [previewConfig, yard]
  )

  useEffect(() => {
    let cancelled = false
    void loadYardPreviewConfig(yardId).then(async (config) => {
      const sizedAssets = await Promise.all(config.assets.map(loadYardAssetSize))
      if (cancelled) return
      setPreviewState({ yardId, config: { ...config, assets: sizedAssets } })
    })
    return () => {
      cancelled = true
    }
  }, [yardId])

  useEffect(() => {
    let cancelled = false
    const ids = [...new Set(
      placements
        .map((placement) => placement.id)
    )].filter(
      (id) =>
        animationRenders[id] == null &&
        goodieAnimationAssetPaths(id, itemDamageState) != null
    )
    if (ids.length === 0) return

    void Promise.all(
      ids.map(async (id) => {
        const paths = goodieAnimationAssetPaths(id, itemDamageState)
        if (!paths) return null
        try {
          const [xml, size] = await Promise.all([
            fetch(paths.xml).then((response) => response.text()),
            loadAnimationImageSize(paths.image),
          ])
          const render = animationRenderFromXml(
            id,
            xml,
            paths.image,
            size.width,
            size.height
          )
          return render ? ([id, render] as const) : null
        } catch {
          return null
        }
      })
    ).then((entries) => {
      if (cancelled) return
      const found = entries.filter((entry): entry is readonly [number, AnimationRender] =>
        entry != null
      )
      if (found.length === 0) return
      setAnimationState((prev) => ({
        itemDamageState,
        renders: {
          ...(prev.itemDamageState === itemDamageState ? prev.renders : {}),
          ...Object.fromEntries(found),
        },
      }))
    })

    return () => {
      cancelled = true
    }
  }, [animationRenders, itemDamageState, placements])

  if (!previewConfig) {
    return (
      <div className="rounded-md bg-slate-100 dark:bg-slate-900 p-6 text-sm text-slate-500 dark:text-slate-400">
        Loading yard preview...
      </div>
    )
  }

  return (
    <div className="rounded-md bg-slate-100 dark:bg-slate-900 p-2 overflow-hidden">
      <YardPanelSvg
        places={previewConfig.places}
        view={previewConfig.view}
        prefab={previewConfig.prefab.nodes}
        pixelsToUnits={previewConfig.pixelsToUnits}
        nodes={previewConfig.prefab.scenes[previewConfig.prefab.scene].nodes}
        assets={previewConfig.assets}
        showLayers={false}
        showPoints={false}
        showText={false}
        className="w-full h-auto max-h-[36rem]"
      >
        {placements.map((placement) => (
          <CopyYardPlacementSprite
            key={placement.key}
            placement={placement}
            render={animationRenders[placement.id] ?? null}
          />
        ))}
      </YardPanelSvg>
    </div>
  )
}
