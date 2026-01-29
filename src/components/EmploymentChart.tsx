import { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface DataPoint {
  period: string;
  [key: string]: string | number;
}

interface EmploymentChartProps {
  data: DataPoint[];
  title: string;
  lines: {
    dataKey: string;
    color: string;
    name: string;
    dashed?: boolean;
  }[];
  yAxisLabel?: string;
}

export function EmploymentChart({
  data,
  title,
  lines,
  yAxisLabel,
}: EmploymentChartProps) {
  const [scaleMode, setScaleMode] = useState<'auto' | 'focused'>('auto');

  // Calculate the data range for focused mode
  const yAxisDomain = useMemo(() => {
    if (scaleMode === 'auto') {
      return undefined; // Let Recharts auto-calculate
    }

    // Find min and max values across all lines
    let min = Infinity;
    let max = -Infinity;

    data.forEach((point) => {
      lines.forEach((line) => {
        const value = point[line.dataKey];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) {
      return undefined;
    }

    // Add 10% padding on each side to make changes more visible
    const range = max - min;
    const padding = range * 0.15;

    // Round to nice numbers
    const niceMin = Math.floor((min - padding) * 10) / 10;
    const niceMax = Math.ceil((max + padding) * 10) / 10;

    return [niceMin, niceMax] as [number, number];
  }, [data, lines, scaleMode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
          <button
            onClick={() => setScaleMode('auto')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              scaleMode === 'auto'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Automaattinen skaalaus (sisältää nollan)"
          >
            Auto
          </button>
          <button
            onClick={() => setScaleMode('focused')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              scaleMode === 'focused'
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            title="Tarkennettu skaalaus (korostaa muutoksia)"
          >
            <svg className="w-4 h-4 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
            Zoom
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            {lines.map((line) => (
              <linearGradient key={`gradient-${line.dataKey}`} id={`gradient-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.color} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={line.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={(value) => {
              if (value.includes('M')) {
                const [year, month] = value.split('M');
                return `${month}/${year.slice(2)}`;
              }
              return value;
            }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            domain={yAxisDomain}
            label={
              yAxisLabel
                ? { value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }
                : undefined
            }
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: 'none',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              padding: '12px 16px',
            }}
            labelStyle={{ color: '#1e293b', fontWeight: 600, marginBottom: 4 }}
            itemStyle={{ color: '#475569', fontSize: 13 }}
            labelFormatter={(label) => {
              if (typeof label === 'string' && label.includes('M')) {
                const [year, month] = label.split('M');
                const monthNames = [
                  'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu',
                  'Toukokuu', 'Kesäkuu', 'Heinäkuu', 'Elokuu',
                  'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'
                ];
                return `${monthNames[parseInt(month) - 1]} ${year}`;
              }
              return label;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            iconType="circle"
            iconSize={8}
          />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              name={line.name}
              strokeWidth={line.dashed ? 2 : 2.5}
              strokeDasharray={line.dashed ? '6 3' : undefined}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
