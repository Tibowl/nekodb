import { useLanguage } from "../hooks/useLanguage"
import { SmallDeco } from "../pages/deco/[decoId]"
import DisplayImage from "./DisplayImage"
import FormattedLink from "./FormattedLink"

export default function DecoLink({ deco }: { deco: SmallDeco }) {
    const { translate } = useLanguage()

    if (!deco.image) return <div className="flex flex-row items-center gap-2 p-2">
        <div>{translate(deco.name)}</div>
    </div>

    return <FormattedLink href={`/deco/${deco.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <div>
                <DisplayImage img={deco.image} alt={translate(deco.name)} className="max-h-6 max-w-9 w-auto" />
            </div>
            <div>{translate(deco.name)}</div>
        </div>
    </FormattedLink>
}
