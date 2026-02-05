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
  ReferenceLine,
} from 'recharts';

interface DataPoint {
  period: string;
  [key: string]: string | number;
}

interface YoYConfig {
  dataKey: string;
  name: string;
  color: string;
  isRate: boolean; // If true, show percentage point change; if false, show % change
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
  yoyConfig?: { dataKey: string; title: string; unit: string; isRate: boolean }; // Single line YoY (backward compatible)
  yoyConfigs?: { // Multi-line YoY
    title: string;
    unit: string;
    lines: YoYConfig[];
  };
}

export function EmploymentChart({
  data,
  title,
  lines,
  yAxisLabel,
  yoyConfig,
  yoyConfigs,
}: EmploymentChartProps) {
  const [scaleMode, setScaleMode] = useState<'absolute' | 'relative'>('absolute');
  const [showYoY, setShowYoY] = useState(false);

  // Determine if we have YoY capability (either single or multi)
  const hasYoYCapability = yoyConfig || yoyConfigs;
  const hasEnoughDataForYoY = hasYoYCapability && data.length >= 13;
  const isYoYMode = showYoY && hasEnoughDataForYoY;

  // Calculate YoY data for single-line mode
  const singleYoyData = useMemo(() => {
    if (!yoyConfig || data.length < 13) return [];

    return data
      .slice(12)
      .map((current, index) => {
        const yearAgo = data[index];
        const currentVal = current[yoyConfig.dataKey];
        const yearAgoVal = yearAgo[yoyConfig.dataKey];

        if (typeof currentVal !== 'number' || typeof yearAgoVal !== 'number') {
          return { period: current.period, yoyValue: 0 };
        }

        let yoyValue: number;
        if (yoyConfig.isRate) {
          yoyValue = currentVal - yearAgoVal;
        } else {
          yoyValue = yearAgoVal === 0 ? 0 : ((currentVal - yearAgoVal) / yearAgoVal) * 100;
        }

        return { period: current.period, yoyValue };
      });
  }, [data, yoyConfig]);

  // Calculate YoY data for multi-line mode
  const multiYoyData = useMemo(() => {
    if (!yoyConfigs || data.length < 13) return [];

    return data
      .slice(12)
      .map((current, index) => {
        const yearAgo = data[index];
        const result: DataPoint = { period: current.period };

        yoyConfigs.lines.forEach((config) => {
          const currentVal = current[config.dataKey];
          const yearAgoVal = yearAgo[config.dataKey];

          if (typeof currentVal !== 'number' || typeof yearAgoVal !== 'number') {
            result[`yoy_${config.dataKey}`] = 0;
            return;
          }

          if (config.isRate) {
            result[`yoy_${config.dataKey}`] = currentVal - yearAgoVal;
          } else {
            result[`yoy_${config.dataKey}`] = yearAgoVal === 0 ? 0 : ((currentVal - yearAgoVal) / yearAgoVal) * 100;
          }
        });

        return result;
      });
  }, [data, yoyConfigs]);

  // Determine display data and configuration based on mode
  const displayData = isYoYMode
    ? (yoyConfigs ? multiYoyData : singleYoyData)
    : data;

  const displayTitle = isYoYMode
    ? (yoyConfigs?.title || yoyConfig?.title || title)
    : title;

  const displayYAxisLabel = isYoYMode
    ? (yoyConfigs?.unit || yoyConfig?.unit || yAxisLabel)
    : yAxisLabel;

  // Lines to display
  const displayLines = useMemo(() => {
    if (isYoYMode) {
      if (yoyConfigs) {
        return yoyConfigs.lines.map((config) => ({
          dataKey: `yoy_${config.dataKey}`,
          color: config.color,
          name: config.name,
          dashed: false,
        }));
      }
      return [{ dataKey: 'yoyValue', color: lines[0]?.color || '#3b82f6', name: `Muutos ${yoyConfig?.unit}`, dashed: false }];
    }
    return lines.map((line) => ({ ...line, dashed: line.dashed ?? false }));
  }, [isYoYMode, yoyConfigs, yoyConfig, lines]);

  // Helper function to calculate "nice" round numbers for axis bounds
  const getNiceNumber = (value: number, roundUp: boolean): number => {
    if (value === 0) return 0;
    const exponent = Math.floor(Math.log10(Math.abs(value) || 1));
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

  // Calculate the Y-axis domain based on scale mode
  const yAxisDomain = useMemo((): [number, number] | undefined => {
    let min = Infinity;
    let max = -Infinity;

    displayData.forEach((point) => {
      displayLines.forEach((line) => {
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
        return [-niceMax, niceMax] as [number, number];
      }
      // All positive or all negative - use nice bounds
      const range = max - min;
      const padding = range * 0.1;
      const niceMin = min >= 0 ? 0 : -getNiceNumber(Math.abs(min - padding), true);
      const niceMax = max <= 0 ? 0 : getNiceNumber(max + padding, true);
      return [niceMin, niceMax] as [number, number];
    }

    if (scaleMode === 'absolute') {
      const niceMax = Math.ceil(max * 1.1);
      return [0, niceMax] as [number, number];
    }

    const range = max - min;
    const padding = range * 0.15;
    const niceMin = Math.max(0, Math.floor((min - padding) / 10) * 10);
    const niceMax = Math.ceil((max + padding) / 10) * 10;

    return [niceMin, niceMax] as [number, number];
  }, [displayData, displayLines, scaleMode, isYoYMode]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-800">{displayTitle}</h3>
        <div className="flex items-center gap-2">
          {/* YoY Toggle */}
          {hasYoYCapability && (
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
                disabled={!hasEnoughDataForYoY}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  showYoY && hasEnoughDataForYoY
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                } ${!hasEnoughDataForYoY ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={!hasEnoughDataForYoY ? 'Vähintään 13 kuukautta dataa vaaditaan' : undefined}
              >
                Vuosimuutos
              </button>
            </div>
          )}
          {/* Scale Toggle - only show when not in YoY mode */}
          {!isYoYMode && (
            <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg">
              <button
                onClick={() => setScaleMode('absolute')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  scaleMode === 'absolute'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Absoluuttinen
              </button>
              <button
                onClick={() => setScaleMode('relative')}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                  scaleMode === 'relative'
                    ? 'bg-white text-slate-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Suhteellinen
              </button>
            </div>
          )}
          <div className="relative group">
            <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
              {hasYoYCapability && (
                <>
                  <p className="font-semibold mb-2">Näyttövalinnat:</p>
                  <p className="mb-2"><span className="font-medium">Arvo:</span> Näyttää alkuperäiset arvot.</p>
                  <p className="mb-3"><span className="font-medium">Vuosimuutos:</span> Näyttää muutoksen verrattuna saman kuukauden arvoon edelliseltä vuodelta.</p>
                </>
              )}
              <p className="font-semibold mb-2">Skaalausvalinnat:</p>
              <p className="mb-2"><span className="font-medium">Absoluuttinen:</span> Y-akseli alkaa nollasta.</p>
              <p><span className="font-medium">Suhteellinen:</span> Y-akseli mukautuu datan vaihteluväliin.</p>
              <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-800 rotate-45"></div>
            </div>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={displayData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <defs>
            {displayLines.map((line) => (
              <linearGradient key={`gradient-${line.dataKey}`} id={`gradient-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={line.color} stopOpacity={0.1}/>
                <stop offset="95%" stopColor={line.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          {isYoYMode && (
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
          )}
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
              displayYAxisLabel
                ? { value: displayYAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }
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
            formatter={isYoYMode ? (value: number | string | (number | string)[] | undefined) => {
              if (value === undefined || typeof value !== 'number') return [''];
              const sign = value >= 0 ? '+' : '';
              const unit = yoyConfigs?.unit || yoyConfig?.unit || '';
              return [`${sign}${value.toFixed(2)} ${unit}`];
            } : undefined}
          />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            iconType="circle"
            iconSize={8}
          />
          {displayLines.map((line) => (
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
