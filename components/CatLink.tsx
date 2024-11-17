import { SmallCat } from "../pages/cats/[catId]";
import { getCatIconLink } from "../utils/cat_utils";
import FormattedLink from "./FormattedLink";

export default function CatLink({cat}: {cat: SmallCat}) {

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <img src={getCatIconLink(cat)} className="max-h-8 max-w-8" />
            <div>{cat.name}</div>
        </div>
    </FormattedLink>
}