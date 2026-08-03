import { resolveSelectableDatasetOptions } from '../../src/data/selectable-settings';
import type { JsonStatDataset } from '../../src/types';

const dataset: JsonStatDataset = {
  id: ['Region', 'Year'],
  size: [2, 2],
  dimension: {
    Region: { category: { index: ['N', 'S'] } },
    Year: { category: { index: ['2023', '2024'] } },
  },
  value: [1, 2, 3, 4],
};

describe('resolveSelectableDatasetOptions', () => {
  it('rejects unknown selection codes at the input boundary', () => {
    expect(() => resolveSelectableDatasetOptions(dataset, {}, { Missing: ['N'] })).toThrow('Unknown dimension code');
    expect(() => resolveSelectableDatasetOptions(dataset, {}, { Region: ['X'] })).toThrow('Unknown category code');
    expect(() => resolveSelectableDatasetOptions(dataset, {}, { Region: 'N' } as unknown as Record<string, string[]>)).toThrow('must be an array');
  });

  it('rejects invalid layout codes, duplicates, and overlap at the input boundary', () => {
    expect(() => resolveSelectableDatasetOptions(dataset, { layout: { rows: ['Missing'], columns: [] } })).toThrow('Unknown dimension code');
    expect(() => resolveSelectableDatasetOptions(dataset, { layout: { rows: ['Region', 'Region'], columns: [] } })).toThrow('Duplicate dimension code');
    expect(() => resolveSelectableDatasetOptions(dataset, { layout: { rows: ['Region'], columns: ['Region'] } })).toThrow('appears in both rows and columns');
  });

  it('rejects malformed layout and dataset selectable inputs at the input boundary', () => {
    expect(() => resolveSelectableDatasetOptions(dataset, {
      layout: { rows: 'Region', columns: [] } as unknown as { rows: string[]; columns: string[] },
    })).toThrow('layout must define rows and columns arrays');
    expect(() => resolveSelectableDatasetOptions({
      ...dataset,
      extension: { selectableConfig: [] as unknown as undefined },
    })).toThrow('extension.selectableConfig must be an object');
  });
});