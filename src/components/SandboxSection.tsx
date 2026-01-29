import { useState, useEffect, useMemo, useCallback } from 'react';
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
  getTableMetadata,
  queryTable,
  parseJsonStat,
  DATASETS,
  TABLES,
  type SandboxTableConfig,
} from '../api/statfin';
import type { PxWebMetadata, PxWebVariable, PxWebRequest } from '../types';

type VizType = 'line' | 'bar' | 'table';
type ChartMode = 'combined' | 'separate';
type QueryMode = 'simple' | 'advanced';

interface SandboxResult {
  period: string;
  [key: string]: string | number;
}

// Additional tables for advanced mode
const ADVANCED_TABLES = [
  { dataset: DATASETS.TYTI, id: TABLES.KEY_INDICATORS_TREND, label: 'Avainluvut ja trendit (135z)' },
  { dataset: DATASETS.TYTI, id: TABLES.INDUSTRY_EMPLOYMENT, label: 'Toimialoittainen työllisyys (13aq)' },
  { dataset: DATASETS.TYTI, id: TABLES.INDUSTRY_QUARTERLY, label: 'Toimialat neljännesvuosittain (137l)' },
  { dataset: DATASETS.TYONV, id: TABLES.UNEMPLOYMENT_RATE, label: 'Työttömyysaste alueittain (12tf)' },
  { dataset: DATASETS.TYONV, id: TABLES.OPEN_POSITIONS_REGION, label: 'Avoimet paikat alueittain (12tv)' },
  { dataset: DATASETS.TYONV, id: TABLES.OCCUPATION_DATA, label: 'Ammattiryhmittäin (12ti)' },
];

