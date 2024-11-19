import { useEffect, useMemo, useState } from "react"
import AnimationViewer, { AnimationMeta } from "./AnimationViewer"
import SelectInput from "./SelectInput"
import FormattedLink from "./FormattedLink"
import createRange from "../utils/create-range"
import { CheckboxInput } from "./CheckboxInput"

export default function AnimationGallery({ animations }: { animations: AnimationMeta[] }) {
  const [animationName, setAnimationName] = useState(animations[0]?.name)
  const [actionIndex, setActionIndex] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const animation = useMemo(
    () => animations.find((a) => a.name == animationName),
    [animationName, animations]
  )
  useEffect(() => {
    if (animation && actionIndex >= animation.actions)
      setActionIndex(0)
    if (!animation && animations.length > 0)
      setAnimationName(animations[0].name)
  }, [animation, animationName, actionIndex, animations])

  if (animations.length == 0) return null

  if (showAll) {
    return (
      <>
        <h2 className="text-xl font-bold" id="animations">Animation gallery</h2>
        <CheckboxInput label="Show all" set={setShowAll} value={showAll} />

        {animations.map((animation, i) => <div key={i}>
          <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
            <div className="flex flex-row justify-between items-center gap-2">
              <div className="text-sm">{animation.name}</div>
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
      <h2 className="text-xl font-bold" id="animations">Animation gallery</h2>
      <CheckboxInput label="Show all" set={setShowAll} value={showAll} />
      <div className="flex flex-row justify-between items-center gap-2">
        <SelectInput label="Animation" value={animationName} set={setAnimationName} options={animations.map((a) => a.name)}/>
        {animation && (<FormattedLink href={animation.url_img} className="text-sm" target="_blank">
            View raw image
          </FormattedLink>
        )}
      </div>
      <SelectInput label="Action"
        value={`${actionIndex}`}
        set={(x) => setActionIndex(+x)}
        options={createRange(animation?.actions ?? 0).map((i) => i.toString())}
      />

      <div className="bg-gray-100 dark:bg-slate-800 rounded-md p-1">
        {animation && <AnimationViewer animation={animation} actionIndex={actionIndex} />}
      </div>
    </>
  )
}
