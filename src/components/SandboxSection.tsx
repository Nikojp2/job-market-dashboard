import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { toPng } from 'html-to-image';
import { FilterSelect } from './FilterSelect';
import { DataTable } from './DataTable';
import { REGION_COLORS } from '../constants/colors';
import {
  getTableMetadata,
  getDatasetTables,
  queryTable,
  parseJsonStat,
  DATASETS,
} from '../api/statfin';
import type { PxWebMetadata, PxWebVariable, PxWebRequest, PxWebTableInfo } from '../types';

type VizType = 'line' | 'bar' | 'table';
type ChartMode = 'combined' | 'separate';

interface SandboxResult {
  period: string;
  [key: string]: string | number;
}

type TimeUnit = 'monthly' | 'quarterly' | 'yearly' | 'unknown';

interface DatasetOption {
  value: string;
  label: string;
}

const DATASET_OPTIONS: DatasetOption[] = [
  { value: DATASETS.TYTI, label: 'Työvoimatutkimus' },
  { value: DATASETS.TYONV, label: 'Työnvälitystilasto' },
];

// Time period options based on time unit (base options, "Kaikki" is added dynamically)
const TIME_PERIOD_OPTIONS: Record<TimeUnit, { value: number; label: string }[]> = {
  monthly: [
    { value: 12, label: '1v' },
    { value: 24, label: '2v' },
    { value: 36, label: '3v' },
    { value: 60, label: '5v' },
    { value: 120, label: '10v' },
  ],
  quarterly: [
    { value: 4, label: '1v' },
    { value: 8, label: '2v' },
    { value: 12, label: '3v' },
    { value: 20, label: '5v' },
    { value: 40, label: '10v' },
  ],
  yearly: [
    { value: 5, label: '5v' },
    { value: 10, label: '10v' },
    { value: 20, label: '20v' },
  ],
  unknown: [
    { value: 24, label: '24 jaksoa' },
    { value: 48, label: '48 jaksoa' },
  ],
};

// Helper to detect time variables
const isTimeVariable = (code: string): boolean => {
  const timeCodes = ['Kuukausi', 'Vuosineljännes', 'Vuosi', 'Aika', 'Viikko'];
  return timeCodes.some((t) => code.toLowerCase().includes(t.toLowerCase()));
};

