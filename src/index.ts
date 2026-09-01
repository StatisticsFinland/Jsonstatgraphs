// Re-export types
export type {
  JsonStatCategory,
  JsonStatDimension,
  JsonStatDataset,
  JsonStatDatasetExtension,
  JsonStatSourceExtension,
  JsonStatChartExtension,
  SelectableConfig,
  SelectableSelections,
  ChartType,
  ChartTypeResult,
  FooterItem,
  ThemeConfig,
  ChartConfig,
  ResolvedTheme,
  DataPoint,
  DataSeries,
  ChartData,
  ScatterDataPoint,
  ScatterChartData,
  PyramidChartData,
  ZoneType,
  ZoneConfig,
  ZoneRect,
  LayoutResult,
  ChartInstance,
  TableData,
  Layout,
  TableDimension,
  MapConfig,
  MapProvider,
  MapChartData,
  MapRegionData,
  MapClassBreak,
  ClassificationMethod,
  MapClassification,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
} from './types';

import { buildHeader } from './data/header-builder';
export { getSeriesColor } from './theme/palette';

// Internal imports
import type {
  JsonStatDataset,
  ChartConfig,
  ChartInstance,
  ChartType,
  ChartTypeResult,
  DimensionMeta,
  DimensionType,
  ResolvedTheme,
  ScatterChartData,
  PyramidChartData,
  GeoJsonFeatureCollection,
  SelectableSelections,
} from './types';
import { validateDataset } from './data/validate';
import {
  transformDataset,
  transformScatterData,
  transformPyramidData,
  getOrderedCodes,
} from './data/transform';
import { applySorting } from './data/sorting';
import { transformTableData } from './data/table-transform';
import { hasSelectableDatasetOptions, resolveSelectableDatasetOptions } from './data/selectable-settings';
import { rebuildDataset, resolveSelectedCodes } from './data/rebuild-dataset';
import { getApplicableChartTypes, selectDefaultChartType, CHART_TYPE_ORDER, ChartRejectionReason } from './data/chart-selector';
import type { DataProperties, ChartSelectorOptions } from './data/chart-selector';
import { resolveTheme } from './theme/theme';
import { createBarChart } from './charts/bar';
import { createLineChart } from './charts/line';
import { createGroupedBarChart } from './charts/grouped-bar';
import { createStackedBarChart } from './charts/stacked-bar';
import { createPieChart } from './charts/pie';
import { createScatterChart } from './charts/scatter';
import { createPyramidChart } from './charts/pyramid';
import { createTableChart } from './charts/table';
import { createKeyFigureChart } from './charts/key-figure';
import { createMapChart } from './charts/map';
import { transformMapData } from './data/map-transform';
import { BurgerMenu } from './interaction/burger-menu';
import { resolveDatasetSource } from './data/source';

import { getLocaleStrings } from './locale/strings';
import type { NiceSkipOptions } from './layout/label-fitting';

// Re-export used-internally utilities
export { validateDataset } from './data/validate';
export { transformDataset } from './data/transform';
export { transformTableData } from './data/table-transform';
export { getApplicableChartTypes, selectDefaultChartType } from './data/chart-selector';
export type { ChartSelectorOptions, DataProperties } from './data/chart-selector';
export { resolveTheme } from './theme/theme';
export { transformMapData } from './data/map-transform';
export { resolveDatasetSource } from './data/source';

// --- Internal helpers ---

import { checkTimeIrregularity, getTimePeriodInfo } from './data/time-regularity';

function deriveDataProperties(dataset: JsonStatDataset): DataProperties {
  let hasActualData = false;
  let hasMissingData = false;
  let hasNegativeData = false;
  for (const v of dataset.value) {
    if (v === null || typeof v === 'string') {
      hasMissingData = true;
    } else {
      hasActualData = true;
      if (v < 0) hasNegativeData = true;
    }
  }
  return { hasActualData, hasMissingData, hasNegativeData };
}

function resolveLocale(cfgLocale?: string, navigatorLanguage?: string): string {
  return cfgLocale ?? navigatorLanguage ?? 'en';
}

function deriveDimensionMeta(dataset: JsonStatDataset): DimensionMeta[] {
  return dataset.id.map((dimId, i) => {
    let type: DimensionType = 'Other';
    if (dataset.role?.time?.includes(dimId)) type = 'Time';
    else if (dataset.role?.metric?.includes(dimId)) type = 'Content';
    else if (dataset.role?.geo?.includes(dimId)) type = 'Geo';

    const dim = dataset.dimension[dimId];
    const codes = getOrderedCodes(dim.category.index);
    const values = codes.map(code => ({
      code,
      name: dim.category.label?.[code] ?? code,
    }));

    const eliminationValueCode = codes.includes('SSS') ? 'SSS' : undefined;
    const isIrregular = type === 'Time' ? checkTimeIrregularity(codes) : undefined;

    let numberOfUnits: number | undefined;
    if (type === 'Content' && dim.category.unit) {
      const unitLabels = new Set(
        codes.map(code => dim.category.unit![code]?.label).filter(Boolean)
      );
      numberOfUnits = unitLabels.size || 1;
    }

    return {
      code: dimId,
      type,
      size: dataset.size[i],
      name: dim.label ?? dimId,
      values,
      ...(eliminationValueCode !== undefined ? { eliminationValueCode } : {}),
      ...(isIrregular !== undefined ? { isIrregular } : {}),
      ...(numberOfUnits !== undefined ? { numberOfUnits } : {}),
    };
  });
}

