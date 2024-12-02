import mermaid from "mermaid"
import { useEffect, useRef, useState } from "react"
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch"

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
})

export function Mermaid({ chart }: { chart: string }) {
  const [content, setContent] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pre = ref.current
    if (!pre) return

    mermaid.render("a", chart, pre).then((x) => {
      setContent(x.svg)
    })
  }, [ref, chart])

  return (
    <div>
    <TransformWrapper>
      <TransformComponent wrapperStyle={{ maxWidth: "100%" }}>
      <div
        className="mermaid"
        ref={ref}
        style={{ width: "1200px", height: "1280px" }}
        dangerouslySetInnerHTML={content ? { __html: content } : undefined}
      ></div>
      </TransformComponent>
    </TransformWrapper>
    </div>
  )
}
