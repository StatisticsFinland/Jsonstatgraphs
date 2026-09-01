// --- JSON-stat 2.0 input types ---

export interface JsonStatCategory {
  index: Record<string, number> | string[];
  label?: Record<string, string>;
  unit?: Record<string, { decimals?: number; label?: string; position?: string }>;
}

/** Dimension code to selected value code(s) filter. */
export type SelectableSelections = Record<string, string[]>;

/** Selectable-dimension settings supplied with a JSON-stat dataset. */
export interface SelectableConfig {
  selectableSelections?: SelectableSelections;
  defaultSelectableSelections?: SelectableSelections;
  multiSelectableDimensionCode?: string;
}

export interface JsonStatSourceExtension {
  dimension?: Record<string, string>;
  category?: Record<string, Record<string, string>>;
}

export interface JsonStatChartExtension {
  sources?: JsonStatSourceExtension;
}

/** Known JSON-stat extension fields while preserving extension fields outside this library's scope. */
export interface JsonStatDatasetExtension {
  selectableConfig?: SelectableConfig;
  jsonstatChart?: JsonStatChartExtension;
  /** Status code to human-readable missing-value description. */
  missingValueDescriptions?: Record<string, string>;
  [key: string]: unknown;
}

export interface JsonStatDimension {
  label?: string;
  category: JsonStatCategory;
  extension?: Record<string, unknown>;
}

export interface JsonStatDataset {
  version?: string;
  class?: string;
  label?: string;
  source?: string;
  updated?: string;
  id: string[];
  size: number[];
  dimension: Record<string, JsonStatDimension>;
  value: (number | null | string)[];
  /** JSON-stat observation status codes keyed by flat observation index. */
  status?: Record<string, string>;
  extension?: JsonStatDatasetExtension;
  role?: {
    time?: string[];
    geo?: string[];
    metric?: string[];
  };
}

// --- Chart types ---

export type ChartType =
  | 'line'
  | 'verticalBar'
  | 'horizontalBar'
  | 'groupedVerticalBar'
  | 'groupedHorizontalBar'
  | 'stackedVerticalBar'
  | 'stackedHorizontalBar'
  | 'percentVerticalBar'
  | 'percentHorizontalBar'
  | 'pie'
  | 'scatterPlot'
  | 'pyramid'
  | 'keyFigure'
  | 'table'
  | 'map';

// --- GeoJSON types (minimal subset for map visualization) ---

export interface GeoJsonGeometry {
  type: 'Point' | 'MultiPoint' | 'LineString' | 'MultiLineString' | 'Polygon' | 'MultiPolygon' | 'GeometryCollection';
  coordinates?: unknown;
  geometries?: GeoJsonGeometry[];
}

export interface GeoJsonProperties {
  [key: string]: unknown;
}

export interface GeoJsonFeature {
  type: 'Feature';
  geometry: GeoJsonGeometry;
  properties: GeoJsonProperties | null;
  id?: string | number;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJsonFeature[];
}

// --- Dimension metadata for chart selection ---

export type DimensionType = 'Content' | 'Time' | 'Ordinal' | 'Nominal' | 'Geo' | 'Other';

export interface DimensionMeta {
  code: string;
  type: DimensionType;
  size: number;
  numberOfUnits?: number;
  isIrregular?: boolean;
  /** Elimination/sum value code (e.g. 'SSS'). Used as the default single-value fallback and to reject chart types where totals would distort aggregation. */
  eliminationValueCode?: string | null;
  name?: string;
  values?: DimensionValueMeta[];
}

export interface DimensionValueMeta {
  code: string;
  name: string;
}

// --- Chart configuration ---

export interface FooterItem {
  type?: 'source' | 'updated' | 'unit' | 'custom';
  label: string;
  value: string;
}

export interface FunctionalMenuItem {
  text: string;
  prefixIcon?: string;
  suffixIcon?: string;
  onClick: () => void;
}

export interface LinkMenuItem {
  text: string;
  prefixIcon?: string;
  suffixIcon?: string;
  url: string;
  isExternal?: boolean;
  openNewTab?: boolean;
}

export type BurgerMenuItemDefinition = FunctionalMenuItem | LinkMenuItem;

export interface ThemeConfig {
  fontFamily?: string;
  fontSizeTick?: string;
  fontSizeLabel?: string;
  fontSizeTitle?: string;
  fontWeightNormal?: number;
  fontWeightBold?: number;
  colorBackground?: string;
  colorSurface?: string;
  colorText?: string;
  colorTextSecondary?: string;
  colorBorder?: string;
  colorTick?: string;
  colorError?: string;
  colorFocusRing?: string;
  colorLink?: string;
  borderRadius?: string;
  gridOpacity?: number;
  tooltipPadding?: string;
  tooltipBoxShadow?: string;
  burgerMenuBackground?: string;
  burgerMenuBorderColor?: string;
  burgerMenuBorderRadius?: string;
  burgerMenuShadow?: string;
  burgerMenuItemHoverBackground?: string;
  burgerMenuItemActiveBackground?: string;
  burgerMenuItemSeparatorColor?: string;
  seriesColors?: string[];
  mapColors?: string[];
}

