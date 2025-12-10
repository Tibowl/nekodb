import { useEffect, useMemo, useState } from "react"
import { getDefaultAnimation } from "../utils/animation/getDefaultAnimation"
import createRange from "../utils/math/createRange"
import AnimationViewer, { AnimationMeta } from "./AnimationViewer"
import { CheckboxInput } from "./CheckboxInput"
import FormattedLink from "./FormattedLink"
import SelectInput from "./SelectInput"


export default function AnimationGallery({ animations }: { animations: AnimationMeta[] }) {
  if (animations.length == 0) return null
  return <>
    <h2 className="text-xl font-bold" id="animations">Animation gallery</h2>
    <AnimationGalleryInternal animations={animations} />
  </>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActionIndex(animation?.defaultAction ?? 0)
  }, [animation])

  useEffect(() => {
    if (animation && actionIndex >= animation.actions)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActionIndex(animation.defaultAction)
    if (!animation && animations.length > 0) {
      const animation = getDefaultAnimation(animations)
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
                <AnimationViewer animations={[{ animation, actionIndex: action }]} />
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
          {animation && <AnimationViewer animations={[{ animation, actionIndex }]} />}
        </div>
      </div>
    </>
  )
}
