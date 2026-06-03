import { formatStatNumber } from "../../yardOptimizerDisplay"

export function MementoFoodRateInline({
  indoorRate,
  outdoorRate,
  foodTypeIndoor,
  foodTypeOutdoor,
}: {
  indoorRate: number
  outdoorRate: number
  foodTypeIndoor: number
  foodTypeOutdoor: number
}) {
  return (
    <div className="flex gap-1.5">
      <dt>Food rate</dt>
      <dd className="font-mono text-slate-700 dark:text-slate-200">
        {formatStatNumber(indoorRate, 3)} / {formatStatNumber(outdoorRate, 3)}
        <span className="text-slate-500 dark:text-slate-400">
          {" "}
          bowls #{foodTypeIndoor} / #{foodTypeOutdoor}
        </span>
      </dd>
    </div>
  )
}

export function MementoFoodRateDetailRow({
  indoorRate,
  outdoorRate,
}: {
  indoorRate: number
  outdoorRate: number
}) {
  return (
    <>
      <dt className="text-slate-500 dark:text-slate-400">Food rate in / out</dt>
      <dd className="font-mono text-slate-800 dark:text-slate-100">
        {formatStatNumber(indoorRate, 3)} / {formatStatNumber(outdoorRate, 3)}
      </dd>
    </>
  )
}
