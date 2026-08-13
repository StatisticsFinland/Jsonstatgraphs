import { applySorting } from '../../src/data/sorting';
import { ChartData } from '../../src/types';

function makeData(): ChartData {
  return {
    categories: ['c1', 'c2', 'c3'],
    categoryLabels: ['Cat 1', 'Cat 2', 'Cat 3'],
    series: [
      { name: 'A', code: 'A', points: [
        { value: 10, label: 'Cat 1', categoryCode: 'c1' },
        { value: 30, label: 'Cat 2', categoryCode: 'c2' },
        { value: 20, label: 'Cat 3', categoryCode: 'c3' },
      ] },
      { name: 'B', code: 'B', points: [
        { value: 5, label: 'Cat 1', categoryCode: 'c1' },
        { value: null, label: 'Cat 2', categoryCode: 'c2' },
        { value: 100, label: 'Cat 3', categoryCode: 'c3' },
      ] },
    ],
  };
}

describe('applySorting', () => {
  it('returns the data unchanged for undefined/null sorting', () => {
    const data = makeData();
    expect(applySorting(data, undefined, false)).toBe(data);
    expect(applySorting(data, null, false)).toBe(data);
  });

  it('returns the data unchanged for no_sorting', () => {
    const data = makeData();
    expect(applySorting(data, 'no_sorting', false)).toBe(data);
  });

  it('reverses category order for reversed', () => {
    const result = applySorting(makeData(), 'reversed', false);
    expect(result.categories).toEqual(['c3', 'c2', 'c1']);
    expect(result.series[0].points.map(p => p.value)).toEqual([20, 30, 10]);
    expect(result.series[1].points.map(p => p.value)).toEqual([100, null, 5]);
  });

  it('sorts categories descending by summed series values for sum (nulls as 0)', () => {
    // sums: c1=15, c2=30 (null treated as 0), c3=120
    const result = applySorting(makeData(), 'sum', false);
    expect(result.categories).toEqual(['c3', 'c2', 'c1']);
  });

  it('sorts categories by series[0] values for ascending', () => {
    // series[0] values: c1=10, c2=30, c3=20
    const result = applySorting(makeData(), 'ascending', false);
    expect(result.categories).toEqual(['c1', 'c3', 'c2']);
  });

  it('sorts categories by series[0] values for descending', () => {
    const result = applySorting(makeData(), 'descending', false);
    expect(result.categories).toEqual(['c2', 'c3', 'c1']);
  });

  it('sorts categories descending by a matched series code (value-code sorting)', () => {
    // series B values: c1=5, c2=null(0), c3=100
    const result = applySorting(makeData(), 'B', false);
    expect(result.categories).toEqual(['c3', 'c1', 'c2']);
    // series array order and colors are left untouched
    expect(result.series.map(s => s.code)).toEqual(['A', 'B']);
  });

  it('sorts by percentage-of-category-total when isPercent is true', () => {
    // percentages of B within each category total: c1=5/15=33%, c2=0/30=0%, c3=100/120=83%
    const result = applySorting(makeData(), 'B', true);
    expect(result.categories).toEqual(['c3', 'c1', 'c2']);
  });

  it('returns the data unchanged when the sorting code matches no series', () => {
    const data = makeData();
    expect(applySorting(data, 'unknown-code', false)).toBe(data);
  });

  it('prioritizes a matching series for grouped horizontal bars', () => {
    const data = makeData();
    const result = applySorting(data, 'B', false, 'groupedHorizontalBar');

    expect(result.categories).toEqual(data.categories);
    expect(result.series.map(series => series.code)).toEqual(['B', 'A']);
    expect(result.series[0].points.map(point => point.categoryCode)).toEqual(['c1', 'c2', 'c3']);
    expect(result.series[1].points.map(point => point.categoryCode)).toEqual(['c1', 'c2', 'c3']);
  });

  it('retains reference-series category sorting for other chart types', () => {
    const result = applySorting(makeData(), 'B', false, 'groupedVerticalBar');

    expect(result.categories).toEqual(['c3', 'c1', 'c2']);
    expect(result.series.map(series => series.code)).toEqual(['A', 'B']);
  });
});
