# Architecture

`@statisticsfinland/jsonstat-chart` is a vanilla TypeScript library that renders interactive statistical charts from JSON-stat 2.0 datasets using D3 and simple-statistics. It has no framework dependency and can be embedded in any web application.

## Public API

```ts
createChart(
  container: HTMLElement,
  dataset: JsonStatDataset,
  config?: ChartConfig,
  selectableSelections?: SelectableSelections,
): ChartInstance
```

`ChartInstance` exposes `update(dataset, config?, selectableSelections?)`, `destroy()`, `setChartType()`, `getChartType()`, and `getApplicableChartTypes()`. Current selections are chart-instance state, so they survive chart-type switches and can be replaced independently of config during an update.

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
│   ├── rebuild-dataset.ts Selection/layout resolution and compact JSON-stat rebuilding
│   ├── selectable-settings.ts Selectable config precedence and input-boundary validation
│   ├── sorting.ts        Supported horizontal/pie category sorting and horizontal series-code behavior
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
├── locale/               Localised UI strings and Intl-based number formatting
└── theme/                Theme resolution (JS config → ResolvedTheme + CSS vars)
```

## Data Flow

1. **Validate dataset** — `validate.ts` checks the incoming JSON-stat dataset.
2. **Resolve selectable settings** — `selectable-settings.ts` combines current selections, `ChartConfig` defaults, and `dataset.extension.selectableConfig`. Renderer selections override extension selections; chart config overrides extension defaults and the extension multi-select dimension. Layout and category codes are validated at this boundary.
3. **Rebuild configured data** — When layout or selectable settings are present, `index.ts` invokes `rebuild-dataset.ts` once before renderer-specific transformation. The rebuild resolves active categories in metadata order and copies only active source cells into a compact N-dimensional JSON-stat dataset. Observation `status` entries are copied and re-indexed with their values. An explicit layout orders dimensions as rows, then columns, then omitted dimensions in their original order. It uses `dataset.id` and `dataset.size` as the authoritative source coordinate order; `dataset.dimension` property order is never used for indexing. The source dataset remains immutable and every source dimension remains present.
4. **Resolve map provider** *(async, optional)* — If `config.mapProvider` is set and the dataset has a geo dimension, the provider is called with the active geo codes and selected time code. A loading indicator is shown while the provider resolves. A generation counter and `AbortSignal` provide cancellation safety. `mapProvider` is the sole mechanism for supplying map geometry (ADR-030).
5. **Select chart type** — `chart-selector.ts` picks the best visualisation or uses the user override. The map type is a candidate when the dataset has exactly one multiselect geo dimension and map geometry is available. A key figure is accepted when all dimensions are single-valued after selectable filtering.
6. **Transform** — Each transformer projects the rebuilt N-dimensional dataset into its renderer-specific shape without rebuilding it again. `transform.ts` creates categorical series and X-axis combinations, including composite codes and labels when an axis contains multiple dimensions. `table-transform.ts` creates an N-dimensional pivot grid and hides all singleton dimensions, including those named in `layout`; an all-singleton dataset remains a scalar grid. For missing cells it resolves `extension.missingValueDescriptions[status]`, then falls back to the raw status string. Scatter, pyramid, map, and key-figure transforms select their required coordinates directly from the rebuilt cube. Unconfigured datasets retain their existing automatic transformation behavior. `sorting.ts` applies `ChartConfig.sorting` only to horizontal bar, grouped/stacked/percent horizontal bar, and pie charts. Keywords reorder outer categories; matching series codes are used by grouped/stacked/percent horizontal bars, with grouped horizontal bars prioritizing the matching series.
7. **Build headers** — `header-builder.ts` constructs title, subtitle, and footer from active metadata. Single selected categories appear in automatic titles; a configured multi-select dimension remains a variable when multiple values are active.
8. **Resolve theme** — `theme.ts` merges user config with defaults into a flat `ResolvedTheme`. Series colors expose ten ordered CSS slots (`--jsc-series-1` through `--jsc-series-10`) before cycling.
9. **Layout** — `layout-engine.ts` divides the container into visual zones. This responsive SVG layout is separate from the data-level `Layout` row/column projection.
10. **Render** — The chart-specific renderer draws the projected data into the plot zone. Numeric labels and their layout measurements use the same `Intl.NumberFormat` locale. Horizontal bar variants omit the redundant category-axis title. Pie charts suppress Cartesian grids and place theme-colored labels outside the pie with connector clearance. Pyramid categories run bottom-to-top and dense layouts retain boundary labels while reducing the interior cadence. Scatter metric/content dimensions and pyramid split dimensions cannot be selectable because they define required renderer structure. `ChartConfig.cutValueAxis` lets the line chart and scatter plot Y axis omit the zero baseline; other chart types always anchor at zero.
11. **Bind interactions** — Tooltip, keyboard nav, legend, and the burger menu are attached by default. Line charts provide transparent point-sized interaction targets when accessibility markers are off. The chart-level `showBurgerMenu: false` option suppresses the menu. When enabled, the menu receives current chart mode, chart type, locale, accessibility mode state, active layout, and dataset from `index.ts`; it publishes the menu button's reserved top spacing for the HTML table renderer so table contents do not overlap the button. CSV exports transform the active rebuilt dataset through `table-transform.ts`, preserving layout, selections, and missing-value text, then trigger browser Blob downloads. SVG export serializes the rendered chart `<svg>` via `XMLSerializer`, and PNG export rasterizes serialized SVG via canvas for chart-capable types (not `table`/`keyFigure`). Accessibility mode toggles chart rendering features (line marker shapes and bar/pie/pyramid pattern fills) on supported chart types.
12. **Accessibility** — ARIA roles/labels and a screen-reader summary are applied.

## Selectable Dataset Rebuild

`SelectableSelections` is a dictionary from dimension codes to category-code arrays. Settings can originate from the current renderer call, `ChartConfig`, or `JsonStatDataset.extension.selectableConfig`. `resolveSelectableDatasetOptions()` owns precedence and structural validation; `rebuildDataset()` owns active-category resolution, dimension permutation, and compact N-dimensional value copying.

`dataset.id` is the sole authoritative order for dimensions, `dataset.size`, and the flattened `dataset.value` array. The dimension dictionary is metadata lookup by code and may use any property order. The rebuilding stage computes source strides from `size`, retains selected categories in source metadata order, and writes the filtered values into a compact row-major cube. With an explicit layout, the rebuilt order is `rows + columns + omitted dimensions`; without one, source dimension order is preserved. Raw numbers, `null`, string missing markers, and observation status codes are copied unchanged, with status keys remapped to rebuilt flat indices.

Rebuilding does not decide whether the resulting shape is suitable for a visualization. Omitted dimensions remain in the cube even when they have multiple active categories. Categorical transforms fix omitted dimensions to their first active category, except that a configured multi-select dimension is projected as series when it is not explicitly placed. Missing selections automatically use the latest time category or first non-time category, while an explicitly empty selection requires a non-empty default.

The rebuilt dataset removes consumed `extension.selectableConfig` data while preserving roles, dimension metadata, and unrelated extension metadata. `createRenderer()` passes this prepared cube to categorical and specialized transformers, so selectable settings are resolved and rebuilt exactly once per render. Unconfigured datasets never allocate a rebuilt cube and retain the original transformation path. Explicit chart choices are honored after structural dataset validation; automatic selection remains responsible for choosing a compatible chart type.

## Chart Types

`line` · `verticalBar` · `groupedVerticalBar` · `stackedVerticalBar` · `percentVerticalBar` · `horizontalBar` · `groupedHorizontalBar` · `stackedHorizontalBar` · `percentHorizontalBar` · `pie` · `scatterPlot` · `pyramid` · `keyFigure` · `table` · `map`

## Key Documents

| File | Purpose |
|---|---|
| [backlog.md](backlog.md) | Work items (new → refined → in progress → done) |
| [decisions.md](decisions.md) | Architectural Decision Records |
| [architecture.md](architecture.md) | This file — project overview |
