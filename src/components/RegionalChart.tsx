import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

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

export function RegionalChart({
  data,
  title,
  unit = '',
}: RegionalChartProps) {
  // Sort by value descending
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Color gradient based on value
  const maxValue = sortedData[0]?.value || 1;
  const getBarColor = (value: number, index: number) => {
    if (index < 3) return '#ef4444'; // High unemployment - red
    if (index < 6) return '#f97316'; // Medium-high - orange
    if (value > maxValue * 0.6) return '#eab308'; // Medium - yellow
    return '#10b981'; // Lower - green
  };

  return (
    <div>
      <h3 className="text-lg font-semibold text-slate-800 mb-6">{title}</h3>
      <ResponsiveContainer width="100%" height={450}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
          />
          <YAxis
            type="category"
            dataKey="region"
            tick={{ fontSize: 12, fill: '#475569' }}
            tickLine={false}
            axisLine={false}
            width={120}
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
            formatter={(value) => [`${(value as number).toFixed(1)}${unit}`, 'Työttömyysaste']}
            cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
            {sortedData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getBarColor(entry.value, index)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
          <span>Korkea</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#f97316]" />
          <span>Keskikorkea</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#eab308]" />
          <span>Keskitaso</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#10b981]" />
          <span>Matala</span>
        </div>
      </div>
    </div>
  );
}
