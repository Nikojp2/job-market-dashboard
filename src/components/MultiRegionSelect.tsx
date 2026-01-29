import { useState, useRef, useEffect } from 'react';
import { REGION_COLORS } from '../constants/colors';

interface Option {
  value: string;
  label: string;
}

interface MultiRegionSelectProps {
  label: string;
  options: readonly Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelections?: number;
}

export function MultiRegionSelect({
  label,
  options,
  selected,
  onChange,
  maxSelections = 5,
}: MultiRegionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      // Always allow deselection
      onChange(selected.filter((v) => v !== value));
    } else if (selected.length < maxSelections) {
      // Only add if under max
      onChange([...selected, value]);
    }
  };

  const getColorForIndex = (index: number) => {
    return REGION_COLORS[index % REGION_COLORS.length];
  };

  const selectedLabels = selected
    .map((v) => options.find((o) => o.value === v)?.label)
    .filter(Boolean);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full min-w-[200px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-left text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate">
            {selected.length === 0
              ? 'Valitse alueet...'
              : selected.length === 1
              ? selectedLabels[0]
              : `${selected.length} aluetta valittu`}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selected.map((value, index) => {
            const option = options.find((o) => o.value === value);
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: getColorForIndex(index) }}
              >
                {option?.label}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(value);
                  }}
                  className="hover:bg-white/20 rounded-full p-0.5"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-auto bg-white border border-slate-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-slate-100 text-xs text-slate-500">
            Valitse enintään {maxSelections} aluetta vertailtavaksi
          </div>
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            const selectedIndex = selected.indexOf(option.value);
            const isDisabled = !isSelected && selected.length >= maxSelections;

            return (
              <button
                key={option.value}
                onClick={() => !isDisabled && handleToggle(option.value)}
                disabled={isDisabled}
                className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                  isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : isSelected
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected ? 'border-transparent' : 'border-slate-300'
                  }`}
                  style={isSelected ? { backgroundColor: getColorForIndex(selectedIndex) } : {}}
                >
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
