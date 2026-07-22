# @statisticsfinland/jsonstat-chart

Render JSON-stat 2.0 datasets as interactive, accessible SVG charts.

## Local Installation

This package is not yet published to npm. Install it locally:

```bash
# In this project directory, build and pack:
npm run pack

# In your consuming project, install the .tgz:
npm install ../jsonstatchart/statisticsfinland-jsonstat-chart-0.1.0.tgz
```

Or link for development:

```bash
# In this project:
npm run build
npm link

# In your consuming project:
npm link @statisticsfinland/jsonstat-chart
```

> **Note:** Rebuild with `npm run build` after source changes when using `npm link`.

## Quick Start

```typescript
import { createChart } from '@statisticsfinland/jsonstat-chart';
import type { JsonStatDataset } from '@statisticsfinland/jsonstat-chart';

// Fetch a JSON-stat 2.0 dataset
const response = await fetch('https://example.com/api/dataset');
const dataset: JsonStatDataset = await response.json();

// Render into a container
const container = document.getElementById('chart')!;
const chart = createChart(container, dataset);

// Later: update with new data or config
chart.update(dataset, { chartType: 'verticalBar' });

// Change chart type
chart.setChartType('line');

// Clean up
chart.destroy();
```

## Configuration

```typescript
const chart = createChart(container, dataset, {
  chartType: 'line',           // Override auto-selected chart type
  locale: 'fi',                // Locale for formatting (en, fi, sv)
  title: 'Custom Title',       // Override auto-generated title
  height: 400,                 // Container height in pixels
  showHeader: true,            // Show auto-generated header (default: true)
  showLegend: true,            // Show legend for multi-series charts
  autoTitle: true,             // Auto-generate title from metadata (default: true)
  menuIconInheritColor: false, // Burger menu icon color inherits parent color when true
  menuItemDefinitions: [       // Optional custom burger menu items (shown before built-ins)
    { text: 'Custom action', onClick: () => console.log('clicked') },
    { text: 'Documentation', url: 'https://example.com/docs', openNewTab: true },
  ],
  footerItems: [
    { type: 'source', label: 'Source:', value: 'Statistics Finland' },
  ],
  sourceLink: 'https://example.com/something',  // Make source footer item clickable
  theme: {                     // Override default theme
    fontFamily: 'Arial, sans-serif',
    colorText: '#333',
    seriesColors: ['#1f77b4', '#ff7f0e', '#2ca02c'],
  },
});
```

### Configuration Options

| Option | Type | Description |
|---|---|---|
| `chartType` | `ChartType` | Override the auto-selected chart type |
| `locale` | `string` | Locale for formatting numbers and dates (`en`, `fi`, `sv`) |
| `title` | `string` | Override the auto-generated title |
| `subtitle` | `string` | Subtitle displayed below the title |
| `height` | `number` | Container height in pixels |
| `showHeader` | `boolean` | Show auto-generated header (default: `true`) |
| `showLegend` | `boolean` | Show legend for multi-series charts (default: `true`) |
| `autoTitle` | `boolean` | Auto-generate title from metadata (default: `true`) |
| `accessibilityMode` | `boolean` | Enable accessibility visuals (pattern fills or marker shapes) for supported chart types |
| `menuItemDefinitions` | `(FunctionalMenuItem \| LinkMenuItem)[]` | Optional custom burger menu items shown before built-in items |
| `menuIconInheritColor` | `boolean` | When `true`, burger menu icon color inherits from parent text color |
| `footerItems` | `FooterItem[]` | Array of footer items. Each item has `type` (`'source'`, `'updated'`, `'custom'`), `label` (prefix text), and `value` (main text) fields. |
| `sourceLink` | `string` | URL to make the source footer item a clickable link. Must be an `http://` or `https://` URL. When set, footer items with `type: 'source'` render as hyperlinks opening in a new tab. The URL is validated and `javascript:` / `data:` URLs are rejected for security. |
| `ariaLabel` | `string` | Custom aria-label for the figure element |
| `xDimension` | `string` | Code of dimension to use as X axis (auto-detected by default) |
| `yDimension` | `string` | Code of dimension to use as Y axis (auto-detected by default) |
| `theme` | `ThemeConfig` | Theme customization options (see Theming section) |

## Burger Menu

Charts render a top-right burger menu button (`☰`) that opens a keyboard-accessible dropdown shell.

Built-in item order:

1. Custom items from `menuItemDefinitions` (if any)
2. Download table (csv)
3. Download figure (svg)
4. Download table (xlsx)
5. Download figure (png)
6. Show symbols in the figure
7. View table / View chart

