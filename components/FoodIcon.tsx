import { getCatIconURL } from "../utils/cat/getCatIconURL"
import { getGoodieIconURL } from "../utils/goodie/getGoodieIconURL"
import DisplayImage from "./DisplayImage"

const foodMapping: Record<string, {name: string, texture: string, width: number, height: number}> = {
  "1": { width: 220, height: 111, name: "Thrifty Bitz", texture: getGoodieIconURL("08meshi_karikari") },
  "2": { width: 220, height: 111, name: "Frisky Bitz", texture: getGoodieIconURL("08meshi_karikari_high") },
  "3": { width: 162, height: 118, name: "Ritzy Bitz", texture: getGoodieIconURL("08meshi_nekokan") },
  "4": { width: 164, height: 125, name: "Bonito Bitz", texture: getGoodieIconURL("08meshi_f00") },
  "5": { width: 162, height: 117, name: "Deluxe Tuna Bitz", texture: getGoodieIconURL("08meshi_nekokan_high") },
  "6": { width: 263, height: 98, name: "Sashimi", texture: getGoodieIconURL("08meshi_sashimi") },
  "7": { width: 364, height: 149, name: "Sashimi Boat", texture: getGoodieIconURL("08meshi_sashimi2") },
  "8": { width: 108, height: 145, name: "Small Glass Bottle", texture: getCatIconURL(`takara_${62..toString().padStart(3, "0")}`) },
}


export default function FoodIcon({ food, children, extraClasses = "" }: { food: string, children: React.ReactNode, extraClasses?: string }) {
  const mapping = foodMapping[food]
  return <div className="flex flex-row items-center gap-2 p-2">
    <DisplayImage img={{
      url: mapping.texture,
      width: mapping.width,
      height: mapping.height,
    }} alt={mapping.name} className={`max-h-6 max-w-9 w-auto ${extraClasses}`} />
    <div>{children}</div>
  </div>
}
