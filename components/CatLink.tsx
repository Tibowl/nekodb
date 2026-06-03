import { SmallCat } from "../pages/cats/[catId]"
import CatFaceName from "./CatFaceName"
import FormattedLink from "./FormattedLink"
import { useLanguage } from "../hooks/useLanguage"

export default function CatLink({ cat }: {cat: SmallCat}) {
    const { translate } = useLanguage()

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="p-2">
            <CatFaceName catId={cat.id} name={translate(cat.name)} size="compact" />
        </div>
    </FormattedLink>
}
