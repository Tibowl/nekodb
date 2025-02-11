import { SmallCat } from "../pages/cats/[catId]"
import DisplayImage from "./DisplayImage"
import FormattedLink from "./FormattedLink"

export default function CatLink({ cat }: {cat: SmallCat}) {

    return <FormattedLink href={`/cats/${cat.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <DisplayImage img={cat.image} alt={cat.name} />
            <div>{cat.name}</div>
        </div>
    </FormattedLink>
}
