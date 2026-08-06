# Development Log

This file tracks completed work and planned features. Share this at the start of Claude Code sessions for context.

## Roadmap / Next Up

### Eurostat-integraatio – Suomen työllisyysdata EU-vertailukontekstissa
Lisätään Eurostatin avoimen REST-rajapinnan tuki rinnakkaiseksi datalähteeksi Tilastokeskuksen API:n oheen.

**Miksi mahdollinen:**
- Eurostat tarjoaa ilmaisen, julkisen REST API:n ilman autentikointia
- Vastausformaatti on JSON-stat – sama kuin projekti jo käyttää Tilastokeskuksen datan kanssa (`parseJsonStat()` toimii suoraan)
- Vite-proxy ja Vercel API-reitti voidaan laajentaa helposti uudelle endpointille (sama kaava kuin nykyinen `/api/statfin/*`)

**Relevantit datasetit:**
- `une_rt_m` – Kuukausittainen työttömyysaste sukupuolen ja iän mukaan (sisältää Suomi-suodattimen `geo=FI`)
- `lfsi_emp_m` – Kuukausittainen työllisyysaste
- Base URL: `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{datasetCode}`

**Ehdotettu toteutus:**
1. Lisää `/api/eurostat/*` proxy Vite-configiin ja Vercel-reitteihin
2. Luo `src/api/eurostat.ts` API-funktioilla (malli: `statfin.ts`)
3. Lisää uusi välilehti tai osio Dashboardiin EU-vertailunäkymällä
4. Näytä Suomen luvut rinnakkain EU-keskiarvon kanssa

## General Project State

Dashboard displays Finnish labour market data across four main sections:
- **Dashboard tab** (Työvoimatutkimus): monthly employment/unemployment with gender & age filters
- **Trends tab**: quarterly regional multi-line charts for employment/unemployment rates + quarterly national open job vacancies
- **Industry tab**: employment by sector and occupation breakdown
- **Sandbox (Hiekkalaatikko)**: user-defined custom queries against StatFin PxWeb API

Data sources:
- `tyti` — Työvoimatutkimus (Labour Force Survey, monthly/quarterly)
- `tyonv` — Työnvälitystilasto (Employment Service registry, monthly, regional)
- `atp` — Avoimet työpaikat -tutkimus (Job Vacancy Survey, quarterly, national/suuralue)

## Changelog

### 2026-08-06
- Fix "Request failed with status code 400" breaking every chart in production/dev
  - Root cause: Statistics Finland changed the PxWeb API between 2026-04-15 and now —
    table IDs dropped the `statfin_<dataset>_pxt_` prefix (e.g. `statfin_tyti_pxt_135y.px` → `135y.px`),
    and several variable codes were renamed (`Kuukausi`→`timeperiod_m`, `Vuosineljännes`→`timeperiod_q`,
    `Vuosi`→`timeperiod_y`, `Sukupuoli`→`sukupuoli_9_20180101`, `Ikäluokka`→`ikaryhma_19_20190101`,
    `Maakunta`→`alue_23_20180101`, `Toimiala`→`toimiala_79_20180101`, `Tiedot`→`contentscode`).
    `tyti` dataset content values also gained a `tyti-` prefix (e.g. `Tyolliset`→`tyti-Tyolliset`);
    `tyonv` dataset content codes and `Alue`/`Ammattiryhmä` codes were unaffected.
  - Updated `TABLES` and every query builder in [statfin.ts](src/api/statfin.ts) to the new IDs/codes
    (verified live against `pxdata.stat.fi` metadata for each table actually in use)
  - Updated `parsed.dimensions[...]` lookups in Dashboard.tsx, TrendsSection.tsx, IndustrySection.tsx to match
  - Fixed Hiekkalaatikko (Sandbox)'s dynamic time-variable detection — `isTimeVariable()` matched on
    substrings like "kuukausi"/"vuosi", which no longer match the new `timeperiod_*` codes; added `timeperiod`
    as a detection pattern
  - Also updated the ATP (avoimet työpaikat) query added on 2026-04-15 to the new table ID/codes — it was
    written against the old scheme and would otherwise still 400
  - Verified all four tabs (Avainluvut, Työvoimatutkimus, Työnvälitystilasto, Hiekkalaatikko) load real data
    in the dev server; `tsc --noEmit` and `eslint src` both clean
- Fix React Compiler memoization warning in EmploymentChart.tsx
  - `yoyPeriodsBack` (added 2026-04-15) was used inside the two YoY `useMemo` callbacks but missing from
    their dependency arrays, so React Compiler skipped optimizing the component
  - Added `yoyPeriodsBack` to both dependency arrays

### 2026-04-15
- Add table view toggle to avoimet työpaikat section
  - "Kaavio / Taulukko" toggle button in the toolbar
  - Table view shows all 5 ATP metrics as columns simultaneously (metric slicer hidden in table mode)
  - Rows sorted newest-first; DataTable's column sort also available
  - Quarter range selector works in both modes
  - Reuses existing DataTable component (Finnish number formatting, sortable columns)

