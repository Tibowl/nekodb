import {
  CAT_STAY_TICK_AVG,
  GOLD_FISH_PER_TICK_WHEN_GOLD_PAYOUT,
  SILVER_FISH_MULTIPLIER_RANGE,
  STAY_TICK_RANGE,
} from "./analyzer/constants"
import { expectationOfUniformRoundedDownClipped } from "./analyzer/probability"

export const LOW_NIBOSHI_GOLD_GIFT_THRESHOLD = 20
export const LOW_NIBOSHI_COMPLETED_STAY_GOLD = 3
export const GOLD_GIFT_PROBABILITY_INDOOR = 0.08
export const GOLD_GIFT_PROBABILITY_OUTDOOR = 0.04

export function expectedSilverRateForCatOnPlayspace(
  catSilverMul: number,
  playspaceSilverMul: number
): number {
  const priorMultiplier = (catSilverMul * playspaceSilverMul) / 100 / 250
  let expectedPerCollection = 0
  for (const t of STAY_TICK_RANGE) {
    expectedPerCollection += expectationOfUniformRoundedDownClipped(
      priorMultiplier * t * SILVER_FISH_MULTIPLIER_RANGE[0],
      priorMultiplier * t * SILVER_FISH_MULTIPLIER_RANGE[1]
    )
  }
  return expectedPerCollection / STAY_TICK_RANGE.length / CAT_STAY_TICK_AVG
}

export function isLowNiboshiGoldGiftCat(catNiboshi: number): boolean {
  return catNiboshi > 0 && catNiboshi < LOW_NIBOSHI_GOLD_GIFT_THRESHOLD
}

export function giftEconomyForCatOnPlayspace(
  catNiboshi: number,
  playspaceSilverMul: number,
  isIndoor: boolean
): {
  silverRatePerTickWhenSilverGift: number
  goldGiftProbability: number
  goldRatePerTickWhenGoldGift: number
} {
  if (isLowNiboshiGoldGiftCat(catNiboshi)) {
    return {
      silverRatePerTickWhenSilverGift: 0,
      goldGiftProbability: 1,
      goldRatePerTickWhenGoldGift:
        LOW_NIBOSHI_COMPLETED_STAY_GOLD / CAT_STAY_TICK_AVG,
    }
  }

  return {
    silverRatePerTickWhenSilverGift: expectedSilverRateForCatOnPlayspace(
      catNiboshi,
      playspaceSilverMul
    ),
    goldGiftProbability: isIndoor
      ? GOLD_GIFT_PROBABILITY_INDOOR
      : GOLD_GIFT_PROBABILITY_OUTDOOR,
    goldRatePerTickWhenGoldGift: GOLD_FISH_PER_TICK_WHEN_GOLD_PAYOUT,
  }
}
