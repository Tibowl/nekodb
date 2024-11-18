export function CheckboxInput({ value, set, label }: {
  value: boolean;
  set: (newValue: boolean) => unknown;
  label: string;
}) {
  return (
    <div>
      <label>
        {label}
        <input
          className="bg-slate-200 dark:bg-slate-800 rounded-lg px-2 ml-2 mt-1 focus:ring-indigo-500 focus:border-indigo-500"
          checked={value}
          onChange={(e) => set(e.target.checked)}
          type="checkbox"
        />
      </label>
    </div>
  )
}
