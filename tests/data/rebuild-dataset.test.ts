import { rebuildDataset } from '../../src/data/rebuild-dataset';
import { getOrderedCodes } from '../../src/data/dataset-utils';
import type { JsonStatDataset } from '../../src/types';

const dataset: JsonStatDataset = {
  version: '2.0',
  class: 'dataset',
  label: 'Example',
  source: 'Test source',
  updated: '2025-01-01',
  id: ['Region', 'Metric', 'Year'],
  size: [3, 2, 3],
  dimension: {
    Year: {
      label: 'Year',
      category: {
        index: ['2022', '2023', '2024'],
        label: { '2022': '2022', '2023': '2023', '2024': '2024*' },
      },
    },
    Region: {
      label: 'Region',
      extension: { kind: 'geography' },
      category: {
        index: { N: 0, C: 1, S: 2 },
        label: { N: 'North', C: 'Central', S: 'South' },
      },
    },
    Metric: {
      label: 'Metric',
      category: {
        index: ['A', 'B'],
        label: { A: 'Alpha', B: 'Beta' },
        unit: {
          A: { label: 'items', decimals: 0 },
          B: { label: 'items', decimals: 2 },
        },
      },
    },
  },
  value: Array.from({ length: 18 }, (_, index) => index === 5 ? null : index === 17 ? '..' : index),
  extension: {
    custom: { preserved: true },
    selectableConfig: { selectableSelections: { Metric: ['B'] } },
  },
  role: { geo: ['Region'], metric: ['Metric'], time: ['Year'] },
};

describe('rebuildDataset', () => {
  it('filters categories and permutes all dimensions using dataset.id as source order', () => {
    const rebuilt = rebuildDataset(dataset, {
      layout: { rows: ['Year'], columns: ['Region'] },
      selectableSelections: { Region: ['S', 'N'], Metric: ['B'], Year: ['2023', '2024'] },
    }).dataset;

    expect(rebuilt.id).toEqual(['Year', 'Region', 'Metric']);
    expect(rebuilt.size).toEqual([2, 2, 1]);
    expect(rebuilt.value).toEqual([4, 16, null, '..']);
    expect(getOrderedCodes(rebuilt.dimension.Region.category.index)).toEqual(['N', 'S']);
    expect(getOrderedCodes(rebuilt.dimension.Year.category.index)).toEqual(['2023', '2024']);
  });

  it('keeps omitted multi-value dimensions after declared layout dimensions', () => {
    const rebuilt = rebuildDataset(dataset, {
      layout: { rows: ['Region'], columns: ['Year'] },
      selectableSelections: { Metric: ['B', 'A'] },
    }).dataset;

    expect(rebuilt.id).toEqual(['Region', 'Year', 'Metric']);
    expect(rebuilt.size).toEqual([3, 3, 2]);
    expect(getOrderedCodes(rebuilt.dimension.Metric.category.index)).toEqual(['A', 'B']);
    expect(rebuilt.value).toEqual([
      0, 3, 1, 4, 2, null,
      6, 9, 7, 10, 8, 11,
      12, 15, 13, 16, 14, '..',
    ]);
  });

  it('preserves source dimension order when layout is absent', () => {
    const rebuilt = rebuildDataset(dataset, {
      selectableSelections: { Metric: ['A'] },
      defaultSelectableSelections: { Year: [] },
    }).dataset;

    expect(rebuilt.id).toEqual(dataset.id);
    expect(rebuilt.size).toEqual([3, 1, 1]);
    expect(rebuilt.value).toEqual([2, 8, 14]);
  });

  it('preserves roles and filtered metadata while consuming selectable configuration', () => {
    const rebuilt = rebuildDataset(dataset, {
      selectableSelections: { Region: ['N', 'S'], Metric: ['B'], Year: ['2024'] },
    }).dataset;

    expect(rebuilt.role).toEqual(dataset.role);
    expect(rebuilt.extension).toEqual({ custom: { preserved: true } });
    expect(rebuilt.dimension.Region.extension).toEqual({ kind: 'geography' });
    expect(rebuilt.dimension.Metric.category.label).toEqual({ B: 'Beta' });
    expect(rebuilt.dimension.Metric.category.unit).toEqual({ B: { label: 'items', decimals: 2 } });
    expect(rebuilt.value).toEqual([null, '..']);
  });

  it('does not mutate the source dataset', () => {
    const snapshot = JSON.parse(JSON.stringify(dataset)) as JsonStatDataset;

    rebuildDataset(dataset, {
      layout: { rows: ['Year'], columns: ['Region'] },
      selectableSelections: { Metric: ['B'] },
    });

    expect(dataset).toEqual(snapshot);
  });

  it('produces one value per coordinate in the rebuilt N-dimensional shape', () => {
    const rebuilt = rebuildDataset(dataset, {
      layout: { rows: ['Year'], columns: ['Region'] },
      selectableSelections: { Metric: ['A'] },
    }).dataset;

    expect(rebuilt.value).toHaveLength(rebuilt.size.reduce((product, size) => product * size, 1));
  });
});