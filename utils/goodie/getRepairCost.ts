import { Goodie } from "../../pages/goodies/[goodieId]"


export function getRepairCost(goodie: Goodie) {
    if (goodie.repairCost !== -1) return goodie.repairCost

    // repair toughness levels
    const toughnessLevel = [{
        toughness: 1000,
        multiplier: 0,
    }, {
        toughness: 4000,
        multiplier: 1/4,
    }, {
        toughness: 13600,
        multiplier: 1/3,
    }, {
        toughness: Infinity,
        multiplier: 1/2,
    }]

    // effective shop price in silver   
    const cost = (goodie.gold < 1)
        ? (goodie.silver)
        : (goodie.gold * 25)

    for (const entry of toughnessLevel)
        if (goodie.toughness < entry.toughness)
            return Math.floor(entry.multiplier * cost)
    return Math.floor(cost/2)
}
