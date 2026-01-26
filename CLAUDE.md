# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A React-based dashboard for visualizing Finnish employment data from Statistics Finland (Tilastokeskus). The application fetches data from the PxWeb API and displays interactive charts showing employment trends, unemployment rates, and labor market statistics.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Architecture

### Tech Stack
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **Recharts** - Charting library
- **Tailwind CSS** - Styling (via @tailwindcss/vite plugin)
- **Axios** - HTTP client for API requests

### Project Structure
```
src/
├── api/
│   └── statfin.ts       # Statistics Finland PxWeb API client
├── components/
│   ├── Dashboard.tsx    # Main dashboard container with filters
│   ├── EmploymentChart.tsx  # Recharts line chart wrapper
│   ├── RegionalChart.tsx    # Recharts bar chart for regional data
│   ├── FilterSelect.tsx     # Dropdown filter component
│   └── StatCard.tsx     # Key metric display card
├── types/
│   └── index.ts         # TypeScript interfaces
├── App.tsx              # Root component
├── main.tsx             # Entry point
└── index.css            # Tailwind imports
```

### Features
- **Filters**: Gender (Sukupuoli) and age group (Ikäryhmä) filters for labour force data
- **Stat Cards**: Key metrics with trend indicators (Työlliset, Työttömät, Työttömyysaste)
- **Line Charts**: 24-month trends for employment and unemployment
- **Regional Bar Chart**: Unemployment rates by region (maakunta) from Työnvälitystilasto

### Statistics Finland API

The app uses the PxWeb API to fetch employment data:

- **Base URL**: `https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin/`
- **Datasets used**:
  - `tyti` - Työvoimatutkimus (Labour Force Survey)
  - `tyonv` - Työnvälitystilasto (Employment Service Statistics)
- **Response format**: JSON-stat2
- **API limits**: 100,000 cells per query, 30 requests per 10 seconds

Key tables:
- `statfin_tyti_pxt_135y.px` - Monthly labour force data
- `statfin_tyti_pxt_13aj.px` - Labour market status by age/gender
- `statfin_tyonv_pxt_12r5.px` - Unemployed job seekers
- `statfin_tyonv_pxt_12tf.px` - Unemployment rates

### Data Flow

1. `Dashboard.tsx` calls API functions on mount and when filters change
2. `statfin.ts` sends POST requests with JSON query to PxWeb API
3. Vite dev server proxies requests to avoid CORS issues (configured in `vite.config.ts`)
4. JSON-stat2 response is parsed via `parseJsonStat()` helper
5. Transformed data is passed to chart components

### CORS Proxy

The Vite dev server is configured with a proxy to handle CORS:
- Requests to `/api/statfin/*` are proxied to `https://pxdata.stat.fi/PXWeb/api/v1/fi/StatFin/*`
- This is only for development; production builds need a different solution (e.g., server-side API or CORS-enabled proxy)

## Adding New Data Views

To add a new chart or data visualization:

1. Check available tables at `https://pxdata.stat.fi/PXWeb/pxweb/fi/StatFin/`
2. Add query function in `src/api/statfin.ts`
3. Create component in `src/components/`
4. Add to Dashboard.tsx

## External Resources

- [Statistics Finland PxWeb API docs](https://pxdata.stat.fi/api1.html)
- [Työvoimatutkimus (Labour Force Survey)](https://stat.fi/tilasto/tyti)
- [Työnvälitystilasto (Employment Service Statistics)](https://stat.fi/tilasto/tyonv)
- [JSON-stat format](https://json-stat.org/)
