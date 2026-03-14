import { useEffect, useMemo, useRef, useState } from "react"
import { drawSequence } from "../utils/animation/drawSequence"
import { getRecommendedSize } from "../utils/animation/getRecommendedSize"
import { xmlParser } from "../utils/animation/xmlParser"
import { ImageMetaData } from "./DisplayImage"

export type FoundAnimationMeta = {
  name: string;
  url_img: string;
  url_xml: string;
  actions: number;
  defaultAction: number;
};

export type FallbackAnimation = {
  name: string;
  url_img: string;
  url_xml: null;
  actions: 1;
  defaultAction: 0;
  imageInfo: ImageMetaData;
}

export function isFoundAnimationMeta(animation: AnimationMeta): animation is FoundAnimationMeta {
  return (animation as FoundAnimationMeta).url_xml !== null
}

export type AnimationMeta = FoundAnimationMeta | FallbackAnimation

export type PlayingAnimation = {
  animation: AnimationMeta;
  actionIndex: number;
  xOffset?: number;
  yOffset?: number;
}

export default function AnimationViewer({ animations }: {
  animations: PlayingAnimation[];
}) {
  const [xmls, setXmls] = useState<any[]>([])
  const [imgs, setImgs] = useState<(HTMLImageElement | null)[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sequenceIndices, setSequenceIndices] = useState<number[]>([])

  const { width, height, x, y } = useMemo(() => getRecommendedSize(animations, xmls), [animations, xmls])
  const isLoading = imgs.some(x => x == null) || xmls.some(x => x == null) || imgs.length !== animations.length || xmls.length !== animations.length || animations.length === 0

  useEffect(() => {
    const newXmls: any[] = animations.map(a => null)
    const newImgs: (HTMLImageElement | null)[] = animations.map(a => null)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSequenceIndices(animations.map(a => 0))
    setXmls([])

    console.log("animations", animations)

    animations.forEach((pa, i) => {
      const { animation } = pa
      if (isFoundAnimationMeta(animation)) {
        fetch(animation.url_xml)
          .then((response) => response.text())
          .then((text) => {
            const xml = xmlParser.parse(text)
            newXmls[i] = xml
            if (newXmls.every(x => x != null))
              setXmls(newXmls)
          })
          .catch((error) => console.error(error))
      } else {
        setXmls([{
          Animation: {
            Actions: {
              Action: [{
                Sequence: [{
                  id: 0,
                  duration: 1,
                }],
              }],
            },
            Modules: {
              Module: [{
                id: 0,
                x: 0, y: 0,
                w: animation.imageInfo.width, h: animation.imageInfo.height,
              }],
            },
            Frames: {
              Frame: [{
                Sprite: [
                  {
                    module_id: 0,
                    m00: 1, m10: 0,
                    m01: 0, m11: 1,
                    m02: 0, m12: 0,
                  },
                ],
              }]
            }
          }
        }])
      }

      const img = new Image()
      img.src = animation.url_img
      img.onload = () => {
        newImgs[i] = img
        if (newImgs.every(x => x != null))
          setImgs(newImgs)
      }
    })
  }, [animations])

  useEffect(() => {
    if (isLoading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const timeout = setTimeout(() => setSequenceIndices(prev => prev.map((x, ind) => {
      if (!xmls[ind]) return x
      const maxSequenceLength = getMaxSequenceLength(xmls[ind], animations[ind].actionIndex)
      const next = (x + 1) % maxSequenceLength
      return next
    })), 1000 / 16) // HpLib.Anime.fps
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for(let i = 0; i < animations.length; i++) {
      const img = imgs[i]
      const xml = xmls[i]
      const animation = animations[i]

      if (!img || !xml || !animation) continue

      const sequence = xml.Animation.Actions.Action[animation.actionIndex]?.Sequence
      if (!sequence) continue

      const sequenceIndex = getSequenceIndex(xml, animation.actionIndex, sequenceIndices[i])
      let frame
      if (sequenceIndex >= sequence.length) {
        frame = sequence[0]
      } else {
        frame = sequence[sequenceIndex]
      }

      // console.log("clear", frame)
      drawSequence(ctx, img, xml, frame.id, x - (animation.xOffset ?? 0), y - (animation.yOffset ?? 0))
    }

    return () => clearTimeout(timeout)
  }, [imgs, xmls, canvasRef, animations, sequenceIndices, x, y, isLoading])

  if (isLoading) return <div>Loading...</div>


  return (
    <div>
      <div className="flex flex-row justify-end gap-2">
        {xmls.map((xml, i) => {
          if (!xml) return null
          const maxSequenceLength = getMaxSequenceLength(xml, animations[i].actionIndex)
          const action = xml?.Animation?.Actions?.Action?.[animations[i].actionIndex]
          if (!action?.Sequence) return null
          const maxSequenceDirectLength = action.Sequence.length
          if (maxSequenceLength !== maxSequenceDirectLength) {
            const sequenceIndex = getSequenceIndex(xml, animations[i].actionIndex, sequenceIndices[i])
            return <div className="text-sm w-28 text-right" key={i}>{sequenceIndices[i] + 1}/{maxSequenceLength} [{sequenceIndex + 1}/{maxSequenceDirectLength}]</div>
          }
          return <div className="text-sm w-10 text-right" key={i}>{sequenceIndices[i] + 1}/{maxSequenceLength}</div>
        })}
      </div>
      <canvas width={width} height={height} ref={canvasRef}></canvas>
    </div>
  )
}

function getMaxSequenceLength(xml: any, actionIndex: number) {
  try {
    const action = xml?.Animation?.Actions?.Action?.[actionIndex]
    if (!action?.Sequence) return 1
    return action.Sequence.reduce((acc: number, frame: any) => acc + +frame.duration, 0)
  } catch (e) {
    console.error("Error in getMaxSequenceLength:", e)
    return 1
  }
}

function getSequenceIndex(xml: any, actionIndex: number, sequenceIndex: number) {
  try {
    const action = xml?.Animation?.Actions?.Action?.[actionIndex]
    if (!action?.Sequence) return 0

    const sequence = action.Sequence
    let acc = 0
    for (let i = 0; i < sequence.length; i++) {
      acc += +sequence[i].duration
      if (acc > sequenceIndex) {
        return i
      }
    }
    return 0
  } catch (e) {
    console.error("Error in getSequenceIndex:", e)
    return 0
  }
}
