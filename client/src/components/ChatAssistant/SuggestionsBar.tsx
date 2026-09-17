// Simple, readable suggestion pills
interface SuggestionsBarProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestionsBar({ suggestions, onSelect }: SuggestionsBarProps) {
  if (!suggestions || suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      <span className="w-full text-[10px] text-slate-400 font-medium">You can also ask:</span>
      {suggestions.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="inline-flex items-center px-3 py-1.5 rounded-full border border-green-200 bg-green-50 text-green-800 text-xs font-medium hover:bg-green-100 hover:border-green-300 transition-all cursor-pointer active:scale-95 max-w-full text-left"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