/**
 * Returns all chart types with validity status and rejection reasons for a JSON-stat dataset.
 *
 * When `options.mapAvailable` is omitted, map eligibility is based on structural constraints only
 * (geo dimension exists, correct sizes) without confirming geometry availability.
 * Set `mapAvailable: true` or `false` for a definitive answer on map eligibility.
 *
 * Note: Elimination value detection uses a heuristic (code 'SSS') that works for Statistics Finland
 * datasets. For other data sources, use the lower-level `getApplicableChartTypes()` with manually
 * constructed `DimensionMeta[]` for precise control.
 */
export function getChartTypesForDataset(
  dataset: JsonStatDataset,
  options?: ChartSelectorOptions,
): ChartTypeResult[] {
  const validation = validateDataset(dataset);
  if (!validation.valid) {
    return CHART_TYPE_ORDER.map(type => ({
      type,
      valid: false,
      rejectionReasons: [ChartRejectionReason.InvalidDataset],
    }));
  }
  const dataProps = deriveDataProperties(dataset);
  const dimMeta = deriveDimensionMeta(dataset);
  return getApplicableChartTypes(dataProps, dimMeta, options);
}

/**
 * Selects the best chart type for a JSON-stat dataset using priority-based automatic selection.
 *
 * When `options.mapAvailable` is omitted, map is eligible based on structural constraints only.
 * See `getChartTypesForDataset` for full details on map handling.
 *
 * Note: Elimination value detection uses a heuristic (code 'SSS') suited for Statistics Finland data.
 */
export function selectChartTypeForDataset(
  dataset: JsonStatDataset,
  options?: ChartSelectorOptions,
): ChartType {
  const validation = validateDataset(dataset);
  if (!validation.valid) {
    return 'table';
  }
  const dataProps = deriveDataProperties(dataset);
  const dimMeta = deriveDimensionMeta(dataset);
  return selectDefaultChartType(dataProps, dimMeta, options);
}

function renderError(container: HTMLElement, message: string, theme: ResolvedTheme): void {
  container.innerHTML = '';
  const errDiv = document.createElement('div');
  errDiv.className = 'jsc-error';
  errDiv.setAttribute('role', 'alert');
  errDiv.style.color = theme.colorError;
  errDiv.style.padding = '16px';
  errDiv.style.fontFamily = theme.fontFamily;
  errDiv.style.fontSize = theme.fontSizeLabel;
  errDiv.style.border = `1px solid ${theme.colorError}`;
  errDiv.style.borderRadius = theme.borderRadius;
  errDiv.textContent = message;
  container.appendChild(errDiv);
}

function createSrOnlyElement(tag: string, text: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = 'jsc-sr-only';
  el.style.position = 'absolute';
  el.style.width = '1px';
  el.style.height = '1px';
  el.style.padding = '0';
  el.style.margin = '-1px';
  el.style.overflow = 'hidden';
  el.style.clip = 'rect(0,0,0,0)';
  el.style.whiteSpace = 'nowrap';
  el.style.border = '0';
  el.textContent = text;
  return el;
}

const LOADING_STRINGS: Record<string, string> = { en: 'Loading', fi: 'Ladataan', sv: 'Laddar' };
function getLoadingLabel(locale: string): string {
  const lang = locale.substring(0, 2).toLowerCase();
  return LOADING_STRINGS[lang] ?? LOADING_STRINGS['en'];
}

function renderLoadingIndicator(container: HTMLElement, theme: ResolvedTheme, ariaLabel: string): void {
  const wrapper = document.createElement('div');
  wrapper.className = 'jsc-loading';
  wrapper.setAttribute('role', 'status');
  wrapper.setAttribute('aria-label', ariaLabel);
  wrapper.setAttribute('aria-live', 'polite');
  wrapper.setAttribute('aria-atomic', 'true');
  wrapper.style.display = 'flex';
  wrapper.style.alignItems = 'center';
  wrapper.style.justifyContent = 'center';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.minHeight = '100px';
  wrapper.style.fontFamily = theme.fontFamily;

  const spinner = document.createElement('div');
  spinner.className = 'jsc-spinner';
  spinner.style.width = '32px';
  spinner.style.height = '32px';
  spinner.style.border = `3px solid ${theme.colorTick}`;
  spinner.style.borderTopColor = theme.colorTextSecondary;
  spinner.style.borderRadius = '50%';
  spinner.style.animation = 'jsc-spin 0.8s linear infinite';

  // Inject keyframes if not already present
  if (!document.getElementById('jsc-spinner-keyframes')) {
    const style = document.createElement('style');
    style.id = 'jsc-spinner-keyframes';
    style.textContent = '@keyframes jsc-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { .jsc-spinner { animation: none !important; } }';
    document.head.appendChild(style);
  }

  wrapper.appendChild(spinner);
  wrapper.appendChild(createSrOnlyElement('span', ariaLabel));
  container.appendChild(wrapper);
}

