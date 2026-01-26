interface TrendInfo {
  direction: 'up' | 'down' | 'neutral';
  value: string;
  label: string;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  yearlyTrend?: TrendInfo;
  monthlyTrend?: TrendInfo;
  icon?: React.ReactNode;
  accentColor?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  yearlyTrend,
  monthlyTrend,
  accentColor = '#1e40af'
}: StatCardProps) {
  const trendStyles = {
    up: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      ),
    },
    down: {
      bg: 'bg-rose-50',
      text: 'text-rose-600',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
      ),
    },
    neutral: {
      bg: 'bg-slate-50',
      text: 'text-slate-500',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>
      ),
    },
  };

  const renderTrend = (trend: TrendInfo) => {
    const style = trendStyles[trend.direction];
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${style.bg}`}>
        <span className={style.text}>{style.icon}</span>
        <span className={`text-xs font-semibold ${style.text}`}>{trend.value}</span>
        <span className="text-xs text-slate-400">{trend.label}</span>
      </div>
    );
  };

  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 p-6 overflow-hidden transition-all duration-200 hover:shadow-md hover:border-slate-200">
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
        style={{ backgroundColor: accentColor }}
      />

      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            {title}
          </h3>
          <div className="mt-2">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">{value}</span>
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          )}
        </div>

        {(yearlyTrend || monthlyTrend) && (
          <div className="flex flex-wrap gap-2">
            {yearlyTrend && renderTrend(yearlyTrend)}
            {monthlyTrend && renderTrend(monthlyTrend)}
          </div>
        )}
      </div>
    </div>
  );
}