- Fix ATP data indexing bug (values mapped to wrong metrics/quarters)
  - Root cause: ATP table's natural dimension order is `[Tiedot, Vuosineljännes]` (Tiedot is outer/slowest), but transform used the inverted formula `qIdx * metrics.length + mIdx`
  - Fix: changed to `mIdx * quarters.length + qIdx` — Q4 2025 atp_lkm now correctly reads as 22 700 instead of ~13 100

- Move avoimet työpaikat chart to Avainluvut page with custom ATP metric slicer
  - Removed chart from TrendsSection (Työvoimatutkimus tab) — it used a different, incompatible data source
  - Added dedicated "Avoimet työpaikat" section to the Avainluvut front page
  - Metric slicer (button group) lets user switch between all 5 ATP metrics:
    - Avoimet työpaikat yhteensä (`atp_lkm`)
    - Joilla ei ole hoitajaa (`atp_eihoit`)
    - Osa-aikaiset (`atp_osa`)
    - Määräaikaiset (`atp_maar`)
    - Vaikeasti täytettävät (`atp_vaik`)
  - Quarter range selector: 2v / 3v / 5v / 10v
  - Data source badge (amber) distinguishes it from Työvoimatutkimus data (blue)
  - Updated `getOpenPositionsQuarterly()` to fetch all 5 metrics in one request
  - Added `ATP_METRIC_OPTIONS` and `AtpMetricValue` type exports to `statfin.ts`
  - Added `yoyPeriodsBack` prop to `EmploymentChart` (default 12); ATP chart uses 4 for correct quarterly YoY

- Fix avoimet työpaikat data source and format
  - **Problem**: Open positions chart was using monthly administrative data from Työnvälitystilasto (`statfin_tyonv_pxt_12tv.px`), which only covers positions registered at TE-offices — inaccurate and wrong granularity
  - **Fix**: Switched to the proper quarterly job vacancy survey (`statfin_atp_pxt_11l1.px`) from the `atp` (Avoimet työpaikat -tutkimus) dataset
  - Added `ATP` dataset constant to `DATASETS` in `statfin.ts`
  - Added `OPEN_POSITIONS_QUARTERLY` table constant
  - Replaced `getMultiRegionOpenPositionsTrend()` with `getOpenPositionsQuarterly()` — national level, quarterly (`Vuosineljännes` dimension), metric `atp_lkm`
  - Chart now uses `formatQuarter` (was `formatMonth`) and `periodsBack={4}` (was 12) for correct YoY calculation
  - Chart title updated to clarify "koko maa" (national) since ATP survey has no Maakunta breakdown (only 5 broad Suuralue regions)

### 2026-02-05
- Add yearly percentage change (YoY) toggle for individual charts
  - Each chart has its own Arvo/Vuosimuutos toggle
  - Shows percentage change for counts, percentage point change for rates
  - Reference line at 0% in YoY mode
  - Scale toggle hidden when in YoY mode (not applicable)
  - Added to Dashboard (Työvoimatutkimus tab) with multi-line chart support
  - Added to TrendsSection (quarterly data uses 4 quarters back, monthly uses 12 months)
  - Works with multi-region comparison
- Add YoY toggle to Hiekkalaatikko (Sandbox)
  - Dynamic periodsBack based on timeUnit (monthly=12, quarterly=4, yearly=1)
  - YoY toggle appears after data is fetched
  - CSV export reflects current mode (YoY or absolute)
  - Works with all visualization types (line, bar, table)
- Improve Y-axis readability with getNiceNumber algorithm
  - Rounds axis bounds to clean values (1, 2, 5, 10 intervals)
  - Symmetric bounds around zero when data crosses zero
- Fix TypeScript errors for Vercel build
  - Fix Tooltip formatter type to handle all Recharts value types
  - Fix displayLines to always include dashed property explicitly

### 2026-02-02
- Add detailed logging and redirect handling to API proxy
- Fix API proxy with simpler rewrite approach
- Fix API proxy for production with catch-all route
- Fix YAxis domain type issues (multiple iterations)
- Enhance Hiekkalaatikko with dynamic tables and improve chart scaling

### 2026-01-29
- Add export buttons to Hiekkalaatikko results section
- Add Phase 2 Hiekkalaatikko with dynamic metadata support
- Add Sandbox feature for custom data queries (Phase 1)
- Add CSV export to all dashboard tabs
- Add multi-region comparison and chart scale toggle

### 2026-01-28
- Add dashboard improvements: tabs, trend data, mini charts, and export
- Fix TypeScript build errors
- Trigger Vercel deployment

### 2026-01-26
- Initial commit - project setup with React, Vite, Recharts, Tailwind