Built-in export items are shown only when export is actionable:

- Table exports (CSV, XLSX) are shown only when a dataset is available.
- Figure exports (SVG, PNG) are shown only when both a dataset is available and the current chart type supports SVG export.

CSV export behavior:

- **Download table (csv)** now exports current dataset data as CSV.
- CSV includes UTF-8 BOM for spreadsheet compatibility.
- Delimiter is locale-aware: `;` for `fi`/`sv`, otherwise `,`.
- Numeric values are locale-formatted without grouping.
- Download filename format: `<datasetLabel|export>_YYYYMMDD_HHMMSS.csv` (sanitized).

SVG export behavior:

- **Download figure (svg)** now exports the currently rendered chart SVG.
- SVG export is available for SVG-rendered chart types and hidden for `table` and `keyFigure`.
- Export serializes the chart container's first `<svg>` element with `XMLSerializer`.
- Download filename format: `<datasetLabel|export>_YYYYMMDD_HHMMSS.svg` (sanitized).

XLSX export behavior:

- **Download table (xlsx)** now exports current dataset data as an `.xlsx` workbook.
- Export transforms dataset data through the existing table transformation pipeline.
- Workbook package includes worksheet XML and required Open XML relationship/content-type parts.
- XML text content is escaped for `&`, `<`, `>`, `"`, and `'` and strips XML-invalid control characters.
- ZIP packaging uses deflate compression when supported by the runtime, with automatic fallback to stored ZIP entries.
- Download filename format: `<datasetLabel|export>_YYYYMMDD_HHMMSS.xlsx` (sanitized).

PNG export behavior:

- **Download figure (png)** now exports the currently rendered chart as a PNG image.
- PNG export is available for SVG-rendered chart types and hidden for `table` and `keyFigure`.
- Export serializes the chart SVG, rasterizes it to a canvas, and downloads the PNG Blob.
- Download filename format: `<datasetLabel|export>_YYYYMMDD_HHMMSS.png` (sanitized).

Accessibility mode toggle behavior:

- The menu includes an accessibility toggle in chart mode for supported chart types.
- Supported chart types: `line`, all bar variants, `pie`, and `pyramid`.
- Unsupported types (toggle hidden): `scatterPlot`, `table`, `keyFigure`, `map`.
- Label is state-dependent:
  - `Show symbols in the figure` when accessibility mode is off
  - `Remove symbols from the figure` when accessibility mode is on
- In line charts, accessibility mode uses distinct marker shapes per series.
- In bar/pie/pyramid charts, accessibility mode applies per-series or per-slice SVG pattern fills.

Table toggle behavior:

- The last menu item toggles between chart and table view.
- The label is `View table` in chart mode and `View chart` in table mode.
- The item is shown only when a table toggle handler is provided to the menu component.

Keyboard support:

- `ArrowDown` / `ArrowUp`: move focus between items (wrap around)
- `Enter` / `Space`: activate focused item
- `Escape`: close menu and return focus to menu button
- `Tab`: close menu

## Theming

Charts are styled through a three-layer cascade. Each layer overrides the one below it:

1. **JS config** — properties passed via `config.theme` (see Configuration above)
2. **CSS custom properties** — `--jsc-*` variables resolved from the chart container
3. **Built-in defaults** — sensible defaults (system font, neutral palette)

### CSS Custom Properties

Every scalar `ThemeConfig` property has a corresponding CSS custom property named `--jsc-{kebab-case-key}`. Set these on or above the chart container:

```css
.my-chart-container {
  --jsc-font-family: 'Inter', sans-serif;
  --jsc-color-text: #1a1a1a;
  --jsc-color-background: #f9f9f9;
  --jsc-color-border: #ddd;
  --jsc-font-size-title: 1.25rem;
}
```

Series colors use `--jsc-series-1` through `--jsc-series-8`:

```css
.my-chart-container {
  --jsc-series-1: #e63946;
  --jsc-series-2: #457b9d;
  --jsc-series-3: #2a9d8f;
}
```

#### Typography

| CSS Variable | Default | Description |
|---|---|---|
| `--jsc-font-family` | `system-ui, -apple-system, sans-serif` | Font stack for all text |
| `--jsc-font-size-tick` | `0.75rem` | Axis tick labels and footer text |
| `--jsc-font-size-label` | `0.875rem` | Legend items, axis titles, subtitles |
| `--jsc-font-size-title` | `1rem` | Chart title |
| `--jsc-font-weight-normal` | `400` | Normal-weight text |
| `--jsc-font-weight-bold` | `700` | Bold text (title, tooltip values) |

