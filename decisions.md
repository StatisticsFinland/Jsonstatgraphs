# Architectural Decision Records

Decisions are numbered sequentially. Once recorded, a decision is not deleted — it can be superseded by a later entry that references the original.

## Template

```
### ADR-NNN: Title

**Status:** accepted | superseded by ADR-NNN
**Date:** YYYY-MM-DD

**Context:** Why the decision was needed.

**Decision:** What was decided.

**Consequences:** Trade-offs and implications.
```

---

## Decisions

### ADR-001: Vanilla TypeScript with D3 — no framework dependency

**Status:** accepted
**Date:** 2025-01-01

**Context:** The library must be usable from any frontend stack (React, Vue, plain HTML) and inside the AiStatFin application. A React component wrapper would limit reuse.

**Decision:** Build as a vanilla TypeScript library that renders into a DOM container via D3. No React, Vue, or other framework dependency.

**Consequences:** Framework users need a thin wrapper (e.g., `useEffect` + ref). The library stays portable and has fewer dependencies.

### ADR-002: Automatic chart type selection

**Status:** accepted
**Date:** 2025-01-01

**Context:** Consumers passing JSON-stat data should not need to know which chart type is appropriate. The dataset's dimension structure (time, geo, metric) already implies the best visualisation.

**Decision:** Implement a constraint-based selector (`chart-selector.ts`) that picks the chart type from the dataset metadata. Users can override with `config.chartType`.

**Consequences:** The selector must be maintained as new chart types are added. Edge cases may pick a suboptimal type — the override escape hatch covers this.

### ADR-003: Zone-based responsive layout

**Status:** accepted
**Date:** 2025-01-01

**Context:** Charts have multiple areas (title, subtitle, plot, axes, legend, footer) that must resize proportionally and avoid overlap.

**Decision:** A layout engine divides the container into named zones, each claiming space in priority order. The plot zone gets whatever remains.

**Consequences:** Adding new zones (e.g., annotations) requires updating the layout engine. The zone model is simpler than CSS-based layout and works inside SVG.

### ADR-004: Theming via JS config + CSS custom properties

**Status:** accepted
**Date:** 2025-01-01

**Context:** Themes need to work both at chart-creation time (JS) and at runtime via external stylesheets.

**Decision:** Theme values are resolved at creation from a JS config, with CSS custom properties set on the container for external override. A `ResolvedTheme` object (all values concrete, no var references) is passed to renderers.

**Consequences:** Consumers can override look-and-feel with plain CSS. The theme resolution step adds a small amount of complexity.

### ADR-005: Automatic header construction from JSON-stat metadata

**Status:** accepted
**Date:** 2025-01-01

**Context:** JSON-stat datasets carry dimension labels, source info, and update timestamps. Manually crafting titles duplicates metadata already present in the data.

**Decision:** The `header-builder.ts` module constructs title, subtitle, and footer automatically from dataset metadata. Users can override any part via config.

**Consequences:** Title quality depends on dataset metadata quality. The builder must handle missing or minimal metadata gracefully.

### ADR-006: Font sizes resolved to px at theme resolution time

**Status:** accepted
**Date:** 2026-05-07

**Context:** Theme defaults use CSS relative units (`1rem`, `0.875rem`, `0.75rem`). Layout code in `base.ts` uses `parseFloat()` to get numeric pixel values for zone height calculations and vertical centering. `parseFloat('1rem')` returns `1`, not `16`, causing header/title text to be clipped.

**Decision:** `resolveTheme()` now converts all font-size properties (`fontSizeTitle`, `fontSizeLabel`, `fontSizeTick`) from `rem`/`em` to `px` strings using the actual computed root font size (for `rem`) and container font size (for `em`). The theme is also re-resolved on every `render()` call to keep font sizes current with user preferences.

**Consequences:** `ResolvedTheme` font-size fields are now always `px` strings (e.g., `'16px'` instead of `'1rem'`). `parseFloat()` works correctly everywhere. Unsupported units (`%`, `vw`, `calc()`) pass through unchanged — this is acceptable as they are not used for font sizes in practice.

### ADR-007: Legend toggle reflows chart via localized redraw

**Status:** accepted
**Date:** 2026-05-07

**Context:** Toggling a legend item hid the SVG series group via `display:none`, leaving visual gaps in grouped bars, stacked bars, and pie charts. A full scaffold re-render would recreate the legend and lose toggle state.

**Decision:** Each chart renderer extracts its drawing logic into a local function (`drawBars`/`drawSlices`). The legend toggle callback clears the plot area and redraws with only visible series — recomputing inner band scales, stack layouts, or pie arcs as needed. The scaffold is not re-rendered; axes and legend remain intact. The Legend class gained `setItemStates()` so hidden state syncs on scaffold re-renders (e.g., resize). Screen reader tables are rebuilt with filtered data to match the visual state.

**Consequences:** Grouped-bar, stacked-bar, and pie charts now visually collapse and redistribute when series are hidden. For non-percent stacked charts, the value axis is not rescaled (bars may not fill the axis range). Percent stacked charts correctly reach 100% after toggling. The localized redraw pattern keeps the legend lifecycle simple but means axes don't adapt to the visible data range — acceptable for now, could be revisited.

### ADR-008: Dedicated colorTick theme token for axis contrast

**Status:** accepted
**Date:** 2026-05-07

