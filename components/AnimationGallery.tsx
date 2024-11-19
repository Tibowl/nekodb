import { useEffect, useMemo, useState } from "react"
import createRange from "../utils/create-range"
import AnimationViewer, { AnimationMeta } from "./AnimationViewer"
import { CheckboxInput } from "./CheckboxInput"
import FormattedLink from "./FormattedLink"
import SelectInput from "./SelectInput"

const defaultAnimations: string[] = [
  "00kihon_grooming",
  "00kihon_tsume_tate",
  "00kihon_tsume_yoko",
  "06jarashi_mushi",
  "06jarashi_the",
  "neko_walk"
]

export default function AnimationGallery({ animations }: { animations: AnimationMeta[] }) {
  if (animations.length == 0) return null
  return <>
    <h2 className="text-xl font-bold" id="animations">Animation gallery</h2>
    <AnimationGalleryInternal animations={animations} />
  </>
}

function getDefault(animations: AnimationMeta[]): AnimationMeta {
  if (animations.length == 0) throw new Error("No animations")

  const found: AnimationMeta[] = []
  for (const name of defaultAnimations) {
    const animation = animations.find(a => a.name == name)
    if (animation)
      found.push(animation)
  }

  if (found.length > 0)
    return found[Math.floor(Math.random() * found.length)]

  return animations[0]
}

function AnimationGalleryInternal({ animations }: { animations: AnimationMeta[] }) {
  const [animationName, setAnimationName] = useState("")
  const [actionIndex, setActionIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const animation = useMemo(
    () => animations.find((a) => a.name == animationName),
    [animationName, animations]
  )

  useEffect(() => {
    setActionIndex(animation?.defaultAction ?? 0)
  }, [animation])

  useEffect(() => {
    if (animation && actionIndex >= animation.actions)
      setActionIndex(animation.defaultAction)
    if (!animation && animations.length > 0) {
      const animation = getDefault(animations)
      setAnimationName(animation.name)
      setActionIndex(animation.defaultAction)
    }
  }, [animation, animationName, actionIndex, animations])

  if (showAll) {
    return (
      <>
        <CheckboxInput label="Show all" set={setShowAll} value={showAll} />
        {animations.map((animation, i) => <div key={i}>
          <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
            <div className="flex flex-row justify-between items-center gap-2">
              <div>{animation.name}</div>
              <FormattedLink href={animation.url_img} className="text-sm" target="_blank">
                View raw image
              </FormattedLink>
            </div>
            <div className="flex flex-wrap gap-2">
              {createRange(animation.actions).map(action => <div key={action} className="bg:gray-200 bg-opacity-50 dark:bg-slate-900 dark:bg-opacity-50 rounded-md p-1">
                <AnimationViewer animation={animation} actionIndex={action} showAction={true} />
              </div>)}
            </div>
          </div>
        </div>)}
      </>
    )
  }

  return (
    <>
      <CheckboxInput label="Show all" set={setShowAll} value={showAll} />
      <div className="flex flex-row justify-between items-center gap-2">
        <SelectInput label="Animation" value={animationName} set={setAnimationName} options={animations.map((a) => a.name)}/>
        {animation && (<FormattedLink href={animation.url_img} className="text-sm" target="_blank">
            View raw image
          </FormattedLink>
        )}
      </div>
      <div className="flex flex-row items-baseline gap-2">
        <SelectInput label="Action"
          value={`${actionIndex + 1}`}
          set={(x) => setActionIndex(+x - 1)}
          options={createRange(animation?.actions ?? 0).map(i => (i+1).toString())}
        />
        / {animation?.actions}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
          {animation && <AnimationViewer animation={animation} actionIndex={actionIndex} />}
        </div>
      </div>
    </>
  )
}
