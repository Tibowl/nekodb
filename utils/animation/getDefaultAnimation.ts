import { AnimationMeta } from "../../components/AnimationViewer"

const defaultAnimations: string[] = [
  "00kihon_grooming",
  "00kihon_tsume_tate",
  "00kihon_tsume_yoko",
  "06jarashi_mushi",
  "06jarashi_the",
  "neko_walk"
]

export function getDefaultAnimation(animations: AnimationMeta[]): AnimationMeta {
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
