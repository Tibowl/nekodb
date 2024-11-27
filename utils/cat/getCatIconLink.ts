import { SmallCat } from "../../pages/cats/[catId]";
import { getCatIconId } from "./getCatIconId";
import { getCatIconURL } from "./getCatIconURL";

export function getCatIconLink(cat: Pick<SmallCat, "id">) {
    return getCatIconURL(getCatIconId(cat))
}
