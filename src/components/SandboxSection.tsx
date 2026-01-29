import { useState, useEffect, useMemo } from 'react';
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
import { FilterSelect } from './FilterSelect';
import { DataTable } from './DataTable';
import { REGION_COLORS } from '../constants/colors';
import {
  SANDBOX_TABLES,
  querySandbox,
  parseJsonStat,
  type SandboxTableConfig,
} from '../api/statfin';

type VizType = 'line' | 'bar' | 'table';
type ChartMode = 'combined' | 'separate';

interface SandboxResult {
  period: string;
  [key: string]: string | number;
}

export function SandboxSection() {
  const [datasetKey, setDatasetKey] = useState<string>('tyti');
  const [tableId, setTableId] = useState<string>('');
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [yearRange, setYearRange] = useState<number>(2);
  const [vizType, setVizType] = useState<VizType>('line');
  const [chartMode, setChartMode] = useState<ChartMode>('combined');
  const [results, setResults] = useState<SandboxResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  // Get current dataset and table config
  const currentDataset = SANDBOX_TABLES[datasetKey];
  const currentTable = useMemo(() => {
    return currentDataset?.tables.find((t) => t.id === tableId) || null;
  }, [currentDataset, tableId]);

  // Initialize table and selections when dataset changes
  useEffect(() => {
    if (currentDataset?.tables.length > 0) {
      const firstTable = currentDataset.tables[0];
      setTableId(firstTable.id);
      initializeSelections(firstTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKey]);

  // Initialize selections when table changes
  useEffect(() => {
    if (currentTable) {
      initializeSelections(currentTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId]);

  const initializeSelections = (table: SandboxTableConfig) => {
    const newSelections: Record<string, string | string[]> = {};
    table.dimensions.forEach((dim) => {
      if (dim.type === 'time') return; // Time is handled by yearRange
      if (dim.type === 'single' && dim.options) {
        newSelections[dim.code] = dim.options[0].value;
      } else if (dim.type === 'multi' && dim.options) {
        // Default to first two options for multi-select
        newSelections[dim.code] = dim.options.slice(0, 2).map((o) => o.value);
      }
    });
    setSelections(newSelections);
    setResults([]);
    setHasQueried(false);
    setError(null);
  };

  const handleSelectionChange = (code: string, value: string | string[]) => {
    setSelections((prev) => ({ ...prev, [code]: value }));
  };

  const handleMultiToggle = (code: string, value: string) => {
    setSelections((prev) => {
      const current = prev[code];
      const currentArray = Array.isArray(current) ? current : [current];

      if (currentArray.includes(value)) {
        // Remove (but keep at least one)
        if (currentArray.length > 1) {
          return { ...prev, [code]: currentArray.filter((v) => v !== value) };
        }
        return prev;
      } else {
        // Add (max 5)
        if (currentArray.length < 5) {
          return { ...prev, [code]: [...currentArray, value] };
        }
        return prev;
      }
    });
  };

  const executeQuery = async () => {
    if (!currentTable) return;

    setLoading(true);
    setError(null);
    setHasQueried(true);

    try {
      const response = await querySandbox(currentTable, selections, yearRange);
      const parsed = parseJsonStat(response);

      // Get dimensions in order
      const timeDim = currentTable.timeDimension;
      const periods = parsed.dimensions[timeDim] || [];
      const otherDims = Object.keys(parsed.dimensions).filter((d) => d !== timeDim);

      // Build result data
      const transformed: SandboxResult[] = [];

      if (otherDims.length === 1) {
        // Simple case: time × one dimension (e.g., time × metrics)
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
        // Two dimensions: time × dim1 × dim2
        const dim1Values = parsed.dimensions[otherDims[0]];
        const dim2Values = parsed.dimensions[otherDims[1]];

        periods.forEach((period, pIdx) => {
          const row: SandboxResult = { period };
          dim1Values.forEach((v1, i1) => {
            dim2Values.forEach((v2, i2) => {
              const valueIndex = pIdx * (dim1Values.length * dim2Values.length)
                + i1 * dim2Values.length + i2;
              const label1 = parsed.labels[otherDims[0]]?.[v1] || v1;
              const label2 = parsed.labels[otherDims[1]]?.[v2] || v2;
              const key = dim1Values.length > 1 ? `${label2} (${label1})` : label2;
              row[key] = parsed.values[valueIndex] ?? 0;
            });
          });
          transformed.push(row);
        });
      } else {
        // Fallback for single dimension (just time)
        periods.forEach((period, pIdx) => {
          const row: SandboxResult = { period, value: parsed.values[pIdx] ?? 0 };
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
  };

  const exportCsv = () => {
    if (results.length === 0) return;

    const columns = Object.keys(results[0]);
    const header = columns.join(';');
    const rows = results.map((row) =>
      columns.map((col) => row[col]).join(';')
    );
    const csv = [header, ...rows].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sandbox_tulokset.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Get data keys for charts (excluding 'period')
  const dataKeys = useMemo(() => {
    if (results.length === 0) return [];
    return Object.keys(results[0]).filter((k) => k !== 'period');
  }, [results]);

  // Format period for display
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

  // Render chart(s)
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
      // Separate charts for each metric
      return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {dataKeys.map((key, idx) => (
            <div key={key} className="bg-slate-50 rounded-xl p-4">
              <h4 className="text-sm font-medium text-slate-700 mb-4">{key}</h4>
              <ResponsiveContainer width="100%" height={250}>
                {vizType === 'line' ? (
                  <LineChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
                    <Line
                      type="monotone"
                      dataKey={key}
                      stroke={REGION_COLORS[idx % REGION_COLORS.length]}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
                    />
                  </LineChart>
                ) : (
                  <BarChart data={results}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
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

    // Combined chart
    return (
      <ResponsiveContainer width="100%" height={350}>
        {vizType === 'line' ? (
          <LineChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
            {dataKeys.map((key, idx) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                name={key}
                stroke={REGION_COLORS[idx % REGION_COLORS.length]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }}
              />
            ))}
          </LineChart>
        ) : (
          <BarChart data={results}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} tickFormatter={formatPeriod} />
            <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: 16 }} />
            {dataKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                name={key}
                fill={REGION_COLORS[idx % REGION_COLORS.length]}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800">Sandbox: Räätälöity haku</h2>
        <p className="text-sm text-slate-500">Valitse tietokanta, taulukko ja suodattimet</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {/* Dataset and Table Selection */}
        <div className="flex flex-wrap gap-4 mb-6">
          <FilterSelect
            label="Tietokanta"
            value={datasetKey}
            options={Object.entries(SANDBOX_TABLES).map(([key, val]) => ({
              value: key,
              label: val.label,
            }))}
            onChange={setDatasetKey}
          />
          {currentDataset && (
            <FilterSelect
              label="Taulukko"
              value={tableId}
              options={currentDataset.tables.map((t) => ({
                value: t.id,
                label: t.label,
              }))}
              onChange={setTableId}
            />
          )}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Aikajakso</label>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {[1, 2, 3, 5].map((y) => (
                <button
                  key={y}
                  onClick={() => setYearRange(y)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    yearRange === y
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {y}v
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table description */}
        {currentTable && (
          <p className="text-sm text-slate-500 mb-4">{currentTable.description}</p>
        )}

        {/* Dynamic Filters */}
        {currentTable && (
          <div className="border-t border-slate-100 pt-4 mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-3">Suodattimet</h3>
            <div className="flex flex-wrap gap-4">
              {currentTable.dimensions
                .filter((d) => d.type !== 'time' && d.options)
                .map((dim) => (
                  <div key={dim.code}>
                    {dim.type === 'single' ? (
                      <FilterSelect
                        label={dim.label}
                        value={(selections[dim.code] as string) || ''}
                        options={dim.options!}
                        onChange={(val) => handleSelectionChange(dim.code, val)}
                      />
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-500 mb-1">
                          {dim.label}
                        </label>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {dim.options!.slice(0, 8).map((opt) => {
                            const selected = Array.isArray(selections[dim.code])
                              ? (selections[dim.code] as string[]).includes(opt.value)
                              : selections[dim.code] === opt.value;
                            return (
                              <button
                                key={opt.value}
                                onClick={() => handleMultiToggle(dim.code, opt.value)}
                                className={`px-2 py-1 text-xs rounded-md transition-all ${
                                  selected
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {opt.label.length > 20 ? opt.label.slice(0, 20) + '...' : opt.label}
                              </button>
                            );
                          })}
                        </div>
                        {dim.options!.length > 8 && (
                          <p className="text-xs text-slate-400 mt-1">
                            +{dim.options!.length - 8} muuta vaihtoehtoa
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Visualization Type */}
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
                    vizType === v.key
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
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
                    chartMode === 'combined'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Yhdistetty
                </button>
                <button
                  onClick={() => setChartMode('separate')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    chartMode === 'separate'
                      ? 'bg-white text-slate-700 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Erilliset
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={executeQuery}
            disabled={loading || !currentTable}
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
          {results.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              CSV
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">
          {error}
        </div>
      )}

      {hasQueried && !loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Tulokset</h3>
            <span className="text-sm text-slate-500">{results.length} riviä</span>
          </div>
          {results.length > 0 ? (
            renderCharts()
          ) : (
            <p className="text-slate-500 text-center py-8">Ei tuloksia valituilla suodattimilla</p>
          )}
        </div>
      )}
    </div>
  );
}