export function SandboxSection() {
  const [datasetKey, setDatasetKey] = useState<string>('tyti');
  const [tableId, setTableId] = useState<string>('');
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [yearRange, setYearRange] = useState<number>(2);
  const [vizType, setVizType] = useState<VizType>('line');
  const [chartMode, setChartMode] = useState<ChartMode>('combined');
  const [queryMode, setQueryMode] = useState<QueryMode>('simple');
  const [results, setResults] = useState<SandboxResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasQueried, setHasQueried] = useState(false);

  // Dynamic metadata for advanced mode
  const [tableMetadata, setTableMetadata] = useState<PxWebMetadata | null>(null);
  const [advancedTableId, setAdvancedTableId] = useState<string>('');
  const [advancedDataset, setAdvancedDataset] = useState<string>(DATASETS.TYTI);

  // Get current dataset and table config (simple mode)
  const currentDataset = SANDBOX_TABLES[datasetKey];
  const currentTable = useMemo(() => {
    return currentDataset?.tables.find((t) => t.id === tableId) || null;
  }, [currentDataset, tableId]);

  // Initialize table and selections when dataset changes (simple mode)
  useEffect(() => {
    if (queryMode === 'simple' && currentDataset?.tables.length > 0) {
      const firstTable = currentDataset.tables[0];
      setTableId(firstTable.id);
      initializeSelections(firstTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasetKey, queryMode]);

  // Initialize selections when table changes (simple mode)
  useEffect(() => {
    if (queryMode === 'simple' && currentTable) {
      initializeSelections(currentTable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableId, queryMode]);

  // Fetch metadata for advanced mode
  useEffect(() => {
    if (queryMode === 'advanced' && advancedTableId && advancedDataset) {
      fetchMetadata(advancedDataset, advancedTableId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [advancedTableId, advancedDataset, queryMode]);

  const fetchMetadata = async (dataset: string, tableId: string) => {
    setMetadataLoading(true);
    setError(null);
    try {
      const metadata = await getTableMetadata(dataset, tableId);
      setTableMetadata(metadata);
      // Initialize selections with first value of each variable
      const newSelections: Record<string, string[]> = {};
      metadata.variables.forEach((v) => {
        if (isTimeVariable(v.code)) {
          // Don't pre-select time - we'll use yearRange
        } else if (v.values.length <= 5) {
          // Select all if few options
          newSelections[v.code] = v.values.slice(0, 3);
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
    } finally {
      setMetadataLoading(false);
    }
  };

  const isTimeVariable = (code: string): boolean => {
    const timeCodes = ['Kuukausi', 'Vuosineljännes', 'Vuosi', 'Aika'];
    return timeCodes.some((t) => code.toLowerCase().includes(t.toLowerCase()));
  };

  const initializeSelections = (table: SandboxTableConfig) => {
    const newSelections: Record<string, string[]> = {};
    table.dimensions.forEach((dim) => {
      if (dim.type === 'time') return;
      if (dim.options) {
        if (dim.type === 'single') {
          newSelections[dim.code] = [dim.options[0].value];
        } else {
          newSelections[dim.code] = dim.options.slice(0, 2).map((o) => o.value);
        }
      }
    });
    setSelections(newSelections);
    setResults([]);
    setHasQueried(false);
    setError(null);
  };

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

  const handleSingleSelect = (code: string, value: string) => {
    setSelections((prev) => ({ ...prev, [code]: [value] }));
  };

  const executeQuery = useCallback(async () => {
    setLoading(true);
    setError(null);
    setHasQueried(true);

    try {
      let response;
      let timeDimCode: string;

      if (queryMode === 'simple' && currentTable) {
        // Simple mode - use predefined config
        timeDimCode = currentTable.timeDimension;
        const query: PxWebRequest = {
          query: currentTable.dimensions.map((dim) => {
            if (dim.type === 'time') {
              const count = dim.code === 'Vuosineljännes' ? yearRange * 4 : yearRange * 12;
              return {
                code: dim.code,
                selection: { filter: 'top', values: [String(count)] },
              };
            }
            const selected = selections[dim.code] || (dim.options ? [dim.options[0].value] : []);
            return {
              code: dim.code,
              selection: { filter: 'item', values: selected },
            };
          }),
          response: { format: 'json-stat2' },
        };
        response = await queryTable(currentTable.dataset, currentTable.id, query);
      } else if (queryMode === 'advanced' && tableMetadata) {
        // Advanced mode - use dynamic metadata
        const timeVar = tableMetadata.variables.find((v) => isTimeVariable(v.code));
        timeDimCode = timeVar?.code || 'Kuukausi';

        const query: PxWebRequest = {
          query: tableMetadata.variables.map((v) => {
            if (isTimeVariable(v.code)) {
              const isQuarterly = v.code.toLowerCase().includes('neljännes');
              const count = isQuarterly ? yearRange * 4 : yearRange * 12;
              return {
                code: v.code,
                selection: { filter: 'top', values: [String(Math.min(count, v.values.length))] },
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
        response = await queryTable(advancedDataset, advancedTableId, query);
      } else {
        throw new Error('Invalid query configuration');
      }

      const parsed = parseJsonStat(response);
      const periods = parsed.dimensions[timeDimCode] || [];
      const otherDims = Object.keys(parsed.dimensions).filter((d) => d !== timeDimCode);

      const transformed: SandboxResult[] = [];

      if (otherDims.length === 1) {
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
      } else if (otherDims.length === 0) {
        periods.forEach((period, pIdx) => {
          transformed.push({ period, value: parsed.values[pIdx] ?? 0 });
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
  }, [queryMode, currentTable, tableMetadata, selections, yearRange, advancedDataset, advancedTableId]);

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

  const dataKeys = useMemo(() => {
    if (results.length === 0) return [];
    return Object.keys(results[0]).filter((k) => k !== 'period');
  }, [results]);

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
              {variable.values.slice(0, 30).map((val, idx) => {
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
              {variable.values.length > 30 && (
                <span className="text-xs text-slate-400 px-2">+{variable.values.length - 30} lisää</span>
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
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <Tooltip {...tooltipStyle} labelFormatter={formatPeriod} />
                    <Line type="monotone" dataKey={key} stroke={REGION_COLORS[idx % REGION_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }} />
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
              <Line key={key} type="monotone" dataKey={key} name={key} stroke={REGION_COLORS[idx % REGION_COLORS.length]} strokeWidth={2.5} dot={false} activeDot={{ r: 6, strokeWidth: 2, fill: 'white' }} />
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
              <Bar key={key} dataKey={key} name={key} fill={REGION_COLORS[idx % REGION_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Hiekkalaatikko</h2>
          <p className="text-sm text-slate-500">Räätälöi omat kyselysi Tilastokeskuksen tietokantoihin</p>
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setQueryMode('simple')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              queryMode === 'simple' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Perus
          </button>
          <button
            onClick={() => setQueryMode('advanced')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              queryMode === 'advanced' ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Edistynyt
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        {queryMode === 'simple' ? (
          <>
            {/* Simple Mode */}
            <div className="flex flex-wrap gap-4 mb-6">
              <FilterSelect
                label="Tietokanta"
                value={datasetKey}
                options={Object.entries(SANDBOX_TABLES).map(([key, val]) => ({ value: key, label: val.label }))}
                onChange={setDatasetKey}
              />
              {currentDataset && (
                <FilterSelect
                  label="Taulukko"
                  value={tableId}
                  options={currentDataset.tables.map((t) => ({ value: t.id, label: t.label }))}
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
                        yearRange === y ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {y}v
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {currentTable && (
              <>
                <p className="text-sm text-slate-500 mb-4">{currentTable.description}</p>
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
                              value={selections[dim.code]?.[0] || ''}
                              options={dim.options!}
                              onChange={(val) => handleSingleSelect(dim.code, val)}
                            />
                          ) : (
                            <div>
                              <label className="block text-xs font-medium text-slate-500 mb-1">{dim.label}</label>
                              <div className="flex flex-wrap gap-1 max-w-md">
                                {dim.options!.slice(0, 8).map((opt) => {
                                  const selected = selections[dim.code]?.includes(opt.value);
                                  return (
                                    <button
                                      key={opt.value}
                                      onClick={() => handleSelectionToggle(dim.code, opt.value)}
                                      className={`px-2 py-1 text-xs rounded-md transition-all ${
                                        selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      {opt.label.length > 20 ? opt.label.slice(0, 20) + '...' : opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <>
            {/* Advanced Mode */}
            <div className="flex flex-wrap gap-4 mb-6">
              <FilterSelect
                label="Tietokanta"
                value={advancedDataset}
                options={[
                  { value: DATASETS.TYTI, label: 'Työvoimatutkimus' },
                  { value: DATASETS.TYONV, label: 'Työnvälitystilasto' },
                ]}
                onChange={(val) => {
                  setAdvancedDataset(val);
                  setAdvancedTableId('');
                  setTableMetadata(null);
                }}
              />
              <FilterSelect
                label="Taulukko"
                value={advancedTableId}
                options={[
                  { value: '', label: 'Valitse taulukko...' },
                  ...ADVANCED_TABLES
                    .filter((t) => t.dataset === advancedDataset)
                    .map((t) => ({ value: t.id, label: t.label })),
                  // Also include simple mode tables
                  ...(SANDBOX_TABLES[advancedDataset === DATASETS.TYTI ? 'tyti' : 'tyonv']?.tables || [])
                    .map((t) => ({ value: t.id, label: t.label })),
                ]}
                onChange={setAdvancedTableId}
              />
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Aikajakso</label>
                <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                  {[1, 2, 3, 5].map((y) => (
                    <button
                      key={y}
                      onClick={() => setYearRange(y)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        yearRange === y ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {y}v
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {metadataLoading && (
              <div className="flex items-center gap-3 text-slate-500 py-4">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Ladataan taulukon tietoja...</span>
              </div>
            )}

            {tableMetadata && !metadataLoading && (
              <div className="border-t border-slate-100 pt-4 mb-6">
                <h3 className="text-sm font-medium text-slate-700 mb-1">{tableMetadata.title}</h3>
                <p className="text-xs text-slate-500 mb-4">
                  {tableMetadata.variables.length} muuttujaa · Valitse arvot kullekin muuttujalle
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tableMetadata.variables
                    .filter((v) => !isTimeVariable(v.code))
                    .map((v) => renderVariableSelector(v))}
                </div>
              </div>
            )}
          </>
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={executeQuery}
            disabled={loading || (queryMode === 'simple' && !currentTable) || (queryMode === 'advanced' && !tableMetadata)}
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
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700">{error}</div>
      )}

      {hasQueried && !loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Tulokset</h3>
            <span className="text-sm text-slate-500">{results.length} riviä</span>
          </div>
          {results.length > 0 ? renderCharts() : (
            <p className="text-slate-500 text-center py-8">Ei tuloksia valituilla suodattimilla</p>
          )}
        </div>
      )}
    </div>
  );
}
