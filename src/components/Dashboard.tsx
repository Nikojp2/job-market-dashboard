import { useEffect, useState } from 'react';
import { EmploymentChart } from './EmploymentChart';
import { StatCard } from './StatCard';
import { FilterSelect } from './FilterSelect';
import { RegionalChart } from './RegionalChart';
import { TrendsSection } from './TrendsSection';
import { IndustrySection } from './IndustrySection';
import {
  getMonthlyLabourForceData,
  getJobSeekersByRegion,
  parseJsonStat,
  GENDER_OPTIONS,
  AGE_GROUP_OPTIONS,
  REGIONS,
} from '../api/statfin';

interface ChartData {
  period: string;
  employed: number;
  unemployed: number;
  unemploymentRate: number;
  [key: string]: string | number;
}

interface RegionalData {
  region: string;
  value: number;
}

export function Dashboard() {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [regionalData, setRegionalData] = useState<RegionalData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState('SSS');
  const [ageGroup, setAgeGroup] = useState('15-74');

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await getMonthlyLabourForceData({ gender, ageGroup });
        const parsed = parseJsonStat(response);

        // Transform data for chart
        const periods = parsed.dimensions['Kuukausi'] || [];
        const dataKeys = parsed.dimensions['Tiedot'] || [];

        const transformed: ChartData[] = periods.map((period, periodIndex) => {
          const dataPoint: ChartData = {
            period,
            employed: 0,
            unemployed: 0,
            unemploymentRate: 0,
          };

          dataKeys.forEach((key, keyIndex) => {
            const valueIndex = periodIndex * dataKeys.length + keyIndex;
            const value = parsed.values[valueIndex] || 0;

            if (key === 'Tyolliset') dataPoint.employed = value;
            if (key === 'Tyottomat') dataPoint.unemployed = value;
            if (key === 'Tyottomyysaste') dataPoint.unemploymentRate = value;
          });

          return dataPoint;
        });

        // Take last 24 months for display
        setChartData(transformed.slice(-24));
        setError(null);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        // Show more details for debugging
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Tietojen lataaminen epäonnistui: ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [gender, ageGroup]);

  // Fetch regional job seeker data
  useEffect(() => {
    async function fetchRegionalData() {
      try {
        const response = await getJobSeekersByRegion();
        const parsed = parseJsonStat(response);

        const regions = parsed.dimensions['Alue'] || [];
        const dataKeys = parsed.dimensions['Tiedot'] || [];

        const transformed: RegionalData[] = regions.map((regionCode, regionIndex) => {
          const regionInfo = REGIONS.find((r) => r.value === regionCode);
          let unemploymentRate = 0;

          dataKeys.forEach((key, keyIndex) => {
            const valueIndex = regionIndex * dataKeys.length + keyIndex;
            const value = parsed.values[valueIndex] || 0;

            if (key === 'TYOTOSUUS') unemploymentRate = value;
          });

          return {
            region: regionInfo?.label || regionCode,
            value: unemploymentRate,
          };
        });

        setRegionalData(transformed);
      } catch (err) {
        console.error('Failed to fetch regional data:', err);
      }
    }

    fetchRegionalData();
  }, []);

  const latestData = chartData[chartData.length - 1];
  // Get data from previous month for month-to-month comparison
  const previousMonthData = chartData[chartData.length - 2];
  // Get data from 12 months ago for year-over-year comparison
  const yearAgoData = chartData[chartData.length - 13];

  // Format number with Finnish thousand separator (space)
  const formatNumber = (num: number): string => {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const calculateTrend = (current: number, previous: number): 'up' | 'down' | 'neutral' => {
    if (current > previous) return 'up';
    if (current < previous) return 'down';
    return 'neutral';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-medium text-slate-600">Ladataan tietoja...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-rose-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-lg font-medium text-slate-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Modern Header */}
      <header className="relative bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 text-white overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%2260%22 height=%2260%22 viewBox=%220 0 60 60%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cg fill=%22none%22 fill-rule=%22evenodd%22%3E%3Cg fill=%22%239C92AC%22 fill-opacity=%220.05%22%3E%3Cpath d=%22M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-50" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-blue-500/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Työmarkkinat Suomessa
                </h1>
              </div>
              <p className="text-blue-200/80 text-sm md:text-base">
                Tilastokeskuksen työvoimatutkimuksen ja työnvälitystilaston tiedot
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-blue-300/60">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Päivitetty: {latestData?.period || ''}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Section: Overview */}
        <section className="mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Yleiskatsaus</h2>
              <p className="text-sm text-slate-500">Työmarkkinoiden avainluvut</p>
            </div>
            <div className="flex flex-wrap gap-3 p-4 bg-white/50 backdrop-blur rounded-2xl border border-slate-200/50">
              <FilterSelect
                label="Sukupuoli"
                value={gender}
                options={GENDER_OPTIONS}
                onChange={setGender}
              />
              <FilterSelect
                label="Ikäryhmä"
                value={ageGroup}
                options={AGE_GROUP_OPTIONS}
                onChange={setAgeGroup}
              />
            </div>
          </div>

          {/* Key Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {latestData && yearAgoData && previousMonthData && (
              <>
                <StatCard
                  title="Työlliset"
                  value={formatNumber(latestData.employed * 1000)}
                  subtitle={latestData.period}
                  accentColor="#10b981"
                  yearlyTrend={{
                    direction: calculateTrend(latestData.employed, yearAgoData.employed),
                    value: formatNumber(Math.abs(latestData.employed - yearAgoData.employed) * 1000),
                    label: 'vuosi',
                  }}
                  monthlyTrend={{
                    direction: calculateTrend(latestData.employed, previousMonthData.employed),
                    value: formatNumber(Math.abs(latestData.employed - previousMonthData.employed) * 1000),
                    label: 'kk',
                  }}
                />
                <StatCard
                  title="Työttömät"
                  value={formatNumber(latestData.unemployed * 1000)}
                  subtitle={latestData.period}
                  accentColor="#ef4444"
                  yearlyTrend={{
                    direction: calculateTrend(yearAgoData.unemployed, latestData.unemployed),
                    value: formatNumber(Math.abs(latestData.unemployed - yearAgoData.unemployed) * 1000),
                    label: 'vuosi',
                  }}
                  monthlyTrend={{
                    direction: calculateTrend(previousMonthData.unemployed, latestData.unemployed),
                    value: formatNumber(Math.abs(latestData.unemployed - previousMonthData.unemployed) * 1000),
                    label: 'kk',
                  }}
                />
                <StatCard
                  title="Työttömyysaste"
                  value={`${latestData.unemploymentRate.toFixed(1)}%`}
                  subtitle={latestData.period}
                  accentColor="#8b5cf6"
                  yearlyTrend={{
                    direction: calculateTrend(yearAgoData.unemploymentRate, latestData.unemploymentRate),
                    value: `${Math.abs(latestData.unemploymentRate - yearAgoData.unemploymentRate).toFixed(1)}%`,
                    label: 'vuosi',
                  }}
                  monthlyTrend={{
                    direction: calculateTrend(previousMonthData.unemploymentRate, latestData.unemploymentRate),
                    value: `${Math.abs(latestData.unemploymentRate - previousMonthData.unemploymentRate).toFixed(1)}%`,
                    label: 'kk',
                  }}
                />
              </>
            )}
          </div>
        </section>

        {/* Section: Charts - Työvoimatutkimus */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Työvoimatutkimus</h2>
            <p className="text-sm text-slate-500">Kuukausittainen kehitys</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
              <EmploymentChart
                data={chartData}
                title="Työlliset ja työttömät (tuhatta henkilöä)"
                lines={[
                  { dataKey: 'employed', color: '#2563eb', name: 'Työlliset' },
                  { dataKey: 'unemployed', color: '#dc2626', name: 'Työttömät' },
                ]}
                yAxisLabel="Tuhansia"
              />
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
              <EmploymentChart
                data={chartData}
                title="Työttömyysaste (%)"
                lines={[
                  { dataKey: 'unemploymentRate', color: '#7c3aed', name: 'Työttömyysaste' },
                ]}
                yAxisLabel="%"
              />
            </div>
          </div>
        </section>

        {/* Section: Regional Data - Työnvälitystilasto */}
        <section className="mb-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800">Työnvälitystilasto</h2>
            <p className="text-sm text-slate-500">Alueellinen työttömyys</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 transition-all duration-200 hover:shadow-md">
            {regionalData.length > 0 && (
              <RegionalChart
                data={regionalData}
                title="Työttömyysaste maakunnittain (%)"
                dataKey="value"
                unit="%"
              />
            )}
          </div>
        </section>

        {/* Section: Trends */}
        <section className="mb-12">
          <TrendsSection />
        </section>

        {/* Section: Industry Analysis */}
        <section className="mb-12">
          <IndustrySection />
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-500/20 backdrop-blur rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-300">Työmarkkinat Suomessa</span>
            </div>
            <div className="text-sm text-slate-400">
              <span>Lähteet: </span>
              <a
                href="https://stat.fi/tilasto/tyti"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Työvoimatutkimus
              </a>
              <span className="mx-2">|</span>
              <a
                href="https://stat.fi/tilasto/tyonv"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors"
              >
                Työnvälitystilasto
              </a>
              <span className="mx-2">|</span>
              <span>Tilastokeskus</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