export interface ChartConfig {
  chartType?: ChartType;
  accessibilityMode?: boolean;
  theme?: ThemeConfig;
  locale?: string;
  title?: string;
  subtitle?: string;
  footerItems?: FooterItem[];
  sourceLink?: string;
  ariaLabel?: string;
  height?: number;
  layout?: Layout;
  defaultSelectableSelections?: SelectableSelections;
  multiSelectableDimensionCode?: string;
  map?: MapConfig;
  /** Async function that resolves geographic boundaries for a given dimension.
   *  Receives the geo dimension ID, geo codes, an AbortSignal, and optionally
   *  the selected time period code for time-dependent boundary resolution.
   *  Return `null` if no geometry is available. */
  mapProvider?: MapProvider;
  showHeader?: boolean;
  /** Add the dataset unit to the footer. Units are shown on the y-axis by default. */
  showUnit?: boolean;
  showLegend?: boolean;
  autoTitle?: boolean;
  showBurgerMenu?: boolean;
  /** Internal layout state set by the chart pipeline when the menu is rendered. */
  burgerMenuVisible?: boolean;
  menuItemDefinitions?: BurgerMenuItemDefinition[];
  menuIconInheritColor?: boolean;
  /** Allow the line chart / scatter plot value axis to omit the zero baseline (default: always includes 0). No effect on other chart types. */
  cutValueAxis?: boolean;
  /** Sorting for horizontal bar, grouped/stacked/percent horizontal bar, and pie charts:
   *  `no_sorting` | `reversed` | `sum` | `ascending` | `descending`. Matching series codes are supported
   *  for grouped, stacked, and percent horizontal bars; grouped horizontal bars prioritize that series. */
  sorting?: string;
}

// --- Resolved theme (all values present) ---

export interface ResolvedTheme {
  fontFamily: string;
  fontSizeTick: string;
  fontSizeLabel: string;
  fontSizeTitle: string;
  fontWeightNormal: number;
  fontWeightBold: number;
  colorBackground: string;
  colorSurface: string;
  colorText: string;
  colorTextSecondary: string;
  colorBorder: string;
  colorTick: string;
  colorError: string;
  colorFocusRing: string;
  colorLink: string;
  borderRadius: string;
  gridOpacity: number;
  tooltipPadding: string;
  tooltipBoxShadow: string;
  burgerMenuBackground: string;
  burgerMenuBorderColor: string;
  burgerMenuBorderRadius: string;
  burgerMenuShadow: string;
  burgerMenuItemHoverBackground: string;
  burgerMenuItemActiveBackground: string;
  burgerMenuItemSeparatorColor: string;
  seriesColors: string[];
  mapColors: string[];
}

// --- Chart data (transformed from JSON-stat) ---

export interface DataPoint {
  value: number | null;
  label: string;
  categoryCode: string;
}

export interface DataSeries {
  name: string;
  code: string;
  points: DataPoint[];
}

export interface ChartData {
  series: DataSeries[];
  categories: string[];
  categoryLabels: string[];
  xLabel?: string;
  seriesLabel?: string;
  yLabel?: string;
}

// Scatter plot data (x/y pairs rather than category-based)
export interface ScatterDataPoint {
  x: number | null;
  y: number | null;
  label: string;
  code: string;
}

export interface ScatterChartData {
  points: ScatterDataPoint[];
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  observationLabel?: string;
}

// Pyramid chart data (two opposed series)
export interface PyramidChartData {
  leftSeries: DataSeries;
  rightSeries: DataSeries;
  categories: string[];
  categoryLabels: string[];
  splitDimensionLabel?: string;
  categoryDimensionLabel?: string;
}

// Table chart data (N-dimensional pivot table)

export interface Layout {
  rows: string[];
  columns: string[];
}

/** Async function that resolves geographic boundaries for a given dimension.
 *  Called internally by `createChart` when the dataset has a geo dimension.
 *  Return `null` if no geometry is available for the given dimension.
 *  The optional `timeCode` provides the selected time period code so the provider
 *  can resolve the correct boundary geometry for that point in time. */
export type MapProvider = (
  dimensionId: string,
  geoCodes: string[],
  signal: AbortSignal,
  timeCode?: string,
) => Promise<GeoJsonFeatureCollection | null>;

// Map chart configuration

