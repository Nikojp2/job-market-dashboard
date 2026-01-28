import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface MiniChartProps {
  data: { period: string; value: number }[];
  color: string;
}

export function MiniChart({ data, color }: MiniChartProps) {
  return (
    <ResponsiveContainer width="100%" height={80}>
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`mini-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: 'none',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgb(0 0 0 / 0.1)',
            padding: '6px 10px',
            fontSize: 12,
          }}
          labelFormatter={(label) => {
            if (typeof label === 'string' && label.includes('M')) {
              const [year, month] = label.split('M');
              const monthNames = [
                'Tammi', 'Helmi', 'Maalis', 'Huhti',
                'Touko', 'Kesä', 'Heinä', 'Elo',
                'Syys', 'Loka', 'Marras', 'Joulu'
              ];
              return `${monthNames[parseInt(month) - 1]} ${year}`;
            }
            return label;
          }}
          formatter={(val: number) => [val.toLocaleString('fi-FI'), '']}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#mini-${color.replace('#', '')})`}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
