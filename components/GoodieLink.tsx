import { SmallGoodie } from "../pages/goodies/[goodieId]"
import DisplayImage from "./DisplayImage"
import FormattedLink from "./FormattedLink"

export default function GoodieLink({ goodie }: {goodie: SmallGoodie}) {
    if (!goodie.image) return <div className="flex flex-row items-center gap-2 p-2">
        <div>{goodie.name}</div>
    </div>

    return <FormattedLink href={`/goodies/${goodie.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <div>
                <DisplayImage img={goodie.image} alt={goodie.name} className="max-h-8 max-w-8" />
            </div>
            <div>{goodie.name}</div>
        </div>
    </FormattedLink>
}