#### Colors

| CSS Variable | Default | Description |
|---|---|---|
| `--jsc-color-background` | `#ffffff` | Background color (table chart headers) |
| `--jsc-color-surface` | `#ffffff` | Tooltip and overlay background |
| `--jsc-color-text` | `#333333` | Primary text (title, tooltip) |
| `--jsc-color-text-secondary` | `#666666` | Secondary text (subtitle, axis labels, footer) |
| `--jsc-color-border` | `#cccccc` | Borders, grid lines, bar strokes |
| `--jsc-color-tick` | `#767676` | Axis tick marks and domain lines |
| `--jsc-color-error` | `#dc3545` | Error state color |
| `--jsc-color-focus-ring` | `#0066cc` | Keyboard focus indicator |
| `--jsc-color-link` | `#0563C1` | Footer source link text color |

#### Layout

| CSS Variable | Default | Description |
|---|---|---|
| `--jsc-border-radius` | `4px` | Tooltip border radius |
| `--jsc-grid-opacity` | `0.2` | Opacity of grid lines |

#### Tooltip

| CSS Variable | Default | Description |
|---|---|---|
| `--jsc-tooltip-padding` | `8px 12px` | Tooltip inner padding |
| `--jsc-tooltip-box-shadow` | `0 2px 4px rgba(0,0,0,0.15)` | Tooltip drop shadow |

#### Burger Menu

| CSS Variable | Default | Description |
|---|---|---|
| `--jsc-burger-menu-background` | `#ffffff` | Burger menu dropdown background |
| `--jsc-burger-menu-border-color` | `#bdbdbd` | Burger menu dropdown border color |
| `--jsc-burger-menu-border-radius` | `18px` | Burger menu and menu item corner radius |
| `--jsc-burger-menu-shadow` | `0 4px 16px rgba(0, 0, 0, 0.12)` | Burger menu dropdown shadow |
| `--jsc-burger-menu-item-hover-background` | `#f5f5f5` | Burger menu item hover background |
| `--jsc-burger-menu-item-active-background` | `#eef5ff` | Burger menu active/focused item background |
| `--jsc-burger-menu-item-separator-color` | `#e3e3e3` | Burger menu item separator color |

```css
/* Dark theme example — adjust values to your design system */
.dark-theme .chart-container {
  --jsc-color-background: #1a1a2e;
  --jsc-color-surface: #16213e;
  --jsc-color-text: #e0e0e0;
  --jsc-color-text-secondary: #a0a0a0;
  --jsc-color-border: #3a3a5c;
  --jsc-color-tick: #8888aa;
  --jsc-color-focus-ring: #64b5f6;
  --jsc-tooltip-box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  --jsc-series-1: #64b5f6;
  --jsc-series-2: #ef5350;
  --jsc-series-3: #66bb6a;
  --jsc-series-4: #ffa726;
}
```

> **Note:** CSS custom property names may change before version 1.0.

## Chart Types

The library auto-selects the best chart type based on dataset dimensions when `chartType` is not specified.

| Type | Value | Description |
|---|---|---|
| Line | `'line'` | Time series or ordinal progression |
| Vertical Bar | `'verticalBar'` | Single-series vertical bars |
| Horizontal Bar | `'horizontalBar'` | Single-series horizontal bars |
| Grouped Vertical Bar | `'groupedVerticalBar'` | Multi-series side-by-side vertical |
| Grouped Horizontal Bar | `'groupedHorizontalBar'` | Multi-series side-by-side horizontal |
| Stacked Vertical Bar | `'stackedVerticalBar'` | Multi-series stacked vertical |
| Stacked Horizontal Bar | `'stackedHorizontalBar'` | Multi-series stacked horizontal |
| Percent Vertical Bar | `'percentVerticalBar'` | Normalized 100% stacked vertical |
| Percent Horizontal Bar | `'percentHorizontalBar'` | Normalized 100% stacked horizontal |
| Pie | `'pie'` | Part-to-whole proportions |
| Scatter Plot | `'scatterPlot'` | Two-variable correlation |
| Pyramid | `'pyramid'` | Mirrored horizontal bars (e.g. age-sex) |
| Key Figure | `'keyFigure'` | Single-value display (auto-selected when all dimensions have size 1) |
| Table | `'table'` | HTML table fallback |

### Key Figure Layout

The key figure chart renders the numeric value and unit inside a shared wrapper element:

