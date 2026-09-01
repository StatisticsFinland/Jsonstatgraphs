import { ChartData, ChartType, DataSeries } from '../types';

export const NO_SORTING = 'no_sorting';
export const REVERSED = 'reversed';
export const SUM = 'sum';
export const ASCENDING = 'ascending';
export const DESCENDING = 'descending';
const SORTABLE_CHART_TYPES: ChartType[] = [
  'horizontalBar',
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
  'pie',
];
const SERIES_PRIORITY_CHART_TYPES: ChartType[] = [
  'groupedHorizontalBar',
  'stackedHorizontalBar',
  'percentHorizontalBar',
];

function reorderCategories(data: ChartData, order: number[]): ChartData {
  return {
    ...data,
    categories: order.map(i => data.categories[i]),
    categoryLabels: order.map(i => data.categoryLabels[i]),
    series: data.series.map((s): DataSeries => ({ ...s, points: order.map(i => s.points[i]) })),
  };
}

function categoryTotal(data: ChartData, catIndex: number): number {
  return data.series.reduce((sum, s) => sum + (s.points[catIndex]?.value ?? 0), 0);
}

/**
 * Reorders supported horizontal/pie chart data per the `sorting` visualization setting.
 * Series codes are interpreted only for grouped, stacked, and percent horizontal bars.
 */
export function applySorting(
  data: ChartData,
  sorting: string | undefined | null,
  isPercent: boolean,
  chartType?: ChartType
): ChartData {
  if (!sorting || sorting === NO_SORTING || !chartType || !SORTABLE_CHART_TYPES.includes(chartType)) return data;

  const isKeyword =
    sorting === REVERSED ||
    sorting === SUM ||
    sorting === ASCENDING ||
    sorting === DESCENDING;
  if (!isKeyword && (chartType === 'horizontalBar' || chartType === 'pie')) return data;

  let sortedData = data;
  if (
    !isKeyword &&
    SERIES_PRIORITY_CHART_TYPES.includes(chartType) &&
    data.series.some(series => series.code === sorting)
  ) {
    const selectedSeries = data.series.find(series => series.code === sorting);
    if (!selectedSeries) return data;
    sortedData = {
      ...data,
      series: [selectedSeries, ...data.series.filter(series => series !== selectedSeries)],
    };
  }

  const indices = sortedData.categories.map((_, i) => i);

  if (sorting === REVERSED) {
    const reversedIndices = indices.slice().reverse();
    return reorderCategories(sortedData, reversedIndices);
  }

  let valueAt: (catIndex: number) => number;

  if (sorting === SUM) {
    valueAt = catIndex => categoryTotal(sortedData, catIndex);
  } else if (sorting === ASCENDING || sorting === DESCENDING) {
    const firstSeries = sortedData.series[0];
    valueAt = catIndex => firstSeries?.points[catIndex]?.value ?? 0;
  } else {
    const referenceSeries = sortedData.series.find(s => s.code === sorting);
    if (!referenceSeries) return data;
    valueAt = isPercent
      ? catIndex => {
          const total = categoryTotal(sortedData, catIndex);
          return total === 0 ? 0 : ((referenceSeries.points[catIndex]?.value ?? 0) / total) * 100;
        }
      : catIndex => referenceSeries.points[catIndex]?.value ?? 0;
  }

  const ascending = sorting === ASCENDING;
  const sortedIndices = [...indices].sort((a, b) => (ascending ? valueAt(a) - valueAt(b) : valueAt(b) - valueAt(a)));
  return reorderCategories(sortedData, sortedIndices);
}
