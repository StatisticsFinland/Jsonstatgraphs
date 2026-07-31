import { JsonStatDataset } from '../types';

export function product(values: number[]): number {
  return values.reduce((acc, value) => acc * value, 1);
}

export function decodeCombo(comboIdx: number, sizes: number[]): number[] {
  const indices: number[] = new Array(sizes.length);
  let remaining = comboIdx;
  for (let i = sizes.length - 1; i >= 0; i--) {
    indices[i] = remaining % sizes[i];
    remaining = Math.floor(remaining / sizes[i]);
  }
  return indices;
}

export function getMetricUnit(dataset: JsonStatDataset): string | null {
  const metricCodes = dataset.role?.metric ?? dataset.id;
  for (const dimCode of metricCodes) {
    const dim = dataset.dimension[dimCode];
    if (!dim?.category?.unit) continue;
    const unitEntries = Object.values(dim.category.unit);
    const unitLabel = unitEntries.find(entry => entry?.label)?.label;
    if (unitLabel) return unitLabel;
  }
  return null;
}
