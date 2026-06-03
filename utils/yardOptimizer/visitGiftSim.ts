import {
  GOLD_GIFT_PROBABILITY_INDOOR,
  GOLD_GIFT_PROBABILITY_OUTDOOR,
  LOW_NIBOSHI_COMPLETED_STAY_GOLD,
  isLowNiboshiGoldGiftCat,
} from "./visitEconomy"

/** Inputs for one discrete gift roll in the tick simulator. */
export type VisitGiftRollInput = {
  isIndoor: boolean
  stay: number
  plannedStay?: number
  silverPayoutBase: number
  giftNiboshi: number
  /** Kicked Tubbs on the outdoor bowl: gold conversion forced to 0. */
  tubbsSilverOnly?: boolean
}

/** Roll silver/gold fish for one visit settlement (game-accurate niboshi path + companion shortcut). */
export function rollVisitGiftFish(
  info: VisitGiftRollInput,
  rand01: () => number
): { silverDelta: number; goldDelta: number; isGoldPayout: boolean } {
  const lowNiboshiGoldGift = isLowNiboshiGoldGiftCat(info.giftNiboshi)
  const completedStay = info.stay >= (info.plannedStay ?? info.stay)
  const goldP = lowNiboshiGoldGift
    ? 1
    : info.isIndoor
      ? GOLD_GIFT_PROBABILITY_INDOOR
      : GOLD_GIFT_PROBABILITY_OUTDOOR
  const effectiveGoldP = info.tubbsSilverOnly ? 0 : goldP
  if (rand01() < effectiveGoldP) {
    const g = lowNiboshiGoldGift
      ? completedStay
        ? LOW_NIBOSHI_COMPLETED_STAY_GOLD
        : 1
      : Math.max(1, Math.floor(info.stay / 2))
    return { silverDelta: 0, goldDelta: g, isGoldPayout: true }
  }
  if (!Number.isFinite(info.giftNiboshi)) {
    const silverMul = 1 + 0.5 * rand01()
    const s = Math.floor(info.silverPayoutBase * info.stay * silverMul)
    return { silverDelta: s, goldDelta: 0, isGoldPayout: false }
  }
  if (info.giftNiboshi < 1) {
    return { silverDelta: 0, goldDelta: 0, isGoldPayout: false }
  }
  const playspaceNiboshi =
    info.silverPayoutBase > 0
      ? Math.round((info.silverPayoutBase * 100 * 250) / info.giftNiboshi)
      : 0
  let raw = info.giftNiboshi * info.stay
  if (raw < 1) {
    return { silverDelta: 1, goldDelta: 0, isGoldPayout: false }
  }
  raw *= playspaceNiboshi
  const randomBound = Math.floor(raw / 200)
  const randomPart = randomBound > 0 ? Math.floor(rand01() * randomBound) : 0
  const preDivide = randomPart + Math.floor(raw / 100)
  const s = preDivide < 250 ? 1 : Math.floor(preDivide / 250)
  return { silverDelta: s, goldDelta: 0, isGoldPayout: false }
}
