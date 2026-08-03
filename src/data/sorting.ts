import { ChartData, DataSeries } from '../types';

export const NO_SORTING = 'no_sorting';
export const REVERSED = 'reversed';
export const SUM = 'sum';
export const ASCENDING = 'ascending';
export const DESCENDING = 'descending';

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
 * Reorders category (and parallel series-point) order per the `sorting` visualization setting.
 * Unrecognized values are interpreted as a series `.code` to sort against (falls back to a no-op
 * if no series matches).
 */
export function applySorting(data: ChartData, sorting: string | undefined | null, isPercent: boolean): ChartData {
  if (!sorting || sorting === NO_SORTING) return data;

  const indices = data.categories.map((_, i) => i);

  if (sorting === REVERSED) {
    const reversedIndices = indices.slice().reverse();
    return reorderCategories(data, reversedIndices);
  }

  let valueAt: (catIndex: number) => number;

  if (sorting === SUM) {
    valueAt = catIndex => categoryTotal(data, catIndex);
  } else if (sorting === ASCENDING || sorting === DESCENDING) {
    const firstSeries = data.series[0];
    valueAt = catIndex => firstSeries?.points[catIndex]?.value ?? 0;
  } else {
    const referenceSeries = data.series.find(s => s.code === sorting);
    if (!referenceSeries) return data;
    valueAt = isPercent
      ? catIndex => {
          const total = categoryTotal(data, catIndex);
          return total === 0 ? 0 : ((referenceSeries.points[catIndex]?.value ?? 0) / total) * 100;
        }
      : catIndex => referenceSeries.points[catIndex]?.value ?? 0;
  }

  const ascending = sorting === ASCENDING;
  const sortedIndices = [...indices].sort((a, b) => (ascending ? valueAt(a) - valueAt(b) : valueAt(b) - valueAt(a)));
  return reorderCategories(data, sortedIndices);
}