function getActiveSelectableCategoryCodes(
  dataset: JsonStatDataset,
  cfg: ChartConfig,
  selectableSelections: SelectableSelections | undefined,
): Record<string, string[]> {
  const options = resolveSelectableDatasetOptions(dataset, cfg, selectableSelections);
  const selectableDimensionCodes = new Set([
    ...Object.keys(options.defaultSelectableSelections ?? {}),
    ...Object.keys(options.selectableSelections ?? {}),
    ...(options.multiSelectableDimensionCode ? [options.multiSelectableDimensionCode] : []),
  ]);
  return Object.fromEntries([...selectableDimensionCodes].map(dimensionCode => {
    const categoryCodes = getOrderedCodes(dataset.dimension[dimensionCode].category.index);
    const selectedCodes = resolveSelectedCodes(
      options.selectableSelections?.[dimensionCode],
      options.defaultSelectableSelections?.[dimensionCode],
      categoryCodes,
      dataset.role?.time?.includes(dimensionCode) ?? false,
      dimensionCode,
    );
    return [dimensionCode, selectedCodes];
  }));
}

function getAutoTitleDimensions(
  dataset: JsonStatDataset,
  cfg: ChartConfig,
  selectableSelections: SelectableSelections | undefined,
  dimensions: DimensionMeta[],
): DimensionMeta[] {
  const options = resolveSelectableDatasetOptions(dataset, cfg, selectableSelections);
  const selectableDimensionCodes = new Set([
    ...Object.keys(options.defaultSelectableSelections ?? {}),
    ...Object.keys(options.selectableSelections ?? {}),
    ...(options.multiSelectableDimensionCode ? [options.multiSelectableDimensionCode] : []),
  ]);

  return dimensions.map(dimension => {
    if (!selectableDimensionCodes.has(dimension.code)) return dimension;

    const categoryCodes = getOrderedCodes(dataset.dimension[dimension.code].category.index);
    const selectedCodes = resolveSelectedCodes(
      options.selectableSelections?.[dimension.code],
      options.defaultSelectableSelections?.[dimension.code],
      categoryCodes,
      dataset.role?.time?.includes(dimension.code) ?? false,
      dimension.code,
    );
    const titleCodes = dimension.code === options.multiSelectableDimensionCode
      ? selectedCodes
      : selectedCodes.slice(0, 1);
    const selectedCodeSet = new Set(titleCodes);

    return {
      ...dimension,
      size: titleCodes.length,
      values: dimension.values?.filter(value => selectedCodeSet.has(value.code)),
    };
  });
}

function getScatterContentDimensionId(dataset: JsonStatDataset): string {
  return dataset.role?.metric?.[0] ??
    dataset.id.find((dimId) => {
      const idx = dataset.id.indexOf(dimId);
      return !dataset.role?.time?.includes(dimId) && dataset.size[idx] > 1;
    }) ??
    dataset.id[0];
}

function getPyramidSplitDimensionId(dataset: JsonStatDataset): string | undefined {
  const metricDimensions = new Set(dataset.role?.metric ?? []);
  return dataset.id.find((dimensionCode, index) =>
    !metricDimensions.has(dimensionCode)
    && !dataset.role?.time?.includes(dimensionCode)
    && dataset.size[index] === 2,
  ) ?? dataset.id.find((dimensionCode, index) =>
    !dataset.role?.time?.includes(dimensionCode) && dataset.size[index] === 2,
  );
}

function validateRendererSelectableDimensions(
  dataset: JsonStatDataset,
  cfg: ChartConfig,
  selectableSelections: SelectableSelections | undefined,
  type: ChartType,
): void {
  if (type !== 'scatterPlot' && type !== 'pyramid') return;

  const options = resolveSelectableDatasetOptions(dataset, cfg, selectableSelections);
  const selectableDimensionCodes = new Set([
    ...Object.keys(options.selectableSelections ?? {}),
    ...Object.keys(options.defaultSelectableSelections ?? {}),
    ...(options.multiSelectableDimensionCode ? [options.multiSelectableDimensionCode] : []),
  ]);
  const requiredDimensionCode = type === 'scatterPlot'
    ? getScatterContentDimensionId(dataset)
    : getPyramidSplitDimensionId(dataset);

  if (requiredDimensionCode && selectableDimensionCodes.has(requiredDimensionCode)) {
    const rendererDimension = type === 'scatterPlot' ? 'metric/content' : 'split';
    throw new Error(
      `[JsonStatChart] Dimension "${requiredDimensionCode}" cannot be selectable for ${type}: it defines the ${rendererDimension} dimension`,
    );
  }
}

function transformScatterDataForChart(
  dataset: JsonStatDataset,
  cfg: ChartConfig,
  activeCategoryCodes: Record<string, string[]>,
): ScatterChartData {
  const contentDimId = getScatterContentDimensionId(dataset);

  const contentDim = dataset.dimension[contentDimId];
  const contentCodes = getOrderedCodes(contentDim.category.index);

  if (contentCodes.length < 2) {
    return { points: [], xLabel: '', yLabel: '' };
  }

  return transformScatterData(dataset, {
    xContentValue: contentCodes[1],
    yContentValue: contentCodes[0],
    observationDimension: cfg.layout?.columns[0],
    activeCategoryCodes,
  });
}

