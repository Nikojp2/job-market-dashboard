import { useEffect, useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { MultiRegionSelect } from './MultiRegionSelect';
import { REGION_COLORS } from '../constants/colors';
import {
  getMultiRegionQuarterlyData,
  getMultiRegionOpenPositionsTrend,
  parseJsonStat,
  REGION_OPTIONS,
} from '../api/statfin';

interface MultiRegionTrendData {
  period: string;
  [key: string]: string | number; // Dynamic keys for each region's metrics
}

// Individual chart component with YoY toggle
interface TrendChartProps {
  data: MultiRegionTrendData[];
  title: string;
  yoyTitle: string;
  metricPrefix: string;
  selectedRegions: string[];
  getRegionLabel: (code: string) => string;
  getColorForRegion: (code: string) => string;
  formatPeriod: (value: unknown) => string;
  yAxisLabel?: string;
  yoyUnit: string;
  isRate: boolean; // If true, show pp change; if false, show % change
  periodsBack: number; // 4 for quarterly, 12 for monthly
}

function TrendChart({
  data,
  title,
  yoyTitle,
  metricPrefix,
  selectedRegions,
  getRegionLabel,
  getColorForRegion,
  formatPeriod,
  yAxisLabel,
  yoyUnit,
  isRate,
  periodsBack,
}: TrendChartProps) {
  const [showYoY, setShowYoY] = useState(false);

  const hasEnoughData = data.length > periodsBack;
  const isYoYMode = showYoY && hasEnoughData;

  // Calculate YoY data
  const yoyData = useMemo(() => {
    if (!hasEnoughData) return [];

    return data.slice(periodsBack).map((current, index) => {
      const yearAgo = data[index];
      const result: MultiRegionTrendData = { period: current.period };

      selectedRegions.forEach((regionCode) => {
        const currentKey = `${metricPrefix}_${regionCode}`;
        const yoyKey = `${metricPrefix}_yoy_${regionCode}`;
        const currentVal = current[currentKey];
        const yearAgoVal = yearAgo[currentKey];

        if (typeof currentVal === 'number' && typeof yearAgoVal === 'number') {
          if (isRate) {
            // Percentage point change for rates
            result[yoyKey] = currentVal - yearAgoVal;
          } else {
            // Percentage change for counts
            result[yoyKey] = yearAgoVal === 0 ? 0 : ((currentVal - yearAgoVal) / yearAgoVal) * 100;
          }
        } else {
          result[yoyKey] = 0;
        }
      });

      return result;
    });
  }, [data, selectedRegions, metricPrefix, isRate, periodsBack, hasEnoughData]);

  const displayData = isYoYMode ? yoyData : data;
  const displayTitle = isYoYMode ? yoyTitle : title;

  // Generate lines for current mode
  const lines = selectedRegions.map((regionCode) => ({
    dataKey: isYoYMode ? `${metricPrefix}_yoy_${regionCode}` : `${metricPrefix}_${regionCode}`,
    color: getColorForRegion(regionCode),
    name: selectedRegions.length > 1
      ? `${isYoYMode ? `Muutos ${yoyUnit}` : title.split(' ')[0]} (${getRegionLabel(regionCode)})`
      : isYoYMode ? `Muutos ${yoyUnit}` : title.split(' ')[0],
  }));

  // Helper function to calculate "nice" round numbers for axis bounds
  const getNiceNumber = (value: number, roundUp: boolean): number => {
    if (value === 0) return 0;
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const fraction = value / Math.pow(10, exponent);
    let niceFraction: number;

    if (roundUp) {
      if (fraction <= 1) niceFraction = 1;
      else if (fraction <= 2) niceFraction = 2;
      else if (fraction <= 5) niceFraction = 5;
      else niceFraction = 10;
    } else {
      if (fraction < 1.5) niceFraction = 1;
      else if (fraction < 3) niceFraction = 2;
      else if (fraction < 7) niceFraction = 5;
      else niceFraction = 10;
    }

    return niceFraction * Math.pow(10, exponent);
  };

  // Calculate Y-axis domain
  const yAxisDomain = useMemo((): [number, number] | undefined => {
    let min = Infinity;
    let max = -Infinity;

    displayData.forEach((point) => {
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

    // In YoY mode, use nice round numbers for better readability
    if (isYoYMode) {
      // If data crosses zero, make symmetric around zero
      if (min < 0 && max > 0) {
        const absMax = Math.max(Math.abs(min), Math.abs(max));
        const niceMax = getNiceNumber(absMax * 1.1, true);
        return [-niceMax, niceMax];
      }
      // All positive or all negative - use nice bounds
      const range = max - min;
      const padding = range * 0.1;
      const niceMin = min >= 0 ? 0 : -getNiceNumber(Math.abs(min - padding), true);
      const niceMax = max <= 0 ? 0 : getNiceNumber(max + padding, true);
      return [niceMin, niceMax];
    }

    return ['auto', 'auto'] as unknown as [number, number];
  }, [displayData, lines, isYoYMode]);

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-slate-800">{displayTitle}</h3>
        <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
          <button
            onClick={() => setShowYoY(false)}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              !showYoY
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Arvo
          </button>
          <button
            onClick={() => setShowYoY(true)}
            disabled={!hasEnoughData}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              showYoY && hasEnoughData
                ? 'bg-white text-slate-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            } ${!hasEnoughData ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={!hasEnoughData ? 'Vähintään 5 vuosineljännestä dataa vaaditaan' : undefined}
          >
            Vuosimuutos
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={displayData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          {isYoYMode && <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />}
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#e2e8f0' }}
            tickFormatter={formatPeriod}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            domain={yAxisDomain}
            label={
              yAxisLabel || isYoYMode
                ? { value: isYoYMode ? yoyUnit : yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }
                : undefined
            }
          />
          <Tooltip
            {...tooltipStyle}
            labelFormatter={formatPeriod}
            formatter={isYoYMode ? (value: number | string | (number | string)[] | undefined) => {
              if (value === undefined || typeof value !== 'number') return [''];
              const sign = value >= 0 ? '+' : '';
              return [`${sign}${value.toFixed(2)} ${yoyUnit}`];
            } : undefined}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
          {lines.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              name={line.name}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendsSection() {
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['SSS']);
  const [trendData, setTrendData] = useState<MultiRegionTrendData[]>([]);
  const [openPositionsData, setOpenPositionsData] = useState<MultiRegionTrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (selectedRegions.length === 0) {
        setTrendData([]);
        setOpenPositionsData([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Fetch quarterly regional data for all selected regions
        const quarterlyResponse = await getMultiRegionQuarterlyData(selectedRegions);
        const quarterlyParsed = parseJsonStat(quarterlyResponse);

        const quarters = quarterlyParsed.dimensions['Vuosineljännes'] || [];
        const regions = quarterlyParsed.dimensions['Maakunta'] || [];
        const dataKeys = quarterlyParsed.dimensions['Tiedot'] || [];

        // Create a map to store data by period
        const periodMap = new Map<string, MultiRegionTrendData>();

        quarters.forEach((period) => {
          periodMap.set(period, { period });
        });

        // Parse multi-dimensional data
        // Value index = periodIndex * (regions.length * dataKeys.length) + regionIndex * dataKeys.length + dataKeyIndex
        quarters.forEach((period, periodIndex) => {
          const dataPoint = periodMap.get(period)!;

          regions.forEach((regionCode, regionIndex) => {
            dataKeys.forEach((key, keyIndex) => {
              const valueIndex = periodIndex * (regions.length * dataKeys.length) + regionIndex * dataKeys.length + keyIndex;
              const value = quarterlyParsed.values[valueIndex] || 0;

              // Create unique keys per region
              if (key === 'Tyolliset') dataPoint[`employed_${regionCode}`] = value;
              if (key === 'Tyovoima') dataPoint[`labourForce_${regionCode}`] = value;
              if (key === 'Tyottomyysaste') dataPoint[`unemploymentRate_${regionCode}`] = value;
              if (key === 'Tyollisyysaste_15_64') dataPoint[`employmentRate_${regionCode}`] = value;
            });
          });
        });

        const transformedTrend = Array.from(periodMap.values()).slice(-20); // Last 20 quarters
        setTrendData(transformedTrend);

        // Fetch open positions trend for selected regions
        const positionsResponse = await getMultiRegionOpenPositionsTrend(selectedRegions);
        const positionsParsed = parseJsonStat(positionsResponse);

        const months = positionsParsed.dimensions['Kuukausi'] || [];
        const posRegions = positionsParsed.dimensions['Alue'] || [];

        const positionsPeriodMap = new Map<string, MultiRegionTrendData>();
        months.forEach((period) => {
          positionsPeriodMap.set(period, { period });
        });

        months.forEach((period, monthIndex) => {
          const dataPoint = positionsPeriodMap.get(period)!;
          posRegions.forEach((regionCode, regionIndex) => {
            const valueIndex = monthIndex * posRegions.length + regionIndex;
            const value = positionsParsed.values[valueIndex] || 0;
            dataPoint[`openPositions_${regionCode}`] = value;
          });
        });

        const transformedPositions = Array.from(positionsPeriodMap.values()).slice(-24); // Last 24 months
        setOpenPositionsData(transformedPositions);
      } catch (err) {
        console.error('Failed to fetch trends data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [selectedRegions]);

  const formatQuarter = (value: unknown) => {
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

  const getRegionLabel = (regionCode: string) => {
    const option = REGION_OPTIONS.find((o) => o.value === regionCode);
    return option?.label || regionCode;
  };

  const getColorForRegion = (regionCode: string) => {
    const index = selectedRegions.indexOf(regionCode);
    return REGION_COLORS[index % REGION_COLORS.length];
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

  const exportTrendData = () => {
    if (trendData.length === 0 || selectedRegions.length === 0) return;

    // Build header with region names
    const regionLabels = selectedRegions.map(getRegionLabel);
    const headers = ['Vuosineljännes'];
    selectedRegions.forEach((_, i) => {
      headers.push(`Työllisyysaste (${regionLabels[i]})`);
      headers.push(`Työttömyysaste (${regionLabels[i]})`);
      headers.push(`Työlliset (${regionLabels[i]})`);
      headers.push(`Työvoima (${regionLabels[i]})`);
    });

    const rows = trendData.map((d) => {
      const row = [d.period];
      selectedRegions.forEach((regionCode) => {
        row.push(String(d[`employmentRate_${regionCode}`] || ''));
        row.push(String(d[`unemploymentRate_${regionCode}`] || ''));
        row.push(String(d[`employed_${regionCode}`] || ''));
        row.push(String(d[`labourForce_${regionCode}`] || ''));
      });
      return row.join(';');
    });

    const csv = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trendit_aluevertailu.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Trendit: Työmarkkinamittarit</h2>
          <p className="text-sm text-slate-500">Neljännesvuosittainen kehitys - vertaile alueita</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <div className="p-3 bg-white/50 backdrop-blur rounded-xl border border-slate-200/50">
            <MultiRegionSelect
              label="Alueet"
              options={REGION_OPTIONS}
              selected={selectedRegions}
              onChange={setSelectedRegions}
              maxSelections={5}
            />
          </div>
          <button
            onClick={exportTrendData}
            disabled={selectedRegions.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/50 backdrop-blur rounded-xl border border-slate-200/50 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            CSV
          </button>
        </div>
      </div>

      {selectedRegions.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center text-slate-500">
          Valitse vähintään yksi alue nähdäksesi trendit
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Employment Rate Chart */}
          <TrendChart
            data={trendData}
            title="Työllisyysaste (%)"
            yoyTitle="Työllisyysaste - vuosimuutos (pp)"
            metricPrefix="employmentRate"
            selectedRegions={selectedRegions}
            getRegionLabel={getRegionLabel}
            getColorForRegion={getColorForRegion}
            formatPeriod={formatQuarter}
            yAxisLabel="%"
            yoyUnit="pp"
            isRate={true}
            periodsBack={4}
          />

          {/* Unemployment Rate Chart */}
          <TrendChart
            data={trendData}
            title="Työttömyysaste (%)"
            yoyTitle="Työttömyysaste - vuosimuutos (pp)"
            metricPrefix="unemploymentRate"
            selectedRegions={selectedRegions}
            getRegionLabel={getRegionLabel}
            getColorForRegion={getColorForRegion}
            formatPeriod={formatQuarter}
            yAxisLabel="%"
            yoyUnit="pp"
            isRate={true}
            periodsBack={4}
          />

          {/* Employed Count Chart */}
          <TrendChart
            data={trendData}
            title="Työllisten määrä (1000 henkilöä)"
            yoyTitle="Työllisten määrä - vuosimuutos (%)"
            metricPrefix="employed"
            selectedRegions={selectedRegions}
            getRegionLabel={getRegionLabel}
            getColorForRegion={getColorForRegion}
            formatPeriod={formatQuarter}
            yAxisLabel="1000"
            yoyUnit="%"
            isRate={false}
            periodsBack={4}
          />

          {/* Labour Force Chart */}
          <TrendChart
            data={trendData}
            title="Työvoiman määrä (1000 henkilöä)"
            yoyTitle="Työvoiman määrä - vuosimuutos (%)"
            metricPrefix="labourForce"
            selectedRegions={selectedRegions}
            getRegionLabel={getRegionLabel}
            getColorForRegion={getColorForRegion}
            formatPeriod={formatQuarter}
            yAxisLabel="1000"
            yoyUnit="%"
            isRate={false}
            periodsBack={4}
          />

          {/* Open Positions Chart */}
          <div className="lg:col-span-2">
            <TrendChart
              data={openPositionsData}
              title="Avoimet työpaikat (kpl)"
              yoyTitle="Avoimet työpaikat - vuosimuutos (%)"
              metricPrefix="openPositions"
              selectedRegions={selectedRegions}
              getRegionLabel={getRegionLabel}
              getColorForRegion={getColorForRegion}
              formatPeriod={formatMonth}
              yAxisLabel="kpl"
              yoyUnit="%"
              isRate={false}
              periodsBack={12}
            />
          </div>
        </div>
      )}
    </div>
  );
}
