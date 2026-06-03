import DisplayImage from "./DisplayImage"
import { catIconImageMeta } from "../utils/yardOptimizer/clientAssets"

type CatFaceNameSize = "inline" | "list" | "compact"

const sizeClasses: Record<
  CatFaceNameSize,
  { wrapper: string; face: string; image: string }
> = {
  inline: {
    wrapper: "align-baseline leading-[inherit]",
    face: "h-5 w-8",
    image: "h-5 w-8",
  },
  compact: {
    wrapper: "h-6 align-middle leading-none",
    face: "h-6 w-9",
    image: "h-6 w-9",
  },
  list: {
    wrapper: "h-8 align-middle leading-none",
    face: "h-8 w-11",
    image: "h-8 w-11",
  },
}

export default function CatFaceName({
  catId,
  name,
  size,
}: {
  catId: number
  name: string
  size: CatFaceNameSize
}) {
  const classes = sizeClasses[size]

  if (size === "inline") {
    return (
      <span className="whitespace-nowrap text-[inherit] font-[inherit] leading-[inherit]">
        <span
          className={`mr-1.5 inline-flex shrink-0 items-center justify-center overflow-hidden align-[-0.25em] ${classes.face}`}
        >
          <DisplayImage
            img={catIconImageMeta(catId)}
            alt=""
            className={`shrink-0 object-contain ${classes.image}`}
          />
        </span>
        <span>{name}</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[inherit] font-[inherit] ${classes.wrapper}`}
    >
      <span
        className={`inline-flex shrink-0 items-center justify-center overflow-hidden ${classes.face}`}
      >
        <DisplayImage
          img={catIconImageMeta(catId)}
          alt=""
          className={`shrink-0 object-contain ${classes.image}`}
        />
      </span>
      <span className="leading-none">{name}</span>
    </span>
  )
}
