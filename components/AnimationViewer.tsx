import { useEffect, useMemo, useRef, useState } from "react"
import { drawSequence } from "../utils/animation/drawSequence"
import { getRecommendedSize } from "../utils/animation/getRecommendedSize"
import { xmlParser } from "../utils/animation/xmlParser"

export type AnimationMeta = {
  name: string;
  url_img: string;
  url_xml: string;
  actions: number;
  defaultAction: number;
};

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
  const [sequenceIndex, setSequenceIndex] = useState(0)

  const { width, height, x, y } = useMemo(() => getRecommendedSize(animations, xmls), [animations, xmls])
  const isLoading = imgs.some(x => x == null) || xmls.some(x => x == null) || imgs.length !== animations.length || xmls.length !== animations.length || animations.length === 0

  useEffect(() => {
    const newXmls: any[] = animations.map(a => null)
    const newImgs: (HTMLImageElement | null)[] = animations.map(a => null)

    console.log("animations", animations)

    animations.forEach((pa, i) => {
      const { animation } = pa
      fetch(animation.url_xml)
        .then((response) => response.text())
        .then((text) => {
          const xml = xmlParser.parse(text)
          newXmls[i] = xml
          if (newXmls.every(x => x != null))
            setXmls(newXmls)
        })
        .catch((error) => console.error(error))

      const img = new Image()
      img.src = animation.url_img
      img.onload = () => {
        newImgs[i] = img
        if (newImgs.every(x => x != null))
          setImgs(newImgs)
      }
    })
  }, [animations])

  const maxSequenceLength = Math.max(...animations.map((animation, ind) => xmls[ind]?.Animation?.Actions?.Action[animation.actionIndex]?.Sequence?.length ?? 0))

  useEffect(() => {
    if (isLoading) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    if (sequenceIndex >= maxSequenceLength) {
      setSequenceIndex(0)
      return
    }

    let frame

    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for(let i = 0; i < animations.length; i++) {
      const img = imgs[i]
      const xml = xmls[i]
      const animation = animations[i]

      if (!img || !xml || !animation) continue

      const action = xml.Animation.Actions.Action[animation.actionIndex]
      if (!action) continue

      const sequence = action.Sequence
      if (!sequence) continue

      if (sequenceIndex >= sequence.length) {
        frame = sequence[0]
      } else {
        frame = sequence[sequenceIndex]
      }

      // console.log("clear", frame)
      drawSequence(ctx, img, xml, frame.id, x - (animation.xOffset ?? 0), y - (animation.yOffset ?? 0))
    }

    const timeout = setTimeout(() => setSequenceIndex(sequenceIndex + 1), frame.duration * 1000 / 16) // HpLib.Anime.fps
    return () => clearTimeout(timeout)
  }, [imgs, xmls, canvasRef, animations, sequenceIndex, x, y, isLoading, maxSequenceLength])

  if (isLoading) return <div>Loading...</div>


  return (
    <div>
      <div className="flex flex-row justify-end gap-2">
        <div className="text-sm">{sequenceIndex + 1}/{maxSequenceLength}</div>
      </div>
      <canvas width={width} height={height} ref={canvasRef}></canvas>
    </div>
  )
}
