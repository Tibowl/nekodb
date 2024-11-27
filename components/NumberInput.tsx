export function NumberInput({ value, set, label, min, max }: {
  value: number;
  set: (newValue: number) => unknown;
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label>
        {label}
        <input
          className="bg-slate-200 sm:w-32 w-24 dark:bg-slate-800 rounded-lg px-2 ml-2 mt-1 focus:ring-indigo-500 focus:border-indigo-500"
          value={value}
          onChange={(e) => {
            const value = +e.target.value
            set(min && value < min ? min : max && value > max ? max : value)
          }}
          min={min}
          max={max}
          type="number"
        />
        <button
          className={`${
            value == min
              ? "bg-slate-800 text-slate-50"
              : "bg-red-500 text-slate-50 cursor-pointer"
          } text-center rounded-lg px-1 inline-block ml-2 md:sr-only`}
          tabIndex={-1}
          onClick={() =>
            min == undefined || value > min ? set(value - 1) : void 0
          }
        >
          Subtract 1
        </button>
        <button
          className={`${
            value == max
              ? "bg-slate-800 text-slate-50"
              : "bg-green-500 text-slate-50 cursor-pointer"
          } text-center rounded-lg px-1 inline-block ml-2 md:sr-only`}
          tabIndex={-1}
          onClick={() =>
            max == undefined || value < max ? set(value + 1) : void 0
          }
        >
          Add 1
        </button>
      </label>
    </div>
  )
}
