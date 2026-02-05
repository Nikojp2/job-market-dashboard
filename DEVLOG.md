# Development Log

This file tracks completed work and planned features. Share this at the start of Claude Code sessions for context.

## Roadmap / Next Up

(No pending items)

## Changelog

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
