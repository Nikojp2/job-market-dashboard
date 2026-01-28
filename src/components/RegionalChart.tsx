import { useState } from 'react';

interface RegionalData {
  region: string;
  value: number;
}

interface RegionalChartProps {
  data: RegionalData[];
  title: string;
  dataKey: string;
  color?: string;
  unit?: string;
}

function getHeatColor(value: number, min: number, max: number): string {
  const ratio = (value - min) / (max - min || 1);
  // Green (low) -> Yellow (mid) -> Red (high)
  if (ratio < 0.5) {
    const r = Math.round(34 + ratio * 2 * (234 - 34));
    const g = Math.round(197 + ratio * 2 * (179 - 197));
    const b = Math.round(94 + ratio * 2 * (8 - 94));
    return `rgb(${r},${g},${b})`;
  }
  const r2 = Math.round(234 + (ratio - 0.5) * 2 * (239 - 234));
  const g2 = Math.round(179 + (ratio - 0.5) * 2 * (68 - 179));
  const b2 = Math.round(8 + (ratio - 0.5) * 2 * (68 - 8));
  return `rgb(${r2},${g2},${b2})`;
}

function getTextColor(value: number, min: number, max: number): string {
  const ratio = (value - min) / (max - min || 1);
  return ratio > 0.6 ? 'white' : '#1e293b';
}

export function RegionalChart({
  data,
  title,
  unit = '',
}: RegionalChartProps) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const minValue = sortedData[sortedData.length - 1]?.value || 0;
  const maxValue = sortedData[0]?.value || 1;

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 mb-6">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {sortedData.map((item) => (
          <div
            key={item.region}
            className="relative rounded-xl p-4 transition-all duration-200 cursor-default"
            style={{
              backgroundColor: getHeatColor(item.value, minValue, maxValue),
              transform: hoveredRegion === item.region ? 'scale(1.05)' : 'scale(1)',
              boxShadow: hoveredRegion === item.region
                ? '0 8px 25px -5px rgb(0 0 0 / 0.2)'
                : '0 1px 3px rgb(0 0 0 / 0.1)',
              zIndex: hoveredRegion === item.region ? 10 : 1,
            }}
            onMouseEnter={() => setHoveredRegion(item.region)}
            onMouseLeave={() => setHoveredRegion(null)}
          >
            <div
              className="text-xs font-medium mb-1 truncate"
              style={{ color: getTextColor(item.value, minValue, maxValue) }}
            >
              {item.region}
            </div>
            <div
              className="text-xl font-bold"
              style={{ color: getTextColor(item.value, minValue, maxValue) }}
            >
              {item.value.toFixed(1)}{unit}
            </div>
            {hoveredRegion === item.region && (
              <div
                className="text-xs mt-1 opacity-80"
                style={{ color: getTextColor(item.value, minValue, maxValue) }}
              >
                Sija {sortedData.indexOf(item) + 1}/{sortedData.length}
              </div>
            )}
          </div>
        ))}
      </div>
      {/* Color scale legend */}
      <div className="flex items-center justify-center gap-3 mt-6 text-xs text-slate-500">
        <span>Matala</span>
        <div
          className="h-3 w-48 rounded-full"
          style={{
            background: `linear-gradient(to right, ${getHeatColor(minValue, minValue, maxValue)}, ${getHeatColor((minValue + maxValue) / 2, minValue, maxValue)}, ${getHeatColor(maxValue, minValue, maxValue)})`,
          }}
        />
        <span>Korkea</span>
      </div>
    </div>
  );
}
