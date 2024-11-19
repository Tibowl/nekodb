import { useEffect, useMemo, useState } from "react"
import createRange from "../utils/create-range"
import AnimationViewer, { AnimationMeta } from "./AnimationViewer"
import { CheckboxInput } from "./CheckboxInput"
import FormattedLink from "./FormattedLink"
import SelectInput from "./SelectInput"

const checkers: [string, number][] = [
  ["00kihon_grooming", 1],
  ["00kihon_tsume_tate", 0],
  ["00kihon_tsume_yoko", 0],
  ["06jarashi_mushi", 0],
  ["06jarashi_the", 0],
  ["neko_walk", 0],
]

export default function AnimationGallery({ animations }: { animations: AnimationMeta[] }) {
  if (animations.length == 0) return null
  return <>
    <h2 className="text-xl font-bold" id="animations">Animation gallery</h2>
    <AnimationGalleryInternal animations={animations} />
  </>
}

function getDefault(animations: AnimationMeta[]): [string, number] {
  if (animations.length == 0) return ["undefined", 0]

  const found: [string, number][] = []
  for (const [name, actionIndex] of checkers) {
    if (animations.some(a => a.name == name))
      found.push([name, Math.min(actionIndex, animations.length - 1)])
  }

  if (found.length > 0)
    return found[Math.floor(Math.random() * found.length)]

  return [animations[0].name, 0]
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
    if (animation && actionIndex >= animation.actions)
      setActionIndex(0)
    if (!animation && animations.length > 0) {
      const [defaultName, defaultActionIndex] = getDefault(animations)
      setAnimationName(defaultName)
      setActionIndex(defaultActionIndex)
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
