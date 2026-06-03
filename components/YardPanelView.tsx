import type { ReactNode } from "react"
import type {
  ParsedOtherPlace,
  ParsedPlace,
  ViewConfig,
  YardAsset,
} from "../utils/yardLayout"

function viewColors(i: number) {
  return `hsl(${i * 360 / 8}, 100%, 50%)`
}

function viewFillColors(i: number) {
  return `hsla(${i * 360 / 8}, 100%, 10%, ${0.4 + 0.05 * i})`
}

function placeColor(place: ParsedPlace) {
  if (place.attributes.includes("Food")) return "yellow"
  if (place.attributes.includes("Myneko")) {
    if (place.attributes.includes("Large")) return "darkblue"
    return "gray"
  }
  if (place.attributes.includes("Large")) return "blue"
  return "red"
}

function otherPlaceColor(place: ParsedOtherPlace) {
  if (place.attributes.includes("RemodelPreviewOrigin")) return "purple"
  if (place.attributes.includes("RemodelPreviewSlot")) return "magenta"
  return "pink"
}

const nameReplacements: Record<string, string | undefined> = {
  RemodelPreviewSlot: "RPS",
  RemodelPreviewOrigin: "RPO",
}

export function YardPanelLegend() {
  return (
    <div>
      <h3 className="font-bold">Legend</h3>
      <div className="flex flex-row flex-wrap gap-4">
        {Object.entries(nameReplacements).map(([key, value], i) => (
          <div key={i} className="flex flex-row gap-2 items-center">
            <div className="font-semibold">{value ?? key}</div>
            <div className="text-right">{key}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function YardPanelSvg({
  places,
  otherPlaces = [],
  view,
  prefab,
  pixelsToUnits,
  nodes,
  assets = [],
  showLayers = true,
  showPoints = true,
  showText = true,
  children,
  className = "w-full h-full",
}: {
  places: ParsedPlace[]
  otherPlaces?: ParsedOtherPlace[]
  view: ViewConfig[]
  prefab?: any
  pixelsToUnits?: Record<string, number>
  nodes?: number[]
  assets?: YardAsset[]
  showLayers?: boolean
  showPoints?: boolean
  showText?: boolean
  children?: ReactNode
  className?: string
}) {
  const largestView = view.reduce((prev, current) =>
    prev.width * prev.height > current.width * current.height ? prev : current
  )
  const hasExpansion = places.some((place) => place.attributes.includes("Expanded"))

  return (
    <svg
      viewBox={`${largestView.x} ${largestView.y} ${largestView.width} ${largestView.height}`}
      className={className}
    >
      {prefab && pixelsToUnits && nodes ? (
        <YardPrefab
          prefab={prefab}
          pixelsToUnits={pixelsToUnits}
          nodes={nodes}
          assets={assets}
        />
      ) : null}
      {showLayers
        ? view.map((area, i) => (
            <g key={i}>
              <rect
                x={area.x}
                y={area.y}
                width={area.width}
                height={area.height}
                visibility={!hasExpansion && i == 2 ? "hidden" : "visible"}
                vectorEffect="non-scaling-stroke"
                fill={viewFillColors(view.length - 1 - i)}
                stroke={viewColors(view.length - 1 - i)}
                strokeWidth="5"
              />
            </g>
          ))
        : null}
      {children}
      {showPoints
        ? otherPlaces.map((place, i) => (
            <YardOtherPlace
              key={i}
              place={place}
              places={places}
              showText={showText}
            />
          ))
        : null}
      {showPoints ? <YardPlaces places={places} showText={showText} /> : null}
    </svg>
  )
}

export function YardPlaces({
  places,
  showText,
}: {
  places: ParsedPlace[]
  showText: boolean
}) {
  return (
    <g>
      {places.map((place, i) => (
        <YardPlaceLines key={i} place={place} places={places} />
      ))}
      {places.map((place, i) => (
        <YardPlace key={i} place={place} showText={showText} />
      ))}
    </g>
  )
}

function YardPlaceLines({
  place,
  places,
}: {
  place: ParsedPlace
  places: ParsedPlace[]
}) {
  const foodPlace = places.find((candidate) => candidate.id == place.foodPlaceId)
  const cleanupPlaces = places.filter((candidate) =>
    place.cleanupPlaceIds.includes(candidate.id)
  )

  return (
    <g>
      {foodPlace ? (
        <path
          d={`M ${place.position.x} ${-place.position.y} L ${foodPlace.position.x} ${-foodPlace.position.y}`}
          vectorEffect="non-scaling-stroke"
          stroke="yellow"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : null}
      {cleanupPlaces.map((cleanupPlace, i) => (
        <path
          key={i}
          d={`M ${place.position.x} ${-place.position.y} L ${cleanupPlace.position.x} ${-cleanupPlace.position.y}`}
          vectorEffect="non-scaling-stroke"
          stroke="blue"
          strokeWidth="1"
          strokeLinecap="round"
        />
      ))}
    </g>
  )
}

function YardPlace({ place, showText }: { place: ParsedPlace; showText: boolean }) {
  return (
    <g>
      <path
        d={`M ${place.position.x} ${-place.position.y} l 0.0001 0`}
        vectorEffect="non-scaling-stroke"
        stroke={placeColor(place)}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {showText ? (
        <text
          x={place.position.x}
          y={-place.position.y + 0.75}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="white"
          fontSize="0.5px"
        >
          {mappedAttributes(place.attributes)}
        </text>
      ) : null}
    </g>
  )
}

function YardOtherPlace({
  place,
  places,
  showText,
}: {
  place: ParsedOtherPlace
  places: ParsedPlace[]
  showText: boolean
}) {
  if (place.attributes.includes("MynekoGoodsPos")) {
    const target = places.find((candidate) => candidate.id == place.state)
    if (target) {
      return (
        <path
          d={`M ${place.position.x} ${-place.position.y} L ${target.position.x} ${-target.position.y}`}
          vectorEffect="non-scaling-stroke"
          stroke="gray"
          strokeWidth="1"
          strokeLinecap="round"
        />
      )
    }
  }
  return (
    <g>
      <path
        d={`M ${place.position.x} ${-place.position.y} l 0.0001 0`}
        vectorEffect="non-scaling-stroke"
        stroke={otherPlaceColor(place)}
        strokeWidth="10"
        strokeLinecap="round"
      />
      {showText ? (
        <text
          x={place.position.x}
          y={-place.position.y + 0.75}
          textAnchor="middle"
          alignmentBaseline="middle"
          fill="white"
          fontSize="0.5px"
        >
          {mappedAttributes(place.attributes)}: {place.state}
        </text>
      ) : null}
    </g>
  )
}

function YardPrefab({
  prefab,
  pixelsToUnits,
  nodes,
  assets,
}: {
  prefab: any
  pixelsToUnits: Record<string, number>
  nodes: number[]
  assets: YardAsset[]
}) {
  return (
    <g>
      {nodes
        .sort((a, b) => {
          const aDepth = prefab[a]?.translation?.[2] ?? 0
          const bDepth = prefab[b]?.translation?.[2] ?? 0
          return bDepth - aDepth
        })
        .map((node) => {
          const prefabNode = prefab[node]
          const children = prefabNode.children
          const asset = assets.find(
            (candidate) => cleanAssetName(candidate.name) === cleanAssetName(prefabNode.name)
          )
          if (!asset) {
            if (!children) {
              console.log(`Asset not found for node ${node}: ${prefabNode.name}`)
              return null
            }

            return (
              <g key={node}>
                <YardPrefab
                  prefab={prefab}
                  pixelsToUnits={pixelsToUnits}
                  nodes={children}
                  assets={assets}
                />
              </g>
            )
          }
          const position = prefabNode.translation ?? [0, 0, 0]
          const scale = prefabNode.scale ?? [1, 1, 1]
          const rotation = prefabNode.rotation ?? [0, 0, 0]
          const width = asset.width * scale[0] / pixelsToUnits[asset.name]
          const height = asset.height * scale[1] / pixelsToUnits[asset.name]
          const x = position[0] + width / 2
          const y = position[1] + height / 2
          return (
            <g key={node}>
              <image
                href={asset.url}
                x={-x}
                y={-y}
                width={width}
                height={height}
                transform={`rotate(${rotation[2]})`}
              />
            </g>
          )
        })}
    </g>
  )
}

function cleanAssetName(name: string) {
  return name
    .replace(/(_c\d)_\d([a-z])?/, "$1")
    .replace(/_front$/, "")
    .replace(/^okimono\d+$/i, "okimono")
    .toLowerCase()
}

function mappedAttributes(attributes: string[]) {
  return attributes.map((attribute) => nameReplacements[attribute] ?? attribute).join(", ")
}
