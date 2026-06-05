import { useEffect, useState } from "react"
import CatFace from "../../CatFaceName"
import DisplayImage from "../../DisplayImage"
import { goodieIconImageMeta } from "../../../utils/yardOptimizer/clientAssets"
import { Callout, RerollButton } from "./primitives"
import {
  formatPercent,
  FOOTER_DEDICATION_CATS,
  FULL_TOY_POOL,
  randomCats,
  relationshipExampleAt,
  sampledCats,
  sampledGoodieListForExample,
  sampledOutdoorGoodiesForExample,
  TINY_OPTIMIZER_FOOD,
} from "./exampleData"

export function CatFaceList({ cats: catList }: { cats: Array<{ id: number; name: string }> }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1 gap-y-0">
      {catList.map((cat, index) => (
        <span key={cat.id} className="inline-flex items-baseline gap-x-1">
          {index === catList.length - 1 && index > 0 ? (
            <span className="leading-[inherit]">and</span>
          ) : null}
          <span className="inline-flex items-baseline">
            <CatFace catId={cat.id} name={cat.name} size="inline" />
            {index < catList.length - 2 ? (
              <span className="leading-[inherit]">,</span>
            ) : null}
          </span>
        </span>
      ))}
    </span>
  )
}

export function InlineGoodieName({ goodieId, name }: { goodieId: number; name: string }) {
  return (
    <span className="whitespace-nowrap text-[inherit] font-[inherit] leading-[inherit]">
      <span className="mr-1.5 inline-flex h-5 w-8 shrink-0 items-center justify-center overflow-hidden align-[-0.25em]">
        <DisplayImage
          img={goodieIconImageMeta(goodieId)}
          alt=""
          className="max-h-5 max-w-8 shrink-0 object-contain"
        />
      </span>
      <span>{name}</span>
    </span>
  )
}

export function FooterDedicationCats() {
  const [footerCats, setFooterCats] = useState(FOOTER_DEDICATION_CATS)

  useEffect(() => {
    const interval = setInterval(() => {
      setFooterCats(randomCats(3))
    }, 10_000)
    return () => clearInterval(interval)
  }, [])

  return <CatFaceList cats={footerCats} />
}

export function AdjustedDrawExample() {
  const [index, setIndex] = useState(0)
  const example = relationshipExampleAt(index)

  return (
    <Callout
      tone="amber"
      title="Tiny example: adjusted draw chance"
      action={<RerollButton onClick={() => setIndex((value) => value + 1)} />}
    >
      <p>
        Some multi-play-space goodies can hold more than one cat, and a cat already
        using one play space can boost or lower another cat&rsquo;s draw weight. In the
        data, <CatFace catId={example.catId} name={example.cat} size="inline" /> has about a{" "}
        <strong>{formatPercent(example.baseDrawPercent)}</strong> draw chance for{" "}
        <strong>{example.goodie}</strong>. If{" "}
        <CatFace catId={example.otherCatId} name={example.otherCat} size="inline" /> is already
        using another play space on that same goodie, the <strong>+{example.modifier}%</strong>{" "}
        boost to {example.cat}&rsquo;s weight raises its draw chance to about{" "}
        <strong>{formatPercent(example.adjustedDrawPercent)}</strong>. The boost
        lands on the weight, not the chance directly, so the new figure comes from
        re-tallying the weights into fresh chances.
      </p>
    </Callout>
  )
}

export function CrossoverExample() {
  const [index, setIndex] = useState(2)
  const example = relationshipExampleAt(index)
  const indoorGoodies = sampledGoodieListForExample(
    example,
    index,
    FULL_TOY_POOL.smallItems,
    3
  )
  const outdoorGoodies = sampledOutdoorGoodiesForExample(example, index)

  return (
    <Callout
      tone="amber"
      title="Tiny example: what crossover means here"
      action={<RerollButton onClick={() => setIndex((value) => value + 1)} />}
    >
      <p>
        If one strong yard has an indoor half that helps{" "}
        <CatFace catId={example.catId} name={example.cat} size="inline" /> with{" "}
        <strong>{indoorGoodies}</strong>, and another has an outdoor half built around{" "}
        <strong>{outdoorGoodies}</strong>, crossover can try combining those halves into a
        new candidate.
      </p>
    </Callout>
  )
}

export function TinyOptimizerExample() {
  const [index, setIndex] = useState(3)
  const example = relationshipExampleAt(index)
  const catsForExample = sampledCats(index, 3)
  const goodiesForExample = sampledGoodieListForExample(
    example,
    index,
    FULL_TOY_POOL.smallItems,
    3
  )

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 p-4 space-y-1">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-800 dark:text-slate-100">For programming</h3>
        <RerollButton onClick={() => setIndex((value) => value + 1)} />
      </div>
      <p className="text-sm">
        Try writing your <em>own</em> tiny yard optimizer with this tiny setup:
      </p>
      <ul className="list-disc pl-5 text-sm space-y-1">
        <li>
          Cats: <CatFaceList cats={catsForExample} />
        </li>
        <li>Goodies: {goodiesForExample}</li>
        <li>
          Food and score: one bowl of {TINY_OPTIMIZER_FOOD}, with a simple score like &ldquo;one
          fish per visit.&rdquo;
        </li>
      </ul>
      <p className="text-sm">
        Build a small, broken version of the same yard problem. That is the fastest way to
        internalize these ideas.
      </p>
    </div>
  )
}