function transformPyramidDataForChart(
  dataset: JsonStatDataset,
  _cfg: ChartConfig,
  activeCategoryCodes: Record<string, string[]>,
): PyramidChartData {
  const metricDimensions = new Set(dataset.role?.metric ?? []);
  const dimSizes = dataset.id.map((id, index) => ({ id, size: dataset.size[index] }));
  const visibleDimensions = dimSizes.filter(dimension =>
    !activeCategoryCodes[dimension.id] && !metricDimensions.has(dimension.id),
  );
  const splitDim = visibleDimensions.find((d) => d.size === 2) ?? dimSizes.find((d) => d.id === getPyramidSplitDimensionId(dataset));
  const catDim =
    visibleDimensions.find((d) => d.id !== splitDim?.id && d.size > 1) ??
    dimSizes.find((d) => d.id !== splitDim?.id && d.size > 1) ??
    visibleDimensions.find((d) => d.id !== splitDim?.id) ??
    dimSizes.find((d) => d.id !== splitDim?.id);

  return transformPyramidData(dataset, {
    categoryDimension: catDim?.id ?? dataset.id[0],
    splitDimension: splitDim?.id ?? dataset.id[1],
    activeCategoryCodes,
  });
}

/** Key figure requires all dimensions to have exactly one category. */
function isKeyFigureCompatible(
  dataset: JsonStatDataset,
  activeCategoryCodes: Record<string, string[]> = {},
): boolean {
  return dataset.size.length > 0 && dataset.id.every((dimensionCode, index) =>
    dataset.size[index] === 1 || activeCategoryCodes[dimensionCode] !== undefined,
  );
}

function isChartVisualizationType(type: ChartType): boolean {
  return type !== 'table' && type !== 'keyFigure' && type !== 'map';
}

function extractKeyFigureData(
  dataset: JsonStatDataset,
  activeCategoryCodes: Record<string, string[]>,
): { value: number | null; unit: string; decimals?: number } {
  const strides = dataset.size.map((_, index) => dataset.size.slice(index + 1).reduce((product, size) => product * size, 1));
  const sourceIndex = dataset.id.reduce((index, dimensionCode, dimensionIndex) => {
    const categoryCode = activeCategoryCodes[dimensionCode]?.[0] ?? getOrderedCodes(dataset.dimension[dimensionCode].category.index)[0];
    return index + getOrderedCodes(dataset.dimension[dimensionCode].category.index).indexOf(categoryCode) * strides[dimensionIndex];
  }, 0);
  const rawValue = dataset.value[sourceIndex];
  const value = rawValue === null || typeof rawValue === 'string' ? null : rawValue;

  // Extract unit from content dimension
  let unit = '';
  let decimals: number | undefined;
  const contentDimId = dataset.role?.metric?.[0] ?? dataset.id[0];
  const contentDim = dataset.dimension[contentDimId];
  if (contentDim?.category?.unit) {
    const codes = activeCategoryCodes[contentDimId] ?? getOrderedCodes(contentDim.category.index);
    const unitInfo = contentDim.category.unit[codes[0]];
    if (unitInfo) {
      unit = unitInfo.label ?? '';
      decimals = unitInfo.decimals;
    }
  }

  return { value, unit, decimals };
}

const NICE_INTERVALS: Record<string, number[]> = {
  Y: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
  H: [1, 2, 4, 10, 20, 50, 100],
  Q: [1, 2, 4, 8, 20, 40, 100],
  M: [1, 2, 3, 6, 12, 24, 60, 120],
  W: [1, 2, 4, 13, 26, 52, 104],
  D: [1, 2, 7, 14, 30, 90, 365],
};

function computeTimeSeriesLabels(
  dims: DimensionMeta[],
  dataset: JsonStatDataset,
  xDimension?: string,
): NiceSkipOptions | undefined {
  const xDimId = xDimension ?? dataset.id.find((id) => dataset.role?.time?.includes(id));
  if (!xDimId) return undefined;

  const dimMeta = dims.find(d => d.code === xDimId);
  if (dimMeta?.type !== 'Time' || dimMeta?.isIrregular) return undefined;

  const dim = dataset.dimension[xDimId];
  const codes = getOrderedCodes(dim.category.index);
  const periodInfo = getTimePeriodInfo(codes);
  if (!periodInfo) return undefined;

  const intervals = NICE_INTERVALS[periodInfo.periodType];
  if (!intervals) return undefined;

  return {
    intervals,
    firstAbsoluteIndex: periodInfo.firstAbsoluteIndex,
  };
}

