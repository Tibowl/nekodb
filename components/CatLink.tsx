import { SmallCat } from "../pages/cats/[catId]"
import DisplayImage from "./DisplayImage"
import FormattedLink from "./FormattedLink"
import { useLanguage } from "../hooks/useLanguage"

export default function CatLink({ cat }: {cat: SmallCat}) {
    const { translate } = useLanguage()

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <DisplayImage img={cat.image} alt={translate(cat.name)} />
            <div>{translate(cat.name)}</div>
        </div>
    </FormattedLink>
}
