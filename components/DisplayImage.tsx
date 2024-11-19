import Image from "next/image"

export type ImageMetaData = {
  url: string;
  width: number;
  height: number;
};

export default function DisplayImage(props: {
  img: ImageMetaData;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <Image
      src={props.img.url}
      alt={props.alt}
      width={props.img.width}
      height={props.img.height}
      className={props.className}
      loading={props.loading ?? "lazy"}
    />
  )
}
