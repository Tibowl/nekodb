import Image from "next/image"
import { SmallCat } from "../pages/cats/[catId]"
import { getCatIconLink } from "../utils/cat_utils"
import FormattedLink from "./FormattedLink"

export default function CatLink({ cat }: {cat: SmallCat}) {

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            {cat.id < 100 ?
                <Image src={getCatIconLink(cat)} alt={cat.name} width={87} height={59} className="max-h-8 max-w-8" />
            :
                <img src={getCatIconLink(cat)} alt={cat.name} className="max-h-8 max-w-8" />
            }
            <div>{cat.name}</div>
        </div>
    </FormattedLink>
}