```
.jsc-key-figure
  .jsc-key-figure-title     (optional — rendered when title is set)
  .jsc-key-figure-display   ← value + unit wrapper
    .jsc-key-figure-value
    .jsc-key-figure-unit    (optional — rendered when unit is non-empty)
  .jsc-key-figure-footer    (optional — rendered when footerItems are set)
```

By default the wrapper stacks value and unit vertically (`flex-direction: column`). Override it to display them in a row:

```css
.jsc-key-figure-display {
  flex-direction: row;
  align-items: baseline;
  gap: 0.25em;
}
```

## API Reference

Key exports from the package.

### Key Types

- `JsonStatDataset` — JSON-stat 2.0 dataset input
- `ChartConfig` — Configuration options (see Configuration section)
- `ChartInstance` — Returned by `createChart()`
- `ChartType` — Union of all chart type strings
- `ThemeConfig` — Theme customization options

### `createChart(container, dataset, config?)`

Creates a chart instance.

- `container: HTMLElement` — DOM element to render into
- `dataset: JsonStatDataset` — JSON-stat 2.0 dataset object
- `config?: ChartConfig` — Optional configuration
- Returns `ChartInstance`

### `ChartInstance` methods

- `update(dataset, config?)` — Re-render with new data/config
- `destroy()` — Clean up DOM and event listeners
- `setChartType(type)` — Switch chart type
- `getChartType()` — Get current chart type
- `getApplicableChartTypes()` — Get all valid chart types with rejection reasons

### Utilities

- `validateDataset(dataset)` — Validate a JSON-stat dataset before rendering
- `resolveTheme(container, themeConfig?)` — Resolve partial theme to full theme
- `getChartTypesForDataset(dataset, options?)` — Get all chart types with validity and rejection reasons
- `selectChartTypeForDataset(dataset, options?)` — Get the auto-selected chart type

### Chart Type Evaluation

Query which chart types are valid for a dataset **without creating a chart**. Useful for building chart-type picker UIs:

```typescript
import { getChartTypesForDataset, selectChartTypeForDataset } from '@statisticsfinland/jsonstat-chart';

// Get all chart types with validity status and rejection reasons
const results = getChartTypesForDataset(dataset);
// [
//   { type: 'line', valid: true, rejectionReasons: [] },
//   { type: 'verticalBar', valid: false, rejectionReasons: ['No time or ordinal axis dimension'] },
//   { type: 'map', valid: true, rejectionReasons: [] },
//   ...
// ]

// Filter to valid types for a chart-type switcher UI
const validTypes = results.filter(r => r.valid).map(r => r.type);

// Or just get the best auto-selected type
const bestType = selectChartTypeForDataset(dataset);
```

#### Map handling

Map eligibility normally requires async geometry resolution via `mapProvider`. These standalone functions handle map differently based on the `mapAvailable` option:

| `mapAvailable` | Behavior |
|---|---|
| `true` | Map geometry confirmed — map fully eligible |
| `false` | Map geometry unavailable — map rejected |
| omitted | Geometry check skipped — map eligible based on structural constraints only (geo dimension, sizes) |

```typescript
// Structural check only (default) — map valid if dataset has geo dimension + correct shape
const results = getChartTypesForDataset(dataset);

// After resolving geometry yourself
const results = getChartTypesForDataset(dataset, { mapAvailable: true });
```

> **Note:** Elimination value detection uses a `'SSS'` code heuristic suited for Statistics Finland data. For other data sources needing precise control, use the lower-level `getApplicableChartTypes()` with manually constructed `DimensionMeta[]`.

## Accessibility

- All charts include `role="figure"` with `aria-roledescription`
- Screen-reader-only data table included for all visual charts
- Keyboard navigation: arrow keys, Home/End, Escape
- Interactive legend with `aria-pressed` toggle
- Tooltips with `aria-live="polite"`

## Development

### Prerequisites

- Node.js 18+
- npm 9+

### Setup

```bash
git clone <repository-url>
cd jsonstatchart
npm install
```

### Commands

```bash
npm test             # Run tests
npm run build        # Build library to dist/
npm run storybook    # Launch Storybook dev server on http://localhost:6006
npm run pack         # Build + create .tgz for local install
```

### Storybook

Storybook provides a visual showcase of all chart types with real JSON-stat 2.0 data from Statistics Finland.

```bash
npm run storybook
```

This starts a dev server at `http://localhost:6006` with hot reloading. Stories are in the `stories/` directory and use fixture datasets from `stories/fixtures/`.

To build a static Storybook site:

```bash
npm run build-storybook
```

## License

Apache-2.0
