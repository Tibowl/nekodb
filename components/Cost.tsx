import DisplayImage from "./DisplayImage";

export default function Cost({ count, type }: { count: number, type: "gold" | "silver" | "stamp" | "tickets"}) {
  return (
    <div className="relative table text-right w-auto">
      <div className="absolute table-caption right-1 top-0 text-sm font-semibold">{count}</div>
      {type == "gold" && <DisplayImage img={({
        url: "/niboshi_counter_gold.png",
        width: 152,
        height: 53,
      })} alt="Gold fish" className="max-h-6 w-auto" />}
      {type == "silver" && <DisplayImage img={({
        url: "/niboshi_counter.png",
        width: 142,
        height: 53,
      })} alt="Silver fish" className="max-h-6 w-auto" />}
      {type == "stamp" && <DisplayImage img={({
        url: "/odekake_stamp_counter.png",
        width: 147,
        height: 42,
      })} alt="Stamp cards" className="max-h-6 w-auto" />}
      {type == "tickets" && <DisplayImage img={({
        url: "/odekake_counter.png",
        width: 174,
        height: 42,
      })} alt="Tickets" className="max-h-6 w-auto" />}
    </div>
  )
}