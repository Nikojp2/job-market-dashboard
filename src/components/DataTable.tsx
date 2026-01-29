import { useState, useMemo } from 'react';

interface DataTableProps {
  data: Record<string, string | number>[];
  columns: { key: string; label: string }[];
}

export function DataTable({ data, columns }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortDirection === 'asc'
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, sortKey, sortDirection]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const formatValue = (value: string | number): string => {
    if (typeof value === 'number') {
      // Format numbers with Finnish locale
      if (Number.isInteger(value)) {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      }
      return value.toFixed(1).replace('.', ',');
    }
    return value;
  };

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        Ei tuloksia
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className="px-4 py-3 text-left font-semibold text-slate-700 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        sortDirection === 'desc' ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-slate-600">
                  {formatValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
