import { useEffect, useMemo, useRef, useState } from "react"
import { drawSequence, getRecommendedSize, xmlParser } from "../utils/animation_utils"

export type AnimationMeta = {
  name: string;
  url_img: string;
  url_xml: string;
  actions: number;
};

export default function AnimationViewer({ animation, actionIndex, showAction = false }: {
  animation: AnimationMeta;
  actionIndex: number;
  showAction?: boolean;
}) {
  const [xml, setXml] = useState<any>(undefined)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sequenceIndex, setSequenceIndex] = useState(0)

  const { width, height, x, y } = useMemo(() => getRecommendedSize(xml), [xml])

  useEffect(() => {
    fetch(animation.url_xml)
      .then((response) => response.text())
      .then((text) => setXml(xmlParser.parse(text)))
      .catch((error) => console.error(error))

    const img = new Image()
    img.src = animation.url_img
    img.onload = () => setImg(img)
  }, [animation])

  useEffect(() => {
    if (!img) return
    if (!xml) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const action = xml.Animation.Actions.Action[actionIndex]
    if (!action) return

    const sequence = action.Sequence
    if (!sequence) return

    if (sequenceIndex >= sequence.length) {
      setSequenceIndex(0)
      return
    }

    const frame = sequence[sequenceIndex]

    // console.log("clear", frame)
    ctx.resetTransform()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawSequence(ctx, img, xml, frame.id, x, y)

    const timeout = setTimeout(() => setSequenceIndex(sequenceIndex + 1), frame.duration * 1000/30)
    return () => clearTimeout(timeout)
  }, [img, xml, canvasRef, actionIndex, sequenceIndex, x, y])

  if (!xml || !img) return <div>Loading...</div>

  const actions = xml.Animation.Actions.Action
  const sequence = actions[actionIndex]?.Sequence
  if (!sequence) return <div>Sequence #{actionIndex} not found</div>

  return (
    <div>
      <div className="flex flex-row justify-end gap-2">
        <div className="text-sm">{sequenceIndex + 1}/{sequence.length}</div>
      </div>
      <canvas width={width} height={height} ref={canvasRef}></canvas>
    </div>
  )
}
