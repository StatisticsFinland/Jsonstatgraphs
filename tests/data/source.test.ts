import { resolveDatasetSource } from '../../src/data/source';
import { rebuildDataset } from '../../src/data/rebuild-dataset';
import type { JsonStatDataset } from '../../src/types';

const dataset: JsonStatDataset = {
  source: 'Table source',
  id: ['MetricA', 'MetricB'],
  size: [2, 2],
  dimension: {
    MetricA: {
      category: { index: ['a1', 'a2'] },
    },
    MetricB: {
      category: { index: { b1: 0, b2: 1 } },
    },
  },
  value: [1, 2, 3, 4],
  role: { metric: ['MetricA', 'MetricB'] },
  extension: {
    jsonstatChart: {
      sources: {
        dimension: { MetricA: 'Dimension A source', MetricB: 'Dimension B source' },
        category: {
          MetricA: { a1: 'Category A1 source', a2: 'Dimension A source' },
          MetricB: { b1: 'Category B1 source' },
        },
      },
    },
  },
};

describe('resolveDatasetSource', () => {
  it('resolves category, dimension, and dataset sources in stable order without duplicates', () => {
    expect(resolveDatasetSource(dataset)).toBe(
      'Category A1 source, Dimension A source, Category B1 source, Dimension B source',
    );
  });

  it('falls back to the dataset source when no content metadata is present', () => {
    const datasetWithoutExtension = {
      ...dataset,
      extension: undefined,
      role: { metric: ['MetricA'] },
    };
    expect(resolveDatasetSource(datasetWithoutExtension)).toBe('Table source');
  });

  it('uses only active category codes from a rebuilt dataset', () => {
    const activeDataset = rebuildDataset(dataset, {
      selectableSelections: { MetricA: ['a2'] },
    }).dataset;
    expect(resolveDatasetSource(activeDataset)).toBe(
      'Dimension A source, Category B1 source, Dimension B source',
    );
  });
});