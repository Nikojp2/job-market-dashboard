import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  getIndustryEmployment,
  getOccupationData,
  parseJsonStat,
  INDUSTRIES,
} from '../api/statfin';

interface IndustryData {
  industry: string;
  employed: number;
  previousYearEmployed: number;
  change: number;
  changePercent: number;
}

interface OccupationDataPoint {
  occupation: string;
  unemployed: number;
  openPositions: number;
}

const COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#ef4444', '#22c55e', '#eab308', '#8b5cf6'
];

export function IndustrySection() {
  const [industryData, setIndustryData] = useState<IndustryData[]>([]);
  const [occupationData, setOccupationData] = useState<OccupationDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch industry employment data
        const industryResponse = await getIndustryEmployment();
        const industryParsed = parseJsonStat(industryResponse);

        const years = industryParsed.dimensions['Vuosi'] || [];
        const industries = industryParsed.dimensions['Toimiala'] || [];
        const dataKeys = industryParsed.dimensions['Tiedot'] || [];

        const latestYearIndex = years.length - 1;
        const previousYearIndex = years.length - 2;

        const transformedIndustry: IndustryData[] = industries.map((industryCode, industryIndex) => {
          const industryInfo = INDUSTRIES.find((i) => i.value === industryCode);

          // Calculate value index for latest year
          const latestValueIndex = (latestYearIndex * industries.length * dataKeys.length) +
            (industryIndex * dataKeys.length);
          const previousValueIndex = (previousYearIndex * industries.length * dataKeys.length) +
            (industryIndex * dataKeys.length);

          const employed = industryParsed.values[latestValueIndex] || 0;
          const previousYearEmployed = industryParsed.values[previousValueIndex] || 0;
          const change = employed - previousYearEmployed;
          const changePercent = previousYearEmployed > 0
            ? ((change / previousYearEmployed) * 100)
            : 0;

          return {
            industry: industryInfo?.label || industryCode,
            employed,
            previousYearEmployed,
            change,
            changePercent,
          };
        });

        setIndustryData(transformedIndustry.sort((a, b) => b.employed - a.employed));

        // Fetch occupation data
        const occupationResponse = await getOccupationData();
        const occupationParsed = parseJsonStat(occupationResponse);

        const occupations = occupationParsed.dimensions['Ammattiryhmä'] || [];
        const occDataKeys = occupationParsed.dimensions['Tiedot'] || [];

        const transformedOccupation: OccupationDataPoint[] = occupations
          .slice(0, 20) // Take first 20 occupation groups
          .map((occCode, occIndex) => {
            const occLabel = occupationParsed.labels['Ammattiryhmä']?.[occCode] || occCode;

            let unemployed = 0;
            let openPositions = 0;

            occDataKeys.forEach((key, keyIndex) => {
              const valueIndex = occIndex * occDataKeys.length + keyIndex;
              const value = occupationParsed.values[valueIndex] || 0;

              if (key === 'TYOTTOMATLOPUSSA') unemployed = value;
              if (key === 'AVPAIKATLOPUSSA') openPositions = value;
            });

            return {
              occupation: occLabel.length > 30 ? occLabel.substring(0, 30) + '...' : occLabel,
              unemployed,
              openPositions,
            };
          })
          .filter((d) => d.unemployed > 0 || d.openPositions > 0)
          .filter((d) => !d.occupation.startsWith('SSS'))
          .sort((a, b) => b.unemployed - a.unemployed)
          .slice(0, 15);

        setOccupationData(transformedOccupation);
      } catch (err) {
        console.error('Failed to fetch industry data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  // Calculate total for pie chart
  const totalEmployed = industryData.reduce((sum, d) => sum + d.employed, 0);

  // Prepare pie data
  const pieData = industryData.map((d) => ({
    name: d.industry,
    value: d.employed,
    percent: (d.employed / totalEmployed) * 100,
  }));

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'white',
      border: 'none',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      padding: '12px 16px',
    },
    labelStyle: { color: '#1e293b', fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: '#475569', fontSize: 13 },
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
        <div className="flex items-center gap-3 text-slate-500">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <span>Ladataan toimialatietoja...</span>
        </div>
      </div>
    );
  }

  const exportIndustryData = () => {
    // Export industry data
    const industryRows = industryData.map((d) =>
      `${d.industry};${d.employed};${d.previousYearEmployed};${d.change};${d.changePercent.toFixed(1)}`
    );
    const industryCsv = [
      'Toimiala;Työlliset (1000);Edellisvuosi (1000);Muutos (1000);Muutos (%)',
      ...industryRows
    ].join('\n');

    const blob = new Blob(['\uFEFF' + industryCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'toimialat.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportOccupationData = () => {
    const occRows = occupationData.map((d) =>
      `${d.occupation};${d.unemployed};${d.openPositions}`
    );
    const occCsv = [
      'Ammattiryhmä;Työttömät;Avoimet paikat',
      ...occRows
    ].join('\n');

    const blob = new Blob(['\uFEFF' + occCsv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ammattiryhmät.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Analyysi: Toimialanäkymä</h2>
          <p className="text-sm text-slate-500">Työllisyys ja toimialajakauma</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportIndustryData}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/50 backdrop-blur rounded-xl border border-slate-200/50 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Toimialat
          </button>
          <button
            onClick={exportOccupationData}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/50 backdrop-blur rounded-xl border border-slate-200/50 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Ammatit
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Industry Distribution Pie Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työllisten jakauma toimialoittain</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={120}
                dataKey="value"
                label={({ name, percent }) => (percent ?? 0) > 5 ? `${(name ?? '').substring(0, 15)}...` : ''}
                labelLine={false}
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                {...tooltipStyle}
                formatter={(value, name) => [
                  `${(value as number).toFixed(0)} tuhatta (${(((value as number) / totalEmployed) * 100).toFixed(1)}%)`,
                  name as string,
                ]}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '11px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Year-over-Year Change */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Vuosimuutos toimialoittain (%)</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart
              data={industryData.slice(0, 10)}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                type="category"
                dataKey="industry"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={120}
              />
              <Tooltip
                {...tooltipStyle}
                formatter={(value) => [`${(value as number).toFixed(1)}%`, 'Muutos']}
              />
              <Bar dataKey="changePercent" name="Vuosimuutos %" radius={[0, 4, 4, 0]}>
                {industryData.slice(0, 10).map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.changePercent >= 0 ? '#10b981' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Employment by Industry Bar Chart - Horizontal for readability */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työlliset toimialoittain (1000 henkilöä)</h3>
          <ResponsiveContainer width="100%" height={Math.max(400, industryData.length * 30)}>
            <BarChart
              data={industryData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                type="category"
                dataKey="industry"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={180}
              />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="employed" name="Työlliset" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Occupation Data */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työttömät ja avoimet paikat ammattiryhmittäin</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart
              data={occupationData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
              <YAxis
                type="category"
                dataKey="occupation"
                tick={{ fontSize: 11, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={160}
              />
              <Tooltip {...tooltipStyle} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Bar dataKey="unemployed" name="Työttömät" fill="#ef4444" radius={[0, 4, 4, 0]} />
              <Bar dataKey="openPositions" name="Avoimet paikat" fill="#10b981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
