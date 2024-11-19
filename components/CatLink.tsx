import Image from "next/image"
import { SmallCat } from "../pages/cats/[catId]"
import { getCatIconLink } from "../utils/cat_utils"
import FormattedLink from "./FormattedLink"
import DisplayImage from "./DisplayImage"

export default function CatLink({ cat }: {cat: SmallCat}) {

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <DisplayImage img={cat.image} alt={cat.name} className="max-h-8 max-w-8" />
            <div>{cat.name}</div>
        </div>
    </FormattedLink>
}
