import { SmallGoodie } from "../pages/goodies/[goodieId]";
import { getGoodieIconLink } from "../utils/goodie_utils";
import FormattedLink from "./FormattedLink";

export default function GoodieLink({goodie}: {goodie: SmallGoodie}) {
    if (!goodie.anime) return <div className="flex flex-row items-center gap-2 p-2">
        <div>{goodie.name}</div>
    </div>

    return <FormattedLink href={`/goodies/${goodie.id}`}>
        <div className="flex flex-row items-center gap-2 p-2">
            <img src={getGoodieIconLink(goodie)} className="max-h-8 max-w-8" />
            <div>{goodie.name}</div>
        </div>
    </FormattedLink>
}