**Context:** Axis tick marks and domain lines used `colorBorder` (`#cccccc`), which has 1.6:1 contrast on white — below the 3:1 WCAG 1.4.11 minimum for non-text contrast. Grid lines also use `colorBorder` but at `gridOpacity: 0.2`, making them decorative.

**Decision:** Added a `colorTick` theme token (default `#767676`, 4.54:1 on white). Applied to tick lines and axis domain lines in `base.ts` `styleAxis()` and `scatter.ts`. Grid lines remain on `colorBorder` + `gridOpacity`. Overridable via `--jsc-color-tick` CSS custom property. Chose `#767676` over `#949494` (3.03:1) for contrast headroom.

**Consequences:** Axis elements now meet WCAG 1.4.11. Consumers who override `--jsc-color-tick` are responsible for maintaining 3:1 contrast. Grid lines remain low-contrast (decorative). Bar segment strokes still use `colorBorder` — a separate concern tracked in the backlog.

### ADR-009: Line charts use scalePoint instead of scaleBand

**Status:** accepted
**Date:** 2026-05-07

**Context:** Line charts used `scaleBand` with `paddingOuter(0.5)`, placing the first data point ~20-30px from the y-axis. Line charts are not band-based — they plot continuous data at discrete category positions. The first data point should sit at the y-axis when its value is non-null.

**Decision:** Line charts now use D3's `scalePoint` with `padding(0)`. The scaffold's `buildScales()` accepts a `scaleType: 'band' | 'point'` parameter (default `'band'`) instead of a `chartType` parameter, keeping the scaffold generic. The `render()` method maps `chartType === 'line'` to `scaleType = 'point'`. Slot width for label fitting uses `N-1` as the divisor for point scale spacing. The line renderer removes the `+ bandwidth()/2` offset.

**Consequences:** First/last data points are at the plot area edges. For single-category charts, the point is centered (D3 default behavior with one domain value). The `ScaffoldRenderContext.xScale` type now includes `ScalePoint<string>` in its union. Edge label containment is handled by the RightMargin layout zone (ADR-011).

### ADR-011: RightMargin zone for point-scale edge label containment

**Status:** accepted
**Date:** 2026-05-08

**Context:** Line charts use `scalePoint` with `padding(0)` (ADR-009), placing the last data point at the exact right edge of the plot area. The centered x-axis label at that position extends past the container boundary, causing visible clipping when the container width is the constraining limit. Previous attempts (scale insets, text-anchor hacks) created geometry mismatches with `fitLabels()` or fragile rendering special-cases.

**Decision:** Add a `RightMargin` zone to the layout engine. The shared row becomes `[YAxisLabels] [PlotArea] [RightMargin]`. The zone is visible for point-scale charts (line) and horizontal bar charts (to contain the last tick label). It is invisible for vertical bar variants where bands are naturally inset. Sized as `min(slotWidth/2, 40)` using a pre-margin width estimate. Capped via the same mechanism as YAxisLabels: `min(rightMargin, containerWidth - yAxisLabelsWidth - PLOT_AREA_MIN_SIZE)`. The container also gets `overflow: hidden` (saved and restored on destroy) and the SVG no longer sets `overflow: visible`. All x-axis labels use `text-anchor: middle` uniformly; the YAxisLabels zone provides space for the left half of the first label.

**Consequences:** The RightMargin zone is used for two purposes: (1) line charts — PlotArea width shrinks slightly to contain the last data point's centered x-axis label, and (2) horizontal bar charts — the zone contains the last tick label on the horizontal axis. For vertical bar/grouped-bar/stacked-bar charts, the zone remains invisible (0 width). `fitLabels()` math remains consistent — it uses the actual PlotArea width, which matches the scale range. The `ZoneType` enum gains a new member. The layout engine handles the new zone identically to YAxisLabels (shared-row, cap-based). Using `scalePoint().padding(0.5)` was considered but rejected because it moves the first data point away from the y-axis, violating ADR-009.

### ADR-010: Period-type-aware label culling with boundary alignment

**Status:** accepted
**Date:** 2026-05-07

**Context:** When charts display many time series categories, x-axis labels overlap. The existing `fitLabels()` skip mechanism uses a brute-force scan (N=2,3,4,…) producing arbitrary skip intervals like 3 or 7, which are meaningless for time series. Labels also start from index 0, landing on arbitrary years (e.g., 1987, 1994, 2001) instead of round boundaries.

**Decision:** Added `NiceSkipOptions` parameter to `fitLabels()` with `intervals` (period-type-aware sequence) and `firstAbsoluteIndex` (for boundary alignment). When provided, the skip search selects from the nice intervals and aligns labels to round boundaries (e.g., skip=10 for yearly data shows 1990, 2000, 2010). Period-type-aware interval sequences: Y=[1,2,5,10,25,…], M=[1,2,3,6,12,24,…], Q=[1,2,4,8,20,…], etc. Falls back to first+last when no interval fits. Time regularity detection reuses existing `DimensionMeta.isIrregular` flag. The option is threaded from `index.ts` through chart factories to `ChartScaffoldConfig`.

**Consequences:** Regular time series get visually clean label culling. Irregular time series and non-time axes retain the brute-force skip behavior (no regression). The `getTimePeriodInfo()` function validates all codes, not just the first. The feature only applies to chart types with categorical x-axes (line, bar, grouped-bar, stacked-bar). Pie, scatter, pyramid, and table charts are unaffected.

### ADR-012: Key figure visualization for single-value datasets

**Status:** accepted
**Date:** 2026-05-08

