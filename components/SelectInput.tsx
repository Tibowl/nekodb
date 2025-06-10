export default function SelectInput({ value, set, label, options, optionLabels }: {
  value: string;
  set: (newValue: string) => unknown;
  options: string[];
  optionLabels?: string[];
  label: string;
}) {
  return (
    <div>
      <label>
        {label}
        <select
          value={value}
          onChange={(e) => set(e.target.value)}
          className="ml-2 py-0.5 px-2 border border-gray-300 bg-slate-200 dark:bg-slate-800 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        >
          {options.map((opt, i) => (
            <option key={opt} value={opt}>{optionLabels?.[i] ?? opt}</option>
          ))}
        </select>
      </label>
    </div>
  )
}
