import { SmallGoodie } from "../pages/goodies/[goodieId]"
import DisplayImage from "./DisplayImage"
import FormattedLink from "./FormattedLink"
import { useLanguage } from "../hooks/useLanguage"

export default function GoodieLink({ goodie }: {goodie: SmallGoodie}) {
    const { translate } = useLanguage();

    if (!goodie.image) return <div className="flex flex-row items-center gap-2 p-2">
        <div>{translate(goodie.name)}</div>
    </div>

    return <FormattedLink href={`/goodies/${goodie.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <div>
                <DisplayImage img={goodie.image} alt={translate(goodie.name)} className="max-h-6 max-w-9 w-auto" />
            </div>
            <div>{translate(goodie.name)}</div>
        </div>
    </FormattedLink>
}