**Context:** When a JSON-stat 2.0 dataset has every dimension at size 1, it contains a single data point. Rendering this as a bar chart or table wastes visual space and obscures the key message. A dedicated "key figure" visualization better serves this common statistical use case.

**Decision:** Added `keyFigure` chart type. It is HTML-based (not SVG), following the table chart's pattern. The chart selector (`checkKeyFigure`) validates that `multiselectCount === 0` (all dimensions size 1) with no other constraints — null values are accepted and displayed as "–" with `aria-label="No data"`. Key figure is first in `DEFAULT_PRIORITY`, auto-selected before all other chart types. Value formatting uses `toLocaleString` with `decimals` from the JSON-stat unit metadata. Title and footer (source, updated) are consumed from `resolvedConfig` — no duplication of header/footer building logic. When a user forces `chartType: 'keyFigure'` on a multi-cell dataset, the renderer falls back to table chart. No new exported data interface; value/unit/decimals are extracted inline in `createRenderer`.

**Consequences:** Single-value datasets now get a visually dominant numeric display by default. The `ChartType` union gains a new member. Consumers can override with any other chart type via `config.chartType`. The key figure does not use the SVG scaffold or layout engine — it manages its own HTML layout via flexbox. CSS classes (`jsc-key-figure-*`) enable user styling.

### ADR-013: Dimension-aware tooltip content

**Status:** accepted
**Date:** 2026-05-10

**Context:** Tooltips showed a flat `series name` + `category: value` format regardless of how many dimensions varied. For single-series charts the series name was redundant; for multi-dimensional datasets the user couldn't tell which dimension a label belonged to.

**Decision:** `TooltipData` gains an optional `dimensionLabels: {label, value}[]` array. When populated, `Tooltip.show()` renders one `DimensionName: value` line per varying dimension, then the metric value in bold. When absent, the old format is preserved (backward compat for scatter/pyramid which build ad-hoc ChartData). `bindTooltipData()` in `bindInteractions.ts` populates dimension labels when `chartData.xLabel` exists, using `categories.length > 1` and `series.length > 1` as the "varying" signal. `ChartData` gains `seriesLabel?: string`, populated by `transformDataset()` from the series dimension's label.

**Consequences:** Standard chart tooltips now show contextual dimension names. Scatter and pyramid retain the old format. Adding dimension labels to pyramid would require extending `PyramidChartData` — deferred.

### ADR-014: Scatter and pyramid dimension-aware tooltips

**Status:** accepted
**Date:** 2026-05-10

**Context:** ADR-013 introduced dimension-aware tooltips for standard charts but left scatter and pyramid using the old format. Scatter showed `"chart title" + "label: x: 1234, y: 5678"` — mixing axis labels and values in a single string. Pyramid showed `"series name" + "categoryLabel: value"` — no dimension context.

**Decision:**

1. **Scatter** builds `dimensionLabels` directly in `scatter.ts` (not via `buildTooltipData()`) because its structure differs fundamentally — two metric values plus an observation dimension, rather than one category + one value. `TooltipData` gains `hideValueLine?: boolean` so scatter can suppress the bold value line (all info is in `dimensionLabels`). Using an explicit flag avoids overloading `value: null`, which already means "missing data" and correctly renders "–" in standard charts.

2. **Pyramid** feeds dimension labels into the existing `buildTooltipData()` mechanism by setting `xLabel` (category dimension) and `seriesLabel` (split dimension) on the `ChartData` passed to `bindInteractions`.

3. `ScatterChartData` gains `observationLabel?: string`; `PyramidChartData` gains `splitDimensionLabel?` and `categoryDimensionLabel?`. Both populated by their respective transform functions from JSON-stat dimension labels.

4. `buildTooltipData()` checks `xLabel` and `seriesLabel` independently (not nested) so partial dimension labels work.

5. `DataElementInfo` gains optional `dimensionLabels` and `hideValueLine` for charts (like scatter) that pre-build tooltip content.

**Consequences:** All chart types now show dimension-aware tooltips. Scatter's direct `dimensionLabels` construction is a chart-specific exception — changes to `buildTooltipData()` formatting won't automatically apply to scatter tooltips. The `hideValueLine` flag is scatter-specific today but available for any future chart type that has all info in `dimensionLabels`. `setFocusCallback`/`onFocus` were removed from `KeyboardNavigator` as a related cleanup (duplicate tooltip `show()` on keyboard nav).

### ADR-015: Pre-tick headroom padding on numeric axes

**Status:** accepted
**Date:** 2026-05-10

**Context:** When data values land exactly on the last tick value, the data visually touches the axis edge with no breathing room. Post-tick domain padding (extending the domain beyond the tick range) creates empty space above the top tick line, which looks unfinished and is hard to read.

**Decision:** Apply 5% of the data range as headroom to `[minValue, maxValue]` **before** calling `getTickPositions()`. The nice-tick algorithm then naturally selects a higher round tick value that provides headroom. The scale domain equals the tick range — no empty space above the top tick line. Padding is only applied on the side away from zero (bar charts anchor at zero). Percent bar charts (`percentVerticalBar`, `percentHorizontalBar`) are excluded entirely — they always show 0–100%. The same padded values are used in both `measureZoneSizes()` and `render()` to keep tick sets consistent. Scatter charts are unaffected (they have their own tick computation with built-in 5% data padding).

