# Architecture

`@statisticsfinland/jsonstat-chart` is a vanilla TypeScript library that renders interactive statistical charts from JSON-stat 2.0 datasets using D3 and simple-statistics. It has no framework dependency and can be embedded in any web application.

## Public API

```ts
createChart(container: HTMLElement, dataset: JsonStatDataset, config?: ChartConfig): ChartInstance
```

`ChartInstance` exposes `update()`, `destroy()`, `setChartType()`, `getChartType()`, and `getApplicableChartTypes()`.

Standalone chart type evaluation (no chart creation required):

```ts
getChartTypesForDataset(dataset: JsonStatDataset, options?: ChartSelectorOptions): ChartTypeResult[]
selectChartTypeForDataset(dataset: JsonStatDataset, options?: ChartSelectorOptions): ChartType
```

## Source Layout

```
src/
├── index.ts              Entry point & public API
├── types.ts              All TypeScript interfaces and type unions
├── a11y/                 Accessibility: ARIA attributes, screen-reader announcements
├── charts/               Chart renderers (bar, line, pie, scatter, pyramid, key-figure, table, map, …)
│   ├── base.ts           Shared scaffold (categorical + numeric modes)
│   ├── footer.ts         Shared footer rendering (SVG + HTML)
│   ├── key-figure.ts     Key figure renderer (HTML, single-value datasets)
│   ├── map.ts            Choropleth map renderer (standalone, d3-geo)
│   └── bindInteractions  Attaches tooltip/keyboard/legend to a rendered chart
├── data/                 Data pipeline
│   ├── chart-selector.ts Automatic chart type selection from dataset shape
│   ├── header-builder.ts Title/subtitle/footer from dataset metadata
│   ├── map-transform.ts  JSON-stat + GeoJSON → MapChartData (code matching, 4 classification methods)
│   ├── table-transform.ts JSON-stat → TableData (N-dimensional pivot table)
│   ├── time-regularity.ts Detects regular vs irregular time dimensions
│   ├── transform.ts      JSON-stat → internal ChartData conversion
│   └── validate.ts       Input validation
├── interaction/          Tooltip, keyboard navigation, legend toggling
│   └── burger-menu.ts    Chart overlay menu with ARIA keyboard interactions, export actions, table mode and accessibility mode toggles
├── layout/               Zone-based responsive layout engine
│   ├── layout-engine.ts  Allocates zones (title, axes, plot, legend, footer, right margin)
│   ├── zones.ts          Zone definitions and priority
│   ├── tick-positions.ts Axis tick interval calculation
│   └── label-fitting.ts  Label rotation/truncation to fit available space
├── locale/               Localised UI strings
└── theme/                Theme resolution (JS config → ResolvedTheme + CSS vars)
```

## Data Flow

1. **Validate** — `validate.ts` checks the incoming JSON-stat dataset.
2. **Resolve map provider** *(async, optional)* — If `config.mapProvider` is set and the dataset has a geo dimension, the provider is called to resolve geographic boundaries. A loading indicator is shown while the provider resolves. Uses a generation counter for cancellation safety. `mapProvider` is the sole mechanism for supplying map geometry (ADR-030).
3. **Transform** — `transform.ts` converts it to internal `ChartData` / `ScatterChartData` / `PyramidChartData`. For tables, `table-transform.ts` produces `TableData` with auto-oriented row/column dimensions.
4. **Select chart type** — `chart-selector.ts` picks the best visualisation (or uses the user override). The map type is a candidate when the dataset has exactly one multiselect geo dimension and map geometry is available.
5. **Build headers** — `header-builder.ts` constructs title, subtitle, footer from metadata.
6. **Resolve theme** — `theme.ts` merges user config with defaults into a flat `ResolvedTheme`.
7. **Layout** — `layout-engine.ts` divides the container into zones.
8. **Render** — The chart-specific renderer draws into the plot zone.
9. **Bind interactions** — Tooltip, keyboard nav, legend, and burger menu are attached. The menu receives current chart mode, chart type, locale, accessibility mode state, and dataset from `index.ts`; CSV/XLSX exports transform dataset data through `table-transform.ts` and trigger browser Blob downloads, SVG export serializes the rendered chart `<svg>` via `XMLSerializer`, and PNG export rasterizes serialized SVG via canvas for chart-capable types (not `table`/`keyFigure`). Accessibility mode toggles chart rendering features (line marker shapes and bar/pie/pyramid pattern fills) on supported chart types.
10. **Accessibility** — ARIA roles/labels and a screen-reader summary are applied.

## Chart Types

`line` · `verticalBar` · `groupedVerticalBar` · `stackedVerticalBar` · `percentVerticalBar` · `horizontalBar` · `groupedHorizontalBar` · `stackedHorizontalBar` · `percentHorizontalBar` · `pie` · `scatterPlot` · `pyramid` · `keyFigure` · `table` · `map`

## Key Documents

| File | Purpose |
|---|---|
| [backlog.md](backlog.md) | Work items (new → refined → in progress → done) |
| [decisions.md](decisions.md) | Architectural Decision Records |
| [architecture.md](architecture.md) | This file — project overview |
