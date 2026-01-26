import { useEffect, useState } from 'react';
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
import { FilterSelect } from './FilterSelect';
import {
  getRegionalQuarterlyData,
  getOpenPositionsTrend,
  parseJsonStat,
  REGION_OPTIONS,
} from '../api/statfin';

interface TrendData {
  period: string;
  employed: number;
  labourForce: number;
  unemploymentRate: number;
  employmentRate: number;
}

interface OpenPositionsData {
  period: string;
  openPositions: number;
}

export function TrendsSection() {
  const [region, setRegion] = useState('SSS');
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [openPositionsData, setOpenPositionsData] = useState<OpenPositionsData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch quarterly regional data
        const quarterlyResponse = await getRegionalQuarterlyData(region);
        const quarterlyParsed = parseJsonStat(quarterlyResponse);

        const quarters = quarterlyParsed.dimensions['Vuosineljännes'] || [];
        const dataKeys = quarterlyParsed.dimensions['Tiedot'] || [];

        const transformedTrend: TrendData[] = quarters.map((period, periodIndex) => {
          const dataPoint: TrendData = {
            period,
            employed: 0,
            labourForce: 0,
            unemploymentRate: 0,
            employmentRate: 0,
          };

          dataKeys.forEach((key, keyIndex) => {
            const valueIndex = periodIndex * dataKeys.length + keyIndex;
            const value = quarterlyParsed.values[valueIndex] || 0;

            if (key === 'Tyolliset') dataPoint.employed = value;
            if (key === 'Tyovoima') dataPoint.labourForce = value;
            if (key === 'Tyottomyysaste') dataPoint.unemploymentRate = value;
            if (key === 'Tyollisyysaste_15_64') dataPoint.employmentRate = value;
          });

          return dataPoint;
        });

        setTrendData(transformedTrend.slice(-20)); // Last 20 quarters (5 years)

        // Fetch open positions trend
        const positionsResponse = await getOpenPositionsTrend(region);
        const positionsParsed = parseJsonStat(positionsResponse);

        const months = positionsParsed.dimensions['Kuukausi'] || [];
        const transformedPositions: OpenPositionsData[] = months.map((period, index) => ({
          period,
          openPositions: positionsParsed.values[index] || 0,
        }));

        setOpenPositionsData(transformedPositions.slice(-24)); // Last 24 months
      } catch (err) {
        console.error('Failed to fetch trends data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [region]);

  const formatQuarter = (value: unknown) => {
    // Format "2024Q3" to "Q3/24"
    if (typeof value !== 'string') return String(value);
    if (value.includes('Q')) {
      const [year, quarter] = value.split('Q');
      return `Q${quarter}/${year.slice(2)}`;
    }
    return value;
  };

  const formatMonth = (value: unknown) => {
    if (typeof value !== 'string') return String(value);
    if (value.includes('M')) {
      const [year, month] = value.split('M');
      return `${month}/${year.slice(2)}`;
    }
    return value;
  };

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
          <span>Ladataan trenditietoja...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Trendit: Työmarkkinamittarit</h2>
          <p className="text-sm text-slate-500">Neljännesvuosittainen kehitys</p>
        </div>
        <div className="p-3 bg-white/50 backdrop-blur rounded-xl border border-slate-200/50">
          <FilterSelect
            label="Alue"
            value={region}
            options={REGION_OPTIONS}
            onChange={setRegion}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employment Rate Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työllisyysaste (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={formatQuarter} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} labelFormatter={formatQuarter} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Line
                type="monotone"
                dataKey="employmentRate"
                stroke="#2563eb"
                name="Työllisyysaste"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Unemployment Rate Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työttömyysaste (%)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={formatQuarter} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
              <Tooltip {...tooltipStyle} labelFormatter={formatQuarter} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Line
                type="monotone"
                dataKey="unemploymentRate"
                stroke="#dc2626"
                name="Työttömyysaste"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Employed Count Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työllisten määrä (1000 henkilöä)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={formatQuarter} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={formatQuarter} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Line
                type="monotone"
                dataKey="employed"
                stroke="#10b981"
                name="Työlliset"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Labour Force Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Työvoiman määrä (1000 henkilöä)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={formatQuarter} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={formatQuarter} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Line
                type="monotone"
                dataKey="labourForce"
                stroke="#7c3aed"
                name="Työvoima"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Open Positions Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md lg:col-span-2">
          <h3 className="text-lg font-semibold text-slate-800 mb-6">Avoimet työpaikat (kpl)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={openPositionsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={formatMonth} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={formatMonth} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
              <Line
                type="monotone"
                dataKey="openPositions"
                stroke="#f59e0b"
                name="Avoimet paikat"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