**Consequences:** Charts may occasionally gain an extra tick when the 5% pushes past a tick boundary, adding up to one full tick interval of visual range. This is acceptable — the same quantization already happens depending on data values, and a clean tick boundary is preferable to empty space. The `domainPadding` parameter was removed from `buildScales()`, simplifying scale construction.

### ADR-016: sourceLink URL validation and rendering approach

**Status:** accepted
**Date:** 2026-05-11

**Context:** The `sourceLink` config option lets consumers attach a URL to the auto-populated source footer text. The URL comes from consumer code, not from the JSON-stat dataset, so it could contain arbitrary input including `javascript:` or `data:` URIs.

**Decision:** Validate URLs using the `URL` constructor with an `http:` / `https:` protocol allowlist. SVG charts render source links as SVG `<a>` elements with both `href` and `xlink:href` (for older browser compatibility), `target="_blank"`, `rel="noopener noreferrer"`, `role="link"`, `tabindex="0"`, and `aria-label` including "(opens in new tab)". Key-figure charts render HTML `<a>` elements with the same security and accessibility attributes. Both paths add visual affordance (underline + pointer cursor) and focus-visible styling.

**Consequences:** Only `http:` and `https:` URLs are accepted — relative URLs, `mailto:`, and other schemes are silently rejected (treated as plain text). The `URL` constructor also rejects malformed URLs like `https://` with no host. The `sourceLink` applies to all footer items with `type === 'source'` — if multiple source items exist, they all link to the same URL.

### ADR-017: Shared footer rendering module

**Status:** accepted
**Date:** 2026-05-15

**Context:** Footer rendering logic (source, updated, custom items) was duplicated in three renderers: `base.ts` (SVG, zone-based layout), `scatter.ts` (SVG, manual layout), and `key-figure.ts` (HTML). All three contained identical `isValidLink()` helpers, sourceLink wrapping logic, and item iteration loops.

**Decision:** Extract shared footer rendering into `src/charts/footer.ts` with: `isValidLink()` URL validator, `getFooterItemText()` helper, `renderSvgFooter()` for SVG charts, and `renderHtmlFooter()` for HTML charts. Both `base.ts` and `scatter.ts` call `renderSvgFooter()` with their own positioning parameters. `key-figure.ts` calls `renderHtmlFooter()`.

**Consequences:** Footer rendering is defined once. Adding new footer features (e.g., label/value split, new interaction) requires changes in only one file. The scatter chart still computes its own footer position via manual margins — a future migration to the zone-based layout engine (tracked in backlog) would eliminate that positioning divergence too.

### ADR-018: FooterItem structured as label + value

**Status:** accepted
**Date:** 2026-05-15

**Context:** `FooterItem` had a single `text` field containing concatenated label+value (e.g., `"Source: Statistics Finland"`). This made it impossible to style, interact with, or link the label and value independently. The `sourceLink` feature (ADR-016) underlined the entire text including the label prefix.

**Decision:** `FooterItem` is now an interface with `{ type?, label, value }`. The `text` field is removed (no backward compatibility needed — library is under active development). SVG rendering produces `<text>` with two `<tspan>` children (`jsc-footer-label`, `jsc-footer-value`). HTML rendering produces two `<span>` children with the same classes. When `sourceLink` is active, `<a>` wraps the entire `<text>`/container but underline is applied only to the value element. Auto-population in `index.ts` emits `{ type: 'source', label: 'Source:', value: 'Statistics Finland' }`.

**Consequences:** Label and value can be styled independently via CSS (`.jsc-footer-label`, `.jsc-footer-value`). Future features (bold labels, clickable values, tooltip on hover) can target each part. Consumers creating custom `FooterItem` objects must provide both `label` and `value` fields (use empty string for label if not needed).

### ADR-019: Scatter chart uses shared ChartScaffold with numeric mode

**Status:** accepted
**Date:** 2026-05-15

**Context:** The scatter chart had its own parallel layout system (~430 lines) duplicating margins, axes, grid, header/footer, resize observer, and clip path logic that the zone-based ChartScaffold already provided for categorical charts. ADR-017 unified footer rendering but scatter still managed its own layout.

**Decision:** Extended `ChartScaffoldConfig` as a discriminated union: `CategoricalScaffoldConfig` (existing charts) and `NumericScaffoldConfig` (scatter). Numeric mode adds `xValueRange`, `yValueRange`, and `paddingMode` fields. The scaffold gained dedicated private methods for numeric layout: `padNumericRange()` (symmetric 5% padding with collapsed-range fallback), `measureNumericZoneSizes()`, `renderNumericGrid()` (both-axis grid), and `renderNumericAxes()` (numeric ticks on both axes). Scatter.ts was rewritten to ~150 lines: creates a scaffold with `mode: 'numeric'` and uses `onRender()` to draw only circles and bind interactions.

**Consequences:** All chart types now share the same layout engine, resize observer, clip path, header/footer, and zone allocation. Scatter-specific layout divergences (y-axis title placement, right margin, footer positioning) are eliminated. The discriminated union keeps the config type-safe — categorical charts cannot accidentally set `xValueRange`, and numeric charts cannot set `categories`. Future numeric chart types (e.g., bubble charts) can reuse the numeric scaffold mode. The `paddingMode` field is currently always `'symmetric'` but exists for future chart types that may need asymmetric padding.

### ADR-020: N-dimensional table via dedicated TableData type and table-transform module

**Status:** accepted
**Date:** 2026-05-18