export interface MapConfig {
  /** Override which geo dimension to use (dimension id). */
  geoDimensionId?: string;
  /** Feature property name to match against geo dimension codes. */
  geoIdProperty?: string;
  /** Transform dataset geo value codes before matching to GeoJSON feature properties.
   *  E.g. (code) => code.replace(/^[A-Z]{2,3}/, '') to strip a prefix.
   *  Default: auto-strips known Statistics Finland prefixes (KU, MK, SK, HA, SA, EL, HVA). */
  geoCodeMapper?: (datasetCode: string) => string;
  /** Number of classification classes (default: 5) */
  classCount?: number;
  /** Classification method for coloring regions (default: 'jenks-nice').
   *  - 'jenks' — Optimal natural breaks via ckmeans (raw boundaries)
   *  - 'jenks-nice' — Natural breaks snapped to nice round numbers
   *  - 'even-ranges' — Equal-width intervals with nice boundaries
   *  - 'linear' — Continuous gradient, no discrete classes */
  classificationMethod?: ClassificationMethod;
}

export type ClassificationMethod = 'jenks' | 'jenks-nice' | 'even-ranges' | 'linear';

/** Classification result — discriminated union by method */
export type MapClassification =
  | { method: 'jenks' | 'jenks-nice' | 'even-ranges'; breaks: MapClassBreak[]; gvf?: number }
  | { method: 'linear'; scaleMin: number; scaleMax: number; colors: string[] };

export interface TableDimension {
  code: string;
  label: string;
  categories: { code: string; label: string }[];
}

export interface TableData {
  /** Dimensions placed on rows, in order (outermost first). */
  rowDimensions: TableDimension[];
  /** Dimensions placed on columns, in order (outermost first). */
  columnDimensions: TableDimension[];
  /** 2D values array: values[rowIndex][colIndex]. Row index is the Cartesian product of row dimensions, col index is the Cartesian product of column dimensions. */
  values: (number | null)[][];
  /** Missing-value descriptions parallel to `values`; null means use the fallback marker. */
  missingValueDescriptions?: (string | null)[][];
  /** Dimensions with only 1 value that were hidden from the table structure. Useful for metadata display. */
  hiddenDimensions: { code: string; label: string; value: string }[];
}

// Map chart data (transformed from JSON-stat + GeoJSON)

export interface MapRegionData {
  /** GeoJSON feature for this region */
  feature: GeoJsonFeature;
  /** Statistical value (null if unmatched) */
  value: number | null;
  /** Region name from the geo dimension labels */
  label: string;
  /** Geo dimension code from the dataset */
  code: string;
  /** Classification class index (0-based, -1 if no data) */
  classIndex: number;
  /** Fill color assigned by the classification */
  color: string;
}

export interface MapClassBreak {
  /** Minimum value (inclusive) */
  min: number;
  /** Maximum value (exclusive, except for last class) */
  max: number;
  /** Color for this class */
  color: string;
  /** When true, this class represents "≥ min" (open-ended upper bound) */
  openEnded?: boolean;
}

export interface MapChartData {
  /** All regions with their data and colors */
  regions: MapRegionData[];
  /** Classification result (breaks for discrete methods, scale for linear) */
  classification: MapClassification;
  /** Color for regions with no data */
  noDataColor: string;
  /** Whether any regions have no data */
  hasNoData: boolean;
  /** Geo dimension label (e.g., "Region", "Municipality") */
  geoDimensionLabel: string;
  /** Value dimension label (e.g., "Population") */
  valueDimensionLabel: string;
  /** Unit label if available */
  unit?: string;
  /** Decimal precision from metadata */
  decimals?: number;
}

// --- Layout system ---

export enum ZoneType {
  Header = 'header',
  YAxisTitle = 'yAxisTitle',
  YAxisLabels = 'yAxisLabels',
  PlotArea = 'plotArea',
  RightMargin = 'rightMargin',
  XAxisLabels = 'xAxisLabels',
  XAxisTitle = 'xAxisTitle',
  Legend = 'legend',
  FooterText = 'footerText',
}

export interface ZoneConfig {
  type: ZoneType;
  minSize: number;
  preferredSize: number;
  priority: number;
  visible: boolean;
}

export interface ZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  zones: Map<ZoneType, ZoneRect>;
  collapsed: ZoneType[];
}

// --- Chart instance (public API return type) ---

export interface ChartInstance {
  update(dataset: JsonStatDataset, config?: ChartConfig, selectableSelections?: SelectableSelections): void;
  destroy(): void;
  setChartType(type: ChartType): void;
  getChartType(): ChartType;
  getApplicableChartTypes(): ChartTypeResult[];
}

// --- Chart type selection result ---

import { ChartRejectionReason } from './data/chart-rejection-reason';
export { ChartRejectionReason } from './data/chart-rejection-reason';

export interface ChartTypeResult {
  type: ChartType;
  valid: boolean;
  rejectionReasons: ChartRejectionReason[];
}

// --- Header builder types ---

export interface HeaderBuildOptions {
  locale?: string;
  headerEditOverride?: string;
  selectableTimeDimension?: boolean;
}

export interface HeaderResult {
  header: string;
}
