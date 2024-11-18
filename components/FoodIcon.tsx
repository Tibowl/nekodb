import { getGoodieIconURL } from "../utils/goodie_utils"

const foodMapping: Record<string, {name: string, texture: string}> = {
  "1": { name: "Thrifty Bitz", texture: "08meshi_karikari" },
  "2": { name: "Frisky Bitz", texture: "08meshi_karikari_high" },
  "3": { name: "Ritzy Bitz", texture: "08meshi_nekokan" },
  "4": { name: "Bonito Bitz", texture: "08meshi_f00" },
  "5": { name: "Deluxe Tuna Bitz", texture: "08meshi_nekokan_high" },
  "6": { name: "Sashimi", texture: "08meshi_sashimi" },
  "7": { name: "Sashimi Boat", texture: "08meshi_sashimi2" },
}


export default function FoodIcon({ food, children, gray = false }: { food: string, children: React.ReactNode, gray?: boolean }) {
  const mapping = foodMapping[food]
  return <div className="flex flex-row items-center gap-2 p-2">
    <img src={getGoodieIconURL(mapping.texture)} alt={mapping.name} className={`max-h-8 max-w-8 ${gray ? "grayscale" : ""}`} />
    <div>{children}</div>
  </div>
}