**Context:** The table chart received `ChartData` (a 2D category+series structure shared with bar/line charts). This limited it to two dimensions and prevented multi-level row/column headers needed for N-dimensional JSON-stat datasets.

**Decision:** Introduced `TableData` (with `rowDimensions`, `columnDimensions`, `values[][]`, `hiddenDimensions`) as a dedicated intermediate type, and `src/data/table-transform.ts` with `computeTableOrientation()` and `transformTableData()`. Auto-orientation places time→columns, geo→rows, and alternates remaining dimensions by size for squareness (tiebreak: `dataset.id` order). Size-1 dimensions are tracked in `hiddenDimensions` for programmatic access but not rendered visually — the auto-generated title already incorporates single-value dimension info. Unit metadata from the metric dimension is auto-populated into the footer. Manual layout override via `ChartConfig.tableLayout`. The table uses `role="region"` (not `role="figure"`) since native HTML `<table>` semantics are self-describing.

**Consequences:** The table chart now handles any number of dimensions. The `TableData` type is independent of `ChartData`, following the pattern of `ScatterChartData` and `PyramidChartData`. Adding `tableLayout` to the shared `ChartConfig` is pragmatic chart-type-specific config leakage (like `xDimension`/`yDimension`); acceptable at current project scale.

### ADR-021: Map visualization as standalone renderer (not ChartScaffold)

**Status:** accepted
**Date:** 2026-05-19

**Context:** Adding choropleth map rendering to the library. The existing `ChartScaffold` (`base.ts`) is built around axis-based charts — its `render()` method hardcodes two branches (`categorical` and `numeric`), both producing axes, grid lines, and label-fitting. Maps have no axes. Adding a third `mode: 'map'` to the scaffold would require invasive changes to ~700 lines of axis/scale/grid/tick-fitting code for zero benefit.

**Decision:** The map renderer (`src/charts/map.ts`) is a standalone SVG chart that does NOT use `ChartScaffold`. It manages its own SVG lifecycle, ResizeObserver, header/footer rendering, and tooltip. It DOES use the shared zone-based layout engine (`createZones()` + `computeLayout()`) for header/footer/legend allocation, and the shared `renderSvgFooter()` from `footer.ts`. Map-specific zone configuration hides all axis-related zones (same pattern as pie chart). The map is explicitly selected via `chartType: 'map'` — it is NOT added to the automatic chart type selector, because map eligibility depends on config (geometry availability), not data shape.

**Consequences:** Maps use the same zone/layout engine as all other charts, ensuring consistent header/footer behavior. The map renderer duplicates some infrastructure (SVG creation, ResizeObserver debounce, header word-wrapping) that the scaffold also provides — acceptable for v1, can be extracted into shared utilities if more standalone renderers are added. The map does not support legend toggling (categorical legend is replaced by a stepped color-range legend).

### ADR-022: Dedicated mapColors sequential theme token

**Status:** accepted
**Date:** 2026-05-19

**Context:** Choropleth maps need a perceptually ordered sequential color ramp (light-to-dark within one hue) for value classification. The existing `seriesColors` palette is designed for categorical distinguishability — interpolating between arbitrary categorical colors produces visually meaningless gradients.