function createRenderer(
  type: ChartType,
  container: HTMLElement,
  activeDataset: JsonStatDataset,
  cfg: ChartConfig,
  selectableOptions: ReturnType<typeof resolveSelectableDatasetOptions>,
  burgerMenuVisible: boolean,
  timeSeriesLabels?: NiceSkipOptions,
  mapGeometry?: GeoJsonFeatureCollection,
): { destroy(): void } {
  const rendererConfig = { ...cfg, burgerMenuVisible };
  const datasetTransformOptions = {
    layout: selectableOptions.layout,
    multiSelectableDimensionCode: selectableOptions.multiSelectableDimensionCode,
  };
  switch (type) {
    case 'line':
      return createLineChart({
        container,
        data: transformDataset(activeDataset, datasetTransformOptions),
        config: rendererConfig,
        timeSeriesLabels,
      });
    case 'horizontalBar':
      return createBarChart({
        container,
        data: applySorting(
          transformDataset(activeDataset, datasetTransformOptions),
          cfg.sorting,
          false,
          type
        ),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    case 'verticalBar':
      return createBarChart({
        container,
        data: transformDataset(activeDataset, datasetTransformOptions),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    case 'groupedHorizontalBar':
      return createGroupedBarChart({
        container,
        data: applySorting(
          transformDataset(activeDataset, datasetTransformOptions),
          cfg.sorting,
          false,
          type
        ),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    case 'groupedVerticalBar':
      return createGroupedBarChart({
        container,
        data: transformDataset(activeDataset, datasetTransformOptions),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    case 'stackedHorizontalBar':
    case 'percentHorizontalBar': {
      const isPercent = type === 'percentHorizontalBar';
      return createStackedBarChart({
        container,
        data: applySorting(
          transformDataset(activeDataset, datasetTransformOptions),
          cfg.sorting,
          isPercent,
          type
        ),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    }
    case 'stackedVerticalBar':
    case 'percentVerticalBar':
      return createStackedBarChart({
        container,
        data: transformDataset(activeDataset, datasetTransformOptions),
        config: rendererConfig,
        chartType: type,
        timeSeriesLabels,
      });
    case 'pie':
      return createPieChart({
        container,
        data: applySorting(
          transformDataset(activeDataset, datasetTransformOptions),
          cfg.sorting,
          false,
          type
        ),
        config: rendererConfig,
      });
    case 'scatterPlot':
      return createScatterChart({
        container,
        data: transformScatterDataForChart(activeDataset, cfg, {}),
        config: rendererConfig,
      });
    case 'pyramid':
      return createPyramidChart({
        container,
        data: transformPyramidDataForChart(activeDataset, cfg, {}),
        config: rendererConfig,
      });
    case 'keyFigure': {
      const kfData = extractKeyFigureData(activeDataset, {});
      return createKeyFigureChart({
        container,
        value: kfData.value,
        unit: kfData.unit,
        decimals: kfData.decimals,
        config: rendererConfig,
      });
    }
    case 'table':
      return createTableChart({
        container,
        data: transformTableData(activeDataset, { layout: selectableOptions.layout }),
        config: rendererConfig,
        burgerMenuVisible,
      });
    case 'map': {
      if (!mapGeometry) {
        throw new Error('[JsonStatChart] Map chart requires mapProvider to supply geometry');
      }
      const theme = resolveTheme(container, cfg.theme);
      const mapData = transformMapData(activeDataset, mapGeometry, cfg.map ?? {}, theme);
      return createMapChart({
        container,
        data: mapData,
        config: rendererConfig,
      });
    }
  }
}

// --- Main API ---

export function createChart(
  container: HTMLElement,
  dataset: JsonStatDataset,
  config?: ChartConfig,
  selectableSelections?: SelectableSelections,
): ChartInstance {
  if (!(container instanceof HTMLElement)) {
    throw new TypeError('[JsonStatChart] container must be an HTMLElement');
  }

  let currentDataset = dataset;
  let currentConfig: ChartConfig = config ?? {};
  let currentSelectableSelections = selectableSelections;
  let currentChartType: ChartType = 'table';
  let currentRenderer: { destroy(): void } | null = null;
  let destroyed = false;
  let chartTypeOverride: ChartType | null = null;
  let generation = 0;
  let pendingAbort: AbortController | null = null;
  let pendingSpinnerRaf: number | null = null;
  let pendingAnnouncementTimer: ReturnType<typeof setTimeout> | null = null;
  let lastMapAvailable = false;
  let resolvedMapGeometry: GeoJsonFeatureCollection | null = null;
  let burgerMenu: BurgerMenu | null = null;
  let chartModeType: ChartType | null = null;
  let accessibilityMode = currentConfig.accessibilityMode ?? false;

  function clearPendingAnnouncement(): void {
    if (pendingAnnouncementTimer !== null) {
      clearTimeout(pendingAnnouncementTimer);
      pendingAnnouncementTimer = null;
    }
  }

  function announceChartLoaded(): void {
    clearPendingAnnouncement();
    const announcement = createSrOnlyElement('div', 'Chart loaded');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    container.appendChild(announcement);
    pendingAnnouncementTimer = setTimeout(() => {
      announcement.remove();
      pendingAnnouncementTimer = null;
    }, 1000);
  }

  function applyChartTypeOverride(type: ChartType): void {
    if (destroyed) return;
    chartTypeOverride = type;
    try {
      rebuildPipeline(currentDataset, currentConfig);
    } catch (err) {
      console.warn('[JsonStatChart]', err);
      const theme = resolveTheme(container, currentConfig.theme);
      renderError(
        container,
        err instanceof Error ? err.message : 'An unexpected error occurred',
        theme,
      );
    }
  }

  function rebuildPipeline(ds: JsonStatDataset, cfg: ChartConfig): void {
    // Increment generation to invalidate any pending async callbacks
    generation++;
    const currentGen = generation;

    // Cancel any pending map provider resolution
    if (pendingAbort) {
      pendingAbort.abort();
      pendingAbort = null;
    }
    if (pendingSpinnerRaf !== null) {
      cancelAnimationFrame(pendingSpinnerRaf);
      pendingSpinnerRaf = null;
    }
    clearPendingAnnouncement();
    // Clear stale map state — will be set again when provider resolves or sync path completes
    resolvedMapGeometry = null;
    lastMapAvailable = false;

    // Always destroy previous renderer first
    if (currentRenderer) {
      currentRenderer.destroy();
      currentRenderer = null;
    }
    if (burgerMenu) {
      burgerMenu.destroy();
      burgerMenu = null;
    }

    const theme = resolveTheme(container, cfg.theme);
    if (cfg.theme?.colorFocusRing) {
      container.style.setProperty('--jsc-color-focus-ring', theme.colorFocusRing);
    } else {
      container.style.removeProperty('--jsc-color-focus-ring');
    }

    // Validate
    const validation = validateDataset(ds);
    if (!validation.valid) {
      container.innerHTML = '';
      renderError(container, validation.errors[0].message, theme);
      return;
    }

    const activeCategoryCodes = getActiveSelectableCategoryCodes(ds, cfg, currentSelectableSelections);

    // Derive data properties
    const dataProps = deriveDataProperties(ds);

    // Resolve locale once
    const resolvedLocale = resolveLocale(
      cfg.locale,
      typeof navigator === 'undefined' ? undefined : navigator.language,
    );

    // Derive dimension meta
    const dimMeta = deriveDimensionMeta(ds);

    // Check if async map provider resolution is needed
    const geoDimId = ds.role?.geo?.find(id => {
      const idx = ds.id.indexOf(id);
      return idx >= 0 && ds.size[idx] > 1;
    }) ?? ds.role?.geo?.[0];

    const hasGeo = !!geoDimId;
    const hasMapProvider = typeof cfg.mapProvider === 'function';

    // Early validation: explicit map type without provider
    if ((cfg.chartType === 'map' || chartTypeOverride === 'map') && !hasMapProvider) {
      container.innerHTML = '';
      throw new Error('[JsonStatChart] Map chart requires config.mapProvider');
    }

    const explicitType = chartTypeOverride ?? cfg.chartType;
    const timeDimForMap = dimMeta.find(d => d.type === 'Time');
    const mapTimeConstraintOk = timeDimForMap?.size === 1;
    let needsMapResolution = false;
    if (hasGeo && hasMapProvider) {
      if (explicitType === 'map') {
        needsMapResolution = true;
      } else if (explicitType === undefined && mapTimeConstraintOk) {
        // In auto mode, only call the provider if map would be selected
        // assuming geometry is available. Avoids unnecessary async work
        // when a higher-priority chart type (e.g. horizontalBar) will win.
        const bestCase = selectDefaultChartType(dataProps, dimMeta, { mapAvailable: true });
        needsMapResolution = bestCase === 'map';
      }
    }

    if (needsMapResolution) {
      // Async path: resolve map provider
      const dim = ds.dimension[geoDimId!];
      const geoCodes = activeCategoryCodes[geoDimId!] ?? getOrderedCodes(dim.category.index);
      const timeCode = timeDimForMap
        ? (activeCategoryCodes[timeDimForMap.code] ?? getOrderedCodes(ds.dimension[timeDimForMap.code].category.index))[0]
        : undefined;

      const abort = new AbortController();
      pendingAbort = abort;

      // Defer spinner insertion via rAF — if provider resolves before rAF fires,
      // the spinner is never inserted (no flicker for cached/preloaded maps)
      container.innerHTML = '';
      if (cfg.height) {
        container.style.height = `${cfg.height}px`;
      }
      const loadingLabel = getLoadingLabel(resolvedLocale);
      pendingSpinnerRaf = requestAnimationFrame(() => {
        pendingSpinnerRaf = null;
        if (currentGen !== generation || destroyed) return;
        renderLoadingIndicator(container, theme, loadingLabel);
      });

      cfg.mapProvider!(geoDimId!, geoCodes, abort.signal, timeCode)
        .then(geometry => {
          if (currentGen !== generation || destroyed) return;
          pendingAbort = null;
          if (pendingSpinnerRaf !== null) {
            cancelAnimationFrame(pendingSpinnerRaf);
            pendingSpinnerRaf = null;
          }

          let effectiveCfg = cfg;
          let mapAvailable = false;
          if (geometry) {
            effectiveCfg = { ...cfg, map: { ...(cfg.map ?? {}), geoDimensionId: geoDimId! } };
            resolvedMapGeometry = geometry;
            mapAvailable = true;
          } else if (cfg.chartType === 'map' || chartTypeOverride === 'map') {
            // Provider returned null but map was explicitly requested — fall back
            console.warn('[JsonStatChart] mapProvider returned null for explicit map chart type, falling back');
            if (chartTypeOverride === 'map') chartTypeOverride = null;
            effectiveCfg = { ...cfg, chartType: undefined };
          }

          lastMapAvailable = mapAvailable;
          try {
            container.innerHTML = '';
            finishRebuild(ds, effectiveCfg, dataProps, dimMeta, resolvedLocale, theme, mapAvailable);
            announceChartLoaded();
          } catch (err) {
            console.warn('[JsonStatChart]', err);
            renderError(container, err instanceof Error ? err.message : 'An unexpected error occurred', theme);
          }
        })
        .catch(err => {
          if (currentGen !== generation || destroyed) return;
          pendingAbort = null;
          if (pendingSpinnerRaf !== null) {
            cancelAnimationFrame(pendingSpinnerRaf);
            pendingSpinnerRaf = null;
          }
          console.warn('[JsonStatChart] mapProvider failed:', err);

          if (chartTypeOverride === 'map') chartTypeOverride = null;
          const catchCfg = (cfg.chartType === 'map') ? { ...cfg, chartType: undefined } : cfg;
          lastMapAvailable = false;
          try {
            container.innerHTML = '';
            finishRebuild(ds, catchCfg, dataProps, dimMeta, resolvedLocale, theme, false);
            announceChartLoaded();
          } catch (finishErr) {
            console.warn('[JsonStatChart]', finishErr);
            renderError(container, finishErr instanceof Error ? finishErr.message : 'An unexpected error occurred', theme);
          }
        });

      return; // Exit — rendering happens in the callback
    }

    // Sync path
    lastMapAvailable = false;
    resolvedMapGeometry = null;
    const syncCfg = cfg;
    container.innerHTML = '';
    finishRebuild(ds, syncCfg, dataProps, dimMeta, resolvedLocale, theme, false);
  }

  function finishRebuild(
    ds: JsonStatDataset,
    cfg: ChartConfig,
    dataProps: DataProperties,
    dimMeta: DimensionMeta[],
    resolvedLocale: string,
    theme: ResolvedTheme,
    mapAvailable: boolean,
  ): void {
    // Select chart type
    const resolvedType = chartTypeOverride ?? cfg.chartType
      ?? selectDefaultChartType(dataProps, dimMeta, { mapAvailable });

    // keyFigure requires single-cell data; fall back to table otherwise
    const activeCategoryCodes = getActiveSelectableCategoryCodes(ds, cfg, currentSelectableSelections);
    const selectableOptions = resolveSelectableDatasetOptions(ds, cfg, currentSelectableSelections);
    const activeDataset = hasSelectableDatasetOptions(selectableOptions)
      ? rebuildDataset(ds, selectableOptions).dataset
      : ds;
    const hasExplicitType = chartTypeOverride !== null || cfg.chartType !== undefined;
    const effectiveType: ChartType = !hasExplicitType && resolvedType === 'keyFigure' && !isKeyFigureCompatible(ds, activeCategoryCodes)
      ? 'table'
      : resolvedType;
    if (!hasExplicitType) validateRendererSelectableDimensions(ds, cfg, currentSelectableSelections, effectiveType);

    // Set container height if specified
    if (cfg.height) {
      container.style.height = `${cfg.height}px`;
    }

    // Auto header building
    const resolvedConfig = { ...cfg };
    resolvedConfig.accessibilityMode = accessibilityMode;
    resolvedConfig.locale = resolvedLocale;
    if (resolvedConfig.showHeader === undefined) resolvedConfig.showHeader = true;
    if (resolvedConfig.showHeader && resolvedConfig.title === undefined) {
      if (resolvedConfig.autoTitle !== false) {
        const titleDimensions = getAutoTitleDimensions(ds, cfg, currentSelectableSelections, dimMeta);
        const headerResult = buildHeader(titleDimensions, { locale: resolvedLocale });
        const autoTitle = headerResult.header.trim();
        resolvedConfig.title = autoTitle || ds.label || '';
      } else if (ds.label) {
        resolvedConfig.title = ds.label;
      }
    }

    // Auto-populate footer from dataset metadata
    const strings = getLocaleStrings(resolvedLocale);

    // Auto-populate unit from content dimension only when explicitly requested.
    const hasUnit = resolvedConfig.footerItems?.some(f => f.type === 'unit');
    if (resolvedConfig.showUnit && !hasUnit && effectiveType !== 'keyFigure') {
      const metricDimId = activeDataset.role?.metric?.[0] ??
        activeDataset.id.find(dimId => activeDataset.dimension[dimId].category.unit != null);
      if (metricDimId) {
        const metricDim = activeDataset.dimension[metricDimId];
        const codes = getOrderedCodes(metricDim.category.index);
        const unitEntries: { valueName: string; unitLabel: string }[] = [];
        for (const code of codes) {
          const unitInfo = metricDim.category.unit?.[code];
          if (unitInfo?.label) {
            unitEntries.push({
              valueName: metricDim.category.label?.[code] ?? code,
              unitLabel: unitInfo.label,
            });
          }
        }
        if (unitEntries.length > 0) {
          let unitText: string;
          if (unitEntries.length === 1) {
            unitText = unitEntries[0].unitLabel;
          } else {
            unitText = unitEntries.map(e => `${e.valueName}: ${e.unitLabel}`).join(', ');
          }
          resolvedConfig.footerItems = [
            { type: 'unit' as const, label: `${strings.unit}:`, value: unitText },
            ...(resolvedConfig.footerItems ?? []),
          ];
        }
      }
    }

    const resolvedSource = resolveDatasetSource(activeDataset);
    const hasSource = resolvedConfig.footerItems?.some(f => f.type === 'source');
    if (resolvedSource && !hasSource) {
      resolvedConfig.footerItems = [
        ...(resolvedConfig.footerItems ?? []),
        { type: 'source' as const, label: `${strings.source}:`, value: resolvedSource },
      ];
    }

    const hasUpdated = resolvedConfig.footerItems?.some(f => f.type === 'updated');
    if (ds.updated && !hasUpdated) {
      const date = new Date(ds.updated);
      let updatedText: string;
      if (!Number.isNaN(date.getTime())) {
        updatedText = date.toLocaleDateString(resolvedLocale, {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          timeZone: 'UTC',
        });
      } else {
        updatedText = ds.updated;
      }
      resolvedConfig.footerItems = [
        ...(resolvedConfig.footerItems ?? []),
        { type: 'updated' as const, label: `${strings.updated}:`, value: updatedText },
      ];
    }

    // Create renderer
    const timeSeriesLabels = computeTimeSeriesLabels(dimMeta, ds, resolvedConfig.layout?.columns[0]);
    currentRenderer = createRenderer(
      effectiveType,
      container,
      activeDataset,
      resolvedConfig,
      selectableOptions,
      cfg.showBurgerMenu !== false,
      timeSeriesLabels,
      resolvedMapGeometry ?? undefined,
    );

    // Store state
    currentChartType = effectiveType;
    if (isChartVisualizationType(effectiveType)) {
      chartModeType = effectiveType;
    }

    const canToggleTableMode = isChartVisualizationType(effectiveType) || (effectiveType === 'table' && chartModeType !== null);
    const tableToggle = canToggleTableMode
      ? {
          tableMode: effectiveType === 'table',
          toggleHandler: () => {
            if (currentChartType === 'table') {
              if (chartModeType !== null) {
                applyChartTypeOverride(chartModeType);
              }
              return;
            }
            applyChartTypeOverride('table');
          },
        }
      : undefined;

    const canToggleAccessibilityMode = isChartVisualizationType(effectiveType) && effectiveType !== 'scatterPlot' && effectiveType !== 'map';

    if (cfg.showBurgerMenu !== false) {
      burgerMenu = new BurgerMenu({
        container,
        dataset: activeDataset,
        chartType: effectiveType,
        locale: resolvedLocale,
        theme,
        accessibilityMode,
        toggleAccessibilityMode: canToggleAccessibilityMode
          ? () => {
              accessibilityMode = !accessibilityMode;
              currentConfig = { ...currentConfig, accessibilityMode };
              rebuildPipeline(currentDataset, currentConfig);
            }
          : undefined,
        menuItemDefinitions: cfg.menuItemDefinitions,
        menuIconInheritColor: cfg.menuIconInheritColor,
        layout: selectableOptions.layout,
        tableToggle,
      });
    }
  }

  try {
    rebuildPipeline(dataset, currentConfig);
  } catch (err) {
    console.warn('[JsonStatChart]', err);
    const theme = resolveTheme(container, currentConfig.theme);
    renderError(
      container,
      err instanceof Error ? err.message : 'An unexpected error occurred',
      theme,
    );
  }

  return {
    update(newDataset: JsonStatDataset, newConfig?: ChartConfig, newSelectableSelections?: SelectableSelections): void {
      if (destroyed) return;
      currentDataset = newDataset;
      if (newConfig !== undefined) {
        currentConfig = newConfig;
        if (newConfig.accessibilityMode !== undefined) {
          accessibilityMode = newConfig.accessibilityMode;
        }
        if (newConfig.chartType !== undefined) {
          chartTypeOverride = newConfig.chartType;
        }
      }
      if (newSelectableSelections !== undefined) {
        currentSelectableSelections = newSelectableSelections;
      }
      try {
        rebuildPipeline(currentDataset, currentConfig);
      } catch (err) {
        console.warn('[JsonStatChart]', err);
        const theme = resolveTheme(container, currentConfig.theme);
        renderError(
          container,
          err instanceof Error ? err.message : 'An unexpected error occurred',
          theme,
        );
      }
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      // Cancel pending map resolution
      if (pendingAbort) {
        pendingAbort.abort();
        pendingAbort = null;
      }
      if (pendingSpinnerRaf !== null) {
        cancelAnimationFrame(pendingSpinnerRaf);
        pendingSpinnerRaf = null;
      }
      clearPendingAnnouncement();
      if (currentRenderer) {
        currentRenderer.destroy();
        currentRenderer = null;
      }
      if (burgerMenu) {
        burgerMenu.destroy();
        burgerMenu = null;
      }
      container.innerHTML = '';
    },

    setChartType(type: ChartType): void {
      applyChartTypeOverride(type);
    },

    getChartType(): ChartType {
      return currentChartType;
    },

    getApplicableChartTypes(): ChartTypeResult[] {
      if (destroyed) return [];
      const dataProps = deriveDataProperties(currentDataset);
      const dimMeta = deriveDimensionMeta(currentDataset);
      return getApplicableChartTypes(dataProps, dimMeta, { mapAvailable: lastMapAvailable });
    },
  };
}