export function SandboxSection() {
  const [dataset, setDataset] = useState<string>(DATASETS.TYTI);
  const [tables, setTables] = useState<PxWebTableInfo[]>([]);
  const [tablesLoading, setTablesLoading] = useState(false);
  const [tableId, setTableId] = useState<string>('');
  const [tableMetadata, setTableMetadata] = useState<PxWebMetadata | null>(null);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [periodCount, setPeriodCount] = useState<number>(24);
  const [vizType, setVizType] = useState<VizType>('line');
  const [chartMode, setChartMode] = useState<ChartMode>('combined');
  const [scaleMode, setScaleMode] = useState<'absolute' | 'relative'>('absolute');
  const [results, setResults] = useState<SandboxResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  // Detect time unit from metadata
  const timeVariable = useMemo(() => {
    if (!tableMetadata) return null;
    return tableMetadata.variables.find((v) => isTimeVariable(v.code)) || null;
  }, [tableMetadata]);

  const timeUnit = useMemo((): TimeUnit => {
    if (!timeVariable) return 'unknown';
    const code = timeVariable.code.toLowerCase();
    if (code.includes('kuukausi')) return 'monthly';
    if (code.includes('neljännes') || code.includes('quarter')) return 'quarterly';
    if (code.includes('vuosi') && !code.includes('neljännes')) return 'yearly';
    // Check value format
    if (timeVariable.values.length > 0) {
      const sample = timeVariable.values[0];
      if (sample.includes('M')) return 'monthly';
      if (sample.includes('Q')) return 'quarterly';
      if (/^\d{4}$/.test(sample)) return 'yearly';
    }
    return 'unknown';
  }, [timeVariable]);

  const periodOptions = useMemo(() => {
    const baseOptions = TIME_PERIOD_OPTIONS[timeUnit];
    if (timeVariable) {
      const maxPeriods = timeVariable.values.length;
      // Filter to only show options that make sense for available data
      const filtered = baseOptions.filter((o) => o.value <= maxPeriods);
      // Add "Kaikki" option with actual total count
      return [...filtered, { value: maxPeriods, label: 'Kaikki' }];
    }
    return baseOptions;
  }, [timeUnit, timeVariable]);

  // Fetch tables when dataset changes
  useEffect(() => {
    async function fetchTables() {
      setTablesLoading(true);
      setError(null);
      try {
        const data = await getDatasetTables(dataset);
        // Filter to only tables (type 't'), not folders
        const tableList = data.filter((item) => item.type === 't');
        setTables(tableList);
        setTableId('');
        setTableMetadata(null);
        setResults([]);
        setHasQueried(false);
      } catch (err) {
        console.error('Failed to fetch tables:', err);
        setError('Taulukkoluettelon haku epäonnistui');
        setTables([]);
      } finally {
        setTablesLoading(false);
      }
    }
    fetchTables();
  }, [dataset]);

  // Fetch metadata when table changes
  useEffect(() => {
    if (!tableId) {
      setTableMetadata(null);
      return;
    }

    async function fetchMetadata() {
      setMetadataLoading(true);
      setError(null);
      try {
        const metadata = await getTableMetadata(dataset, tableId);
        setTableMetadata(metadata);

        // Initialize selections with first value of each variable
        const newSelections: Record<string, string[]> = {};
        metadata.variables.forEach((v) => {
          if (isTimeVariable(v.code)) {
            // Don't pre-select time - we'll use periodCount
          } else if (v.values.length <= 5) {
            // Select first 3 if few options
            newSelections[v.code] = v.values.slice(0, Math.min(3, v.values.length));
          } else {
            // Select first 2 for larger lists
            newSelections[v.code] = v.values.slice(0, 2);
          }
        });
        setSelections(newSelections);
        setResults([]);
        setHasQueried(false);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
        setError('Taulukon metatietojen haku epäonnistui');
        setTableMetadata(null);
      } finally {
        setMetadataLoading(false);
      }
    }
    fetchMetadata();
  }, [dataset, tableId]);

  // Update period count when time unit changes
  useEffect(() => {
    const defaultPeriod = TIME_PERIOD_OPTIONS[timeUnit][1]?.value || TIME_PERIOD_OPTIONS[timeUnit][0]?.value;
    setPeriodCount(defaultPeriod);
  }, [timeUnit]);

  const handleSelectionToggle = (code: string, value: string) => {
    setSelections((prev) => {
      const current = prev[code] || [];
      if (current.includes(value)) {
        if (current.length > 1) {
          return { ...prev, [code]: current.filter((v) => v !== value) };
        }
        return prev;
      } else {
        if (current.length < 5) {
          return { ...prev, [code]: [...current, value] };
        }
        return prev;
      }
    });
  };

  const executeQuery = useCallback(async () => {
    if (!tableMetadata) return;

    setLoading(true);
    setError(null);
    setHasQueried(true);

    try {
      const timeVar = tableMetadata.variables.find((v) => isTimeVariable(v.code));
      const timeDimCode = timeVar?.code || 'Kuukausi';

      const query: PxWebRequest = {
        query: tableMetadata.variables.map((v) => {
          if (isTimeVariable(v.code)) {
            const count = Math.min(periodCount, v.values.length);
            return {
              code: v.code,
              selection: { filter: 'top', values: [String(count)] },
            };
          }
          const selected = selections[v.code] || v.values.slice(0, 1);
          return {
            code: v.code,
            selection: { filter: 'item', values: selected },
          };
        }),
        response: { format: 'json-stat2' },
      };

      const response = await queryTable(dataset, tableId, query);
      const parsed = parseJsonStat(response);
      const periods = parsed.dimensions[timeDimCode] || [];
      const otherDims = Object.keys(parsed.dimensions).filter((d) => d !== timeDimCode);

      const transformed: SandboxResult[] = [];

      if (otherDims.length === 0) {
        periods.forEach((period, pIdx) => {
          transformed.push({ period, value: parsed.values[pIdx] ?? 0 });
        });
      } else if (otherDims.length === 1) {
        const dimValues = parsed.dimensions[otherDims[0]];
        periods.forEach((period, pIdx) => {
          const row: SandboxResult = { period };
          dimValues.forEach((val, vIdx) => {
            const valueIndex = pIdx * dimValues.length + vIdx;
            const label = parsed.labels[otherDims[0]]?.[val] || val;
            row[label] = parsed.values[valueIndex] ?? 0;
          });
          transformed.push(row);
        });
      } else if (otherDims.length === 2) {
        const dim1Values = parsed.dimensions[otherDims[0]];
        const dim2Values = parsed.dimensions[otherDims[1]];
        periods.forEach((period, pIdx) => {
          const row: SandboxResult = { period };
          dim1Values.forEach((v1, i1) => {
            dim2Values.forEach((v2, i2) => {
              const valueIndex = pIdx * (dim1Values.length * dim2Values.length) + i1 * dim2Values.length + i2;
              const label1 = parsed.labels[otherDims[0]]?.[v1] || v1;
              const label2 = parsed.labels[otherDims[1]]?.[v2] || v2;
              const key = dim1Values.length > 1 ? `${label2} (${label1})` : label2;
              row[key] = parsed.values[valueIndex] ?? 0;
            });
          });
          transformed.push(row);
        });
      } else {
        // 3+ dimensions - flatten to key combinations
        const buildKey = (indices: number[], dims: string[]): string => {
          return dims.map((d, i) => {
            const val = parsed.dimensions[d][indices[i]];
            return parsed.labels[d]?.[val] || val;
          }).join(' / ');
        };

        const dimSizes = otherDims.map((d) => parsed.dimensions[d].length);
        periods.forEach((period, pIdx) => {
          const row: SandboxResult = { period };
          const totalCombos = dimSizes.reduce((a, b) => a * b, 1);
          for (let combo = 0; combo < totalCombos; combo++) {
            const indices: number[] = [];
            let remaining = combo;
            for (let d = otherDims.length - 1; d >= 0; d--) {
              indices.unshift(remaining % dimSizes[d]);
              remaining = Math.floor(remaining / dimSizes[d]);
            }
            const valueIndex = pIdx * totalCombos + combo;
            const key = buildKey(indices, otherDims);
            row[key] = parsed.values[valueIndex] ?? 0;
          }
          transformed.push(row);
        });
      }

      setResults(transformed);
    } catch (err) {
      console.error('Query failed:', err);
      setError('Tietojen haku epäonnistui. Tarkista valinnat ja yritä uudelleen.');
    } finally {
      setLoading(false);
    }
  }, [tableMetadata, selections, periodCount, dataset, tableId]);

  const exportCsv = () => {
    if (results.length === 0) return;
    const columns = Object.keys(results[0]);
    const header = columns.join(';');
    const rows = results.map((row) => columns.map((col) => row[col]).join(';'));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'hiekkalaatikko_tulokset.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveAsImage = async () => {
    if (!chartContainerRef.current || results.length === 0 || vizType === 'table') return;

    try {
      const dataUrl = await toPng(chartContainerRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = 'hiekkalaatikko_kaavio.png';
      a.click();
    } catch (err) {
      console.error('Failed to save image:', err);
    }
  };

  const dataKeys = useMemo(() => {
    if (results.length === 0) return [];
    return Object.keys(results[0]).filter((k) => k !== 'period');
  }, [results]);

  // Calculate Y-axis domain based on scale mode
  const yAxisDomain = useMemo(() => {
    if (results.length === 0 || dataKeys.length === 0) {
      return scaleMode === 'absolute' ? [0, 'auto'] : undefined;
    }

    // Find min and max values across all data keys
    let min = Infinity;
    let max = -Infinity;

    results.forEach((row) => {
      dataKeys.forEach((key) => {
        const value = row[key];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) {
      return scaleMode === 'absolute' ? [0, 'auto'] : undefined;
    }

    if (scaleMode === 'absolute') {
      // Zero-based: start from 0
      const niceMax = Math.ceil(max * 1.1);
      return [0, niceMax] as [number, number];
    }

    // Relative mode: focus on data range
    const range = max - min;
    const padding = range * 0.15;
    const niceMin = Math.max(0, Math.floor((min - padding) / 10) * 10);
    const niceMax = Math.ceil((max + padding) / 10) * 10;

    return [niceMin, niceMax] as [number, number];
  }, [results, dataKeys, scaleMode]);

  const formatPeriod = (value: unknown) => {
    if (typeof value !== 'string') return String(value);
    if (value.includes('M')) {
      const [year, month] = value.split('M');
      return `${month}/${year.slice(2)}`;
    }
    if (value.includes('Q')) {
      const [year, quarter] = value.split('Q');
      return `Q${quarter}/${year.slice(2)}`;
    }
    return value;
  };

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: 'white',
      border: 'none',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      padding: '12px 16px',
    },
    labelStyle: { color: '#1e293b', fontWeight: 600, marginBottom: 4 },
    itemStyle: { color: '#475569', fontSize: 13 },
  };

  const renderVariableSelector = (variable: PxWebVariable) => {
    const selected = selections[variable.code] || [];
    const isLargeList = variable.values.length > 10;

    return (
      <div key={variable.code} className="mb-4">
        <label className="block text-xs font-medium text-slate-500 mb-1">
          {variable.text} ({selected.length}/{variable.values.length})
        </label>
        {isLargeList ? (
          <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg p-2">
            <div className="flex flex-wrap gap-1">
              {variable.values.slice(0, 50).map((val, idx) => {
                const isSelected = selected.includes(val);
                return (
                  <button
                    key={val}
                    onClick={() => handleSelectionToggle(variable.code, val)}
                    className={`px-2 py-0.5 text-xs rounded transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                    title={variable.valueTexts[idx]}
                  >
                    {variable.valueTexts[idx]?.slice(0, 25) || val}
                  </button>
                );
              })}
              {variable.values.length > 50 && (
                <span className="text-xs text-slate-400 px-2">+{variable.values.length - 50} lisää</span>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1">
            {variable.values.map((val, idx) => {
              const isSelected = selected.includes(val);
              return (
                <button
                  key={val}
                  onClick={() => handleSelectionToggle(variable.code, val)}
                  className={`px-2 py-1 text-xs rounded-md transition-all ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {variable.valueTexts[idx]?.slice(0, 30) || val}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderCharts = () => {
    if (results.length === 0) return null;

    if (vizType === 'table') {
      const columns = [
        { key: 'period', label: 'Aikajakso' },
        ...dataKeys.map((k) => ({ key: k, label: k })),
      ];
      return <DataTable data={results} columns={columns} />;
    }

    if (chartMode === 'separate' && dataKeys.length > 1) {
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dataKeys.map((key, idx) => (
            <div key={key} className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-4 truncate" title={key}>{key}</h4>
              <ResponsiveContainer width="100%" height={250}>
                {vizType === 'line' ? (
                  <LineChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={yAxisDomain} />
                    <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
                    <Line type="monotone" dataKey={key} stroke={REGION_COLORS[idx % REGION_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }} />
                  </LineChart>
                ) : (
                  <BarChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={yAxisDomain} />
                    <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
                    <Bar dataKey={key} fill={REGION_COLORS[idx % REGION_COLORS.length]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={350}>
        {vizType === 'line' ? (
          <LineChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={yAxisDomain} />
            <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
            {dataKeys.map((key, idx) => (
              <Line key={key} type="monotone" dataKey={key} name={key} stroke={REGION_COLORS[idx % REGION_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} domain={yAxisDomain} />
            <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
            {dataKeys.map((key, idx) => (
              <Bar key={key} dataKey={key} name={key} fill={REGION_COLORS[idx % REGION_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  const tableOptions = useMemo(() => {
    return tables.map((t) => ({
      value: t.id,
      label: t.text,
    }));
  }, [tables]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Hiekkalaatikko</h2>
        <p className="text-sm text-slate-500">Räätälöi omat kyselysi Tilastokeskuksen tietokantoihin</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {/* Dataset and Table Selection */}
        <div className="flex flex-wrap gap-4 mb-6">
          <FilterSelect
            label="Tietokanta"
            value={dataset}
            options={DATASET_OPTIONS}
            onChange={(val) => setDataset(val)}
          />
          <div className="flex-1 min-w-64">
            <label className="block text-xs font-medium text-slate-500 mb-1">Taulukko</label>
            {tablesLoading ? (
              <div className="flex items-center gap-2 text-slate-500 py-2">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Ladataan taulukoita...</span>
              </div>
            ) : (
              <select
                value={tableId}
                onChange={(e) => setTableId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Valitse taulukko... ({tables.length} taulukkoa)</option>
                {tableOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Loading indicator for metadata */}
        {metadataLoading && (
          <div className="flex items-center gap-3 text-slate-500 py-4">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span>Ladataan taulukon tietoja...</span>
          </div>
        )}

        {/* Table metadata and filters */}
        {tableMetadata && !metadataLoading && (
          <>
            <div className="border-t border-slate-100 pt-4 mb-6">
              <h3 className="text-sm font-medium text-slate-700 mb-1">{tableMetadata.title}</h3>
              <p className="text-xs text-slate-500 mb-4">
                {tableMetadata.variables.length} muuttujaa
                {timeVariable && ` · ${timeVariable.values.length} aikajaksoa`}
              </p>

              {/* Time period selector */}
              <div className="mb-4">
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Aikajakso ({timeUnit === 'monthly' ? 'kuukaudet' : timeUnit === 'quarterly' ? 'neljännekset' : timeUnit === 'yearly' ? 'vuodet' : 'jaksot'})
                </label>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                  {periodOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPeriodCount(opt.value)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        periodCount === opt.value ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Variable selectors */}
              <h4 className="text-xs font-medium text-slate-500 mb-3">Muuttujat</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tableMetadata.variables
                  .filter((v) => !isTimeVariable(v.code))
                  .map((v) => renderVariableSelector(v))}
              </div>
            </div>
          </>
        )}

        {/* Visualization Type */}
        {tableMetadata && (
          <div className="border-t border-slate-100 pt-4 mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Visualisointi</h3>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                {[
                  { key: 'line' as VizType, label: 'Viiva', icon: '📈' },
                  { key: 'bar' as VizType, label: 'Pylväs', icon: '📊' },
                  { key: 'table' as VizType, label: 'Taulukko', icon: '📋' },
                ].map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setVizType(v.key)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      vizType === v.key ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
              {vizType !== 'table' && dataKeys.length > 1 && (
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setChartMode('combined')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      chartMode === 'combined' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Yhdistetty
                  </button>
                  <button
                    onClick={() => setChartMode('separate')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      chartMode === 'separate' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Erilliset
                  </button>
                </div>
              )}
              {vizType !== 'table' && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      onClick={() => setScaleMode('absolute')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        scaleMode === 'absolute' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Absoluuttinen
                    </button>
                    <button
                      onClick={() => setScaleMode('relative')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        scaleMode === 'relative' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      Suhteellinen
                    </button>
                  </div>
                  <div className="relative group">
                    <button className="p-1 text-slate-400 hover:text-slate-600 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                      <p className="font-semibold mb-2">Skaalausvalinnat:</p>
                      <p className="mb-2"><span className="font-medium">Absoluuttinen:</span> Y-akseli alkaa nollasta. Näyttää arvojen todelliset suhteet, mutta pienet muutokset voivat olla vaikeita havaita.</p>
                      <p><span className="font-medium">Suhteellinen:</span> Y-akseli mukautuu datan vaihteluväliin. Korostaa muutoksia ja trendejä, mutta voi liioitella pieniä eroja.</p>
                      <div className="absolute -top-1 right-3 w-2 h-2 bg-slate-800 rotate-45"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={executeQuery}
            disabled={loading || !tableMetadata}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Haetaan...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Hae tiedot
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">{error}</div>
      )}

      {hasQueried && !loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-slate-800">Tulokset</h3>
              <span className="text-sm text-slate-500">{results.length} riviä</span>
            </div>
            {results.length > 0 && (
              <div className="flex gap-2">
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </button>
                {vizType !== 'table' && (
                  <button
                    onClick={saveAsImage}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    PNG
                  </button>
                )}
              </div>
            )}
          </div>
          <div ref={chartContainerRef}>
            {results.length > 0 ? renderCharts() : (
              <p className="text-slate-500 text-center py-8">Ei tuloksia valituilla suodattimilla</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