**Decision:** Added `mapColors: string[]` to `ThemeConfig` and `ResolvedTheme`. Default ramp is a 5-step blue sequential palette: `['#c6dbef', '#9ecae1', '#6baed6', '#3182bd', '#08519c']` (derived from D3's Blues scheme). The ramp is used directly for quantile classification classes. No `d3-scale-chromatic` dependency is added — the default ramp is hardcoded, and users can provide any custom sequential palette via `theme.mapColors`.

**Consequences:** Map colors are independent of the categorical series palette. Users can customize the ramp without affecting other chart types. If more sequential palettes are needed (diverging maps, bivariate maps), `mapColors` can be extended or additional tokens added.

### ADR-023: GeoJSON-only for map v1 (TopoJSON deferred)

**Status:** accepted
**Date:** 2026-05-19

**Context:** The map plan includes support for both GeoJSON and TopoJSON. TopoJSON support requires adding `topojson-client` as a dependency plus `topoObjectName` config for selecting among multiple topology objects.

**Decision:** Map v1 accepts only GeoJSON `FeatureCollection` for geometry. The `MapConfig.geometry` type is `GeoJsonFeatureCollection` (not a union with TopoJSON). Users who have TopoJSON can convert offline before passing to the library.

**Consequences:** Simpler API and no additional dependency for v1. The type can be widened to a union when TopoJSON support is added — this is a non-breaking additive change. Users with TopoJSON data need to use `topojson-client` themselves in the interim.

### ADR-024: Auto-detection of Statistics Finland geo code prefixes

**Status:** accepted
**Date:** 2026-05-19

**Context:** Statistics Finland JSON-stat datasets use prefixed geo codes (e.g., `KU005` for municipality 005, `MK01` for region 01). GeoJSON boundary data uses bare codes (e.g., `"005"`, `"01"`) in properties named after the administrative level (e.g., `kunta`, `maakunta`). The library needs to match these two code systems.

**Decision:** `map-transform.ts` auto-detects known Statistics Finland prefixes (`KU`, `MK`, `SK`, `HVA`, `HA`, `SA`, `EL`) from the first geo dimension code. When detected, the `geoIdProperty` defaults to the corresponding GeoJSON property name (e.g., `kunta` for `KU` codes) and the `geoCodeMapper` defaults to stripping the prefix. Users can override both via `MapConfig.geoIdProperty` and `MapConfig.geoCodeMapper`.

**Consequences:** Statistics Finland data works out of the box without any mapper configuration. Non-Finnish data requires explicit `geoIdProperty` and/or `geoCodeMapper` configuration. The prefix detection is a heuristic based on the first geo code — it could misfire on non-Finnish datasets that happen to start with the same letter pairs, but the user override covers this case.

### ADR-025: Equal-interval classification with nice boundaries for map legends

**Status:** superseded by ADR-027
**Date:** 2026-05-19

**Context:** Map v1 used quantile classification (`classifyQuantile`), which distributes data points equally across classes but produces irregular break boundaries (e.g., 12.3–47.8, 47.8–93.2). Users found the raw boundaries hard to read and requested round numbers matching the axis tick label style.

**Decision:** Added `classifyNiceInterval()` in `map-transform.ts` as the default classification method. It uses `linearAxisIntervalStepFunction()` from `tick-positions.ts` to snap the interval to a nice round value, then rounds the lower bound down and upper bound up to that interval. If the snapped range produces more classes than requested, excess breaks are merged from the end. `classifyQuantile` is retained in the codebase for potential future use (e.g., a `classificationMethod` config option).

**Consequences:** Legend labels now show round values (e.g., 0–200, 200–400). For highly skewed distributions (common in statistical data), most regions may fall into one or two classes — unlike quantile, which guarantees visual spread. This trade-off was explicitly accepted. The break count may be fewer than `classCount` when the nice interval produces fewer steps than requested.

### ADR-026: Portrait-aware map legend placement via RightMargin zone

**Status:** accepted
**Date:** 2026-05-19

**Context:** Finland's map is tall and narrow. When rendered in a standard container, the map uses a narrow central strip with wasted horizontal space. The bottom legend takes vertical space that could go to the map.

**Decision:** For GeoJSON with portrait aspect ratio (height/width > 1.2), the legend renders vertically in the existing `RightMargin` zone (part of the shared layout row) instead of the full-width `Legend` zone below the plot area. The GeoJSON bounding box aspect ratio is computed once and cached per dataset. A minimum width threshold (40px) prevents rendering in collapsed right margins. The `showLegend` config flag is respected in both modes. The layout engine was not modified — only the `RightMargin` zone visibility was extended to include `'map'` in `zones.ts`.

**Consequences:** Portrait maps get more vertical space for the geography. The right-side legend width is dynamically measured from break label text. For landscape/square geographies, the horizontal bottom legend is preserved unchanged. If the container is too narrow for the right-side legend (RightMargin collapses below 40px), no legend is rendered — an acceptable degradation for extremely small containers.

### ADR-027: Four classification methods with discriminated union

**Status:** accepted
**Date:** 2025-07-16

**Context:** ADR-025 introduced equal-interval classification with nice boundaries as the sole map classification method. Users needed multiple methods for different data distributions: natural breaks (Jenks) for clustered data, even ranges for uniform distributions, and continuous gradients for smooth visualization. The original `MapChartData.breaks: MapClassBreak[]` field couldn't represent a continuous gradient mode.

**Decision:** Introduced four classification methods (`jenks`, `jenks-nice`, `even-ranges`, `linear`) configurable via `MapConfig.classificationMethod`, defaulting to `jenks-nice`. The `MapChartData.breaks` field was replaced with a `classification: MapClassification` discriminated union keyed on `method`:
- Discrete methods (`jenks`, `jenks-nice`, `even-ranges`): `{ method, breaks: MapClassBreak[], gvf?: number }`
- Continuous method (`linear`): `{ method: 'linear', scaleMin, scaleMax, colors: string[] }`

Jenks uses `ckmeans` from `simple-statistics` (improved O(kn log n) DP algorithm). `jenks-nice` snaps raw Jenks breaks to round numbers using a dedicated `snapToNice()` function (replacing the previous `linearAxisIntervalStepFunction` reuse). Linear mode uses `d3.scaleLinear<string>()` for color interpolation. A new `renderGradientLegend()` renders an SVG `<linearGradient>` bar for linear mode.

**Consequences:** First non-D3 runtime dependency (`simple-statistics`). The discriminated union forces exhaustive handling via TypeScript narrowing — no more `classIndex === -1` sentinel for unclassified regions. `ClassificationMethod` and `MapClassification` are exported from the public API. GVF (Goodness of Variance Fit) is computed and attached to discrete classifications for diagnostics. Candidate search (trying multiple class counts to optimize GVF) was deferred as YAGNI — users can assess via the interactive Storybook story.

### ADR-028: MapProvider for dynamic map geometry resolution

**Status:** accepted
**Date:** 2026-05-20

**Context:** Maps require GeoJSON geometry which users previously had to supply directly via `config.map.geometry`. This prevented map from participating in automatic chart type selection — users had to explicitly set `chartType: 'map'`. Users also had to handle the geometry lifecycle (fetching, caching) entirely outside the library, with no feedback loop into chart selection.

**Decision:** Added `MapProvider` type: `(dimensionId: string, geoCodes: string[], signal: AbortSignal, timeCode?: string) => Promise<GeoJsonFeatureCollection | null>`. Users set `config.mapProvider` and the library handles resolution internally:

- `createChart` stays synchronous in return type. Async resolution is handled internally with a generation counter pattern (not a state machine) for safe cancellation across `update()`, `destroy()`, and `setChartType()`.
- A loading indicator (CSS spinner, `role="status"`, localized aria-label, `prefers-reduced-motion` aware) is inserted via `requestAnimationFrame` — if the provider resolves before rAF fires, the spinner is never painted (no flicker for cached/preloaded maps).
- `AbortSignal` is passed to the provider so users can cancel in-flight fetches.
- Direct `config.map.geometry` takes precedence — provider is not called when geometry is already provided.
- Provider errors fall back silently to the best non-map chart type (console warning).
- Explicit non-map `chartType` skips the provider entirely.
- Added `'Geo'` to `DimensionType` (previously geo dimensions were typed as `'Nominal'`).
- Map auto-selection constraint: exactly 1 multiselect dimension which is `'Geo'` type + geometry available + time dimension with exactly 1 value. Priority: after all bar charts, before `pie`.
- The provider receives the selected time period code (`timeCode`) so it can resolve the correct boundary geometry for that point in time. In auto mode, the provider is only called when the time constraint is satisfied (optimisation).
- Added `MapConfig.geoDimensionId` to ensure provider and `transformMapData` use the same geo dimension in multi-geo datasets.
- `MapConfig.geometry` is now optional (runtime validation unchanged).

**Consequences:** Map can now be auto-selected when the dataset shape is suitable and geometry is available via the provider. The generation counter pattern keeps async state management simple — each rebuild increments the counter and stale callbacks no-op. The `DimensionType` change from `'Nominal'` to `'Geo'` is a minor breaking change for consumers inspecting dimension metadata. The `MapConfig.geometry` optionality is a minor breaking change for consumers constructing `MapConfig` objects and accessing `.geometry` without null checks.

### ADR-029: Map accessibility via hidden data table, no keyboard navigation on regions

**Status:** accepted
**Date:** 2026-05-20

**Context:** The accessibility review flagged that map region `<path>` elements lack keyboard focusability (`tabindex`) and keyboard event handlers, making tooltips unreachable for keyboard/screen-reader users. The question is whether adding keyboard navigation to map regions is the right approach.

**Decision:** Map regions do NOT get keyboard navigation, focus handling, or keyboard-triggered tooltips. The primary accessible interface for map data is the existing hidden screen-reader data table (`renderScreenReaderTable`). Rationale:

1. **No natural navigation order.** Geographic regions have no inherent sequence — unlike bar chart categories or table rows, there is no meaningful "next" region. Any imposed order (alphabetical, code-based) would be arbitrary and unhelpful for spatial comprehension.
2. **Regions can be arbitrarily small.** At municipal level (300+ areas), many regions are too small to see or target on screen. Adding focus rings and keyboard interaction to invisible-sized SVG paths provides no value.
3. **Maps are inherently visual.** The spatial layout is the map's information channel. Screen-reader users benefit more from the structured data table (which has natural row/column navigation) than from stepping through unlabelled geographic shapes.
4. **The data table already exists.** `renderScreenReaderTable()` renders a visually-hidden `<table>` with region names and values, accessible via screen readers. This provides complete, navigable access to all map data.

The `aria-label` attributes on individual `<path>` elements are retained as supplementary information for users who explore the SVG, but paths remain non-focusable.

**Consequences:** Keyboard-only users cannot trigger map tooltips — they access the same data via the screen-reader table. This is consistent with how many production mapping libraries handle accessibility (data table fallback). If a future use case requires interactive region exploration (e.g., drill-down navigation), this decision can be revisited with a defined navigation model.

### ADR-030: MapProvider as sole geometry source — remove direct geometry from MapConfig

**Status:** accepted (supersedes direct geometry support from ADR-028)
**Date:** 2026-05-20

**Context:** ADR-028 introduced `mapProvider` alongside the existing `MapConfig.geometry` field, creating two paths to supply map geometry. The precedence rule (direct geometry wins over provider) added branching complexity and a public API surface that encourages the less capable pattern. Since `mapProvider` already handles preloaded/cached geometry seamlessly (instant Promise resolution = no spinner), maintaining the direct geometry path provides no unique benefit.

**Decision:** Remove `geometry` from `MapConfig`. `mapProvider` is the only way to supply map vector data. Specific changes:

1. `MapConfig` no longer has a `geometry` field.
2. `transformMapData` accepts geometry as an explicit parameter: `(dataset, geometry, mapConfig, theme)` instead of reading from `mapConfig.geometry`.
3. `createRenderer` accepts an optional `mapGeometry` parameter for the map case.
4. The `rebuildPipeline` sync path no longer checks for direct geometry — all map rendering goes through the async provider path.
5. `resolvedMapGeometry` and `lastMapAvailable` are cleared at the start of every rebuild to prevent stale state during pending provider resolution.
6. Users with pre-loaded geometry use: `mapProvider: async () => preloadedGeo`.

**Consequences:** Single mechanism simplifies both the library internals and user-facing API. All map rendering is now async (deferred to microtask), even for pre-loaded geometry. The `transformMapData` public API signature changed (breaking for direct callers). Tests and stories were migrated.

### ADR-031: Standalone chart type selection API with tri-state map availability

**Status:** accepted
**Date:** 2026-05-21

**Context:** Users who render the auto-selected chart type may want to offer a UI for switching to other valid types. The existing `getApplicableChartTypes()` requires pre-computed `DataProperties` and `DimensionMeta[]` — internal representations that users cannot easily construct from a raw JSON-stat dataset. `ChartInstance.getApplicableChartTypes()` works but requires creating a chart first. Additionally, map eligibility depends on async geometry resolution via `mapProvider`, which blocks standalone usage.

**Decision:**

1. Added two convenience functions exported from the public API:
   - `getChartTypesForDataset(dataset, options?)` — validates dataset, derives internal types, returns `ChartTypeResult[]` for all chart types with validity and rejection reasons.
   - `selectChartTypeForDataset(dataset, options?)` — same derivation, returns the single best `ChartType`.
   - On validation failure, `getChartTypesForDataset` returns all types as invalid with the validation error; `selectChartTypeForDataset` returns `'table'` (the universal fallback).

2. Changed `checkMap()` to tri-state `mapAvailable` semantics:
   - `true` — map geometry confirmed available (fully valid).
   - `false` — map geometry confirmed unavailable (rejected with "No map geometry available").
   - `undefined` (not provided) — geometry check skipped; only structural constraints validated (geo dimension exists, correct sizes, time dimension = 1).

3. Exported `CHART_TYPE_ORDER` (readonly array of all chart types in check order) and `ChartSelectorOptions` from the public API.

**Consequences:** Users can evaluate chart type eligibility from a raw dataset without creating a chart or resolving geometry. The tri-state map behavior lets UI builders show map as structurally eligible, deferring geometry confirmation to the user's own async flow. The rendering pipeline always passes an explicit `mapAvailable` boolean, so its behavior is unchanged. Elimination value detection uses a `'SSS'` heuristic — non-Finnish datasets needing precise elimination handling should use the lower-level `getApplicableChartTypes()` with manually constructed `DimensionMeta[]`.

### ADR-032: Keep SVG presentation attributes — no switch to CSS custom property injection

**Status:** accepted
**Date:** 2026-05-21

**Context:** All fill/stroke/font properties are applied via D3's `.attr('fill', ...)`, which sets SVG presentation attributes (e.g., `<rect fill="#4e79a7">`). A backlog item proposed switching to CSS custom property injection (`style="--fill: ${color}"` + `.jsc-bar { fill: var(--fill) }`) to enable consumer CSS overrides. The concern was that presentation attributes block CSS selectors.

**Decision:** Keep the current approach. No change needed.

Investigation and browser testing confirmed that SVG presentation attributes sit at the **bottom** of the CSS cascade (specificity `0,0,0` per SVG 2 §6.2). Any CSS class selector (specificity `0,1,0`) already overrides them without `!important`. Verified in Chrome: injecting `.jsc-bar { fill: blue; }` via a `<style>` element immediately overrode the `fill="#4e79a7"` presentation attribute, with `getComputedStyle(bar).fill` returning `rgb(0, 0, 255)`.

The initial premise — that `.jsc-bar { fill: blue }` has no effect — was incorrect. It would only be true if inline **styles** (`.style('fill', ...)`) were used, but the codebase uses presentation **attributes** (`.attr('fill', ...)`).

**Consequences:**
- **CSS overrides already work.** Consumers can use `.jsc-bar { fill: blue; }` or any `jsc-*` class selector to restyle chart elements.
- **SVG portability preserved.** Exported SVGs are self-contained with all visual properties as attributes — no external stylesheet dependency.
- **No migration cost.** No changes to ~127 `.attr()` calls, no test updates, no breaking changes for consumers.
- ADR-004's theme cascade (JS config → CSS custom properties → defaults) remains the primary theming mechanism; direct CSS class selectors are a complementary escape hatch for fine-grained overrides.

### ADR-033: Storybook story organization — one file per chart type with opt-in shared controls

**Status:** accepted
**Date:** 2026-05-22

**Context:** The original `ChartTypes.stories.ts` had one story per chart type (16 stories in one flat file) with no interactive controls beyond width/height. Theme properties (colors, fonts) were not exposed as Storybook controls. The single-story-per-type approach didn't showcase how charts behave with different data shapes (long labels, many categories, negative values, nulls, etc.).

**Decision:**
1. **One story file per chart type** under `stories/charts/`, each containing 2–7 stories showcasing different data scenarios (e.g., Default, ManyCategories, LongLabels, NegativeValues, WithNulls).
2. **Opt-in shared theme controls** via `themeArgTypes`/`themeArgs` objects spread into each story file's meta — not registered globally in `preview.ts`. This avoids dead controls on stories that don't route through `buildConfig`.
3. **`buildConfig(args, baseConfig)` helper** maps flat Storybook args to nested `ChartConfig` with `ThemeConfig`. Keeps `renderChart` simple and the arg→config mapping explicit.
4. **`sliceDataset` utility** derives story variants from real API fixtures by trimming categories on a dimension, keeping JSON-stat 2.0 structure valid.
5. **Sidebar hierarchy**: `Charts/Vertical Bar`, `Charts/Line`, etc. Map and Table moved under `Charts/` for consistency.

**Consequences:**
- ~50 stories across 20 files (vs. 51 stories across 9 files previously). More files but each is focused and self-contained.
- Theme controls (color pickers, font inputs, booleans) are available on chart-type stories, enabling live visual experimentation.
- Story variants are derived from real API data via `sliceDataset`, keeping data structures authentic without maintaining dozens of separate fixture files.
- Edge case and interactive stories remain as-is — they use custom DOM patterns that don't benefit from shared controls.
- Autodocs (`tags: ['autodocs']`) generates documentation pages automatically for all story files.
